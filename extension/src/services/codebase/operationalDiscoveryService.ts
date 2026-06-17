import * as vscode from "vscode";
import { truncateText } from "../../helpers/text.js";

/**
 * Service to discover and summarize operational and deployment configurations.
 * This gives the AI awareness of how the project is built and shipped.
 */
export async function discoverOperationalConfig(): Promise<{ path: string; summary: string }[]> {
  const configs: { path: string; summary: string }[] = [];

  const configPatterns = [
    "**/wrangler.toml",
    "**/vite.config.ts",
    "**/vite.config.js",
    "**/tsconfig.json",
    "**/package.json", // Focus on scripts
    "**/.env.example",
    "**/.dev.vars", // Safely truncated
  ];

  for (const pattern of configPatterns) {
    try {
      const uris = await vscode.workspace.findFiles(pattern, "**/node_modules/**", 15);
      
      for (const uri of uris) {
        const doc = await vscode.workspace.openTextDocument(uri);
        const text = doc.getText();
        const relPath = vscode.workspace.asRelativePath(uri);

        let summary = text;
        if (relPath.endsWith("package.json")) {
          summary = summarizePackageScripts(text);
        }

        configs.push({
          path: relPath,
          summary: truncateText(summary, 2000),
        });
      }
    } catch (err) {
      console.error(`Matterhorn: Operational discovery failed for ${pattern}`, err);
    }
  }

  return configs;
}

function summarizePackageScripts(text: string): string {
  try {
    const json = JSON.parse(text);
    return JSON.stringify({
      name: json.name,
      scripts: json.scripts,
      engines: json.engines,
      workspaces: json.workspaces,
    }, null, 2);
  } catch {
    return text;
  }
}
