import { strict as assert } from "node:assert";
import * as fs from "node:fs/promises";
import * as http from "node:http";
import * as os from "node:os";
import * as path from "node:path";

import type { NssAskRequestPayload, NssAskResponse, NssHealthResponse } from "../models/contracts.js";
import { startNssWorkspaceAiServer } from "../server.js";

async function main(): Promise<void> {
  const { portStateFilePath, tempRoot } = await createTempPortStateLocation();
  const started = await startNssWorkspaceAiServer({
    port: 0,
    mCore: {
      providerMode: "mock",
      requestTimeoutMs: 30_000,
    },
  }, {
    portStateFilePath,
  });

  try {
    const baseUrl = `http://127.0.0.1:${started.port}`;
    const health = await fetchJson<NssHealthResponse>(`${baseUrl}/health`);
    assert.equal(health.status, "ok");
    assert.equal(health.mode, "mock");
    await assertPortStateFile(portStateFilePath, started.port);

    const explainFile = await postAsk(baseUrl, {
      prompt: "Explain this file clearly.",
      intent: "explain-file",
      workspace: {
        name: "Northern Step Studio",
        rootPath: "D:\\dev\\Northern Step Studio",
      },
      mode: "coding",
      presetId: "general-nss-studio",
      studioProjectId: "general-nss-studio",
      activeFile: {
        path: "apps/nstep-workspace-ai/src/extension.ts",
        languageId: "typescript",
        content: "import * as vscode from 'vscode';\nexport function test() {}\n",
      },
    });
    assert.equal(explainFile.title, "Explain extension.ts");
    assert(explainFile.response.includes("Active file:"));

    const proposal = await postAsk(baseUrl, {
      prompt: "Propose a safer edit.",
      intent: "propose-edit",
      workspace: {
        name: "Northern Step Studio",
      },
      activeFile: {
        path: "apps/nstep-workspace-ai/src/extension.ts",
        languageId: "typescript",
        content: "export function test() {}\n",
      },
    });
    assert.equal(proposal.title, "Proposed Edit: extension.ts");
    assert.equal(proposal.proposedText, undefined);
    assert(proposal.response.includes("review-only"));

    await assertListenConflictIsAutoPicked();
  } finally {
    await started.close();
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  assert.equal(response.ok, true);
  return (await response.json()) as T;
}

async function postAsk(baseUrl: string, payload: NssAskRequestPayload): Promise<NssAskResponse> {
  const response = await fetch(`${baseUrl}/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  assert.equal(response.ok, true);
  return (await response.json()) as NssAskResponse;
}

async function assertPortStateFile(portStateFilePath: string, expectedPort: number): Promise<void> {
  const raw = await fs.readFile(portStateFilePath, "utf8");
  const parsed = JSON.parse(raw) as { readonly pid?: number; readonly port?: number };

  assert.equal(parsed.port, expectedPort);
  assert.equal(parsed.pid, process.pid);
}

async function assertListenConflictIsAutoPicked(): Promise<void> {
  const blocker = await createListeningServer();

  try {
    const started = await startNssWorkspaceAiServer({
        port: blocker.port,
        mCore: {
          providerMode: "mock",
          requestTimeoutMs: 30_000,
        },
      }, {
        portStateFilePath: false,
    });

    assert.notEqual(started.port, blocker.port);

    try {
      const health = await fetchJson<NssHealthResponse>(`http://127.0.0.1:${started.port}/health`);
      assert.equal(health.status, "ok");
    } finally {
      await started.close();
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      blocker.server.close((error: Error | undefined) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}

async function createListeningServer(): Promise<{ readonly server: http.Server; readonly port: number }> {
  const server = http.createServer();

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not determine blocker server port.");
  }

  return {
    server,
    port: address.port,
  };
}

async function createTempPortStateLocation(): Promise<{
  readonly portStateFilePath: string;
  readonly tempRoot: string;
}> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nstep-workspace-ai-server-"));
  return {
    tempRoot,
    portStateFilePath: path.join(tempRoot, "port-state.json"),
  };
}

void main();
