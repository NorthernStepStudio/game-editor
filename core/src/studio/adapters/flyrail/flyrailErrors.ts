/**
 * Structured error mapping for the Flyrail adapter.
 *
 * Maps Flyrail JSON-RPC error codes and common failure patterns to
 * the specialist-agnostic SpecialistErrorCode type.
 */

import { SpecialistError, type SpecialistErrorCode } from "../types.js";

// ── JSON-RPC standard codes ─────────────────────────────────────────

const JSONRPC_PARSE_ERROR = -32700;
const JSONRPC_INVALID_REQUEST = -32600;
const JSONRPC_METHOD_NOT_FOUND = -32601;
const JSONRPC_INVALID_PARAMS = -32602;
const JSONRPC_INTERNAL_ERROR = -32603;
const JSONRPC_APPLICATION_ERROR = -32000;

// ── Error message patterns ──────────────────────────────────────────

const PATTERN_MAP: ReadonlyArray<readonly [RegExp, SpecialistErrorCode, boolean]> = [
  [/unauthorized/i, "PERMISSION_DENIED", false],
  [/permission denied/i, "PERMISSION_DENIED", false],
  [/tool not enabled/i, "PERMISSION_DENIED", false],
  [/unknown method/i, "UNSUPPORTED_CAPABILITY", false],
  [/unknown capability/i, "UNSUPPORTED_CAPABILITY", false],
  [/no project open/i, "PROJECT_UNAVAILABLE", true],
  [/project missing/i, "PROJECT_UNAVAILABLE", true],
  [/godot.*not found/i, "GODOT_UNAVAILABLE", true],
  [/engine.*not found/i, "GODOT_UNAVAILABLE", true],
  [/timeout/i, "TIMEOUT", true],
  [/ECONNREFUSED/i, "SPECIALIST_UNAVAILABLE", true],
  [/ECONNRESET/i, "TRANSPORT_ERROR", true],
  [/EPIPE/i, "TRANSPORT_ERROR", true],
  [/protocol.*mismatch/i, "PROTOCOL_MISMATCH", false],
  [/revision mismatch/i, "EXECUTION_FAILED", true],
  [/test.*fail/i, "TEST_FAILED", true],
  [/validation.*fail/i, "VALIDATION_FAILED", true],
  [/cancel/i, "CANCELLED", false],
  [/max.*attempts/i, "RETRY_EXHAUSTED", false],
  [/budget.*exhaust/i, "RETRY_EXHAUSTED", false],
];

/**
 * Convert a JSON-RPC error code + message into a typed SpecialistError.
 */
export function fromJsonRpcError(
  rpcCode: number,
  message: string,
  data?: unknown,
): SpecialistError {
  // Try pattern matching first — the message is usually more informative.
  for (const [pattern, code, recoverable] of PATTERN_MAP) {
    if (pattern.test(message)) {
      return new SpecialistError(code, message, { recoverable, details: data });
    }
  }

  // Fall back to the JSON-RPC code.
  switch (rpcCode) {
    case JSONRPC_PARSE_ERROR:
    case JSONRPC_INVALID_REQUEST:
    case JSONRPC_INVALID_PARAMS:
      return new SpecialistError("INVALID_TASK", message, { details: data });

    case JSONRPC_METHOD_NOT_FOUND:
      return new SpecialistError("UNSUPPORTED_CAPABILITY", message, {
        details: data,
      });

    case JSONRPC_INTERNAL_ERROR:
      return new SpecialistError("EXECUTION_FAILED", message, {
        recoverable: true,
        details: data,
      });

    case JSONRPC_APPLICATION_ERROR:
      return new SpecialistError("EXECUTION_FAILED", message, {
        recoverable: true,
        details: data,
      });

    default:
      return new SpecialistError("TRANSPORT_ERROR", message, {
        recoverable: true,
        details: data,
      });
  }
}

/**
 * Wrap a transport-level error (connection refused, socket closed, etc.)
 * into a SpecialistError.
 */
export function fromTransportError(error: unknown): SpecialistError {
  const message = error instanceof Error ? error.message : String(error);
  for (const [pattern, code, recoverable] of PATTERN_MAP) {
    if (pattern.test(message)) {
      return new SpecialistError(code, message, { recoverable, details: error });
    }
  }
  return new SpecialistError("TRANSPORT_ERROR", message, {
    recoverable: true,
    details: error,
  });
}
