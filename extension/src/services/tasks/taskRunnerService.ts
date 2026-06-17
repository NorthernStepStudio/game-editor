import * as fs from "node:fs/promises";
import * as path from "node:path";
import { spawn } from "node:child_process";
import * as vscode from "vscode";

import type { NssTaskKind, NssTaskResult } from "../../models/task.types.js";
import { findLikelyErrorFilesFromOutput } from "../codebase/errorFileService.js";

export async function runWorkspaceTask(kind: NssTaskKind): Promise<NssTaskResult> {
  const executionContext = await resolveTaskExecutionContext(kind);
  const startedAt = new Date().toISOString();

  return new Promise<NssTaskResult>((resolve, reject) => {
    const child = spawn(executionContext.command, executionContext.args, {
      cwd: executionContext.cwd,
      shell: false,
      windowsHide: true,
    });

    const stdout: string[] = [];
    const stderr: string[] = [];

    child.stdout.on("data", (chunk) => {
      stdout.push(String(chunk));
    });
    child.stderr.on("data", (chunk) => {
      stderr.push(String(chunk));
    });
    child.on("error", reject);
    child.on("close", async (exitCode) => {
      const combinedStdout = stdout.join("");
      const combinedStderr = stderr.join("");
      const likelyErrorFiles = await findLikelyErrorFilesFromOutput(combinedStderr || combinedStdout);

      resolve({
        id: `task-${Date.now()}`,
        kind,
        commandLine: [executionContext.command, ...executionContext.args].join(" "),
        cwd: executionContext.cwd,
        status: exitCode === 0 ? "succeeded" : "failed",
        exitCode,
        stdout: combinedStdout,
        stderr: combinedStderr,
        summary: exitCode === 0 ? `${kind} completed successfully.` : `${kind} failed with exit code ${exitCode}.`,
        likelyErrorFiles,
        createdAt: startedAt,
        finishedAt: new Date().toISOString(),
      });
    });
  });
}

async function resolveTaskExecutionContext(kind: NssTaskKind): Promise<{ cwd: string; command: string; args: string[] }> {
  const packageDirectory = await findNearestPackageDirectory();
  const packageJsonPath = path.join(packageDirectory, "package.json");
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8")) as {
    scripts?: Record<string, string>;
  };

  if (!packageJson.scripts?.[kind]) {
    throw new Error(`The nearest package.json at ${packageDirectory} does not define an "${kind}" script.`);
  }

  if (process.platform === "win32") {
    return {
      cwd: packageDirectory,
      command: "cmd.exe",
      args: ["/d", "/s", "/c", "npm", "run", kind],
    };
  }

  return {
    cwd: packageDirectory,
    command: "npm",
    args: ["run", kind],
  };
}

async function findNearestPackageDirectory(): Promise<string> {
  const activeFilePath = vscode.window.activeTextEditor?.document.uri.fsPath;
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const startPath = activeFilePath ? path.dirname(activeFilePath) : workspaceRoot;

  if (!startPath) {
    throw new Error("Open a workspace or file before running Matterhorn workspace tasks.");
  }

  let currentDirectory = startPath;
  while (true) {
    const candidate = path.join(currentDirectory, "package.json");
    try {
      await fs.stat(candidate);
      return currentDirectory;
    } catch {
      const parent = path.dirname(currentDirectory);
      if (parent === currentDirectory) {
        break;
      }
      currentDirectory = parent;
    }
  }

  throw new Error("Matterhorn could not find a package.json above the current file or workspace root.");
}
