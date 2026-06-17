import type { ResponseOsLogger } from "./logger.js";

export interface NssEvent {
  readonly type: string;
  readonly timestamp: string;
  readonly metadata: Record<string, any>;
}

export interface NssAppSnapshot {
  readonly structureSummary: string;
  readonly activeFile?: string;
}

export type ResponseOsAgentId = "general" | "workspace-ops" | "stack-expert" | "architect";
export type NssWorkspaceKind = "api" | "fullstack" | "package" | "web" | "worker" | "unknown";
export type NssBuildScope = "feature" | "migration" | "package" | "workspace" | "app";

export type NssModeId = "coding" | "debugging" | "product" | "marketing" | "research" | "architect";

export type NssAskIntent =
  | "ask"
  | "ask-current-file"
  | "ask-error-file"
  | "analyze-task-failure"
  | "change-plan"
  | "explain-file"
  | "explain-project-structure"
  | "knowledge-search"
  | "generate-from-selection"
  | "propose-edit"
  | "propose-error-file-fix"
  | "propose-multi-file-change"
  | "review-refresh"
  | "workspace-briefing";

export type ResponseOsProviderMode = "off" | "mock" | "gemini";

export interface NssWorkspaceContext {
  readonly name: string;
  readonly rootPath?: string;
}

export interface NssFileContext {
  readonly path: string;
  readonly languageId: string;
  readonly content: string;
  readonly selection?: string;
}

export interface NssProjectContext {
  readonly structureSummary?: string;
}

export interface NssMemoryContext {
  readonly projectRules?: readonly string[];
  readonly repairPatterns?: readonly string[];
  readonly recurringFailures?: readonly string[];
}

export interface NssKnowledgeContextItem {
  readonly title: string;
  readonly path: string;
  readonly excerpt: string;
}

export interface NssTaskContext {
  readonly commandLine: string;
  readonly exitCode: number | null;
  readonly stderr: string;
  readonly summary: string;
  readonly likelyErrorFiles?: readonly string[];
}

export interface NssCodebaseContext {
  readonly relatedFiles?: readonly string[];
  readonly searchSummary?: readonly string[];
  readonly likelyErrorFiles?: readonly string[];
  readonly searchResults?: readonly {
    readonly path: string;
    readonly content: string;
    readonly score: number;
  }[];
  readonly schemas?: readonly {
    readonly path: string;
    readonly summary: string;
  }[];
  readonly docs?: readonly {
    readonly path: string;
    readonly summary: string;
  }[];
  readonly dependencies?: readonly {
    readonly app: string;
    readonly dependencies: readonly string[];
    readonly internalLinks: readonly string[];
  }[];
  readonly operations?: readonly {
    readonly path: string;
    readonly summary: string;
  }[];
}

export interface NssTemplateSuggestion {
  readonly id: "api-service" | "fullstack-app" | "shared-package" | "web-app" | "worker" | "custom";
  readonly title: string;
  readonly description: string;
  readonly rationale: string;
}

export interface NssBuildContext {
  readonly goal: string;
  readonly scope: NssBuildScope;
  readonly target: string;
  readonly workspaceKind: NssWorkspaceKind;
  readonly frameworks: readonly string[];
  readonly runtimes: readonly string[];
  readonly databases: readonly string[];
  readonly testTools: readonly string[];
  readonly focusAreas: readonly string[];
  readonly template: NssTemplateSuggestion;
  readonly steps: readonly string[];
  readonly validation: readonly string[];
  readonly rollback: readonly string[];
  readonly relatedFiles?: readonly {
    readonly path: string;
    readonly score: number;
  }[];
}

export interface NssWorkflowContext {
  readonly title: string;
  readonly currentStep: string;
}

export interface NssAskRequestPayload {
  readonly prompt: string;
  readonly intent: NssAskIntent;
  readonly workspace: NssWorkspaceContext;
  readonly preferredAgentId?: ResponseOsAgentId;
  readonly mode?: NssModeId;
  readonly presetId?: string;
  readonly studioProjectId?: string;
  readonly activeFile?: NssFileContext;
  readonly project?: NssProjectContext;
  readonly memory?: NssMemoryContext;
  readonly knowledge?: readonly NssKnowledgeContextItem[];
  readonly task?: NssTaskContext;
  readonly codebase?: NssCodebaseContext;
  readonly workflow?: NssWorkflowContext;
  readonly events?: readonly NssEvent[];
  readonly appSnapshot?: NssAppSnapshot;
  readonly build?: NssBuildContext;
}

export interface NssAskResponse {
  readonly title?: string;
  readonly response: string;
  readonly proposedText?: string;
  readonly preview?: string;
  readonly proposedMemories?: readonly {
    readonly content: string;
    readonly tags: readonly string[];
  }[];
}

export interface NssHealthResponse {
  readonly status: "ok";
  readonly mode: ResponseOsProviderMode;
  readonly detail: string;
  readonly checkedAt: string;
}

export interface ResponseOsBudget {
  readonly temperature: number;
  readonly maxOutputTokens: number;
}

export interface ResponseOsAgent {
  readonly id: ResponseOsAgentId;
  readonly title: string;
  readonly summary: string;
  readonly systemInstruction: string;
}

export interface ResponseOsProviderRequest {
  readonly request: NssAskRequestPayload;
  readonly agent: ResponseOsAgent;
  readonly budget: ResponseOsBudget;
  readonly logger: ResponseOsLogger;
}

export interface ResponseOsProvider {
  readonly id: ResponseOsProviderMode;
  describe(): string;
  generate(input: ResponseOsProviderRequest): Promise<NssAskResponse>;
}

export interface ResponseOsRuntimeConfig {
  readonly providerMode: ResponseOsProviderMode;
  readonly geminiApiKey?: string;
  readonly geminiModel?: string;
  readonly geminiBaseUrl?: string;
  readonly requestTimeoutMs: number;
  readonly logger?: ResponseOsLogger;
}

export interface ResponseOsRuntime {
  readonly providerMode: ResponseOsProviderMode;
  describeProvider(): string;
  run(request: NssAskRequestPayload): Promise<NssAskResponse>;
}
