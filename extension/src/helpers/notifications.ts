import * as vscode from "vscode";

export async function openMarkdownPreview(title: string, body: string): Promise<void> {
  const document = await vscode.workspace.openTextDocument({
    language: "markdown",
    content: `# ${title}\n\n${body}`,
  });

  await vscode.window.showTextDocument(document, {
    preview: false,
    preserveFocus: false,
  });
}
