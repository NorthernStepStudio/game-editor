import type { IncomingMessage, ServerResponse } from 'node:http';
import type { StudioService } from './studioService.js';
import { listStudioAgents, listStudioSpecialists, STUDIO_WORKFLOW_STAGES } from '@nss/m-core';

const send = (response: ServerResponse, status: number, body: unknown) => {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
};

export async function studioRoutes(
  request: IncomingMessage,
  response: ServerResponse,
  service: StudioService,
  readBody: () => Promise<unknown>,
): Promise<boolean> {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
  if (!pathname.startsWith('/api/')) return false;
  const { controller, adapter } = service;

  if (request.method === 'GET' && pathname === '/api/studio/agents') {
    send(response, 200, listStudioAgents());
    return true;
  }

  if (request.method === 'GET' && pathname === '/api/studio/specialists') {
    send(response, 200, listStudioSpecialists());
    return true;
  }

  if (request.method === 'GET' && pathname === '/api/projects') {
    send(response, 200, service.projects.map(({ id, name }) => ({ id, name })));
    return true;
  }

  if (request.method === 'GET' && pathname === '/api/studio/health') {
    const health = await adapter.health();
    send(response, 200, {
      available: health.available,
      version: health.version,
      storage: 'disk',
      restartRecovery: service.getRecoveryState(),
      cancellationSupported: false,
      executionSpecialist: 'flyrail',
      validatorAgent: 'sentinel',
      workflow: STUDIO_WORKFLOW_STAGES,
    });
    return true;
  }

  if (request.method === 'POST' && pathname === '/api/studio/plan') {
    send(response, 200, service.plan(await readBody()));
    return true;
  }

  if (request.method === 'POST' && pathname === '/api/studio/runs') {
    await service.ensureRecovered();
    send(response, 202, controller.start(service.plan(await readBody())));
    return true;
  }

  if (request.method === 'GET' && pathname === '/api/studio/runs') {
    send(response, 200, controller.store.list());
    return true;
  }

  const match = /^\/api\/studio\/runs\/([a-zA-Z0-9_-]+)(?:\/(cancel|events|evidence))?$/.exec(pathname);
  if (match) {
    const [, id, action] = match;
    const run = controller.store.get(id);
    if (!run) {
      send(response, 404, { error: 'Run not found.' });
      return true;
    }

    if (request.method === 'POST' && action === 'cancel') {
      await service.ensureRecovered();
      send(response, 202, controller.requestCancel(id));
      return true;
    }

    if (request.method === 'GET' && action === 'events') {
      response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      response.write(`data: ${JSON.stringify({ run })}\n\n`);
      const off = controller.store.subscribe(event => {
        if (event.runId === id && !response.destroyed) {
          if (!response.write(`id: ${event.sequence}\ndata: ${JSON.stringify(event)}\n\n`)) response.destroy();
        }
      });
      const timer = setInterval(() => response.write(': heartbeat\n\n'), 15000);
      response.on('close', () => { clearInterval(timer); off(); });
      return true;
    }

    if (request.method === 'GET') {
      send(response, 200, action === 'evidence'
        ? { runId: id, status: run.status, tasks: run.tasks.map(task => ({ id: task.id, detail: task.detail, result: task.result })) }
        : run);
      return true;
    }
  }

  send(response, 404, { error: 'API route not found.' });
  return true;
}
