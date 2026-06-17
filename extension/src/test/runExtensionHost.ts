import { execFile, spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const EXTENSION_TEST_TIMEOUT_MS = 120_000;

interface StartedBundledServer {
  readonly baseUrl: string;
  close(): Promise<void>;
}

interface StartedServerModule {
  readonly port: number;
  close(): Promise<void>;
}

interface ServerModule {
  startNssWorkspaceAiServer(
    overrides?: {
    readonly port?: number;
    readonly mCore?: {
      readonly providerMode?: "off" | "mock" | "gemini";
      readonly requestTimeoutMs?: number;
    };
  },
    options?: {
      readonly portStateFilePath?: string | false;
    },
  ): Promise<StartedServerModule>;
}

async function main(): Promise<void> {
  const extensionRoot = path.resolve(__dirname, "..", "..");
  const bundledServer = await startBundledServer(extensionRoot);
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nstep-workspace-ai-"));
  const workspaceDir = path.join(tempRoot, "workspace");
  const userDataDir = path.join(tempRoot, "user-data");
  const extensionsDir = path.join(tempRoot, "extensions");

  await fs.mkdir(workspaceDir, { recursive: true });
  await fs.mkdir(userDataDir, { recursive: true });
  await fs.mkdir(extensionsDir, { recursive: true });
  await fs.writeFile(
    path.join(workspaceDir, "README.md"),
    "# NStep Workspace AI test workspace\n\nThis workspace exists for the extension-host smoke run.\n",
    "utf8",
  );
  await fs.writeFile(
    path.join(workspaceDir, "package.json"),
    JSON.stringify(
      {
        name: "nstep-workspace-ai-test-workspace",
        private: true,
        dependencies: {
          hono: "^4.0.0",
          "@supabase/supabase-js": "^2.0.0",
          react: "^19.0.0",
          "react-dom": "^19.0.0",
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  await fs.mkdir(path.join(workspaceDir, "src"), { recursive: true });
  await fs.writeFile(
    path.join(workspaceDir, "src", "integration.ts"),
    [
      'import { Hono } from "hono";',
      'import { createClient } from "@supabase/supabase-js";',
      'import { useState } from "react";',
      "",
      "export function calculateStudioScore(input: number): number {",
      "  return input + 1;",
      "}",
      "",
      "export function createWorkspaceApp() {",
      "  const app = new Hono();",
      "  const client = createClient(\"https://example.supabase.co\", \"public-anon-key\");",
      "  void client;",
      "  void useState;",
      "  return app;",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );

  try {
    await runVsCodeExtensionTests({
      codeExecutable: await resolveCodeExecutable(),
      extensionDevelopmentPath: extensionRoot,
      extensionTestsPath: path.join(__dirname, "integration", "runInHost.js"),
      workspacePath: workspaceDir,
      userDataDir,
      extensionsDir,
      env: {
        ...process.env,
        NSS_TEST_SERVER_URL: bundledServer.baseUrl,
      },
    });
  } finally {
    await bundledServer.close();
    await cleanupTempRoot(tempRoot);
  }
}

async function resolveCodeExecutable(): Promise<string> {
  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      const installedCode = path.join(localAppData, "Programs", "Microsoft VS Code", "bin", "code.cmd");
      if (await pathExists(installedCode)) {
        return installedCode;
      }
    }

    try {
      const { stdout } = await execFileAsync("where.exe", ["code.cmd"]);
      const resolved = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.length > 0);
      if (resolved) {
        return resolved;
      }
    } catch {
      // Fall back to relying on PATH if direct lookup fails.
    }
  }

  return "code";
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function startBundledServer(extensionRoot: string): Promise<StartedBundledServer> {
  const serverRoot = path.resolve(extensionRoot, "..", "nstep-workspace-ai-server");
  const serverPackage = path.join(serverRoot, "package.json");
  if (!(await pathExists(serverPackage))) {
    throw new Error(`Bundled NStep server is missing at ${serverPackage}.`);
  }

  await runNpmCommand(["run", "compile"], serverRoot);

  const serverEntry = path.join(serverRoot, "out", "server.js");
  if (!(await pathExists(serverEntry))) {
    throw new Error(`Bundled NStep server did not compile to ${serverEntry}.`);
  }

  const imported = (await import(pathToFileURL(serverEntry).href)) as ServerModule;
  const started = await imported.startNssWorkspaceAiServer(
    {
      port: 0,
      mCore: {
        providerMode: "mock",
        requestTimeoutMs: 30_000,
      },
    },
    {
      portStateFilePath: false,
    },
  );

  return {
    baseUrl: `http://127.0.0.1:${started.port}`,
    close: () => started.close(),
  };
}

async function runNpmCommand(args: readonly string[], cwd: string): Promise<void> {
  if (process.platform === "win32") {
    await execFileAsync("cmd.exe", ["/d", "/s", "/c", "npm", ...args], {
      cwd,
      windowsHide: true,
    });
    return;
  }

  await execFileAsync("npm", [...args], {
    cwd,
    windowsHide: true,
  });
}

async function cleanupTempRoot(tempRoot: string): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await fs.rm(tempRoot, { recursive: true, force: true });
      return;
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "EBUSY") {
        throw error;
      }

      await delay(500);
    }
  }

  console.warn(`Skipping temp cleanup because ${tempRoot} is still locked by VS Code.`);
}

async function runVsCodeExtensionTests(options: {
  readonly codeExecutable: string;
  readonly extensionDevelopmentPath: string;
  readonly extensionTestsPath: string;
  readonly workspacePath: string;
  readonly userDataDir: string;
  readonly extensionsDir: string;
  readonly env: NodeJS.ProcessEnv;
}): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const args = [
      "--new-window",
      "--disable-gpu",
      "--user-data-dir",
      options.userDataDir,
      "--extensions-dir",
      options.extensionsDir,
      "--extensionDevelopmentPath",
      options.extensionDevelopmentPath,
      "--extensionTestsPath",
      options.extensionTestsPath,
      options.workspacePath,
    ];
    const child =
      process.platform === "win32"
        ? spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", buildPowerShellCommand(options.codeExecutable, args)], {
            windowsHide: true,
            env: options.env,
          })
        : spawn(options.codeExecutable, args, { windowsHide: true, env: options.env });
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      child.kill();
      reject(new Error(`VS Code extension host run timed out after ${EXTENSION_TEST_TIMEOUT_MS}ms.`));
    }, EXTENSION_TEST_TIMEOUT_MS);

    child.stdout?.pipe(process.stdout);
    child.stderr?.pipe(process.stderr);
    child.on("error", (error) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      reject(error);
    });
    child.on("exit", (code, signal) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`VS Code extension host exited with code ${code ?? "unknown"}${signal ? ` (${signal})` : ""}.`));
    });
  });
}

function buildPowerShellCommand(executable: string, args: readonly string[]): string {
  const commandSegments = [escapePowerShellLiteral(executable), ...args.map(escapePowerShellLiteral)].join(" ");
  return `$ErrorActionPreference = 'Stop'; & ${commandSegments}; exit $LASTEXITCODE`;
}

function escapePowerShellLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

void main();
