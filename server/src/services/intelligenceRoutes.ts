import type { IncomingMessage, ServerResponse } from "node:http";
import type { IntelligenceService } from "./intelligenceService.js";

function send(
  response: ServerResponse,
  status: number,
  payload: unknown,
): void {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

export async function intelligenceRoutes(
  request: IncomingMessage,
  response: ServerResponse,
  service: IntelligenceService,
  readBody: () => Promise<unknown>,
): Promise<boolean> {
  const pathname = new URL(
    request.url ?? "/",
    "http://localhost",
  ).pathname;
  if (!pathname.startsWith("/api/intelligence/")) return false;

  if (
    request.method === "GET" &&
    pathname === "/api/intelligence/models"
  ) {
    send(response, 200, { models: service.models() });
    return true;
  }

  if (
    request.method === "POST" &&
    pathname === "/api/intelligence/run"
  ) {
    send(response, 200, await service.run(await readBody()));
    return true;
  }

  if (
    request.method === "GET" &&
    pathname === "/api/intelligence/sessions"
  ) {
    send(response, 200, { sessions: service.listSessions() });
    return true;
  }

  if (
    request.method === "POST" &&
    pathname === "/api/intelligence/sessions"
  ) {
    send(response, 201, await service.startSession(await readBody()));
    return true;
  }

  const sessionMatch =
    /^\/api\/intelligence\/sessions\/([a-f0-9-]{36})(?:\/(messages|approvals))?$/.exec(
      pathname,
    );
  if (sessionMatch) {
    const sessionId = sessionMatch[1];
    const action = sessionMatch[2];

    if (request.method === "GET" && !action) {
      send(response, 200, service.getSession(sessionId));
      return true;
    }

    if (request.method === "POST" && action === "messages") {
      send(
        response,
        200,
        await service.continueSession(
          sessionId,
          await readBody(),
        ),
      );
      return true;
    }

    if (request.method === "POST" && action === "approvals") {
      send(
        response,
        200,
        await service.resolveApprovals(
          sessionId,
          await readBody(),
        ),
      );
      return true;
    }
  }

  send(response, 404, {
    error: "Intelligence route not found.",
  });
  return true;
}
