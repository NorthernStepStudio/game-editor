import { DEFAULT_REQUEST_KNOWLEDGE_LIMIT } from "../config/defaults.js";
import type { NssKnowledgeItem } from "../models/knowledge.types.js";

export function getKnowledgeRequestItems(
  knowledgeItems: readonly NssKnowledgeItem[],
  limit = DEFAULT_REQUEST_KNOWLEDGE_LIMIT,
): NssKnowledgeItem[] {
  return knowledgeItems.slice(0, limit);
}
