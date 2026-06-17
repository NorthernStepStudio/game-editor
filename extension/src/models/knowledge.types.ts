export interface NssKnowledgeItem {
  readonly id: string;
  readonly title: string;
  readonly path: string;
  readonly excerpt: string;
  readonly linkedPresetIds: readonly string[];
  readonly updatedAt: string;
}
