/**
 * Maps between Matterhorn studio contracts and Flyrail's native protocol.
 *
 * This is the ONLY place that understands both sides.
 * Matterhorn core never sees Flyrail types directly.
 */

import type {
  NssStudioArtifactRef,
  NssStudioEvidence,
  NssStudioExecutionResult,
  NssStudioHandoff,
} from "../../types.js";
import type { SpecialistCapabilitySet } from "../types.js";

// ── Flyrail native shapes (duck-typed from protocol inspection) ─────

/** Subset of LoopReport fields we need from Flyrail. */
export interface FlyrailLoopReport {
  runId: string;
  requestId?: string;
  ok: boolean;
  stages?: ReadonlyArray<{ stage: string; ok: boolean; detail: string }>;
  spec?: { title?: string; summary?: string } | null;
  plan?: ReadonlyArray<{ id: string; description: string }> | null;
  checkpointId?: string | null;
  commitMessage?: string | null;
  repairAttempts?: number;
  evidence?: {
    validationOk?: boolean;
    scenarioOk?: boolean;
    qaOk?: boolean;
    playtestOk?: boolean | null;
    playtestRunId?: string | null;
    decisionTrace?: string | null;
    incidentCount?: number;
    replayMovie?: string | null;
    terminalOutcome?: string | null;
    seed?: number | null;
    reproduction?: string | null;
    incidentKinds?: string[];
    primaryIncident?: { id: string; kind: string; frame: number } | null;
  } | null;
  evidencePath?: string;
  provenancePath?: string;
  error?: string;
}

export interface FlyrailLoopStatus {
  runId: string;
  status: string;
  ok?: boolean | null;
  stage?: string;
  report?: FlyrailLoopReport | null;
}

export interface FlyrailSystemPing {
  ok: boolean;
  protocolVersion: string;
  phase: number;
}

export interface FlyrailCapabilitiesResponse {
  ok?: boolean;
  protocolVersion?: string;
  phase?: number;
  capabilities?: string[];
}

// ── Capability mapping ──────────────────────────────────────────────

/** Map Flyrail protocol phase number to Matterhorn capability IDs. */
const PHASE_CAPABILITIES: ReadonlyArray<readonly [number, readonly string[]]> = [
  [1, ["godot.project.inspect"]],
  [2, ["godot.scene.create", "godot.scene.modify"]],
  [3, ["godot.project.git"]],
  [4, ["godot.tests.run"]],
  [5, ["godot.project.run"]],
  [6, ["godot.input.send", "godot.frame.advance"]],
  [7, ["godot.screenshot.capture", "godot.validation.visual"]],
  [8, ["godot.validation.run"]],
  [9, ["godot.workflow.run"]],
  [11, ["godot.performance.capture"]],
  [12, ["godot.project.export"]],
  [13, ["godot.explore.run"]],
];

export function mapFlyrailCapabilities(
  protocolVersion: string,
  phase: number,
  explicitCapabilities?: readonly string[],
): SpecialistCapabilitySet {
  let capabilities: string[] = [];
  if (explicitCapabilities && explicitCapabilities.length > 0) {
    capabilities = [...explicitCapabilities];
  } else {
    for (const [phaseNumber, caps] of PHASE_CAPABILITIES) {
      if (phase >= phaseNumber) {
        capabilities.push(...caps);
      }
    }
  }
  return {
    specialistId: "flyrail",
    protocolVersion,
    capabilities,
  };
}

// ── Handoff → Flyrail request ───────────────────────────────────────

/**
 * Translate a Matterhorn studio handoff into params for `loop.run`.
 * Uses handoff.taskId for both runId and featureId, and requires an open sessionId.
 */
export function handoffToLoopRunParams(
  handoff: NssStudioHandoff,
  sessionId: string,
): Record<string, unknown> {
  return {
    sessionId,
    runId: handoff.taskId,
    featureId: handoff.taskId,
    text: buildFeatureText(handoff),
    maxRepairAttempts: 3,
    playtestMode: "auto",
  };
}

function buildFeatureText(handoff: NssStudioHandoff): string {
  const parts = [handoff.goal];
  if (handoff.acceptanceCriteria.length > 0) {
    parts.push("");
    parts.push("Acceptance criteria:");
    for (const criterion of handoff.acceptanceCriteria) {
      parts.push(`- ${criterion}`);
    }
  }
  return parts.join("\n");
}

// ── Flyrail result → Matterhorn execution result ────────────────────

export function loopReportToExecutionResult(
  taskId: string,
  report: FlyrailLoopReport,
): NssStudioExecutionResult {
  const artifacts: NssStudioArtifactRef[] = [];
  const evidence: NssStudioEvidence[] = [];

  // Commit as artifact
  if (report.commitMessage) {
    artifacts.push({
      kind: "commit",
      uri: report.checkpointId ?? "",
      label: report.commitMessage,
      producedBy: "flyrail",
    });
  }

  // Evidence path
  if (report.evidencePath) {
    artifacts.push({
      kind: "evidence-bundle",
      uri: report.evidencePath,
      label: "Flyrail evidence bundle",
      producedBy: "flyrail",
    });
  }

  // Provenance
  if (report.provenancePath) {
    artifacts.push({
      kind: "provenance",
      uri: report.provenancePath,
      label: "Provenance chain",
      producedBy: "flyrail",
    });
  }

  // Validation evidence
  if (report.evidence) {
    const ev = report.evidence;

    if (ev.validationOk !== undefined) {
      evidence.push({
        kind: "test",
        summary: ev.validationOk ? "Validation passed" : "Validation failed",
      });
    }

    if (ev.scenarioOk !== undefined) {
      evidence.push({
        kind: "test",
        summary: ev.scenarioOk ? "Scenario checks passed" : "Scenario checks failed",
      });
    }

    if (ev.qaOk !== undefined) {
      evidence.push({
        kind: "report",
        summary: ev.qaOk ? "QA passed" : "QA failed",
      });
    }

    if (ev.playtestOk !== undefined && ev.playtestOk !== null) {
      evidence.push({
        kind: "report",
        summary: ev.playtestOk ? "Playtest passed" : "Playtest failed",
        uri: ev.playtestRunId ?? undefined,
      });
    }

    if (ev.replayMovie) {
      evidence.push({
        kind: "render",
        summary: "Playtest replay movie",
        uri: ev.replayMovie,
      });
    }

    if (ev.terminalOutcome) {
      evidence.push({
        kind: "log",
        summary: `Terminal outcome: ${ev.terminalOutcome}`,
      });
    }

    if (ev.decisionTrace) {
      evidence.push({
        kind: "log",
        summary: "AI decision trace",
        uri: ev.decisionTrace,
      });
    }

    if (ev.primaryIncident) {
      evidence.push({
        kind: "report",
        summary: `Incident: ${ev.primaryIncident.kind} at frame ${ev.primaryIncident.frame} (${ev.primaryIncident.id})`,
      });
    }
  }

  // Stage logs
  if (report.stages) {
    for (const stage of report.stages) {
      if (!stage.ok) {
        evidence.push({
          kind: "log",
          summary: `Stage ${stage.stage} failed: ${stage.detail}`,
        });
      }
    }
  }

  // Build summary
  const summaryParts: string[] = [];
  if (report.spec?.title) summaryParts.push(report.spec.title);
  if (report.spec?.summary) summaryParts.push(report.spec.summary);
  if (report.repairAttempts && report.repairAttempts > 0) {
    summaryParts.push(`(${report.repairAttempts} repair attempt${report.repairAttempts > 1 ? "s" : ""})`);
  }
  if (report.error) summaryParts.push(`Error: ${report.error}`);

  const status = report.ok ? "completed" : "failed";

  return {
    taskId,
    specialistId: "flyrail",
    status,
    summary: summaryParts.join(" — ") || (report.ok ? "Task completed" : "Task failed"),
    artifacts: artifacts.length > 0 ? artifacts : undefined,
    evidence: evidence.length > 0 ? evidence : undefined,
  };
}

/**
 * Map a loop status response to a human-readable task phase string.
 */
export function mapLoopStageToPhase(
  stage: string | undefined,
): "accepted" | "running" | "validating" | "completed" | "failed" | "unknown" {
  if (!stage) return "unknown";
  switch (stage) {
    case "inspect":
    case "spec":
    case "plan":
    case "checkpoint":
      return "accepted";
    case "implement":
      return "running";
    case "validate":
    case "scenario":
    case "playtest":
    case "observe":
    case "qa":
      return "validating";
    case "commit":
    case "report":
    case "done":
      return "completed";
    case "diagnose":
    case "fix":
      return "running";
    case "failed":
      return "failed";
    default:
      return "unknown";
  }
}
