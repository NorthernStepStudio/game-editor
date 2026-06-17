import * as vscode from "vscode";
import { truncateText } from "../../helpers/text.js";

/**
 * Service to discover and map API routes (specifically Hono).
 * This gives the AI a direct look at the backend network layer.
 */
export async function discoverApiRoutes(): Promise<{ path: string; routes: string[] }[]> {
  const apiMaps: { path: string; routes: string[] }[] = [];

  const apiPatterns = [
    "**/src/index.ts",
    "**/src/routes/*.ts",
    "**/apps/*/src/index.ts",
  ];

  for (const pattern of apiPatterns) {
    try {
      const uris = await vscode.workspace.findFiles(pattern, "**/node_modules/**", 10);
      
      for (const uri of uris) {
        const doc = await vscode.workspace.openTextDocument(uri);
        const text = doc.getText();
        const relPath = vscode.workspace.asRelativePath(uri);

        // Simple regex-based route extraction for Hono/Express style
        // Matches: app.get('/path', ...) or routes.post('/path', ...)
        const routeRegex = /(?:app|route|router|api)\.(get|post|put|delete|patch|all)\(['"]([^'"]+)['"]/gi;
        const routes: string[] = [];
        let match;

        while ((match = routeRegex.exec(text)) !== null) {
          routes.push(`${match[1].toUpperCase()} ${match[2]}`);
        }

        if (routes.length > 0) {
          apiMaps.push({
            path: relPath,
            routes: [...new Set(routes)], // Unique routes
          });
        }
      }
    } catch (err) {
      console.error(`Matterhorn: API route discovery failed for ${pattern}`, err);
    }
  }

  return apiMaps;
}
