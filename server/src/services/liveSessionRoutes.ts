import type { IncomingMessage, ServerResponse } from 'node:http';
import type { LiveSessionService, SubmitCorrectionOptions } from './liveSessionService.js';
import type { LiveAnnotation, BodyPartId } from '../../../core/out/index.js';

const sendJson = (response: ServerResponse, status: number, body: unknown) => {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(body));
};

export async function liveSessionRoutes(
  request: IncomingMessage,
  response: ServerResponse,
  service: LiveSessionService,
  readBody: () => Promise<unknown>,
): Promise<boolean> {
  const requestUrl = new URL(request.url ?? '/', 'http://localhost');
  const pathname = requestUrl.pathname;
  if (!pathname.startsWith('/api/')) return false;

  // Characters endpoints
  if (request.method === 'GET' && pathname === '/api/characters') {
    sendJson(response, 200, {
      characters: service.getCharacters(),
      tombstones: service.getTombstones(),
    });
    return true;
  }

  const charMatch = pathname.match(/^\/api\/characters\/([a-zA-Z0-9_-]+)$/);
  if (request.method === 'GET' && charMatch) {
    const character = service.getCharacter(charMatch[1]);
    if (!character) {
      sendJson(response, 404, { error: `Character "${charMatch[1]}" not found.` });
      return true;
    }
    sendJson(response, 200, { character });
    return true;
  }

  // Live sessions list & creation
  if (request.method === 'GET' && pathname === '/api/live-sessions') {
    sendJson(response, 200, { sessions: service.listSessions() });
    return true;
  }

  if (request.method === 'POST' && pathname === '/api/live-sessions') {
    try {
      const body = (await readBody()) as {
        characterId?: string;
        characterRevision?: string;
        tool?: string;
        specialist?: string;
        stage?: string;
      };
      const session = service.createSession({
        characterId: body.characterId ?? 'yun_urban_adventurer',
        characterRevision: body.characterRevision,
        tool: (body.tool as any) ?? 'blender',
        specialist: body.specialist,
        stage: body.stage,
      });
      sendJson(response, 201, { session });
    } catch (err: any) {
      sendJson(response, 400, { error: err.message });
    }
    return true;
  }

  // SSE Event Stream: /api/live-sessions/:id/events
  const eventsMatch = pathname.match(/^\/api\/live-sessions\/([a-zA-Z0-9_-]+)\/events$/);
  if (request.method === 'GET' && eventsMatch) {
    const sessionId = eventsMatch[1];
    const session = service.getSession(sessionId);
    if (!session) {
      sendJson(response, 404, { error: `Live session "${sessionId}" not found.` });
      return true;
    }

    response.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    response.flushHeaders?.();

    // Send initial session state
    response.write(`event: session-state\ndata: ${JSON.stringify(session)}\n\n`);

    const unsubscribe = service.subscribeEvents(sessionId, (event) => {
      response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    });

    const keepAliveInterval = setInterval(() => {
      response.write(': keepalive\n\n');
    }, 15000);

    request.on('close', () => {
      clearInterval(keepAliveInterval);
      unsubscribe();
    });

    return true;
  }

  // Session state by ID
  const sessionMatch = pathname.match(/^\/api\/live-sessions\/([a-zA-Z0-9_-]+)$/);
  if (request.method === 'GET' && sessionMatch) {
    const session = service.getSession(sessionMatch[1]);
    if (!session) {
      sendJson(response, 404, { error: `Session "${sessionMatch[1]}" not found.` });
      return true;
    }
    sendJson(response, 200, { session });
    return true;
  }

  // Session Control Actions: pause, resume, stop, approve, correct, retry, revert, part, approve-part
  const actionMatch = pathname.match(
    /^\/api\/live-sessions\/([a-zA-Z0-9_-]+)\/(pause|resume|stop|approve|correct|retry|revert|annotations|part|approve-part)$/,
  );
  if (request.method === 'POST' && actionMatch) {
    const sessionId = actionMatch[1];
    const action = actionMatch[2];

    try {
      if (action === 'pause') {
        const session = service.pause(sessionId);
        sendJson(response, 200, { success: true, session });
        return true;
      }
      if (action === 'resume') {
        const session = service.resume(sessionId);
        sendJson(response, 200, { success: true, session });
        return true;
      }
      if (action === 'stop') {
        const session = service.stop(sessionId);
        sendJson(response, 200, { success: true, session });
        return true;
      }
      if (action === 'approve') {
        const body = (await readBody()) as { note?: string };
        const session = service.approve(sessionId, body.note);
        sendJson(response, 200, { success: true, session });
        return true;
      }
      if (action === 'correct') {
        const body = (await readBody()) as SubmitCorrectionOptions;
        if (!body.feedback || typeof body.feedback !== 'string') {
          sendJson(response, 400, { error: 'Feedback text is required for correction.' });
          return true;
        }
        const session = service.correct(sessionId, body);
        sendJson(response, 200, { success: true, session });
        return true;
      }
      if (action === 'retry') {
        const session = service.retry(sessionId);
        sendJson(response, 200, { success: true, session });
        return true;
      }
      if (action === 'revert') {
        const body = (await readBody()) as { revisionId?: string; checkpointId?: string };
        const target = body.revisionId ?? body.checkpointId;
        if (!target) {
          sendJson(response, 400, { error: 'Target revisionId or checkpointId is required.' });
          return true;
        }
        const session = service.revert(sessionId, target);
        sendJson(response, 200, { success: true, session });
        return true;
      }
      if (action === 'part') {
        const body = (await readBody()) as { partId?: BodyPartId };
        if (!body.partId) {
          sendJson(response, 400, { error: 'partId is required.' });
          return true;
        }
        const session = service.setBodyPart(sessionId, body.partId);
        sendJson(response, 200, { success: true, session });
        return true;
      }
      if (action === 'approve-part') {
        const body = (await readBody()) as { note?: string };
        const session = service.approvePartAndNext(sessionId, body.note);
        sendJson(response, 200, { success: true, session });
        return true;
      }
      if (action === 'annotations') {
        const body = (await readBody()) as LiveAnnotation;
        const session = service.addAnnotation(sessionId, body);
        sendJson(response, 200, { success: true, session });
        return true;
      }
    } catch (err: any) {
      sendJson(response, 400, { error: err.message });
      return true;
    }
  }

  return false;
}
