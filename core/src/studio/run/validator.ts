/**
 * Evidence-Based Completion Gate Validator.
 *
 * Deterministically verifies specialist execution results against required
 * evidence, test outputs, QA reports, and artifact generation before
 * marking a Studio task as completed.
 */

import type { NssStudioExecutionResult, NssStudioTask } from "../types.js";
import type { TaskValidationResult } from "./types.js";

export class StudioTaskValidator {
  /**
   * Validate a specialist execution result against a Studio task specification.
   */
  validate(
    task: NssStudioTask,
    result: NssStudioExecutionResult | undefined,
  ): TaskValidationResult {
    const failures: string[] = [];
    const warnings: string[] = [];
    const criteria = [...task.acceptanceCriteria];
    const evidence = result?.evidence ?? [];

    if (!result) {
      return {
        passed: false,
        criteria,
        evidenceConsidered: [],
        failures: ["Specialist returned no execution result."],
        warnings: [],
      };
    }

    // 1. Check top-level status
    if (result.status !== "completed") {
      failures.push(`Specialist reported non-completed status: ${result.status} (${result.summary})`);
    }

    // 2. Check for explicit validation/test/QA failures in evidence summaries
    for (const ev of evidence) {
      const summaryLower = ev.summary.toLowerCase();
      if (
        summaryLower.includes("validation failed") ||
        summaryLower.includes("scenario checks failed") ||
        summaryLower.includes("qa failed") ||
        summaryLower.includes("test failed") ||
        summaryLower.includes("infrastructure_failure")
      ) {
        failures.push(`Evidence reported failure: "${ev.summary}"`);
      }
    }

    // 3. Verify required evidence items exist if task requires validation
    if (task.domain === "godot" || task.domain === "software" || task.domain === "qa") {
      const hasTestOrReportEvidence = evidence.some(
        (e) => e.kind === "test" || e.kind === "report" || e.kind === "log",
      );
      if (!hasTestOrReportEvidence && evidence.length === 0) {
        warnings.push("No validation or test evidence items were attached to the execution result.");
      }
    }

    // 4. Verify required output artifacts if specified on the task
    if (task.outputArtifacts && task.outputArtifacts.length > 0) {
      const producedKinds = new Set(result.artifacts?.map((a) => a.kind) ?? []);
      for (const reqArtifact of task.outputArtifacts) {
        if (!producedKinds.has(reqArtifact.kind)) {
          failures.push(`Required output artifact kind missing: ${reqArtifact.kind}`);
        }
      }
    }

    const passed = failures.length === 0;

    return {
      passed,
      criteria,
      evidenceConsidered: evidence,
      failures,
      warnings,
    };
  }
}
