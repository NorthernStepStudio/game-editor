import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface NssWorkspaceAiServerPortState {
  readonly pid: number;
  readonly port: number;
  readonly startedAt: string;
}

export function resolveDefaultPortStateFilePath(cwd: string = process.cwd()): string {
  return path.resolve(cwd, "..", "..", ".nstep-workspace-ai-server-port.json");
}

export async function writePortStateFile(filePath: string, port: number): Promise<void> {
  const state: NssWorkspaceAiServerPortState = {
    pid: process.pid,
    port,
    startedAt: new Date().toISOString(),
  };

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}
