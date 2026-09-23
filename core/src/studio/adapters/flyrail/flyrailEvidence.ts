import { readFileSync, realpathSync, statSync } from 'node:fs';
import { join, relative, isAbsolute } from 'node:path';
import type { NssStudioExecutionResult } from '../../types.js';
import type { FlyrailLoopReport } from './flyrailMapper.js';
/** Only these exact checks can be derived from the current daemon's evidence schema. */
export const FLYRAIL_GATE_CRITERIA = ['Godot validation passes', 'Scenario checks pass', 'QA checks pass', 'Playtest passes'] as const;
export function verifyFlyrailEvidence(result: NssStudioExecutionResult, report: FlyrailLoopReport, projectPath: string): NssStudioExecutionResult {
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
    const checks = FLYRAIL_GATE_CRITERIA.map((criterion, index) => ({ criterion, outcome: values[index] === true ? 'passed' as const : values[index] === false ? 'failed' as const : 'unknown' as const, evidenceUri: `${uri}#${index}` }));
    return {
      ...result,
      status: bundle.ok === false ? 'failed' : result.status,
      criterionResults: checks,
      evidence: [...result.evidence ?? [], ...checks.map(check => ({ kind: 'test' as const, summary: check.criterion, outcome: check.outcome, uri: check.evidenceUri }))],
    };
  } catch {
    return { ...result, status: 'blocked', criterionResults: [], summary: 'Evidence file is missing, inaccessible, outside the project evidence directory, or does not match this execution.' };
  }
}
