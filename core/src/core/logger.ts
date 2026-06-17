export interface ResponseOsLogger {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

export function createConsoleLogger(prefix = "m-core"): ResponseOsLogger {
  return {
    debug(message, meta) {
      write("debug", prefix, message, meta);
    },
    info(message, meta) {
      write("info", prefix, message, meta);
    },
    warn(message, meta) {
      write("warn", prefix, message, meta);
    },
    error(message, meta) {
      write("error", prefix, message, meta);
    },
  };
}

export function createNoopLogger(): ResponseOsLogger {
  return {
    debug() {},
    info() {},
    warn() {},
    error() {},
  };
}

function write(level: "debug" | "info" | "warn" | "error", prefix: string, message: string, meta?: unknown): void {
  const formatted = `[${prefix}] ${message}`;
  if (meta === undefined) {
    console[level](formatted);
    return;
  }

  console[level](formatted, meta);
}
