import {
  inspectFoundryRuntimeSnapshot,
  type FoundryRuntimeOracleOptions,
} from "../qa/oracles.js";
import type { FoundryInputEvent } from "../runtime/types.js";
import { hashFoundryEvidence } from "./hash.js";
import type {
  FoundryVerificationArtifact,
  FoundryVerificationProvider,
  FoundryVerificationReport,
  FoundryVerificationStep,
} from "./types.js";

export interface FoundryVerificationSessionOptions {
  readonly executionId: string;
  readonly runtimeSessionId: string;
  readonly seed?: number;
  readonly scene?: string;
  readonly oracle?: FoundryRuntimeOracleOptions;
}

export interface FoundryVerificationStepOptions {
  readonly frames: number;
  readonly inputs?: readonly FoundryInputEvent[];
  readonly watchedPaths?: readonly string[];
  readonly captureViewport?: boolean;
  readonly viewportName?: string;
  readonly drainEvents?: boolean;
}

export class FoundryVerificationSession {
  private readonly createdAt = new Date().toISOString();
  private readonly steps: FoundryVerificationStep[] = [];
  private readonly artifacts: FoundryVerificationArtifact[] = [];
  private initialSnapshot:
    | Awaited<ReturnType<FoundryVerificationProvider["snapshot"]>>
    | undefined;
  private started = false;
  private ended = false;

  constructor(
    private readonly provider: FoundryVerificationProvider,
    private readonly options: FoundryVerificationSessionOptions,
  ) {}

  async begin(): Promise<void> {
    if (this.started) throw new Error("Foundry verification session already started.");
    if (this.ended) throw new Error("Foundry verification session already ended.");
    this.started = true;
    if (this.provider.beginAgent) {
      await this.provider.beginAgent(this.options.runtimeSessionId);
    }
    this.initialSnapshot = await this.provider.snapshot(
      this.options.runtimeSessionId,
    );
  }

  async step(
    options: FoundryVerificationStepOptions,
  ): Promise<FoundryVerificationStep> {
    if (!this.started || this.ended) {
      throw new Error("Foundry verification session is not active.");
    }
    if (!Number.isInteger(options.frames) || options.frames <= 0) {
      throw new Error("Verification step frames must be a positive integer.");
    }
    if (!this.provider.stepAgent || !this.provider.observeAgent) {
      throw new Error(
        "Verification provider does not support deterministic agent stepping.",
      );
    }

    const startedAt = new Date().toISOString();
    const inputs = [...(options.inputs ?? [])];
    const watchedPaths = [...(options.watchedPaths ?? [])];

    await this.provider.stepAgent(
      this.options.runtimeSessionId,
      options.frames,
      inputs,
    );
    const observed = await this.provider.observeAgent(
      this.options.runtimeSessionId,
      watchedPaths,
      options.drainEvents ?? true,
    );
    const snapshot = await this.provider.snapshot(
      this.options.runtimeSessionId,
    );
    const incidents = inspectFoundryRuntimeSnapshot(
      snapshot,
      this.options.oracle,
    );
    const snapshotHash = hashFoundryEvidence(snapshot);

    let viewport: FoundryVerificationArtifact | undefined;
    if (options.captureViewport) {
      if (!this.provider.captureViewport) {
        throw new Error("Verification provider does not support viewport capture.");
      }
      const capture = await this.provider.captureViewport(
        this.options.runtimeSessionId,
        options.viewportName ?? `step-${this.steps.length + 1}`,
      );
      if (!capture.ok || !capture.path) {
        throw new Error(capture.error ?? "Viewport capture failed.");
      }
      viewport = {
        kind: "viewport",
        uri: capture.path,
        label: `${capture.width ?? "?"}x${capture.height ?? "?"}`,
      };
      this.artifacts.push(viewport);
    }

    const step: FoundryVerificationStep = {
      index: this.steps.length,
      frames: options.frames,
      inputs,
      watchedPaths,
      startedAt,
      finishedAt: new Date().toISOString(),
      ...(observed.status?.simulationFrames !== undefined
        ? { simulationFrame: observed.status.simulationFrames }
        : {}),
      ...(observed.nodes ? { observedNodes: observed.nodes } : {}),
      ...(observed.events ? { events: observed.events } : {}),
      snapshot,
      snapshotHash,
      ...(viewport ? { viewport } : {}),
      incidents,
    };
    this.steps.push(step);
    return step;
  }

  async finish(): Promise<FoundryVerificationReport> {
    if (!this.started || this.ended) {
      throw new Error("Foundry verification session is not active.");
    }
    this.ended = true;
    if (this.provider.endAgent) {
      await this.provider.endAgent(this.options.runtimeSessionId);
    }
    const finalSnapshot = await this.provider.snapshot(
      this.options.runtimeSessionId,
    );
    const incidents = [
      ...inspectFoundryRuntimeSnapshot(
        this.initialSnapshot!,
        this.options.oracle,
      ),
      ...this.steps.flatMap((step) => step.incidents),
      ...inspectFoundryRuntimeSnapshot(finalSnapshot, this.options.oracle),
    ];

    const reportCore = {
      protocol: "nss.foundry.verification-report.v1" as const,
      executionId: this.options.executionId,
      runtimeSessionId: this.options.runtimeSessionId,
      createdAt: this.createdAt,
      completedAt: new Date().toISOString(),
      ...(this.options.seed !== undefined ? { seed: this.options.seed } : {}),
      ...(this.options.scene ? { scene: this.options.scene } : {}),
      steps: this.steps,
      initialSnapshot: this.initialSnapshot,
      finalSnapshot,
      incidents,
      artifacts: this.artifacts,
    };
    return {
      ...reportCore,
      stateHash: hashFoundryEvidence(reportCore),
    };
  }
}
