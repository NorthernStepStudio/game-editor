import type { NssPersistentMemory } from "../../models/memory.types.js";

/**
 * Recalls relevant memories from the persistent store based on the user's prompt.
 * 
 * @param prompt The user's input prompt.
 * @param projectId The active studio project ID.
 * @param memories All available persistent memories.
 * @param limit Maximum number of memories to recall.
 * @returns An array of filtered and ranked memories.
 */
export function recallRelevantMemories(
  prompt: string,
  projectId: string,
  memories: readonly NssPersistentMemory[],
  limit: number = 5
): NssPersistentMemory[] {
  const normalizedPrompt = prompt.toLowerCase();
  
  // Filter by project and basic keyword match
  const relevant = memories.filter((memory) => {
    if (memory.projectId !== projectId) {
      return false;
    }

    const hasTagMatch = memory.tags.some(tag => normalizedPrompt.includes(tag.toLowerCase()));
    const hasContentMatch = memory.content.toLowerCase().includes(normalizedPrompt);
    
    // Reverse check: does the prompt contain words from the content?
    const contentWords = memory.content.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    const hasPromptMatch = contentWords.some(word => normalizedPrompt.includes(word));

    return hasTagMatch || hasContentMatch || hasPromptMatch;
  });

  // Rank by importance and keyword density (simple heuristic)
  return relevant
    .sort((a, b) => {
      const aScore = calculateRelevanceScore(normalizedPrompt, a);
      const bScore = calculateRelevanceScore(normalizedPrompt, b);
      return bScore - aScore;
    })
    .slice(0, limit);
}

function calculateRelevanceScore(prompt: string, memory: NssPersistentMemory): number {
  let score = memory.importance * 2; // Base score from importance

  // Tag match bonus
  for (const tag of memory.tags) {
    if (prompt.includes(tag.toLowerCase())) {
      score += 10;
    }
  }

  // Content keyword match bonus
  const promptWords = prompt.split(/\s+/).filter(w => w.length > 3);
  for (const word of promptWords) {
    if (memory.content.toLowerCase().includes(word.toLowerCase())) {
      score += 2;
    }
  }

  return score;
}
