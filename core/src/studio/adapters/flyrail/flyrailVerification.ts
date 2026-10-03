import type {
  FoundryInputEvent,
  FoundryReplayBundle,
  FoundryRuntimeNode,
  FoundryRuntimeSnapshot,
} from "../../../foundry/runtime/index.js";
import { FlyrailClient, type FlyrailClientOptions } from "./flyrailClient.js";
import { SpecialistError } from "../types.js";

export interface FlyrailVerificationCapabilities {
  readonly runtimeSnapshot: boolean;
  readonly input: boolean;
  readonly frameAdvance: boolean;
  readonly screenshot: boolean;
  readonly performance: boolean;
  readonly agentPlaytest: boolean;
  readonly agentStep: boolean;
  readonly viewportCapture: boolean;
  readonly runtimeEvents: boolean;
}

export interface FlyrailVerificationClientOptions extends FlyrailClientOptions {
  readonly projectPath?: string;
}

export interface FlyrailRuntimeLaunchOptions {
  readonly scene?: string;
  readonly seed?: number;
  readonly headless?: boolean;
  readonly agentAutopause?: boolean;
  readonly quitAfter?: number;
}

export interface FlyrailAgentPlaytestOptions {
  readonly seed?: number;
  readonly captureScreenshots?: boolean;
  readonly budget?: Readonly<Record<string, number>>;
}

export interface FlyrailAgentStepStatus {
  readonly active: boolean;
  readonly paused: boolean;
  readonly stepId: number;
  readonly remainingFrames: number;
  readonly simulationFrames: number;
}

export interface FlyrailAgentStepAccepted {
  readonly ok: boolean;
  readonly stepId: number;
  readonly frames: number;
}

export interface FlyrailAgentObserveResult {
  readonly status: FlyrailAgentStepStatus;
  readonly scenePath: string | null;
  readonly performance: {
    readonly fps: number;
    readonly frameTimeMs: number;
    readonly memoryMb: number;
    readonly objectCount: number;
  };
  readonly nodes: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly events: readonly {
    readonly name: string;
    readonly frame: number;
    readonly payload?: Readonly<Record<string, unknown>>;
  }[];
}

export interface FlyrailViewportCaptureResult {
  readonly ok: boolean;
  readonly path?: string;
  readonly width?: number;
  readonly height?: number;
  readonly error?: string;
}

interface FlyrailCapabilitiesResponse {
  readonly phase?: number;
  readonly capabilities?: readonly string[];
}

interface FlyrailRuntimeSnapshotShape {
  readonly sessionId?: string;
  readonly scenePath?: string | null;
  readonly ready?: boolean;
  readonly tree?: FlyrailRuntimeNodeShape | null;
  readonly errors?: readonly {
    readonly at?: string;
    readonly message?: string;
    readonly source?: string;
  }[];
  readonly logs?: readonly string[];
  readonly performance?: {
    readonly fps?: number;
    readonly frameTimeMs?: number;
    readonly memoryMb?: number;
    readonly objectCount?: number;
  };
  readonly revision?: number;
}

interface FlyrailRuntimeNodeShape {
  readonly path?: string;
  readonly name?: string;
  readonly type?: string;
  readonly properties?: Readonly<Record<string, unknown>>;
  readonly children?: readonly FlyrailRuntimeNodeShape[];
}

interface FlyrailAgentRunShape {
  readonly runId?: string;
  readonly adapterId?: string;
  readonly report?: unknown;
  readonly evidence?: {
    readonly directory?: string | null;
    readonly trace?: string | null;
    readonly report?: string | null;
    readonly replayPlan?: string | null;
    readonly events?: string | null;
    readonly incidents?: string | null;
    readonly reproduction?: string | null;
    readonly screenshots?: string | null;
  };
}

interface FlyrailRuntimeLaunchShape {
  readonly sessionId?: string;
  readonly runtimeSessionId?: string;
  readonly runtime?: {
    readonly sessionId?: string;
  };
}

export function deriveFlyrailVerificationCapabilities(
  response: FlyrailCapabilitiesResponse,
): FlyrailVerificationCapabilities {
  const phase = response.phase ?? 0;
  const caps = new Set(response.capabilities ?? []);
  const explicit = caps.size > 0;
  const has = (capability: string, minimumPhase: number) =>
    explicit ? caps.has(capability) : phase >= minimumPhase;

  return {
    runtimeSnapshot: has("godot.project.run", 5),
    input: has("godot.input.send", 6),
    frameAdvance: has("godot.frame.advance", 6),
    screenshot: has("godot.screenshot.capture", 7),
    performance: has("godot.performance.capture", 11),
    agentPlaytest: has("godot.explore.run", 13),
    agentStep: caps.has("godot.runtime.agent_step"),
    viewportCapture: caps.has("godot.runtime.viewport_capture"),
    runtimeEvents: caps.has("godot.runtime.events"),
  };
}

export function extractFlyrailRuntimeSessionId(
  response: FlyrailRuntimeLaunchShape,
): string {
  const runtimeSessionId =
    response.runtimeSessionId ??
    response.runtime?.sessionId ??
    response.sessionId ??
    "";
  if (!runtimeSessionId) {
    throw new SpecialistError(
      "EXECUTION_FAILED",
      "Flyrail runtime.launch did not return a runtime session id.",
    );
  }
  return runtimeSessionId;
}

export function mapFlyrailRuntimeSnapshot(
  raw: FlyrailRuntimeSnapshotShape,
  capturedAt = new Date().toISOString(),
): FoundryRuntimeSnapshot {
  const runtimeSessionId = String(raw.sessionId ?? "");
  if (!runtimeSessionId) {
    throw new SpecialistError(
      "VALIDATION_FAILED",
      "Flyrail runtime snapshot did not include a sessionId.",
    );
  }

  return {
    protocol: "nss.foundry.runtime-snapshot.v1",
    runtimeSessionId,
    capturedAt,
    scenePath: raw.scenePath ?? null,
    ready: raw.ready === true,
    tree: raw.tree ? mapNode(raw.tree) : null,
    errors: (raw.errors ?? []).map((error) => ({
      at: String(error.at ?? ""),
      message: String(error.message ?? ""),
      ...(error.source ? { source: error.source } : {}),
    })),
    logs: [...(raw.logs ?? [])],
    performance: {
      fps: Number(raw.performance?.fps ?? 0),
      frameTimeMs: Number(raw.performance?.frameTimeMs ?? 0),
      memoryMb: Number(raw.performance?.memoryMb ?? 0),
      objectCount: Number(raw.performance?.objectCount ?? 0),
    },
    revision: Number(raw.revision ?? 0),
  };
}

export function mapFlyrailAgentRunToReplayBundle(
  raw: FlyrailAgentRunShape,
  runtimeSessionId: string,
  seed?: number,
): FoundryReplayBundle {
  const executionId = String(raw.runId ?? "");
  if (!executionId) {
    throw new SpecialistError(
      "VALIDATION_FAILED",
      "Flyrail agent playtest did not return a runId.",
    );
  }

  return {
    protocol: "nss.foundry.replay.v1",
    executionId,
    runtimeSessionId,
    ...(raw.adapterId ? { adapterId: raw.adapterId } : {}),
    ...(seed !== undefined ? { seed } : {}),
    evidence: {
      directory: raw.evidence?.directory,
      trace: raw.evidence?.trace,
      report: raw.evidence?.report,
      replayPlan: raw.evidence?.replayPlan,
      events: raw.evidence?.events,
      incidents: raw.evidence?.incidents,
      reproduction: raw.evidence?.reproduction,
      screenshots: raw.evidence?.screenshots,
    },
    providerReport: raw.report,
  };
}

export class FlyrailVerificationClient {
  private readonly client: FlyrailClient;
  private readonly defaultProjectPath?: string;
  private readonly sessions = new Map<string, string>();
  private capabilities: FlyrailVerificationCapabilities | null = null;

  constructor(options: FlyrailVerificationClientOptions = {}) {
    this.client = new FlyrailClient(options);
    this.defaultProjectPath = options.projectPath;
  }

  async getCapabilities(): Promise<FlyrailVerificationCapabilities> {
    if (this.capabilities) return this.capabilities;
    const response = (await this.client.call(
      "system.capabilities",
    )) as FlyrailCapabilitiesResponse;
    this.capabilities = deriveFlyrailVerificationCapabilities(response);
    return this.capabilities;
  }

  async ensureSession(projectPath = this.defaultProjectPath): Promise<string> {
    if (!projectPath) {
      throw new SpecialistError(
        "PROJECT_UNAVAILABLE",
        "Foundry verification requires a Godot project path.",
      );
    }
    const existing = this.sessions.get(projectPath);
    if (existing) return existing;

    const response = (await this.client.call("project.open", {
      path: projectPath,
      installAddons: false,
    })) as { sessionId?: string };

    if (!response.sessionId) {
      throw new SpecialistError(
        "PROJECT_UNAVAILABLE",
        "Flyrail project.open did not return a sessionId.",
      );
    }
    this.sessions.set(projectPath, response.sessionId);
    return response.sessionId;
  }

  async launchRuntime(
    options: FlyrailRuntimeLaunchOptions = {},
    projectPath = this.defaultProjectPath,
  ): Promise<string> {
    await this.requireCapability("runtimeSnapshot");
    const sessionId = await this.ensureSession(projectPath);
    const response = (await this.client.call("runtime.launch", {
      sessionId,
      ...(options.scene ? { scene: options.scene } : {}),
      ...(options.seed !== undefined ? { seed: options.seed } : {}),
      ...(options.headless !== undefined ? { headless: options.headless } : {}),
      ...(options.agentAutopause !== undefined
        ? { agentAutopause: options.agentAutopause }
        : {}),
      ...(options.quitAfter !== undefined ? { quitAfter: options.quitAfter } : {}),
    })) as FlyrailRuntimeLaunchShape;

    return extractFlyrailRuntimeSessionId(response);
  }

  async snapshot(runtimeSessionId: string): Promise<FoundryRuntimeSnapshot> {
    await this.requireCapability("runtimeSnapshot");
    const response = (await this.client.call("runtime.snapshot", {
      runtimeSessionId,
    })) as FlyrailRuntimeSnapshotShape;
    return mapFlyrailRuntimeSnapshot(response);
  }

  async press(
    runtimeSessionId: string,
    action: string,
    strength = 1,
  ): Promise<unknown> {
    await this.requireCapability("input");
    return this.client.call("input.press", {
      runtimeSessionId,
      action,
      strength,
    });
  }

  async release(runtimeSessionId: string, action: string): Promise<unknown> {
    await this.requireCapability("input");
    return this.client.call("input.release", { runtimeSessionId, action });
  }

  async advanceFrames(
    runtimeSessionId: string,
    frames: number,
  ): Promise<{ frame: number }> {
    await this.requireCapability("frameAdvance");
    this.validateFrameCount(frames);
    return (await this.client.call("scenario.advance", {
      runtimeSessionId,
      frames,
    })) as { frame: number };
  }

  async waitForCondition(
    runtimeSessionId: string,
    condition: {
      readonly path: string;
      readonly property: string;
      readonly equals?: unknown;
      readonly approx?: { readonly value: number; readonly tolerance: number };
      readonly timeoutFrames?: number;
    },
  ): Promise<{ frame: number; ok: boolean }> {
    await this.requireCapability("frameAdvance");
    return (await this.client.call("scenario.wait_condition", {
      runtimeSessionId,
      path: condition.path,
      property: condition.property,
      ...(condition.equals !== undefined ? { equals: condition.equals } : {}),
      ...(condition.approx ? { approx: condition.approx } : {}),
      ...(condition.timeoutFrames !== undefined
        ? { timeoutFrames: condition.timeoutFrames }
        : {}),
    })) as { frame: number; ok: boolean };
  }

  async beginAgent(runtimeSessionId: string): Promise<FlyrailAgentStepStatus> {
    await this.requireCapability("agentStep");
    return (await this.client.call("runtime.agent_begin", {
      runtimeSessionId,
    })) as FlyrailAgentStepStatus;
  }

  async getAgentStatus(runtimeSessionId: string): Promise<FlyrailAgentStepStatus> {
    await this.requireCapability("agentStep");
    return (await this.client.call("runtime.agent_status", {
      runtimeSessionId,
    })) as FlyrailAgentStepStatus;
  }

  async stepAgent(
    runtimeSessionId: string,
    frames: number,
    inputs: readonly FoundryInputEvent[] = [],
  ): Promise<FlyrailAgentStepAccepted> {
    await this.requireCapability("agentStep");
    this.validateFrameCount(frames);
    return (await this.client.call("runtime.agent_step", {
      runtimeSessionId,
      frames,
      inputs,
    })) as FlyrailAgentStepAccepted;
  }

  async observeAgent(
    runtimeSessionId: string,
    paths: readonly string[],
    drainEvents = false,
  ): Promise<FlyrailAgentObserveResult> {
    await this.requireCapability("agentStep");
    return (await this.client.call("runtime.agent_observe", {
      runtimeSessionId,
      paths,
      drainEvents,
    })) as FlyrailAgentObserveResult;
  }

  async endAgent(runtimeSessionId: string): Promise<FlyrailAgentStepStatus> {
    await this.requireCapability("agentStep");
    return (await this.client.call("runtime.agent_end", {
      runtimeSessionId,
    })) as FlyrailAgentStepStatus;
  }

  async captureViewport(
    runtimeSessionId: string,
    name = "foundry-proof",
  ): Promise<FlyrailViewportCaptureResult> {
    await this.requireCapability("viewportCapture");
    return (await this.client.call("runtime.capture_viewport", {
      runtimeSessionId,
      name,
    })) as FlyrailViewportCaptureResult;
  }

  async drainRuntimeEvents(
    runtimeSessionId: string,
  ): Promise<FlyrailAgentObserveResult["events"]> {
    await this.requireCapability("runtimeEvents");
    return (await this.client.call("runtime.events", {
      runtimeSessionId,
    })) as FlyrailAgentObserveResult["events"];
  }

  async runAgentPlaytest(
    runtimeSessionId: string,
    manifest: unknown,
    options: FlyrailAgentPlaytestOptions = {},
  ): Promise<{ replay: FoundryReplayBundle; raw: unknown }> {
    await this.requireCapability("agentPlaytest");
    const raw = (await this.client.call("playtest.agent_run", {
      runtimeSessionId,
      manifest,
      ...(options.seed !== undefined ? { seed: options.seed } : {}),
      ...(options.captureScreenshots !== undefined
        ? { captureScreenshots: options.captureScreenshots }
        : {}),
      ...(options.budget ? { budget: options.budget } : {}),
    })) as FlyrailAgentRunShape;

    return {
      raw,
      replay: mapFlyrailAgentRunToReplayBundle(
        raw,
        runtimeSessionId,
        options.seed,
      ),
    };
  }

  async stopRuntime(runtimeSessionId: string): Promise<unknown> {
    return this.client.call("runtime.stop", { runtimeSessionId });
  }

  disconnect(): void {
    this.client.disconnect();
    this.sessions.clear();
    this.capabilities = null;
  }

  private async requireCapability(
    capability: keyof FlyrailVerificationCapabilities,
  ): Promise<void> {
    const capabilities = await this.getCapabilities();
    if (!capabilities[capability]) {
      throw new SpecialistError(
        "UNSUPPORTED_CAPABILITY",
        `Flyrail does not expose Foundry verification capability: ${capability}.`,
      );
    }
  }

  private validateFrameCount(frames: number): void {
    if (!Number.isInteger(frames) || frames <= 0) {
      throw new SpecialistError(
        "INVALID_TASK",
        "Frame advance requires a positive integer frame count.",
      );
    }
  }
}

function mapNode(raw: FlyrailRuntimeNodeShape): FoundryRuntimeNode {
  return {
    path: String(raw.path ?? ""),
    name: String(raw.name ?? ""),
    type: String(raw.type ?? ""),
    properties: { ...(raw.properties ?? {}) },
    children: (raw.children ?? []).map(mapNode),
  };
}
