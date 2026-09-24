export interface FoundryVector2 {
  readonly x: number;
  readonly y: number;
}

export interface FoundryRuntimeNode {
  readonly path: string;
  readonly name: string;
  readonly type: string;
  readonly properties: Readonly<Record<string, unknown>>;
  readonly children: readonly FoundryRuntimeNode[];
}

export interface FoundryRuntimeError {
  readonly at: string;
  readonly message: string;
  readonly source?: string;
}

export interface FoundryPerformanceSample {
  readonly fps: number;
  readonly frameTimeMs: number;
  readonly memoryMb: number;
  readonly objectCount: number;
}

export interface FoundryRuntimeSnapshot {
  readonly protocol: "nss.foundry.runtime-snapshot.v1";
  readonly runtimeSessionId: string;
  readonly capturedAt: string;
  readonly scenePath: string | null;
  readonly ready: boolean;
  readonly tree: FoundryRuntimeNode | null;
  readonly errors: readonly FoundryRuntimeError[];
  readonly logs: readonly string[];
  readonly performance: FoundryPerformanceSample;
  readonly revision: number;
}

export type FoundryInputEvent =
  | { readonly type: "press"; readonly action: string; readonly strength?: number }
  | { readonly type: "release"; readonly action: string }
  | { readonly type: "key"; readonly key: string; readonly pressed: boolean }
  | {
      readonly type: "mouse";
      readonly x: number;
      readonly y: number;
      readonly button?: number;
      readonly pressed?: boolean;
    }
  | {
      readonly type: "touch";
      readonly index: number;
      readonly x: number;
      readonly y: number;
      readonly pressed: boolean;
    };

export interface FoundryReplayInput {
  readonly frame: number;
  readonly event: FoundryInputEvent;
}

export interface FoundryReplayCheckpoint {
  readonly frame: number;
  readonly stateHash?: string;
  readonly snapshotUri?: string;
  readonly screenshotUri?: string;
}

export interface FoundryReplayEvidenceRefs {
  readonly directory?: string | null;
  readonly trace?: string | null;
  readonly report?: string | null;
  readonly replayPlan?: string | null;
  readonly events?: string | null;
  readonly incidents?: string | null;
  readonly reproduction?: string | null;
  readonly screenshots?: string | null;
}

export interface FoundryReplayBundle {
  readonly protocol: "nss.foundry.replay.v1";
  readonly executionId: string;
  readonly runtimeSessionId?: string;
  readonly adapterId?: string;
  readonly seed?: number;
  readonly engineVersion?: string;
  readonly buildHash?: string;
  readonly timeline?: readonly FoundryReplayInput[];
  readonly checkpoints?: readonly FoundryReplayCheckpoint[];
  readonly evidence: FoundryReplayEvidenceRefs;
  readonly providerReport?: unknown;
}
