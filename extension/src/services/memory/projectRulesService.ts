import type { NssProjectRule } from "../../models/memory.types.js";

export function createProjectRule(projectId: string, rule: string): NssProjectRule {
  return {
    id: `rule-${Date.now()}`,
    projectId,
    rule,
    createdAt: new Date().toISOString(),
  };
}

export function listProjectRulesForProject(rules: readonly NssProjectRule[], projectId: string): NssProjectRule[] {
  return rules.filter((rule) => rule.projectId === projectId);
}
