import { strict as assert } from "node:assert";
import * as path from "node:path";

import * as vscode from "vscode";

import { extractKeywords, searchCodebaseKeywords } from "../../services/codebase/searchIndexingService.js";

const EXTENSION_ID = "northern-step-studio.nss-workspace-ai";
const REQUIRED_COMMANDS = [
  "nssWorkspaceAi.askWorkspaceAi",
  "nssWorkspaceAi.showQuickStart",
  "nssWorkspaceAi.askAboutErrorFile",
  "nssWorkspaceAi.proposeFixForErrorFile",
  "nssWorkspaceAi.proposeMultiFileChange",
  "nssWorkspaceAi.showBuildFoundation",
  "nss.showModeDetails",
  "nss.openReviewCenter",
] as const;

interface NssDebugStateSnapshot {
  readonly serverHealth: {
    readonly status: "offline" | "online" | "unknown";
    readonly detail: string;
  };
  readonly currentFilePath?: string;
  readonly latestResponse?: {
    readonly title: string;
    readonly body: string;
    readonly sourceCommand: string;
  };
}

export async function run(): Promise<void> {
  const serverUrl = process.env.NSS_TEST_SERVER_URL;
  assert(serverUrl, "Expected NSS_TEST_SERVER_URL to be set for the extension-host run.");

  const availableCommands = await vscode.commands.getCommands(true);
  for (const commandId of REQUIRED_COMMANDS) {
    assert(availableCommands.includes(commandId), `Expected command ${commandId} to be registered.`);
  }

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  assert(workspaceFolder, "Expected the extension host to open a workspace folder.");

  await vscode.workspace.getConfiguration("nssWorkspaceAi").update("serverUrl", serverUrl, vscode.ConfigurationTarget.Workspace);

  const fixturePath = path.join(workspaceFolder.uri.fsPath, "src", "integration.ts");
  const fixtureDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(fixturePath));
  await vscode.window.showTextDocument(fixtureDocument, { preview: false });

  const extension = vscode.extensions.getExtension(EXTENSION_ID);
  assert(extension, `Expected ${EXTENSION_ID} to be installed in the extension host.`);

  await extension.activate();
  assert.equal(extension.isActive, true, "Expected Matterhorn to activate.");

  await vscode.commands.executeCommand("nssWorkspaceAi.explainThisFile");
  const roundtripSnapshot = await waitForSnapshot(
    (snapshot) => snapshot.latestResponse?.sourceCommand === "nssWorkspaceAi.explainThisFile",
  );
  assert.equal(roundtripSnapshot.serverHealth.status, "online");
  assert.equal(roundtripSnapshot.latestResponse?.title, "Explain integration.ts");
  assert(roundtripSnapshot.latestResponse?.body.includes("Intent: explain-file"));
  assert(roundtripSnapshot.latestResponse?.body.includes("Agent: NSS Stack Expert"));
  assert(roundtripSnapshot.latestResponse?.body.includes("Active file:"));
  assert.equal(roundtripSnapshot.currentFilePath?.endsWith(`${path.sep}integration.ts`), true);

  const ragResults = await searchCodebaseKeywords(extractKeywords("hono supabase react calculate studio score"));
  assert(ragResults.some((result) => result.path.includes("src/integration.ts")));
  assert(ragResults.some((result) => result.content.includes("createWorkspaceApp")));

  await vscode.commands.executeCommand("nssWorkspaceAi.showQuickStart");
  const document = await waitForVisibleMarkdown("Matterhorn Quick Start");
  assert(document, "Expected Matterhorn Quick Start markdown preview to open.");
  assert(document.getText().includes("Ask Matterhorn"), "Expected the quick start document to contain Matterhorn guidance.");
}

async function waitForVisibleMarkdown(titleFragment: string): Promise<vscode.TextDocument | undefined> {
  const deadline = Date.now() + 5_000;

  while (Date.now() < deadline) {
    const activeDocument = vscode.window.activeTextEditor?.document;
    if (
      activeDocument &&
      activeDocument.languageId === "markdown" &&
      activeDocument.getText().includes(titleFragment)
    ) {
      return activeDocument;
    }

    await delay(100);
  }

  return undefined;
}

async function waitForSnapshot(
  predicate: (snapshot: NssDebugStateSnapshot) => boolean,
): Promise<NssDebugStateSnapshot> {
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    const snapshot = (await vscode.commands.executeCommand(
      "nssWorkspaceAi.dev.snapshotState",
    )) as NssDebugStateSnapshot;

    if (predicate(snapshot)) {
      return snapshot;
    }

    await delay(100);
  }

  throw new Error("Timed out waiting for NSS debug snapshot state.");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
