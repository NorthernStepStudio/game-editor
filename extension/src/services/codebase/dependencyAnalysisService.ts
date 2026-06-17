import * as vscode from "vscode";

/**
 * Service to analyze monorepo dependencies and cross-app links.
 * Identifies internal (@nss/*) package references across all apps.
 */
export async function analyzeProjectDependencies(): Promise<{ app: string; dependencies: string[]; internalLinks: string[] }[]> {
  const analysis: { app: string; dependencies: string[]; internalLinks: string[] }[] = [];

  try {
    const packageFiles = await vscode.workspace.findFiles("**/package.json", "**/node_modules/**", 20);
    
    for (const uri of packageFiles) {
      const doc = await vscode.workspace.openTextDocument(uri);
      const json = JSON.parse(doc.getText());
      const relPath = vscode.workspace.asRelativePath(uri);
      
      const appName: string = json.name || relPath;
      const allDeps: Record<string, string> = {
        ...(json.dependencies ?? {}),
        ...(json.devDependencies ?? {}),
        ...(json.peerDependencies ?? {}),
      };
      
      const dependencies = Object.keys(allDeps);
      // Internal links are packages scoped to @nss/ or that use workspace: protocol
      const internalLinks = dependencies.filter(
        (d) => d.startsWith("@nss/") || allDeps[d]?.startsWith("workspace:")
      );

      analysis.push({ app: appName, dependencies, internalLinks });
    }
  } catch (err) {
    console.error("Matterhorn: Dependency analysis failed", err);
  }

  return analysis;
}
