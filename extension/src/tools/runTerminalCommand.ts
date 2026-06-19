import { spawn } from "node:child_process";
import * as process from "node:process";
import * as vscode from "vscode";

export interface TerminalCommandResult {
  readonly command: string;
  readonly cwd: string;
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
  readonly timedOut: boolean;
}

export async function runTerminalCommand(
  command: string,
  options?: {
    readonly cwd?: string;
    readonly timeoutMs?: number;
  },
): Promise<TerminalCommandResult> {
  const cwd = options?.cwd ?? getDefaultWorkspaceCwd();
  const timeoutMs = options?.timeoutMs ?? 30_000;

  return new Promise<TerminalCommandResult>((resolve) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      windowsHide: true,
      env: process.env,
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let timedOut = false;
    let settled = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.stdout?.on("data", (chunk) => {
      stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    child.stderr?.on("data", (chunk) => {
      stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        command,
        cwd,
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: `${Buffer.concat(stderrChunks).toString("utf8")}${error.message}`,
        exitCode: null,
        timedOut,
      });
    });

    child.on("close", (exitCode) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        command,
        cwd,
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
        exitCode,
        timedOut,
      });
    });
  });
}

export function formatTerminalCommandResult(result: TerminalCommandResult): string {
  const stdout = result.stdout.trimEnd() || "(no stdout)";
  const stderr = result.stderr.trimEnd() || "(no stderr)";

  return [
    `Command: \`${result.command}\``,
    `Working directory: \`${result.cwd}\``,
    `Exit code: \`${result.exitCode ?? "null"}\`${result.timedOut ? " (timed out)" : ""}`,
    "",
    "Stdout:",
    "```text",
    stdout,
    "```",
    "",
    "Stderr:",
    "```text",
    stderr,
    "```",
  ].join("\n");
}

function getDefaultWorkspaceCwd(): string {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    throw new Error("Open a workspace folder before running terminal commands.");
  }

  return workspaceFolder.uri.fsPath;
}
