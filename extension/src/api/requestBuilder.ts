import type {
  NssAskIntent,
  NssAskRequestPayload,
  NssCodebaseContext,
  NssBuildContext,
  NssFileContext,
  NssKnowledgeContextItem,
  NssMemoryContext,
  NssProjectContext,
  NssTaskContext,
  NssWorkflowContext,
  NssEvent,
  NssAppSnapshot,
} from "../models/api.types.js";
import type { NssModeId } from "../models/mode.types.js";

export interface BuildAskRequestInput {
  readonly prompt: string;
  readonly intent: NssAskIntent;
  readonly workspaceName: string;
  readonly workspacePath?: string;
  readonly preferredAgentId?: NssAskRequestPayload["preferredAgentId"];
  readonly mode?: NssModeId;
  readonly presetId?: string;
  readonly studioProjectId?: string;
  readonly activeFile?: NssFileContext;
  readonly project?: NssProjectContext;
  readonly memory?: NssMemoryContext;
  readonly knowledge?: readonly NssKnowledgeContextItem[];
  readonly task?: NssTaskContext;
  readonly codebase?: NssCodebaseContext;
  readonly codebaseSearchResults?: NonNullable<NssCodebaseContext["searchResults"]>;
  readonly workflow?: NssWorkflowContext;
  readonly events?: readonly NssEvent[];
  readonly appSnapshot?: NssAppSnapshot;
  readonly build?: NssBuildContext;
}

export function buildAskRequest(input: BuildAskRequestInput): NssAskRequestPayload {
  return {
    prompt: input.prompt.trim(),
    intent: input.intent,
    workspace: {
      name: input.workspaceName,
      rootPath: input.workspacePath,
    },
    preferredAgentId: input.preferredAgentId,
    mode: input.mode,
    presetId: input.presetId,
    studioProjectId: input.studioProjectId,
    activeFile: input.activeFile,
    project: input.project,
    memory: input.memory,
    knowledge: input.knowledge,
    task: input.task,
    codebase: mergeCodebaseContext(input.codebase, input.codebaseSearchResults),
    workflow: input.workflow,
    events: input.events,
    appSnapshot: input.appSnapshot,
    build: input.build,
  };
}

function mergeCodebaseContext(
  codebase: NssCodebaseContext | undefined,
  searchResults: NonNullable<NssCodebaseContext["searchResults"]> | undefined,
): NssCodebaseContext | undefined {
  if (!codebase && !searchResults) {
    return undefined;
  }

  if (!searchResults || searchResults.length === 0) {
    return codebase;
  }

  return {
    ...(codebase ?? {}),
    searchResults: [...(codebase?.searchResults ?? []), ...searchResults],
  };
}
