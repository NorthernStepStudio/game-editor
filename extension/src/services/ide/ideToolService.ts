import { exec } from "node:child_process";
import * as path from "node:path";
import * as vscode from "vscode";

import type {
  NssIdeToolCall,
  NssIdeToolContext,
  NssIdeToolName,
  NssIdeToolResult,
} from "../../models/ideTool.types.js";

const MAX_SEARCH_RESULTS = 100;
const MAX_SEARCH_FILE_BYTES = 1_000_000;
const MAX_TERMINAL_OUTPUT = 24_000;
const TERMINAL_TIMEOUT_MS = 120_000;
const ALLOW_ONCE = "Allow once";

export function buildIdeToolContext(): NssIdeToolContext {
  return {
    protocol: [
      "Use IDE tools only when workspace inspection, file reading/editing, terminal validation, or diagnostics are needed.",
      "To request tools, respond only as JSON:",
      '{"title":"Tool request","response":"I need workspace context.","toolCalls":[{"name":"read_file","args":{"path":"relative/path.ts"}}]}',
      "After tool results are provided, answer the original user request. Request more tools only if still needed.",
      "Use write_file/edit_file only for user-requested code changes. Use run_terminal only for safe validation commands.",
    ].join(" "),
    tools: [
      {
        name: "list_files",
        description: "Return files/folders inside a workspace-relative path.",
        parameters: { path: "Optional workspace-relative folder path. Defaults to workspace root." },
      },
      {
        name: "read_file",
        description: "Return full text contents of a workspace file.",
        parameters: { path: "Workspace-relative or absolute file path inside the workspace." },
      },
      {
        name: "write_file",
        description: "Create or overwrite a workspace file.",
        parameters: {
          path: "Workspace-relative or absolute file path inside the workspace.",
          content: "Full text content to write.",
        },
      },
      {
        name: "edit_file",
        description: "Replace exact text in a workspace file.",
        parameters: {
          path: "Workspace-relative or absolute file path inside the workspace.",
          search: "Exact text to replace.",
          replace: "Replacement text.",
        },
      },
      {
        name: "search_files",
        description: "Search workspace text files for literal text.",
        parameters: {
          query: "Text or regex pattern to search for.",
          path: "Optional workspace-relative folder/file path to scope the search.",
        },
      },
      {
        name: "run_terminal",
        description: "Run a safe terminal command in the workspace and return stdout/stderr.",
        parameters: { command: "Safe command to run from the workspace root." },
      },
      {
        name: "get_diagnostics",
        description: "Return VS Code diagnostics/errors for a file or the whole workspace.",
        parameters: { path: "Optional workspace-relative or absolute file path." },
      },
    ],
  };
}

export async function executeIdeToolCalls(toolCalls: readonly NssIdeToolCall[]): Promise<NssIdeToolResult[]> {
  const results: NssIdeToolResult[] = [];

  for (const toolCall of toolCalls) {
    try {
      await confirmMutatingToolCall(toolCall);
      results.push({
        name: toolCall.name,
        ok: true,
        result: await executeIdeToolCall(toolCall),
      });
    } catch (error) {
      results.push({
        name: toolCall.name,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

async function executeIdeToolCall(toolCall: NssIdeToolCall): Promise<unknown> {
  const args = toolCall.args ?? {};

  switch (toolCall.name) {
    case "list_files":
      return listFiles(readOptionalString(args.path));
    case "read_file":
      return readFile(readRequiredString(args.path, "path"));
    case "write_file":
      return writeFile(readRequiredString(args.path, "path"), readRequiredString(args.content, "content"));
    case "edit_file":
      return editFile(
        readRequiredString(args.path, "path"),
        readRequiredString(args.search, "search"),
        readRequiredString(args.replace, "replace"),
      );
    case "search_files":
      return searchFiles(readRequiredString(args.query, "query"), readOptionalString(args.path));
    case "run_terminal":
      return runTerminal(readRequiredString(args.command, "command"));
    case "get_diagnostics":
      return getDiagnostics(readOptionalString(args.path));
    default:
      throw new Error(`Unsupported IDE tool: ${(toolCall as { name?: string }).name ?? "unknown"}`);
  }
}

async function listFiles(inputPath: string | undefined): Promise<unknown> {
  const uri = resolveWorkspaceUri(inputPath);
  const entries = await vscode.workspace.fs.readDirectory(uri);

  return {
    path: toWorkspacePath(uri),
    entries: entries
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 250)
      .map(([name, type]) => {
        const childUri = vscode.Uri.joinPath(uri, name);
        return {
          name,
          path: toWorkspacePath(childUri),
          type: formatFileType(type),
        };
      }),
  };
}

async function readFile(inputPath: string): Promise<unknown> {
  const uri = resolveWorkspaceUri(inputPath);
  const content = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString("utf8");

  return {
    path: toWorkspacePath(uri),
    content,
  };
}

async function writeFile(inputPath: string, content: string): Promise<unknown> {
  const uri = resolveWorkspaceUri(inputPath);
  const parent = vscode.Uri.file(path.dirname(uri.fsPath));
  await vscode.workspace.fs.createDirectory(parent);
  await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf8"));

  return {
    path: toWorkspacePath(uri),
    bytes: Buffer.byteLength(content, "utf8"),
    message: "File written.",
  };
}

async function editFile(inputPath: string, search: string, replace: string): Promise<unknown> {
  if (!search) {
    throw new Error("edit_file requires a non-empty search string.");
  }

  const uri = resolveWorkspaceUri(inputPath);
  const original = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString("utf8");
  const index = original.indexOf(search);
  if (index < 0) {
    throw new Error(`Exact search text was not found in ${toWorkspacePath(uri)}.`);
  }

  const next = `${original.slice(0, index)}${replace}${original.slice(index + search.length)}`;
  await vscode.workspace.fs.writeFile(uri, Buffer.from(next, "utf8"));

  return {
    path: toWorkspacePath(uri),
    replacements: 1,
    message: "Exact text replaced.",
  };
}

async function searchFiles(query: string, inputPath: string | undefined): Promise<unknown> {
  const workspaceFolder = requirePrimaryWorkspaceFolder();
  const candidates = await findSearchCandidates(workspaceFolder, inputPath);
  const results: Array<{ path: string; line: number; preview: string }> = [];
  const normalizedQuery = query.toLowerCase();
  let searchedFiles = 0;
  let skippedFiles = 0;

  for (const uri of candidates) {
    if (results.length >= MAX_SEARCH_RESULTS) {
      break;
    }

    try {
      const stat = await vscode.workspace.fs.stat(uri);
      if (stat.size > MAX_SEARCH_FILE_BYTES) {
        skippedFiles += 1;
        continue;
      }

      const content = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString("utf8");
      if (content.includes("\u0000")) {
        skippedFiles += 1;
        continue;
      }

      searchedFiles += 1;
      const lines = content.split(/\r?\n/);
      for (let index = 0; index < lines.length && results.length < MAX_SEARCH_RESULTS; index += 1) {
        const line = lines[index];
        if (line.toLowerCase().includes(normalizedQuery)) {
          results.push({
            path: toWorkspacePath(uri),
            line: index + 1,
            preview: line.trim(),
          });
        }
      }
    } catch {
      skippedFiles += 1;
    }
  }

  return {
    query,
    count: results.length,
    searchedFiles,
    skippedFiles,
    truncated: results.length >= MAX_SEARCH_RESULTS,
    results,
  };
}

async function findSearchCandidates(
  workspaceFolder: vscode.WorkspaceFolder,
  inputPath: string | undefined,
): Promise<vscode.Uri[]> {
  if (!inputPath) {
    return vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceFolder, "**/*"),
      "{**/node_modules/**,**/.git/**,**/out/**,**/dist/**}",
      2_000,
    );
  }

  const scopeUri = resolveWorkspaceUri(inputPath);
  const stat = await vscode.workspace.fs.stat(scopeUri);
  if (stat.type & vscode.FileType.File) {
    return [scopeUri];
  }

  const relativePath = path.relative(workspaceFolder.uri.fsPath, scopeUri.fsPath).replace(/\\/g, "/");
  const pattern = relativePath ? `${relativePath}/**/*` : "**/*";
  return vscode.workspace.findFiles(
    new vscode.RelativePattern(workspaceFolder, pattern),
    "{**/node_modules/**,**/.git/**,**/out/**,**/dist/**}",
    2_000,
  );
}

async function runTerminal(command: string): Promise<unknown> {
  assertSafeTerminalCommand(command);
  const workspaceFolder = requirePrimaryWorkspaceFolder();

  return new Promise((resolve) => {
    exec(
      command,
      {
        cwd: workspaceFolder.uri.fsPath,
        timeout: TERMINAL_TIMEOUT_MS,
        windowsHide: true,
        maxBuffer: MAX_TERMINAL_OUTPUT * 2,
      },
      (error, stdout, stderr) => {
        const execError = error as ({ code?: unknown; signal?: unknown; killed?: boolean; message?: string } | null);
        resolve({
          command,
          cwd: workspaceFolder.uri.fsPath,
          exitCode: typeof execError?.code === "number" ? execError.code : 0,
          signal: typeof execError?.signal === "string" ? execError.signal : undefined,
          stdout: truncateToolText(stdout),
          stderr: truncateToolText(stderr),
          timedOut: Boolean(execError?.killed),
          error: execError?.message,
        });
      },
    );
  });
}

function getDiagnostics(inputPath: string | undefined): unknown {
  const diagnosticEntries = inputPath
    ? [[resolveWorkspaceUri(inputPath), vscode.languages.getDiagnostics(resolveWorkspaceUri(inputPath))] as const]
    : vscode.languages.getDiagnostics();
  const diagnostics = diagnosticEntries.flatMap(([uri, items]) =>
    items.map((diagnostic) => ({
      uri,
      diagnostic,
    })),
  );

  return {
    path: inputPath,
    count: diagnostics.length,
    diagnostics: diagnostics.slice(0, 100).map(({ uri, diagnostic }) => ({
      path: toWorkspacePath(uri),
      severity: formatDiagnosticSeverity(diagnostic.severity),
      message: diagnostic.message,
      source: diagnostic.source,
      code: diagnostic.code,
      range: {
        startLine: diagnostic.range.start.line + 1,
        startCharacter: diagnostic.range.start.character + 1,
        endLine: diagnostic.range.end.line + 1,
        endCharacter: diagnostic.range.end.character + 1,
      },
    })),
  };
}

async function confirmMutatingToolCall(toolCall: NssIdeToolCall): Promise<void> {
  if (toolCall.name !== "write_file" && toolCall.name !== "edit_file" && toolCall.name !== "run_terminal") {
    return;
  }

  const summary = describeToolCall(toolCall);
  const choice = await vscode.window.showWarningMessage(
    `Matterhorn wants to run ${toolCall.name}: ${summary}`,
    { modal: true },
    ALLOW_ONCE,
  );

  if (choice !== ALLOW_ONCE) {
    throw new Error(`${toolCall.name} was cancelled by the user.`);
  }
}

function describeToolCall(toolCall: NssIdeToolCall): string {
  const args = toolCall.args ?? {};
  switch (toolCall.name) {
    case "write_file":
      return `${String(args.path ?? "unknown path")} (${String(args.content ?? "").length} chars)`;
    case "edit_file":
      return `${String(args.path ?? "unknown path")} (exact replacement)`;
    case "run_terminal":
      return String(args.command ?? "unknown command");
    default:
      return toolCall.name;
  }
}

function resolveWorkspaceUri(inputPath: string | undefined): vscode.Uri {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders?.length) {
    throw new Error("Open a workspace before using IDE tools.");
  }

  const rawPath = inputPath?.trim();
  const candidate = rawPath
    ? path.resolve(path.isAbsolute(rawPath) ? rawPath : path.join(workspaceFolders[0].uri.fsPath, rawPath))
    : workspaceFolders[0].uri.fsPath;

  const matchingFolder = workspaceFolders.find((folder) => isInsidePath(candidate, folder.uri.fsPath));
  if (!matchingFolder) {
    throw new Error("IDE tools can only access files inside the open workspace.");
  }

  return vscode.Uri.file(candidate);
}

function requirePrimaryWorkspaceFolder(): vscode.WorkspaceFolder {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    throw new Error("Open a workspace before using IDE tools.");
  }

  return workspaceFolder;
}

function isInsidePath(candidatePath: string, rootPath: string): boolean {
  const normalizedCandidate = path.resolve(candidatePath);
  const normalizedRoot = path.resolve(rootPath);
  return normalizedCandidate === normalizedRoot || normalizedCandidate.startsWith(`${normalizedRoot}${path.sep}`);
}

function toWorkspacePath(uri: vscode.Uri): string {
  const folder = vscode.workspace.getWorkspaceFolder(uri);
  return folder ? path.relative(folder.uri.fsPath, uri.fsPath) || "." : uri.fsPath;
}

function assertSafeTerminalCommand(command: string): void {
  const normalized = command.toLowerCase();
  const blockedPatterns = [
    /\brm\s+-rf\b/,
    /\bremove-item\b.*\s-(recurse|r)\b/i,
    /\bdel\s+\/[sq]\b/i,
    /\brmdir\s+\/[sq]\b/i,
    /\bgit\s+reset\s+--hard\b/,
    /\bgit\s+clean\b/,
    /\bgit\s+push\b.*\s--force\b/,
    /\bnpm\s+publish\b/,
    /\bdrop\s+database\b/,
    /\bformat\s+[a-z]:/i,
  ];

  if (blockedPatterns.some((pattern) => pattern.test(normalized))) {
    throw new Error("run_terminal blocked a potentially destructive command.");
  }
}

function readRequiredString(value: unknown, name: string): string {
  if (typeof value !== "string") {
    throw new Error(`${name} must be a string.`);
  }

  return value;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function formatFileType(type: vscode.FileType): string {
  if (type & vscode.FileType.Directory) return "directory";
  if (type & vscode.FileType.File) return "file";
  if (type & vscode.FileType.SymbolicLink) return "symlink";
  return "unknown";
}

function formatDiagnosticSeverity(severity: vscode.DiagnosticSeverity): string {
  switch (severity) {
    case vscode.DiagnosticSeverity.Error:
      return "error";
    case vscode.DiagnosticSeverity.Warning:
      return "warning";
    case vscode.DiagnosticSeverity.Information:
      return "information";
    case vscode.DiagnosticSeverity.Hint:
      return "hint";
    default:
      return "unknown";
  }
}

function truncateToolText(value: string): string {
  if (value.length <= MAX_TERMINAL_OUTPUT) {
    return value;
  }

  return `${value.slice(0, MAX_TERMINAL_OUTPUT)}\n[Output truncated]`;
}
