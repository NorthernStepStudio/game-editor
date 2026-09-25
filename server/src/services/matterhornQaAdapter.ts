import type {
  NssStudioExecutionResult,
  NssStudioHandoff,
  NssStudioQaTaskSpec,
} from '../../../core/out/index.js';
import {
  SpecialistError,
  type SpecialistAdapter,
  type SpecialistCancelResult,
  type SpecialistCapabilitySet,
  type SpecialistHealthResult,
  type SpecialistTaskHandle,
  type SpecialistTaskStatus,
} from '../../../core/out/index.js';

const QA_CAPABILITIES = ['studio.qa', 'studio.evidence.aggregate'];

/** Matterhorn's in-process final evidence gate; it does not invent test results. */
export class MatterhornQaAdapter implements SpecialistAdapter {
  readonly specialistId = 'matterhorn' as const;
  private readonly results = new Map<string, NssStudioExecutionResult>();

  async health(): Promise<SpecialistHealthResult> {
    return {
      available: true,
      specialistId: this.specialistId,
      protocolVersion: '1.0.0',
      capabilities: QA_CAPABILITIES,
      detail: 'Matterhorn QA evidence aggregation is available.',
    };
  }

  async getCapabilities(): Promise<SpecialistCapabilitySet> {
    return { specialistId: this.specialistId, protocolVersion: '1.0.0', capabilities: QA_CAPABILITIES };
  }

  async submitTask(handoff: NssStudioHandoff): Promise<SpecialistTaskHandle> {
    const taskId = handoff.taskId || handoff.id;
    if (handoff.to !== this.specialistId) throw new SpecialistError('INVALID_TASK', 'Matterhorn QA received a task for another specialist.');
    if (this.results.has(taskId)) throw new SpecialistError('INVALID_TASK', `QA task ${taskId} has already been submitted.`);
    this.results.set(taskId, aggregate(handoff));
    return { taskId, specialistId: this.specialistId, accepted: true };
  }

  async getTaskStatus(taskId: string): Promise<SpecialistTaskStatus> {
    const result = this.results.get(taskId);
    if (!result) return { taskId, specialistId: this.specialistId, phase: 'unknown', detail: 'QA result is not available.' };
    return {
      taskId,
      specialistId: this.specialistId,
      phase: result.status === 'completed' ? 'completed' : 'failed',
      detail: result.summary,
    };
  }

  async getResult(taskId: string): Promise<NssStudioExecutionResult> {
    const result = this.results.get(taskId);
    if (!result) throw new SpecialistError('TRANSPORT_ERROR', `QA result is missing for ${taskId}.`, { recoverable: true });
    return structuredClone(result);
  }

  async cancelTask(taskId: string): Promise<SpecialistCancelResult> {
    return { taskId, cancelled: false, detail: 'Evidence aggregation is an atomic local check.' };
  }
}

function aggregate(handoff: NssStudioHandoff): NssStudioExecutionResult {
  const spec = handoff.taskSpec as NssStudioQaTaskSpec | undefined;
  if (spec?.protocol !== 'nss.studio-task-spec.v1' || spec.specialist !== 'matterhorn' || spec.action !== 'aggregate_evidence') {
    return blocked(handoff, 'QA task is missing a valid structured aggregation specification.');
  }
  const dependencyResults = handoff.dependencyResults ?? [];
  const sourceResults = dependencyResults.filter(result => result.status === 'completed' && spec.dependencyTaskIds.some(id => result.taskId.endsWith(`-${id}`)));
  if (sourceResults.length !== spec.dependencyTaskIds.length) {
    return blocked(handoff, 'QA is missing one or more successful dependency results.');
  }

  const evidence = sourceResults.flatMap(result => result.evidence ?? []).filter(item => item.outcome === 'passed' && item.uri);
  const uniqueEvidence = [...new Map(evidence.map(item => [item.uri!, item])).values()];
  const criterionResults = spec.criteria.map((criterion, index) => {
    const matches = sourceResults.flatMap(result => (result.criterionResults ?? [])
      .filter(check => check.criterion === criterion || check.description === criterion)
      .filter(check => check.outcome === 'passed' && Boolean(check.evidenceUri) &&
        result.evidence?.some(item => item.uri === check.evidenceUri && item.outcome === 'passed'))
      .map(check => ({ result, check })));
    if (matches.length !== 1) {
      return {
        criterionId: `qa-criterion-${index + 1}`,
        description: criterion,
        criterion,
        checkType: 'generic' as const,
        outcome: 'blocked' as const,
        executionId: handoff.taskId,
      };
    }
    const { result, check } = matches[0]!;
    return {
      ...check,
      criterion,
      description: criterion,
      evidenceUri: check.evidenceUri,
      executionId: handoff.taskId,
      sourceExecutionId: result.taskId,
      outcome: 'passed' as const,
    };
  });

  const blockedCriteria = criterionResults.filter(item => item.outcome !== 'passed');
  const status = blockedCriteria.length ? 'blocked' : 'completed';
  return {
    taskId: handoff.taskId,
    specialistId: 'matterhorn',
    status,
    summary: blockedCriteria.length
      ? `QA blocked: ${blockedCriteria.map(item => item.description).join('; ')} lacks unique, passing specialist evidence.`
      : `QA verified ${criterionResults.length} acceptance criteria against specialist evidence.`,
    evidence: uniqueEvidence,
    criterionResults,
  };
}

function blocked(handoff: NssStudioHandoff, summary: string): NssStudioExecutionResult {
  return {
    taskId: handoff.taskId,
    specialistId: 'matterhorn',
    status: 'blocked',
    summary,
    criterionResults: handoff.acceptanceCriteria.map((criterion, index) => ({
      criterionId: `qa-criterion-${index + 1}`,
      description: criterion,
      criterion,
      outcome: 'blocked',
      executionId: handoff.taskId,
    })),
  };
}
