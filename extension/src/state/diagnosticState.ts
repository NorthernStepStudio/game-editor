import type { NssDiagnosticSession } from "../models/diagnostic.types.js";

export function getActiveDiagnosticSession(
  sessions: readonly NssDiagnosticSession[],
  activeSessionId: string | undefined,
): NssDiagnosticSession | undefined {
  if (!activeSessionId) {
    return sessions.find((session) => session.status === "active") ?? sessions[0];
  }

  return sessions.find((session) => session.id === activeSessionId) ?? sessions[0];
}
