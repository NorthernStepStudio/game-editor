import { readFileSync, realpathSync, statSync } from 'node:fs';
import { join, relative, isAbsolute } from 'node:path';
import type { NssStudioCriterionResult, NssStudioExecutionResult } from '../../types.js';
import type { FlyrailLoopReport } from './flyrailMapper.js';
import { validateTaskCriteria } from '../../criterionValidator.js';

/** Only these exact checks can be derived from the current daemon's evidence schema. */
export const FLYRAIL_GATE_CRITERIA = ['Godot validation passes', 'Scenario checks pass', 'QA checks pass', 'Playtest passes'] as const;

export function verifyFlyrailEvidence(
  result: NssStudioExecutionResult,
  report: FlyrailLoopReport,
  projectPath: string,
  taskAcceptanceCriteria?: readonly string[],
): NssStudioExecutionResult {
  if (!report.evidencePath) return { ...result, status: result.status === 'failed' ? 'failed' : 'blocked', summary: 'No persisted evidence bundle was returned.' };
  try {
    const projectRoot = realpathSync(projectPath);
    const root = realpathSync(join(projectPath, '.flyrail', 'evidence'));
    const rootRelative = relative(projectRoot, root);
    if (!rootRelative || rootRelative.startsWith('..') || isAbsolute(rootRelative)) throw new Error('Evidence directory escapes project');
    const uri = realpathSync(report.evidencePath);
    const rel = relative(root, uri);
    if (!rel || rel.startsWith('..') || isAbsolute(rel) || statSync(uri).size > 2 * 1024 * 1024) throw new Error('Invalid evidence path');
    const bundle = JSON.parse(readFileSync(uri, 'utf8'));
    if (bundle.schemaVersion !== 1 || bundle.requestId !== result.taskId || typeof bundle.ok !== 'boolean') throw new Error('Invalid evidence identity');
    const values: unknown[] = [bundle.validation?.ok, bundle.scenario?.ok, bundle.qa?.ok, bundle.playtestOk];
    const reportValues = [report.evidence?.validationOk, report.evidence?.scenarioOk, report.evidence?.qaOk, report.evidence?.playtestOk];
    if (values.some((value, index) => value !== reportValues[index] && !(value == null && reportValues[index] == null))) throw new Error('Evidence differs from execution report');
    
    // Generic gate criteria
    const genericChecks: NssStudioCriterionResult[] = FLYRAIL_GATE_CRITERIA.map((criterion, index) => ({
      criterionId: `gate-${index + 1}`,
      description: criterion,
      checkType: 'generic' as const,
      outcome: values[index] === true ? 'passed' as const : values[index] === false ? 'failed' as const : 'unknown' as const,
      evidenceUri: `${uri}#${index}`,
      executionId: result.taskId,
      criterion,
    }));

    // Specific criterion results from bundle or report
    const customBundleResults: NssStudioCriterionResult[] = (bundle.criterionResults ?? report.criterionResults ?? []).map((item: any) => ({
      criterionId: item.criterionId ?? item.id ?? 'unknown',
      description: item.description ?? item.criterion ?? 'Custom criterion',
      checkType: item.checkType ?? 'generic',
      target: item.target,
      expected: item.expected,
      actual: item.actual,
      outcome: item.outcome ?? (item.ok === true ? 'passed' : item.ok === false ? 'failed' : 'unknown'),
      evidenceUri: item.evidenceUri ?? uri,
      executionId: item.executionId ?? result.taskId,
      timestamp: item.timestamp,
      criterion: item.description ?? item.criterion,
    }));

    const combinedReturnedResults = [...genericChecks, ...customBundleResults];

    // If explicit acceptance criteria were requested for this task, perform strict validation
    if (taskAcceptanceCriteria && taskAcceptanceCriteria.length > 0) {
      const validation = validateTaskCriteria(result.taskId, taskAcceptanceCriteria, combinedReturnedResults, uri);
      const finalStatus = bundle.ok === false ? 'failed' : validation.status;
      return {
        ...result,
        status: finalStatus,
        summary: result.summary && result.summary !== 'Task completed' ? `${result.summary} — ${validation.summary}` : validation.summary,
        criterionResults: validation.criterionResults,
        evidence: [...result.evidence ?? [], ...validation.criterionResults.map(check => ({ kind: 'test' as const, summary: check.description ?? check.criterion ?? 'Criterion', outcome: check.outcome, uri: check.evidenceUri }))],
      };
    }

    return {
      ...result,
      status: bundle.ok === false ? 'failed' : result.status,
      criterionResults: genericChecks,
      evidence: [...result.evidence ?? [], ...genericChecks.map(check => ({ kind: 'test' as const, summary: check.criterion!, outcome: check.outcome, uri: check.evidenceUri }))],
    };
  } catch {
    return { ...result, status: 'blocked', criterionResults: [], summary: 'Evidence file is missing, inaccessible, outside the project evidence directory, or does not match this execution.' };
  }
}
