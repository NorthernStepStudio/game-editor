import type { NssKnowledgeItem } from "../../models/knowledge.types.js";

export function searchKnowledgeItems(items: readonly NssKnowledgeItem[], query: string): NssKnowledgeItem[] {
  const normalizedQuery = query.toLowerCase();
  return items.filter((item) => {
    return (
      item.title.toLowerCase().includes(normalizedQuery) ||
      item.excerpt.toLowerCase().includes(normalizedQuery) ||
      item.path.toLowerCase().includes(normalizedQuery)
    );
  });
}
