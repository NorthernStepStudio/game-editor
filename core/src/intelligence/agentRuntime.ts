import { createHash } from "node:crypto";
import { MatterhornModelGateway } from "./gateway.js";
import { resolveMatterhornToolPolicy } from "./toolPolicy.js";
import type {
  MatterhornAgentApprovalDecision,
  MatterhornAgentLimits,
  MatterhornAgentRunInput,
  MatterhornAgentRunResult,
  MatterhornAgentState,
  MatterhornModelUsage,
  MatterhornToolCall,
  MatterhornToolDefinition,
} from "./types.js";

const DEFAULT_LIMITS: MatterhornAgentLimits = {
  maxTurns: 12,
  maxToolCalls: 24,
  maxRepeatedToolCalls: 3,
};

export class MatterhornAgentRuntime {
  constructor(private readonly gateway: MatterhornModelGateway) {}

  async run(input: MatterhornAgentRunInput): Promise<MatterhornAgentRunResult> {
    const route = this.gateway.route(input.route, input.routingPolicy);
    const state: MatterhornAgentState = {
      route: {
        providerId: route.provider.id,
        modelId: route.model.modelId,
      },
      messages: [
        { role: "system", content: input.system },
        ...input.messages,
      ],
      turns: 0,
      toolCalls: 0,
      repeatedToolCallCounts: {},
      pendingToolCalls: [],
      accumulatedUsage: {},
    };
    return this.continue(input, state, []);
  }

  async resume(
    input: MatterhornAgentRunInput,
    state: MatterhornAgentState,
    decisions: readonly MatterhornAgentApprovalDecision[],
  ): Promise<MatterhornAgentRunResult> {
    const route = this.gateway.route(
      {
        ...input.route,
        preferredProviderId: state.route.providerId,
        preferredModelId: state.route.modelId,
      },
      {
        ...input.routingPolicy,
        allowFallback: false,
      },
    );

    if (
      route.provider.id !== state.route.providerId ||
      route.model.modelId !== state.route.modelId
    ) {
      return failed(state, "Agent route changed while awaiting approval.");
    }

    return this.continue(input, state, decisions);
  }

  private async continue(
    input: MatterhornAgentRunInput,
    initialState: MatterhornAgentState,
    decisions: readonly MatterhornAgentApprovalDecision[],
  ): Promise<MatterhornAgentRunResult> {
    const limits = normalizeLimits(input.limits);
    const route = this.gateway.route(
      {
        ...input.route,
        preferredProviderId: initialState.route.providerId,
        preferredModelId: initialState.route.modelId,
      },
      {
        ...input.routingPolicy,
        allowFallback: false,
      },
    );

    let state = cloneState(initialState);

    if (state.pendingToolCalls.length) {
      const decisionMap = new Map(
        decisions.map((decision) => [decision.callId, decision.approved]),
      );
      if (
        state.pendingToolCalls.some(
          (call) => !decisionMap.has(call.id),
        )
      ) {
        return {
          status: "approval_required",
          text: "Tool approval is required before Matterhorn can continue.",
          state,
          pendingApprovals: state.pendingToolCalls,
        };
      }

      for (const call of state.pendingToolCalls) {
        const approved = decisionMap.get(call.id) === true;
        if (!approved) {
          state = appendToolResult(state, {
            callId: call.id,
            name: call.name,
            ok: false,
            error: "User denied this tool call.",
          });
          continue;
        }
        const executed = await input.toolExecutor.execute(call);
        state = appendToolResult(state, executed);
      }
      state = { ...state, pendingToolCalls: [] };
    }

    const tools = new Map(
      input.toolExecutor.tools.map((tool) => [tool.name, tool]),
    );

    while (state.turns < limits.maxTurns) {
      const response = await route.provider.invoke(
        route.model.modelId,
        {
          messages: state.messages,
          tools: input.toolExecutor.tools,
          temperature: input.temperature,
          maxOutputTokens: input.maxOutputTokens,
        },
      );

      state = {
        ...state,
        turns: state.turns + 1,
        accumulatedUsage: mergeUsage(
          state.accumulatedUsage,
          response.usage,
        ),
      };

      if (response.text.trim() || response.toolCalls.length) {
        state = appendMessage(state, {
          role: "assistant",
          content: response.text,
          ...(response.toolCalls.length
            ? { toolCalls: response.toolCalls }
            : {}),
        });
      }

      if (!response.toolCalls.length) {
        return {
          status: "completed",
          text: response.text,
          state,
        };
      }

      if (
        state.toolCalls + response.toolCalls.length >
        limits.maxToolCalls
      ) {
        return failed(
          state,
          `Agent tool-call limit exceeded (${limits.maxToolCalls}).`,
        );
      }

      const pending: MatterhornToolCall[] = [];
      for (const call of response.toolCalls) {
        const tool = tools.get(call.name);
        if (!tool) {
          return failed(
            state,
            `Model requested unknown tool: ${call.name}`,
          );
        }

        const fingerprint = toolFingerprint(call);
        const count =
          (state.repeatedToolCallCounts[fingerprint] ?? 0) + 1;
        if (count > limits.maxRepeatedToolCalls) {
          return failed(
            state,
            `Repeated tool-call guard triggered for ${call.name}.`,
          );
        }

        state = {
          ...state,
          toolCalls: state.toolCalls + 1,
          repeatedToolCallCounts: {
            ...state.repeatedToolCallCounts,
            [fingerprint]: count,
          },
        };

        const policy = resolveMatterhornToolPolicy(
          tool,
          input.toolPolicies,
        );
        if (policy.mode === "disabled") {
          return failed(
            state,
            `Tool is disabled by policy: ${call.name}`,
          );
        }
        if (policy.mode === "approval") {
          pending.push(call);
          continue;
        }

        const result = await input.toolExecutor.execute(call);
        state = appendToolResult(state, result);
      }

      if (pending.length) {
        state = { ...state, pendingToolCalls: pending };
        return {
          status: "approval_required",
          text: "Tool approval is required before Matterhorn can continue.",
          state,
          pendingApprovals: pending,
        };
      }
    }

    return failed(
      state,
      `Agent turn limit exceeded (${limits.maxTurns}).`,
    );
  }
}

function normalizeLimits(
  overrides: Partial<MatterhornAgentLimits> | undefined,
): MatterhornAgentLimits {
  const limits = { ...DEFAULT_LIMITS, ...overrides };
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isInteger(value) || value <= 0 || value > 100) {
      throw new Error(`Invalid agent limit ${name}.`);
    }
  }
  return limits;
}

function appendMessage(
  state: MatterhornAgentState,
  message: MatterhornAgentState["messages"][number],
): MatterhornAgentState {
  return {
    ...state,
    messages: [...state.messages, message],
  };
}

function appendToolResult(
  state: MatterhornAgentState,
  result: {
    readonly callId: string;
    readonly name: string;
    readonly ok: boolean;
    readonly output?: unknown;
    readonly error?: string;
  },
): MatterhornAgentState {
  return appendMessage(state, {
    role: "tool",
    toolCallId: result.callId,
    name: result.name,
    content: JSON.stringify(
      result.ok
        ? { ok: true, output: result.output }
        : { ok: false, error: result.error ?? "Tool failed." },
    ),
  });
}

function failed(
  state: MatterhornAgentState,
  error: string,
): MatterhornAgentRunResult {
  return {
    status: "failed",
    text: "",
    state,
    error,
  };
}

function cloneState(state: MatterhornAgentState): MatterhornAgentState {
  return {
    ...state,
    messages: [...state.messages],
    repeatedToolCallCounts: { ...state.repeatedToolCallCounts },
    pendingToolCalls: [...state.pendingToolCalls],
    accumulatedUsage: { ...state.accumulatedUsage },
  };
}

function toolFingerprint(call: MatterhornToolCall): string {
  return createHash("sha256")
    .update(`${call.name}\n${stableSerialize(call.args)}`)
    .digest("hex");
}

function stableSerialize(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }
  const record = value as Readonly<Record<string, unknown>>;
  return `{${Object.keys(record)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${stableSerialize(record[key])}`,
    )
    .join(",")}}`;
}

function mergeUsage(
  current: MatterhornModelUsage,
  next: MatterhornModelUsage | undefined,
): MatterhornModelUsage {
  if (!next) return current;

  const inputTokens =
    (current.inputTokens ?? 0) + (next.inputTokens ?? 0);
  const outputTokens =
    (current.outputTokens ?? 0) + (next.outputTokens ?? 0);
  const totalTokens =
    (current.totalTokens ?? 0) +
    (next.totalTokens ??
      (next.inputTokens ?? 0) + (next.outputTokens ?? 0));

  const costs = [current.estimatedCost, next.estimatedCost].filter(
    (cost): cost is NonNullable<MatterhornModelUsage["estimatedCost"]> =>
      Boolean(cost),
  );
  const estimatedCost =
    costs.length === 0
      ? undefined
      : costs.every((cost) => cost.currency === costs[0].currency)
        ? {
            currency: costs[0].currency,
            amount: costs.reduce((sum, cost) => sum + cost.amount, 0),
          }
        : undefined;

  return {
    ...(inputTokens ? { inputTokens } : {}),
    ...(outputTokens ? { outputTokens } : {}),
    ...(totalTokens ? { totalTokens } : {}),
    ...(estimatedCost ? { estimatedCost } : {}),
  };
}
