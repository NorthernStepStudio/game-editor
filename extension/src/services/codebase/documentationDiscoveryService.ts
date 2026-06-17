import * as vscode from "vscode";
import { truncateText } from "../../helpers/text.js";

/**
 * Service to discover and summarize project documentation and meta-files.
 * This provides the AI with "Why" and "What's Next" context.
 */
export async function discoverProjectDocumentation(): Promise<{ path: string; summary: string }[]> {
  const docs: { path: string; summary: string }[] = [];

  const docPatterns = [
    "**/README.md",
    "**/ARCHITECTURE.md",
    "**/TODO.md",
    "**/CHANGELOG.md",
    "**/ROADMAP.md",
  ];

  for (const pattern of docPatterns) {
    try {
      // Find the most relevant docs (up to 10)
      const uris = await vscode.workspace.findFiles(pattern, "**/node_modules/**", 10);
      
      for (const uri of uris) {
        const doc = await vscode.workspace.openTextDocument(uri);
        const text = doc.getText();
        const relPath = vscode.workspace.asRelativePath(uri);

        // We summarize docs by taking the first 3000 chars, 
        // focus is on headers and introductory text.
        docs.push({
          path: relPath,
          summary: truncateText(text, 3000),
        });
      }
    } catch (err) {
      console.error(`Matterhorn: Documentation discovery failed for ${pattern}`, err);
    }
  }

  return docs;
}
