import * as vscode from "vscode";

import {
  DEFAULT_KNOWLEDGE_ITEM_LIMIT,
  DEFAULT_MAX_DIAGNOSTIC_SESSION_HISTORY,
  DEFAULT_MAX_REVIEW_HISTORY,
  DEFAULT_PROJECT_RULE_LIMIT,
  DEFAULT_RECURRING_FAILURE_LIMIT,
  DEFAULT_REPAIR_PATTERN_LIMIT,
  DEFAULT_RESPONSE_HISTORY_LIMIT,
  DEFAULT_ROADMAP_NOTE_LIMIT,
  DEFAULT_TASK_HISTORY_LIMIT,
} from "../config/defaults.js";
import { clampMinimum } from "../helpers/limits.js";

export interface NssStorageLimits {
  readonly responseHistory: number;
  readonly reviewItems: number;
  readonly taskHistory: number;
  readonly diagnosticSessions: number;
  readonly projectRules: number;
  readonly repairPatterns: number;
  readonly recurringFailures: number;
  readonly knowledgeItems: number;
  readonly roadmapNotes: number;
}

export function getStorageLimits(): NssStorageLimits {
  const config = vscode.workspace.getConfiguration("nssWorkspaceAi");

  return {
    responseHistory: DEFAULT_RESPONSE_HISTORY_LIMIT,
    reviewItems: clampMinimum(config.get<number>("maxReviewHistory", DEFAULT_MAX_REVIEW_HISTORY), 10),
    taskHistory: DEFAULT_TASK_HISTORY_LIMIT,
    diagnosticSessions: clampMinimum(
      config.get<number>("maxDiagnosticSessionHistory", DEFAULT_MAX_DIAGNOSTIC_SESSION_HISTORY),
      3,
    ),
    projectRules: DEFAULT_PROJECT_RULE_LIMIT,
    repairPatterns: DEFAULT_REPAIR_PATTERN_LIMIT,
    recurringFailures: DEFAULT_RECURRING_FAILURE_LIMIT,
    knowledgeItems: DEFAULT_KNOWLEDGE_ITEM_LIMIT,
    roadmapNotes: DEFAULT_ROADMAP_NOTE_LIMIT,
  };
}
