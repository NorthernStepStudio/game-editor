export type MatterhornModelRole =
  | "reasoning"
  | "coding"
  | "fast"
  | "vision"
  | "local";

export type MatterhornModelCapability =
  | "text"
  | "streaming"
  | "tools"
  | "vision"
  | "structured_output"
  | "reasoning";

export type MatterhornToolRisk =
  | "read"
  | "write"
  | "execute"
  | "network"
  | "external_cost";

export interface MatterhornModelDescriptor {
  readonly providerId: string;
  readonly modelId: string;
  readonly label: string;
  readonly roles: readonly MatterhornModelRole[];
  readonly capabilities: readonly MatterhornModelCapability[];
  readonly local: boolean;
  readonly requiresNetwork: boolean;
  readonly externalCost: boolean;
  readonly contextWindow?: number;
}

export interface MatterhornModelMessage {
  readonly role: "system" | "user" | "assistant" | "tool";
  readonly content: string;
  readonly toolCallId?: string;
  readonly name?: string;
}

export interface MatterhornToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
  readonly risk: MatterhornToolRisk;
}

export interface MatterhornToolCall {
  readonly id: string;
  readonly name: string;
  readonly args: Readonly<Record<string, unknown>>;
}

export interface MatterhornToolResult {
  readonly callId: string;
  readonly name: string;
  readonly ok: boolean;
  readonly output?: unknown;
  readonly error?: string;
}

export interface MatterhornModelUsage {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
  readonly estimatedCost?: {
    readonly currency: string;
    readonly amount: number;
  };
}

export type MatterhornModelFinishReason =
  | "stop"
  | "tool_calls"
  | "length"
  | "content_filter"
  | "error"
  | "unknown";

export interface MatterhornModelRequest {
  readonly messages: readonly MatterhornModelMessage[];
  readonly tools?: readonly MatterhornToolDefinition[];
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface MatterhornModelResponse {
  readonly text: string;
  readonly toolCalls: readonly MatterhornToolCall[];
  readonly finishReason: MatterhornModelFinishReason;
  readonly usage?: MatterhornModelUsage;
}

export interface MatterhornModelProvider {
  readonly id: string;
  readonly models: readonly MatterhornModelDescriptor[];
  describe(): string;
  invoke(
    modelId: string,
    request: MatterhornModelRequest,
  ): Promise<MatterhornModelResponse>;
}

export interface MatterhornModelRouteRequest {
  readonly role: MatterhornModelRole;
  readonly requiredCapabilities?: readonly MatterhornModelCapability[];
  readonly preferredProviderId?: string;
  readonly preferredModelId?: string;
}

export interface MatterhornModelRoutingPolicy {
  readonly preferLocal: boolean;
  readonly allowNetwork: boolean;
  readonly allowExternalCost: boolean;
  readonly allowFallback: boolean;
  readonly allowedProviders?: readonly string[];
  readonly blockedProviders?: readonly string[];
}

export interface MatterhornModelRoute {
  readonly provider: MatterhornModelProvider;
  readonly model: MatterhornModelDescriptor;
  readonly reasons: readonly string[];
}

export type MatterhornToolPolicyMode =
  | "auto"
  | "approval"
  | "disabled";

export interface MatterhornToolPolicy {
  readonly mode: MatterhornToolPolicyMode;
}

export interface MatterhornToolExecutor {
  readonly tools: readonly MatterhornToolDefinition[];
  execute(call: MatterhornToolCall): Promise<MatterhornToolResult>;
}

export interface MatterhornAgentLimits {
  readonly maxTurns: number;
  readonly maxToolCalls: number;
  readonly maxRepeatedToolCalls: number;
}

export interface MatterhornAgentApprovalDecision {
  readonly callId: string;
  readonly approved: boolean;
}

export interface MatterhornAgentState {
  readonly route: {
    readonly providerId: string;
    readonly modelId: string;
  };
  readonly messages: readonly MatterhornModelMessage[];
  readonly turns: number;
  readonly toolCalls: number;
  readonly repeatedToolCallCounts: Readonly<Record<string, number>>;
  readonly pendingToolCalls: readonly MatterhornToolCall[];
  readonly accumulatedUsage: MatterhornModelUsage;
}

export type MatterhornAgentStatus =
  | "completed"
  | "approval_required"
  | "failed";

export interface MatterhornAgentRunResult {
  readonly status: MatterhornAgentStatus;
  readonly text: string;
  readonly state: MatterhornAgentState;
  readonly pendingApprovals?: readonly MatterhornToolCall[];
  readonly error?: string;
}

export interface MatterhornAgentRunInput {
  readonly route: MatterhornModelRouteRequest;
  readonly routingPolicy: MatterhornModelRoutingPolicy;
  readonly system: string;
  readonly messages: readonly MatterhornModelMessage[];
  readonly toolExecutor: MatterhornToolExecutor;
  readonly toolPolicies?: Readonly<Record<string, MatterhornToolPolicy>>;
  readonly limits?: Partial<MatterhornAgentLimits>;
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
}
