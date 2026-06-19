export type CommandSafetyLevel = "allow" | "confirm" | "block";

export interface CommandSafetyResult {
  readonly level: CommandSafetyLevel;
  readonly reason: string;
}

const SAFE_READ_ONLY_PATTERNS: readonly RegExp[] = [
  /^pwd$/i,
  /^ls(\s+[-\w./\\]*)?$/i,
  /^dir(\s+[-\w./\\]*)?$/i,
  /^git\s+status(\s+--short)?$/i,
  /^git\s+remote\s+-v$/i,
  /^git\s+diff(\s+--stat)?(\s+--\s+[-\w./\\]+)?$/i,
  /^git\s+branch(\s+[-\w./\\]+)?$/i,
  /^git\s+log(\s+[-\w=./\\]+)*$/i,
  /^npm\s+-v$/i,
  /^node\s+-v$/i,
  /^pnpm\s+-v$/i,
  /^yarn\s+-v$/i,
];

const CONFIRM_PATTERNS: readonly RegExp[] = [
  /^git\s+add\b/i,
  /^git\s+commit\b/i,
  /^git\s+push\b/i,
  /^npm\s+install\b/i,
  /^pnpm\s+install\b/i,
  /^yarn\s+install\b/i,
  /^npm\s+run\b/i,
  /^pnpm\s+run\b/i,
  /^yarn\s+run\b/i,
  /^npx\b/i,
  />/,
  /\bset-content\b/i,
  /\bout-file\b/i,
  /\bnew-item\b/i,
  /\bmove-item\b/i,
  /\bcopy-item\b/i,
];

const BLOCK_PATTERNS: readonly RegExp[] = [
  /^git\s+push\b.*\s--force\b/i,
  /^git\s+push\b.*\s-f\b/i,
  /^git\s+branch\b.*\s-D\b/i,
  /^git\s+branch\b.*\s-d\b/i,
  /\brm\s+-rf\b/i,
  /\brmdir\s+\/s\b/i,
  /\bRemove-Item\b.*\b-Recurse\b/i,
  /\.git\b/i,
  /(^|[\s/\\])\.env(\s|$)/i,
  /\b(printenv|set)\b/i,
  /\b(curl|wget|irm|iwr)\b.*\|\s*(sh|bash|powershell|pwsh)/i,
];

export function classifyTerminalCommand(command: string): CommandSafetyResult {
  const normalized = command.trim();

  if (!normalized) {
    return { level: "block", reason: "Empty commands are not allowed." };
  }

  if (normalized.includes("\n") || normalized.includes("&&") || normalized.includes(";") || normalized.includes("|")) {
    return {
      level: "block",
      reason: "Run one command at a time. Command chaining and pipes are blocked for safety.",
    };
  }

  if (BLOCK_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return { level: "block", reason: "This command is blocked because it can be destructive or expose secrets." };
  }

  if (SAFE_READ_ONLY_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return { level: "allow", reason: "Read-only command allowed." };
  }

  if (CONFIRM_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return { level: "confirm", reason: "This command can change the workspace and requires confirmation." };
  }

  return { level: "confirm", reason: "Unknown command requires confirmation before Matterhorn runs it." };
}
