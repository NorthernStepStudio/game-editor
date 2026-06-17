import type { NssAskRequestPayload, ResponseOsAgent } from "../core/types.js";
import { generalAgent } from "./generalAgent.js";
import { stackExpertAgent } from "./stackExpertAgent.js";
import { architectAgent } from "./architectAgent.js";
import { workspaceOpsAgent } from "./workspaceOpsAgent.js";

export function resolveAgentForRequest(request: NssAskRequestPayload): ResponseOsAgent {
  if (request.preferredAgentId) {
    const preferredAgent = resolvePreferredAgent(request.preferredAgentId);
    if (preferredAgent) {
      return preferredAgent;
    }
  }

  if (request.mode === "architect") return architectAgent;
  if (request.mode === "coding" || request.mode === "debugging") return stackExpertAgent;
  if (request.mode === "product") return workspaceOpsAgent;

  const structuralIntents = ["propose-multi-file-change", "explain-project-structure", "change-plan"];
  if (structuralIntents.includes(request.intent)) {
    return architectAgent;
  }

  if (hasStudioStackSignals(request)) {
    return stackExpertAgent;
  }

  const isTechnicalFile =
    request.activeFile?.languageId &&
    ["typescript", "typescriptreact", "javascript", "javascriptreact", "prisma", "sql", "json"].includes(
      request.activeFile.languageId,
    );

  if (isTechnicalFile || request.intent === "propose-edit" || request.intent === "propose-error-file-fix") {
    return stackExpertAgent;
  }

  return generalAgent;
}

function resolvePreferredAgent(agentId: NssAskRequestPayload["preferredAgentId"]): ResponseOsAgent | undefined {
  switch (agentId) {
    case "general":
      return generalAgent;
    case "workspace-ops":
      return workspaceOpsAgent;
    case "stack-expert":
      return stackExpertAgent;
    case "architect":
      return architectAgent;
    default:
      return undefined;
  }
}

function hasStudioStackSignals(request: NssAskRequestPayload): boolean {
  const dependencyNames = request.codebase?.dependencies?.flatMap((entry) => entry.dependencies) ?? [];
  if (dependencyNames.some((dependency) => isStackDependency(dependency))) {
    return true;
  }

  if (hasStackContentSignals(request.activeFile?.content ?? "")) {
    return true;
  }

  const searchResultText =
    request.codebase?.searchResults?.map((result) => `${result.path}\n${result.content}`).join("\n") ?? "";
  return hasStackContentSignals(searchResultText);
}

function isStackDependency(dependency: string): boolean {
  const normalized = dependency.toLowerCase();
  return (
    normalized === "hono" ||
    normalized === "react" ||
    normalized === "react-dom" ||
    normalized === "@types/react" ||
    normalized === "@supabase/supabase-js" ||
    normalized.includes("supabase")
  );
}

function hasStackContentSignals(content: string): boolean {
  if (!content) {
    return false;
  }

  const patterns = [
    /\bnew\s+Hono\s*\(/i,
    /\bfrom\s+["'][^"']*hono[^"']*["']/i,
    /\bcreateClient\s*\(/i,
    /\bsupabase\.(from|auth|storage|rpc)\b/i,
    /\buseState\s*\(/i,
    /\buseEffect\s*\(/i,
    /<\s*[A-Z][\w.-]*(?:\s|>|\/)/,
  ];

  return patterns.some((pattern) => pattern.test(content));
}
