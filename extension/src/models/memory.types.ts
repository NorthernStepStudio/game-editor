export interface NssProjectRule {
  readonly id: string;
  readonly projectId: string;
  readonly rule: string;
  readonly createdAt: string;
}

export interface NssRepairPattern {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly symptom: string;
  readonly fix: string;
  readonly createdAt: string;
}

export interface NssRecurringFailure {
  readonly id: string;
  readonly projectId: string;
  readonly summary: string;
  readonly createdAt: string;
}

export interface NssPersistentMemory {
  readonly id: string;
  readonly projectId: string;
  readonly tags: readonly string[];
  readonly content: string;
  readonly importance: number; // 1-5
  readonly createdAt: string;
  readonly lastRecalledAt?: string;
}
