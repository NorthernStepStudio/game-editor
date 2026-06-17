import * as path from "node:path";

import type { NssAskIntent, NssAskRequestPayload, NssAskResponse, ResponseOsAgent } from "../core/types.js";

export function buildResponseTitle(request: NssAskRequestPayload): string {
  switch (request.intent) {
    case "explain-file":
      return request.activeFile ? `Explain ${path.basename(request.activeFile.path)}` : "Explain File";
    case "explain-project-structure":
      return "Project Structure";
    case "change-plan":
      return "Change Plan";
    case "ask-error-file":
      return request.activeFile ? `Likely Error File: ${path.basename(request.activeFile.path)}` : "Likely Error File";
    case "propose-edit":
      return request.activeFile ? `Proposed Edit: ${path.basename(request.activeFile.path)}` : "Proposed Edit";
    case "propose-error-file-fix":
      return request.activeFile ? `Proposed Error Fix: ${path.basename(request.activeFile.path)}` : "Proposed Error Fix";
    case "propose-multi-file-change":
      return "Multi-File Proposal";
    case "workspace-briefing":
      return "Workspace Briefing";
    case "knowledge-search":
      return "Knowledge Search";
    default:
      return "NSS Workspace AI";
  }
}

export function buildMockResponseBody(request: NssAskRequestPayload, agent: ResponseOsAgent): string {
  const lines: string[] = [];

  lines.push(`Intent: ${request.intent}`);
  lines.push(`Prompt: ${request.prompt}`);
  lines.push(`Workspace: ${request.workspace.name}${request.workspace.rootPath ? ` (${request.workspace.rootPath})` : ""}`);
  lines.push(`Agent: ${agent.title}`);
  lines.push(`Agent focus: ${agent.summary}`);
  if (request.preferredAgentId) {
    lines.push(`Preferred agent: ${request.preferredAgentId}`);
  }

  if (request.mode || request.presetId || request.studioProjectId) {
    lines.push(
      `Mode/Preset/Project: ${request.mode ?? "unspecified"} / ${request.presetId ?? "unspecified"} / ${request.studioProjectId ?? "unspecified"}`,
    );
  }

  if (request.activeFile) {
    const file = request.activeFile;
    lines.push("");
    lines.push("Active file:");
    lines.push(`- Path: ${file.path}`);
    lines.push(`- Language: ${file.languageId}`);
    lines.push(`- Size: ${countLines(file.content)} lines`);
    lines.push(`- Imports: ${countMatches(file.content, /^\s*import\s/mg)}`);
    lines.push(`- Exports: ${countMatches(file.content, /^\s*export\s/mg)}`);
    lines.push(`- Functions: ${countMatches(file.content, /\bfunction\b|=>/g)}`);

    if (file.selection) {
      lines.push(`- Selection: ${truncateText(file.selection, 180)}`);
    }
  }

  if (request.project?.structureSummary) {
    lines.push("");
    lines.push("Project structure snapshot:");
    lines.push(request.project.structureSummary);
  }

  if (request.task) {
    lines.push("");
    lines.push("Task context:");
    lines.push(`- Command: ${request.task.commandLine}`);
    lines.push(`- Exit code: ${String(request.task.exitCode)}`);
    lines.push(`- Summary: ${request.task.summary}`);
    if (request.task.likelyErrorFiles?.length) {
      lines.push(...request.task.likelyErrorFiles.slice(0, 5).map((file) => `- Likely error file: ${file}`));
    }
  }

  if (request.codebase?.relatedFiles?.length) {
    lines.push("");
    lines.push("Related files:");
    lines.push(...request.codebase.relatedFiles.slice(0, 6).map((file) => `- ${file}`));
  }

  if (request.codebase?.likelyErrorFiles?.length) {
    lines.push("");
    lines.push("Likely error files:");
    lines.push(...request.codebase.likelyErrorFiles.slice(0, 6).map((file) => `- ${file}`));
  }

  if (request.build) {
    lines.push("");
    lines.push("Build foundation:");
    lines.push(`- Goal: ${request.build.goal}`);
    lines.push(`- Scope: ${request.build.scope}`);
    lines.push(`- Target: ${request.build.target}`);
    lines.push(`- Workspace kind: ${request.build.workspaceKind}`);
    lines.push(`- Template: ${request.build.template.title}`);
    lines.push(`- Focus areas: ${request.build.focusAreas.length > 0 ? request.build.focusAreas.join(", ") : "none"}`);
    lines.push(`- Steps: ${request.build.steps.length}`);
    lines.push(`- Validation: ${request.build.validation.length}`);

    if (request.build.relatedFiles?.length) {
      lines.push(...request.build.relatedFiles.slice(0, 5).map((file) => `- Build related file: ${file.path}`));
    }
  }

  if (request.memory?.projectRules?.length || request.memory?.repairPatterns?.length || request.memory?.recurringFailures?.length) {
    lines.push("");
    lines.push("Workspace memory:");
    lines.push(...(request.memory.projectRules?.slice(0, 4).map((rule) => `- Project rule: ${rule}`) ?? []));
    lines.push(...(request.memory.repairPatterns?.slice(0, 3).map((pattern) => `- Repair pattern: ${pattern}`) ?? []));
    lines.push(...(request.memory.recurringFailures?.slice(0, 3).map((failure) => `- Recurring failure: ${failure}`) ?? []));
  }

  if (request.knowledge?.length) {
    lines.push("");
    lines.push("Knowledge highlights:");
    lines.push(...request.knowledge.slice(0, 5).map((item) => `- ${item.title}: ${truncateText(item.excerpt, 140)}`));
  }

  if (request.workflow) {
    lines.push("");
    lines.push(`Workflow: ${request.workflow.title} -> ${request.workflow.currentStep}`);
  }

  lines.push("");
  lines.push("Recommended next steps:");
  lines.push(...buildNextSteps(request).map((step) => `- ${step}`));

  if (isProposalIntent(request.intent)) {
    lines.push("");
    lines.push("M-CORE is using the local mock provider, so this proposal remains review-only.");
    lines.push("Switch to the Gemini provider if you want the runtime to attempt concrete `proposedText` output.");
  }

  return lines.join("\n");
}

export function normalizeStructuredModelResponse(content: string, fallbackTitle: string): NssAskResponse {
  const parsed = tryParseJson(content);
  if (parsed && typeof parsed === "object") {
    const record = parsed as Record<string, unknown>;

    return {
      title: firstString(record, ["title"]) ?? fallbackTitle,
      response: firstString(record, ["response", "answer", "text", "message", "content", "body"]) ?? content,
      preview: firstString(record, ["preview", "summary"]),
      proposedText: firstString(record, ["proposedText", "fileContent", "updatedFileContent", "replacement", "newFileContent"]),
    };
  }

  return {
    title: fallbackTitle,
    response: content,
  };
}

export function isProposalIntent(intent: NssAskIntent): boolean {
  return (
    intent === "propose-edit" ||
    intent === "propose-error-file-fix" ||
    intent === "propose-multi-file-change" ||
    intent === "review-refresh"
  );
}

function buildNextSteps(request: NssAskRequestPayload): string[] {
  switch (request.intent) {
    case "explain-file":
      return [
        "Confirm the file's role against nearby related files before editing.",
        "Check whether the current selection contains the riskiest logic path.",
        "Use a review proposal before applying any broad rewrite.",
      ];
    case "change-plan":
      return [
        "Clarify acceptance criteria before editing.",
        "Touch the smallest set of files that satisfies the change.",
        request.build
          ? "Use the build foundation spec and plan to choose a safe implementation order."
          : "Reconstruct the likely implementation order from the local context before editing.",
        "Queue review items before applying multi-file edits.",
      ];
    case "ask-error-file":
    case "propose-error-file-fix":
    case "analyze-task-failure":
      return [
        "Start from the first concrete compiler or runtime error, not the last cascade message.",
        "Check the likely error file against the failing task output.",
        "Prefer a minimal fix and rerun the task before widening the change.",
      ];
    case "propose-edit":
    case "review-refresh":
    case "propose-multi-file-change":
      return [
        "Review the proposed scope before applying anything.",
        "Keep one file review item focused on one behavior change.",
        request.build
          ? "Cross-check the proposal against the build foundation context and related files."
          : "Cross-check the proposal against the active file and nearby related files.",
        "Re-run the relevant task or workflow after apply.",
      ];
    case "workspace-briefing":
      return [
        "Use the current mode and preset to decide the kind of work actually needed.",
        "Check project rules and repair patterns before repeating old mistakes.",
        "Move to a workflow if the task spans multiple steps.",
      ];
    default:
      return [
        "Use the active file and workspace context to narrow the task.",
        "Prefer review-first edits over blind replacement.",
        "Run a bounded local task after any meaningful change.",
      ];
  }
}

function tryParseJson(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{")) {
    return undefined;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

function firstString(record: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return undefined;
}

function countLines(value: string): number {
  return value ? value.split(/\r?\n/).length : 0;
}

function countMatches(value: string, pattern: RegExp): number {
  return [...value.matchAll(pattern)].length;
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}
