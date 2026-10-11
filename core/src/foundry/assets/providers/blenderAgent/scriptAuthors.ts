/**
 * Script authors turn an asset description into Blender Python.
 *
 * Authors only produce text. They never receive tools, a shell, or file access:
 * Matterhorn's Blender Agent provider guards and executes the script itself.
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface ScriptAuthorRequest {
  readonly system: string;
  readonly prompt: string;
  readonly signal?: AbortSignal;
}

export interface ScriptAuthor {
  readonly id: "claude-code" | "ollama";
  readonly label: string;
  readonly model?: string;
  author(request: ScriptAuthorRequest): Promise<string>;
}

const AUTHOR_TIMEOUT_MS = 6 * 60_000;

/**
 * Environment for running the user's own Claude Code. Drops the session variables a host
 * (such as the Claude desktop app) sets for its own children, so Claude Code uses the
 * user's login and behaves the same however Matterhorn was started.
 */
export function cleanClaudeEnvironment(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const clean: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(env)) {
    if (/^(CLAUDECODE|CLAUDE_CODE_|CLAUDE_AGENT_SDK_|CLAUDE_PID$|CLAUDE_EFFORT$|CLAUDE_PREVIEW_|ANTHROPIC_BASE_URL$)/i.test(key)) continue;
    clean[key] = value;
  }
  return clean;
}

export function findClaudeCodeExecutable(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const explicit = env.MATTERHORN_CLAUDE_BIN?.trim();
  if (explicit) return existsSync(explicit) ? explicit : undefined;

  const candidates: string[] = [];
  if (process.platform === "win32") {
    if (env.APPDATA) {
      candidates.push(join(env.APPDATA, "npm", "node_modules", "@anthropic-ai", "claude-code", "bin", "claude.exe"));
    }
    candidates.push(join(homedir(), ".local", "bin", "claude.exe"));
  } else {
    candidates.push(join(homedir(), ".local", "bin", "claude"), "/usr/local/bin/claude", "/opt/homebrew/bin/claude");
  }
  for (const candidate of candidates) if (existsSync(candidate)) return candidate;

  const lookup = spawnSync(process.platform === "win32" ? "where.exe" : "which", [process.platform === "win32" ? "claude.exe" : "claude"], { encoding: "utf8" });
  const first = lookup.status === 0 ? String(lookup.stdout).split(/\r?\n/).find((line) => line.trim()) : undefined;
  return first && existsSync(first.trim()) ? first.trim() : undefined;
}

/** Headless Claude Code with every tool disabled: it can only answer with text. */
export class ClaudeCodeScriptAuthor implements ScriptAuthor {
  readonly id = "claude-code" as const;
  readonly label = "Claude Code";

  constructor(
    private readonly executable: string,
    readonly model?: string,
  ) {}

  author(request: ScriptAuthorRequest): Promise<string> {
    const args = [
      "-p",
      "--output-format", "json",
      "--tools", "",
      "--no-session-persistence",
      "--system-prompt", request.system,
      ...(this.model ? ["--model", this.model] : []),
    ];
    return new Promise((resolvePromise, reject) => {
      const child = spawn(this.executable, args, {
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
        shell: false,
        env: cleanClaudeEnvironment(),
      });
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => child.kill(), AUTHOR_TIMEOUT_MS);
      const abort = () => child.kill();
      request.signal?.addEventListener("abort", abort, { once: true });
      child.stdout.on("data", (chunk) => { stdout += chunk; });
      child.stderr.on("data", (chunk) => { stderr += chunk; });
      child.on("error", (error) => {
        clearTimeout(timer);
        reject(new Error(`Claude Code could not start: ${error.message}`));
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        request.signal?.removeEventListener("abort", abort);
        let parsed: { result?: unknown; is_error?: boolean; terminal_reason?: string } | undefined;
        try {
          parsed = JSON.parse(stdout);
        } catch {
          parsed = undefined;
        }
        if (code === 0 && parsed && !parsed.is_error && typeof parsed.result === "string") {
          resolvePromise(parsed.result);
          return;
        }
        const reason = parsed?.terminal_reason ?? (stderr.trim().split(/\r?\n/).pop() || `exit ${code}`);
        reject(new Error(
          reason === "api_error"
            ? "Claude Code is installed but not signed in (or the request failed). Run `claude` once in a terminal and sign in."
            : `Claude Code failed: ${String(reason).slice(0, 400)}`,
        ));
      });
      child.stdin.end(request.prompt);
    });
  }
}

/** Local Ollama chat model. Thinking is disabled: we want the script, not the deliberation. */
export class OllamaScriptAuthor implements ScriptAuthor {
  readonly id = "ollama" as const;
  readonly label = "Ollama";

  /** `model` may be a function so the user's model choice applies without restarting. */
  constructor(
    private readonly baseUrl: string,
    private readonly modelSource: string | (() => string | undefined),
  ) {}

  get model(): string {
    const value = typeof this.modelSource === "function" ? this.modelSource() : this.modelSource;
    if (!value) throw new Error("No local model is chosen for building assets. Pick one in Settings › AI.");
    return value;
  }

  async author(request: ScriptAuthorRequest): Promise<string> {
    const signal = request.signal
      ? AbortSignal.any([request.signal, AbortSignal.timeout(AUTHOR_TIMEOUT_MS)])
      : AbortSignal.timeout(AUTHOR_TIMEOUT_MS);
    const response = await fetch(`${this.baseUrl.replace(/\/+$/, "")}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      // Streamed so long generations keep the connection alive instead of hitting header timeouts.
      body: JSON.stringify({
        model: this.model,
        stream: true,
        think: false,
        options: { temperature: 0.4, num_ctx: 16384 },
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: request.prompt },
        ],
      }),
    });
    if (!response.ok || !response.body) {
      throw new Error(`Ollama returned ${response.status}: ${(await response.text()).slice(0, 300)}`);
    }
    let content = "";
    let pending = "";
    const decoder = new TextDecoder();
    for await (const chunk of response.body) {
      pending += decoder.decode(chunk, { stream: true });
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines) content += ollamaChunkText(line);
    }
    content += ollamaChunkText(pending);
    if (!content.trim()) throw new Error("Ollama returned an empty reply.");
    return content;
  }
}

function ollamaChunkText(line: string): string {
  if (!line.trim()) return "";
  const data = JSON.parse(line) as { message?: { content?: unknown }; error?: unknown };
  if (typeof data.error === "string") throw new Error(`Ollama: ${data.error}`);
  return typeof data.message?.content === "string" ? data.message.content : "";
}
