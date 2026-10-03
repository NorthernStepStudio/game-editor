import type { FoundryCriterionEvidenceV2 } from "../criteria/types.js";
import type { FoundryQaIncident } from "../qa/types.js";
import type {
  FoundryInputEvent,
  FoundryRuntimeSnapshot,
} from "../runtime/types.js";

export interface FoundryVerificationArtifact {
  readonly kind:
    | "runtime_snapshot"
    | "viewport"
    | "event_log"
    | "report"
    | "replay";
  readonly uri: string;
  readonly label?: string;
  readonly contentHash?: string;
}

export interface FoundryVerificationStep {
  readonly index: number;
  readonly frames: number;
  readonly inputs: readonly FoundryInputEvent[];
  readonly watchedPaths: readonly string[];
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly simulationFrame?: number;
  readonly observedNodes?: Readonly<
    Record<string, Readonly<Record<string, unknown>>>
  >;
  readonly events?: readonly unknown[];
  readonly snapshot?: FoundryRuntimeSnapshot;
  readonly snapshotHash?: string;
  readonly viewport?: FoundryVerificationArtifact;
  readonly incidents: readonly FoundryQaIncident[];
}

export interface FoundryVerificationReport {
  readonly protocol: "nss.foundry.verification-report.v1";
  readonly executionId: string;
  readonly runtimeSessionId: string;
  readonly createdAt: string;
  readonly completedAt: string;
  readonly seed?: number;
  readonly scene?: string;
  readonly steps: readonly FoundryVerificationStep[];
  readonly initialSnapshot?: FoundryRuntimeSnapshot;
  readonly finalSnapshot?: FoundryRuntimeSnapshot;
  readonly incidents: readonly FoundryQaIncident[];
  readonly criterionEvidence?: readonly FoundryCriterionEvidenceV2[];
  readonly artifacts: readonly FoundryVerificationArtifact[];
  readonly stateHash: string;
}

export interface FoundryVerificationProvider {
  snapshot(runtimeSessionId: string): Promise<FoundryRuntimeSnapshot>;
  beginAgent?(runtimeSessionId: string): Promise<unknown>;
  stepAgent?(
    runtimeSessionId: string,
    frames: number,
    inputs?: readonly FoundryInputEvent[],
  ): Promise<{ readonly stepId?: number; readonly frames?: number }>;
  observeAgent?(
    runtimeSessionId: string,
    paths: readonly string[],
    drainEvents?: boolean,
  ): Promise<{
    readonly status?: { readonly simulationFrames?: number };
    readonly nodes?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
    readonly events?: readonly unknown[];
  }>;
  endAgent?(runtimeSessionId: string): Promise<unknown>;
  captureViewport?(
    runtimeSessionId: string,
    name?: string,
  ): Promise<{
    readonly ok: boolean;
    readonly path?: string;
    readonly width?: number;
    readonly height?: number;
    readonly error?: string;
  }>;
}
