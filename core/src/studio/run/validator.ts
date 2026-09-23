import type { NssStudioExecutionResult, NssStudioTask } from '../types.js';
import { validateStudioEvidence } from '../evidenceValidator.js';
import type { TaskValidationResult } from './types.js';
export class StudioTaskValidator {
  validate(task: NssStudioTask, result: NssStudioExecutionResult | undefined): TaskValidationResult {
    const checked = result ? validateStudioEvidence(result, task.id, task.specialistId, task.acceptanceCriteria) : { valid: false, detail: 'No result returned.' };
    const failures = checked.valid ? [] : [checked.detail];
    for (const artifact of task.outputArtifacts ?? []) if (!result?.artifacts?.some(a => a.kind === artifact.kind && a.uri)) failures.push(`Required artifact missing: ${artifact.kind}`);
    return { passed: failures.length === 0, criteria: task.acceptanceCriteria, evidenceConsidered: result?.evidence ?? [], failures, warnings: [] };
  }
}
