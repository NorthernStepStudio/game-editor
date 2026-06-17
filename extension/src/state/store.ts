import type * as vscode from "vscode";

import {
  DEFAULT_MODE,
  DEFAULT_PRESET_ID,
  DEFAULT_STUDIO_PROJECT_ID,
} from "../config/defaults.js";
import type { NssServerHealth } from "../models/api.types.js";
import type { NssResponseRecord } from "../models/command.types.js";
import type { NssDiagnosticSession } from "../models/diagnostic.types.js";
import type { NssKnowledgeItem } from "../models/knowledge.types.js";
import type { NssProjectRule, NssRecurringFailure, NssRepairPattern, NssPersistentMemory } from "../models/memory.types.js";
import type { NssModeId } from "../models/mode.types.js";
import type { NssReviewItem } from "../models/review.types.js";
import type { NssRoadmapNote } from "../models/roadmap.types.js";
import type { NssTaskResult } from "../models/task.types.js";
import type { NssWorkflowRun } from "../models/workflow.types.js";
import { pruneWorkspaceState } from "../storage/pruning.js";
import { NSS_LEGACY_WORKSPACE_STATE_KEYS, NSS_WORKSPACE_STATE_STORAGE_KEY } from "../storage/storageKeys.js";
import { getStorageLimits } from "../storage/storageLimits.js";

export interface NssWorkspaceAiState {
  responseHistory: NssResponseRecord[];
  latestResponse?: NssResponseRecord;
  reviewItems: NssReviewItem[];
  activeReviewId?: string;
  serverHealth: NssServerHealth;
  taskHistory: NssTaskResult[];
  diagnosticSessions: NssDiagnosticSession[];
  activeDiagnosticSessionId?: string;
  projectRules: NssProjectRule[];
  repairPatterns: NssRepairPattern[];
  recurringFailures: NssRecurringFailure[];
  mode: NssModeId;
  presetId: string;
  studioProjectId: string;
  activeWorkflow?: NssWorkflowRun;
  knowledgeItems: NssKnowledgeItem[];
  roadmapNotes: NssRoadmapNote[];
  persistentMemories: NssPersistentMemory[];
}

export function createInitialState(): NssWorkspaceAiState {
  return {
    responseHistory: [],
    reviewItems: [],
    serverHealth: {
      status: "unknown",
      detail: "No backend request yet.",
      checkedAt: new Date().toISOString(),
    },
    taskHistory: [],
    diagnosticSessions: [],
    projectRules: [],
    repairPatterns: [],
    recurringFailures: [],
    mode: DEFAULT_MODE,
    presetId: DEFAULT_PRESET_ID,
    studioProjectId: DEFAULT_STUDIO_PROJECT_ID,
    knowledgeItems: [],
    roadmapNotes: [],
    persistentMemories: [],
  };
}

function cloneState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class NssStateStore {
  private state: NssWorkspaceAiState;
  private readonly legacyStorageKey?: string;

  public constructor(private readonly context: vscode.ExtensionContext) {
    const persistedState = this.context.workspaceState.get<Partial<NssWorkspaceAiState>>(NSS_WORKSPACE_STATE_STORAGE_KEY);
    if (persistedState) {
      this.state = hydrateState(persistedState);
      return;
    }

    const legacyEntry = NSS_LEGACY_WORKSPACE_STATE_KEYS.find((key) => this.context.workspaceState.get(key) !== undefined);
    this.legacyStorageKey = legacyEntry;
    this.state = hydrateState(
      legacyEntry ? this.context.workspaceState.get<Partial<NssWorkspaceAiState>>(legacyEntry) : undefined,
    );
  }

  public async initialize(): Promise<void> {
    this.state = pruneWorkspaceState(this.state, getStorageLimits());
    await this.context.workspaceState.update(NSS_WORKSPACE_STATE_STORAGE_KEY, this.state);

    if (this.legacyStorageKey) {
      await this.context.workspaceState.update(this.legacyStorageKey, undefined);
    }
  }

  public snapshot(): NssWorkspaceAiState {
    return cloneState(this.state);
  }

  public async update(mutator: (draft: NssWorkspaceAiState) => void): Promise<void> {
    const draft = this.snapshot();
    mutator(draft);
    this.state = pruneWorkspaceState(draft, getStorageLimits());
    await this.context.workspaceState.update(NSS_WORKSPACE_STATE_STORAGE_KEY, this.state);
  }
}

function hydrateState(value: Partial<NssWorkspaceAiState> | undefined): NssWorkspaceAiState {
  const initialState = createInitialState();
  if (!value) {
    return initialState;
  }

  return {
    ...initialState,
    ...value,
    responseHistory: [...(value.responseHistory ?? initialState.responseHistory)],
    reviewItems: [...(value.reviewItems ?? initialState.reviewItems)],
    taskHistory: [...(value.taskHistory ?? initialState.taskHistory)],
    diagnosticSessions: [...(value.diagnosticSessions ?? initialState.diagnosticSessions)],
    projectRules: [...(value.projectRules ?? initialState.projectRules)],
    repairPatterns: [...(value.repairPatterns ?? initialState.repairPatterns)],
    recurringFailures: [...(value.recurringFailures ?? initialState.recurringFailures)],
    knowledgeItems: [...(value.knowledgeItems ?? initialState.knowledgeItems)],
    roadmapNotes: [...(value.roadmapNotes ?? initialState.roadmapNotes)],
    persistentMemories: [...(value.persistentMemories ?? initialState.persistentMemories)],
    serverHealth: value.serverHealth ?? initialState.serverHealth,
    mode: value.mode ?? initialState.mode,
    presetId: value.presetId ?? initialState.presetId,
    studioProjectId: value.studioProjectId ?? initialState.studioProjectId,
  };
}
