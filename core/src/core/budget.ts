import type { NssAskIntent, ResponseOsBudget } from "./types.js";

const DEFAULT_BUDGET: ResponseOsBudget = {
  temperature: 0.2,
  maxOutputTokens: 1500,
};

export function resolveBudgetForIntent(intent: NssAskIntent): ResponseOsBudget {
  switch (intent) {
    case "propose-multi-file-change":
    case "change-plan":
    case "explain-project-structure":
      // Architect-level work: needs room for structured, multi-step proposals
      return {
        temperature: 0.15,
        maxOutputTokens: 3000,
      };
    case "propose-edit":
    case "propose-error-file-fix":
    case "review-refresh":
      return {
        temperature: 0.1,
        maxOutputTokens: 2000,
      };
    case "workspace-briefing":
      return {
        temperature: 0.2,
        maxOutputTokens: 1800,
      };
    default:
      return DEFAULT_BUDGET;
  }
}
