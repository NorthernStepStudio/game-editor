import type { StudioRun } from "./runTypes.js";

export type StudioWorkflowStage = "ask" | "plan" | "build" | "verify" | "repair" | "complete" | "blocked" | "failed" | "cancelled";

export function deriveStudioWorkflowStage(run: StudioRun): StudioWorkflowStage {
  if (run.status === "completed") return "complete";
  if (run.status === "failed") return "failed";
  if (run.status === "blocked") return "blocked";
  if (run.status === "cancelled" || run.status === "cancel-requested") return "cancelled";
  if (run.status === "queued") return "plan";
  if (run.status === "validating" || run.tasks.some(task => task.status === "validating")) return "verify";
  if (run.tasks.some(task => task.status === "failed" || task.status === "blocked")) return "repair";
  return "build";
}

export const STUDIO_WORKFLOW_STAGES = ["ask", "plan", "build", "verify", "repair", "complete"] as const;
