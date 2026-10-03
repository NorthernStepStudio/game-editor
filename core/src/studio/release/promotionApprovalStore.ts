import { createHash, randomUUID } from "node:crypto";
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { StudioRun } from "../runTypes.js";

export interface MatterhornPromotionApproval {
  readonly runId: string;
  readonly runSnapshotHash: string;
  readonly approvedAt: string;
  readonly approvedBy: "local-human";
  readonly note?: string;
}

export interface MatterhornPromotionStatus {
  readonly runId: string;
  readonly state: "not-eligible" | "approval-required" | "approved" | "stale";
  readonly eligible: boolean;
  readonly approval?: MatterhornPromotionApproval;
  readonly detail: string;
}

function approvalHash(run: StudioRun): string {
  const snapshot = JSON.stringify({
    id: run.id,
    status: run.status,
    plan: run.plan,
    tasks: run.tasks,
    detail: run.detail ?? null,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  });
  return createHash("sha256").update(snapshot).digest("hex");
}

function validRunId(value: string): boolean {
  return /^[a-zA-Z0-9_-]{1,100}$/.test(value);
}

function validateApproval(raw: unknown): MatterhornPromotionApproval {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Promotion approval record is invalid.");
  const input = raw as Record<string, unknown>;
  if (typeof input.runId !== "string" || !validRunId(input.runId)) throw new Error("Promotion approval run id is invalid.");
  if (typeof input.runSnapshotHash !== "string" || !/^[0-9a-f]{64}$/.test(input.runSnapshotHash)) throw new Error("Promotion approval snapshot hash is invalid.");
  if (typeof input.approvedAt !== "string" || !Number.isFinite(new Date(input.approvedAt).valueOf())) throw new Error("Promotion approval timestamp is invalid.");
  if (input.approvedBy !== "local-human") throw new Error("Promotion approval actor is invalid.");
  if (input.note != null && (typeof input.note !== "string" || input.note.length > 2_000)) throw new Error("Promotion approval note is invalid.");
  return {
    runId: input.runId,
    runSnapshotHash: input.runSnapshotHash,
    approvedAt: input.approvedAt,
    approvedBy: "local-human",
    ...(typeof input.note === "string" && input.note.trim() ? { note: input.note.trim() } : {}),
  };
}

function atomicWrite(path: string, text: string): void {
  const temp = `${path}.${randomUUID()}.tmp`;
  let fd: number | undefined;
  try {
    fd = openSync(temp, "wx", 0o600);
    writeFileSync(fd, text, "utf8");
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    renameSync(temp, path);
  } finally {
    if (fd !== undefined) closeSync(fd);
    try { unlinkSync(temp); } catch {}
  }
}

export class MatterhornPromotionApprovalStore {
  private readonly directory: string;

  constructor(dataDirectory: string) {
    this.directory = resolve(dataDirectory, "promotion-approvals");
  }

  status(run: StudioRun): MatterhornPromotionStatus {
    const structurallyComplete =
      run.status === "completed" &&
      run.tasks.length > 0 &&
      run.tasks.every(task => task.status === "completed") &&
      run.plan.finalAcceptanceCriteria.length > 0;
    if (!structurallyComplete) {
      return {
        runId: run.id,
        state: "not-eligible",
        eligible: false,
        detail: "Only a completed, Sentinel-accepted run can be approved for promotion.",
      };
    }

    const approval = this.read(run.id);
    if (!approval) {
      return {
        runId: run.id,
        state: "approval-required",
        eligible: true,
        detail: "Execution is complete, but promotion still requires explicit human approval.",
      };
    }

    if (approval.runSnapshotHash !== approvalHash(run)) {
      return {
        runId: run.id,
        state: "stale",
        eligible: true,
        approval,
        detail: "The completed run changed after approval. Human approval must be renewed for the current snapshot.",
      };
    }

    return {
      runId: run.id,
      state: "approved",
      eligible: true,
      approval,
      detail: "The exact completed run snapshot is approved for promotion.",
    };
  }

  approve(run: StudioRun, confirmation: string, note?: string): MatterhornPromotionApproval {
    const eligibility = this.status(run);
    if (!eligibility.eligible) throw new Error("Only a fully completed, acceptance-gated run can be approved for promotion.");
    if (confirmation !== "APPROVE") throw new Error('Promotion approval requires the exact confirmation "APPROVE".');
    if (note != null && (typeof note !== "string" || note.length > 2_000)) throw new Error("Promotion approval note is too large.");
    if (!validRunId(run.id)) throw new Error("Run id is invalid.");

    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    const info = lstatSync(this.directory);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Promotion approval storage must be a real directory.");

    const approval: MatterhornPromotionApproval = {
      runId: run.id,
      runSnapshotHash: approvalHash(run),
      approvedAt: new Date().toISOString(),
      approvedBy: "local-human",
      ...(note?.trim() ? { note: note.trim() } : {}),
    };
    atomicWrite(this.path(run.id), JSON.stringify(approval) + "\n");
    return approval;
  }

  revoke(runId: string): void {
    if (!validRunId(runId)) throw new Error("Run id is invalid.");
    try {
      unlinkSync(this.path(runId));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  requireApproved(run: StudioRun): MatterhornPromotionApproval {
    const status = this.status(run);
    if (status.state !== "approved" || !status.approval) {
      throw new Error(`Promotion blocked: ${status.detail}`);
    }
    return status.approval;
  }

  private read(runId: string): MatterhornPromotionApproval | undefined {
    if (!validRunId(runId)) throw new Error("Run id is invalid.");
    const path = this.path(runId);
    if (!existsSync(path)) return undefined;
    const info = lstatSync(path);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 16_384) throw new Error("Promotion approval record is invalid.");
    return validateApproval(JSON.parse(readFileSync(path, "utf8")));
  }

  private path(runId: string): string {
    return resolve(this.directory, `${runId}.json`);
  }
}
