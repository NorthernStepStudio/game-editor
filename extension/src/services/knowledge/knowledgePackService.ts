import * as vscode from "vscode";

import { truncateText } from "../../helpers/text.js";
import type { NssKnowledgeItem } from "../../models/knowledge.types.js";
import { discoverWorkspaceDocs } from "./docDiscoveryService.js";

export async function rebuildKnowledgePacks(activePresetId: string): Promise<NssKnowledgeItem[]> {
  const docs = await discoverWorkspaceDocs();
  const items: NssKnowledgeItem[] = [];

  for (const uri of docs) {
    const content = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString("utf8");
    items.push({
      id: `knowledge-${uri.fsPath}`,
      title: uri.path.split("/").at(-1) ?? uri.fsPath,
      path: uri.fsPath,
      excerpt: truncateText(content.trim(), 500),
      linkedPresetIds: uri.fsPath.toLowerCase().includes(activePresetId) ? [activePresetId] : [],
      updatedAt: new Date().toISOString(),
    });
  }

  return items;
}
