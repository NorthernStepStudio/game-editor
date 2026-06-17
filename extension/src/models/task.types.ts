export type NssTaskKind = "build" | "dev" | "lint" | "test" | "typecheck";
export type NssTaskStatus = "failed" | "running" | "succeeded";

export interface NssTaskResult {
  readonly id: string;
  readonly kind: NssTaskKind;
  readonly commandLine: string;
  readonly cwd: string;
  readonly status: NssTaskStatus;
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly summary: string;
  readonly likelyErrorFiles: readonly string[];
  readonly createdAt: string;
  readonly finishedAt: string;
}
