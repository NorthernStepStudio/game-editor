import * as fs from "node:fs";
import * as path from "node:path";

export type ServerUrlSource = "configured" | "workspace-port-file" | "default";

export interface ResolveServerUrlOptions {
  readonly configuredServerUrl: string | undefined;
  readonly workspaceRoot: string | undefined;
  readonly defaultServerUrl: string;
}

export interface ResolvedServerUrl {
  readonly serverUrl: string;
  readonly source: ServerUrlSource;
  readonly portStateFilePath?: string;
}

export function resolveServerUrl(options: ResolveServerUrlOptions): ResolvedServerUrl {
  const configuredServerUrl = trimOptional(options.configuredServerUrl);
  if (configuredServerUrl && configuredServerUrl !== options.defaultServerUrl) {
    return {
      serverUrl: configuredServerUrl,
      source: "configured",
    };
  }

  // Use the workspace root if available, otherwise fallback to the current process CWD or a fixed path
  const searchRoot = options.workspaceRoot ?? process.cwd();
  const portStateFilePath = path.join(searchRoot, ".nstep-workspace-ai-server-port.json");

  const discoveredPort = readPortStateFile(portStateFilePath);
  if (discoveredPort !== undefined) {
    return {
      serverUrl: `http://127.0.0.1:${discoveredPort}`,
      source: "workspace-port-file",
      portStateFilePath,
    };
  }

  return {
    serverUrl: configuredServerUrl ?? options.defaultServerUrl,
    source: "default",
    portStateFilePath,
  };
}

export function readPortStateFile(filePath: string): number | undefined {
  try {
    const raw = fs.readFileSync(filePath, "utf8").trim();
    if (!raw) {
      return undefined;
    }

    const directPort = parsePort(raw);
    if (directPort !== undefined) {
      return directPort;
    }

    const parsed = JSON.parse(raw) as { readonly port?: unknown } | undefined;
    return parsePort(parsed?.port);
  } catch {
    return undefined;
  }
}

function trimOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parsePort(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
  }

  return undefined;
}
