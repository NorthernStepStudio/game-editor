import type { StudioRunEvent } from "../studio/run/types.js";

export type MatterhornRuntimeCapability =
  | "project-memory"
  | "browser-control"
  | "sandbox-execution"
  | "telemetry"
  | "agent-evaluation";

export type MatterhornCapabilityState = "ready" | "degraded" | "unavailable";

export interface MatterhornRuntimeHealth {
  readonly state: MatterhornCapabilityState;
  readonly diagnosticDetail?: string;
}

export interface MatterhornRuntimeAttribution {
  /**
   * Internal provenance only. Do not surface this object in product UI.
   * It exists so Northern Step Studio can satisfy licenses and audit the
   * implementation behind a Matterhorn-owned capability.
   */
  readonly sourceProject: string;
  readonly sourceUrl: string;
  readonly license: string;
}

export interface MatterhornRuntimeAdapterBase {
  readonly id: string;
  readonly capability: MatterhornRuntimeCapability;
  readonly attribution?: MatterhornRuntimeAttribution;
  health(): Promise<MatterhornRuntimeHealth>;
}

export interface MatterhornBrowserTab {
  readonly targetId: string;
  readonly title?: string;
  readonly url?: string;
  readonly type?: string;
}

export interface MatterhornBrowserAdapter extends MatterhornRuntimeAdapterBase {
  readonly capability: "browser-control";
  connect(): Promise<void>;
  listTabs(): Promise<readonly MatterhornBrowserTab[]>;
  useTab(targetId: string): Promise<void>;
  navigate(url: string): Promise<void>;
  getTitle(): Promise<string>;
  captureScreenshot(): Promise<string>;
}

export interface MatterhornProjectMemoryFact {
  readonly id: string;
  readonly name: string;
  readonly fact: string;
  readonly validAt?: string;
  readonly invalidAt?: string;
  readonly createdAt: string;
  readonly expiredAt?: string;
  readonly sourceNodeId?: string;
  readonly targetNodeId?: string;
  readonly episodeIds?: readonly string[];
}

export interface MatterhornProjectMemoryWrite {
  readonly projectId: string;
  readonly content: string;
  readonly source: string;
  readonly timestamp?: string;
  readonly id?: string;
  readonly role?: "user" | "assistant" | "system";
}

export interface MatterhornProjectMemorySearch {
  readonly projectId: string;
  readonly query: string;
  readonly maxFacts?: number;
}

export interface MatterhornProjectMemoryAdapter extends MatterhornRuntimeAdapterBase {
  readonly capability: "project-memory";
  remember(input: MatterhornProjectMemoryWrite): Promise<void>;
  search(input: MatterhornProjectMemorySearch): Promise<readonly MatterhornProjectMemoryFact[]>;
  forgetProject(projectId: string): Promise<void>;
}

export interface MatterhornAgentEvaluationRequest {
  readonly goal: string;
  readonly outcome: string;
  readonly criteria?: readonly string[];
  readonly threshold?: number;
}

export interface MatterhornAgentEvaluationResult {
  readonly passed: boolean;
  readonly score: number;
  readonly reason?: string;
  readonly metric: string;
}

export interface MatterhornAgentEvaluationAdapter extends MatterhornRuntimeAdapterBase {
  readonly capability: "agent-evaluation";
  evaluate(input: MatterhornAgentEvaluationRequest): Promise<MatterhornAgentEvaluationResult>;
}

export interface MatterhornSafeExecutionRequest {
  readonly profileId: string;
  readonly argv: readonly string[];
  readonly env?: Readonly<Record<string, string>>;
  readonly timeoutMs?: number;
}

export interface MatterhornSafeExecutionResult {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
  readonly durationMs: number;
}

export interface MatterhornSafeExecutionAdapter extends MatterhornRuntimeAdapterBase {
  readonly capability: "sandbox-execution";
  execute(input: MatterhornSafeExecutionRequest): Promise<MatterhornSafeExecutionResult>;
}

export interface MatterhornTelemetryAdapter extends MatterhornRuntimeAdapterBase {
  readonly capability: "telemetry";
  recordStudioEvent(event: StudioRunEvent): void | Promise<void>;
}

export interface MatterhornCapabilityStatus {
  readonly capability: MatterhornRuntimeCapability;
  readonly title: string;
  readonly state: MatterhornCapabilityState;
}

export interface MatterhornRuntimeDiagnostic {
  readonly id: string;
  readonly capability: MatterhornRuntimeCapability;
  readonly state: MatterhornCapabilityState;
  readonly diagnosticDetail?: string;
  readonly attribution?: MatterhornRuntimeAttribution;
}

const CAPABILITY_TITLES: Readonly<Record<MatterhornRuntimeCapability, string>> = {
  "project-memory": "Project memory",
  "browser-control": "Local browser",
  "sandbox-execution": "Safe execution",
  telemetry: "Run insights",
  "agent-evaluation": "Agent validation",
};

const CAPABILITIES = Object.keys(CAPABILITY_TITLES) as MatterhornRuntimeCapability[];

function validAdapterId(id: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{2,79}$/i.test(id);
}

function isTelemetryAdapter(adapter: MatterhornRuntimeAdapterBase): adapter is MatterhornTelemetryAdapter {
  return adapter.capability === "telemetry" && "recordStudioEvent" in adapter &&
    typeof (adapter as MatterhornTelemetryAdapter).recordStudioEvent === "function";
}

/**
 * Matterhorn-owned seam around reusable runtime engines.
 *
 * Product code should depend on this registry and Matterhorn capability
 * interfaces, never on a third-party framework's UI model, naming, or domain
 * objects. Third-party provenance stays available through diagnostics for
 * licensing and maintenance.
 */
export class MatterhornRuntimeCapabilityRegistry {
  private readonly adapters = new Map<MatterhornRuntimeCapability, MatterhornRuntimeAdapterBase>();

  register(adapter: MatterhornRuntimeAdapterBase): void {
    if (!validAdapterId(adapter.id)) throw new Error("Invalid Matterhorn runtime adapter id.");
    if (this.adapters.has(adapter.capability)) {
      throw new Error(`A Matterhorn runtime adapter is already registered for ${adapter.capability}.`);
    }
    this.adapters.set(adapter.capability, adapter);
  }

  get<T extends MatterhornRuntimeAdapterBase = MatterhornRuntimeAdapterBase>(
    capability: MatterhornRuntimeCapability,
  ): T | undefined {
    return this.adapters.get(capability) as T | undefined;
  }

  async publicStatus(): Promise<readonly MatterhornCapabilityStatus[]> {
    return Promise.all(CAPABILITIES.map(async capability => {
      const adapter = this.adapters.get(capability);
      if (!adapter) {
        return { capability, title: CAPABILITY_TITLES[capability], state: "unavailable" as const };
      }
      try {
        const health = await adapter.health();
        return { capability, title: CAPABILITY_TITLES[capability], state: health.state };
      } catch {
        return { capability, title: CAPABILITY_TITLES[capability], state: "degraded" as const };
      }
    }));
  }

  async diagnostics(): Promise<readonly MatterhornRuntimeDiagnostic[]> {
    return Promise.all([...this.adapters.values()].map(async adapter => {
      try {
        const health = await adapter.health();
        return {
          id: adapter.id,
          capability: adapter.capability,
          state: health.state,
          diagnosticDetail: health.diagnosticDetail,
          attribution: adapter.attribution,
        };
      } catch (error) {
        return {
          id: adapter.id,
          capability: adapter.capability,
          state: "degraded" as const,
          diagnosticDetail: error instanceof Error ? error.message : "Runtime adapter health check failed.",
          attribution: adapter.attribution,
        };
      }
    }));
  }

  recordStudioEvent(event: StudioRunEvent): void {
    const adapter = this.adapters.get("telemetry");
    if (!adapter || !isTelemetryAdapter(adapter)) return;
    try {
      const result = adapter.recordStudioEvent(structuredClone(event));
      if (result && typeof (result as Promise<void>).catch === "function") {
        void (result as Promise<void>).catch(() => undefined);
      }
    } catch {
      // Observability must never become an execution dependency.
    }
  }
}
