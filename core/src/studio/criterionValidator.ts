import type { NssStudioCheckType, NssStudioCriterionResult } from './types.js';

export const GENERIC_GATE_CRITERIA: readonly string[] = [
  'Godot validation passes',
  'Scenario checks pass',
  'QA checks pass',
  'Playtest passes',
];

export interface CriterionSpec {
  id: string;
  description: string;
  checkType: NssStudioCheckType;
  target?: string;
  expected?: unknown;
}

export function parseCriterionSpec(raw: string, index: number): CriterionSpec {
  const description = raw.trim();
  const id = `criterion-${index + 1}`;

  if (GENERIC_GATE_CRITERIA.includes(description)) {
    return { id, description, checkType: 'generic' };
  }

  // Structured JSON format check
  if (description.startsWith('{') && description.endsWith('}')) {
    try {
      const parsed = JSON.parse(description);
      return {
        id: parsed.id ?? id,
        description: parsed.description ?? description,
        checkType: parsed.checkType ?? 'generic',
        target: parsed.target,
        expected: parsed.expected,
      };
    } catch {
      // Fallback to text parsing
    }
  }

  // Text pattern matching heuristics for initial check types
  if (description.toLowerCase().includes('health') || description.toLowerCase().includes('damage')) {
    const num = extractLastNumber(description);
    return { id, description, checkType: 'health_damage', target: 'player.health', expected: num };
  }

  if (description.toLowerCase().includes('position') || description.toLowerCase().includes('moves') || description.toLowerCase().includes('pixels') || description.toLowerCase().includes('meters')) {
    const num = extractLastNumber(description);
    return { id, description, checkType: 'movement_position', target: 'player.position', expected: num };
  }

  if (description.toLowerCase().includes('exists') || description.toLowerCase().includes('present')) {
    return { id, description, checkType: 'node_exists', target: extractTargetNode(description), expected: true };
  }

  if (description.toLowerCase().includes('between') || description.toLowerCase().includes('range')) {
    const range = extractRange(description);
    return { id, description, checkType: 'property_range', expected: range };
  }

  if (description.toLowerCase().includes('equals') || description.toLowerCase().includes('is ')) {
    const num = extractLastNumber(description);
    return { id, description, checkType: 'property_equals', expected: num ?? description };
  }

  if (description.toLowerCase().includes('second') || description.toLowerCase().includes('time') || description.toLowerCase().includes('cooldown')) {
    const num = extractLastNumber(description);
    return { id, description, checkType: 'timed_scenario', expected: num };
  }

  return { id, description, checkType: 'generic' };
}

function extractLastNumber(text: string): number | undefined {
  const matches = text.match(/-?\d+(?:\.\d+)?/g);
  if (!matches || matches.length === 0) return undefined;
  return parseFloat(matches[matches.length - 1]);
}

function extractRange(text: string): { min: number; max: number } | undefined {
  const matches = text.match(/-?\d+(?:\.\d+)?/g);
  if (!matches || matches.length < 2) return undefined;
  return { min: parseFloat(matches[0]), max: parseFloat(matches[1]) };
}

function extractTargetNode(text: string): string {
  const words = text.split(/\s+/);
  return words[0] || 'node';
}

export function verifyCriterionMeasurement(spec: CriterionSpec, result: NssStudioCriterionResult): 'passed' | 'failed' | 'blocked' {
  if (result.outcome === 'failed') return 'failed';
  if (result.outcome === 'blocked' || result.outcome === 'unknown') return 'blocked';

  // If actual and expected values are provided, perform deterministic verification
  if (result.expected !== undefined && result.actual !== undefined) {
    switch (spec.checkType) {
      case 'property_equals':
      case 'health_damage': {
        const pass = String(result.actual) === String(result.expected) || Number(result.actual) === Number(result.expected);
        return pass ? 'passed' : 'failed';
      }
      case 'property_range': {
        const act = Number(result.actual);
        const exp = result.expected as { min?: number; max?: number } | [number, number];
        let min = -Infinity, max = Infinity;
        if (Array.isArray(exp)) {
          [min, max] = exp;
        } else if (typeof exp === 'object' && exp !== null) {
          min = exp.min ?? -Infinity;
          max = exp.max ?? Infinity;
        }
        return (act >= min && act <= max) ? 'passed' : 'failed';
      }
      case 'node_exists': {
        const pass = Boolean(result.actual) === Boolean(result.expected);
        return pass ? 'passed' : 'failed';
      }
      case 'movement_position': {
        const act = Number(result.actual);
        const exp = Number(result.expected);
        return act >= exp ? 'passed' : 'failed';
      }
      case 'timed_scenario': {
        const act = Number(result.actual);
        const exp = Number(result.expected);
        return act <= exp ? 'passed' : 'failed';
      }
      default:
        break;
    }
  }

  return result.outcome === 'passed' ? 'passed' : 'blocked';
}

export interface TaskCriteriaValidationResult {
  status: 'completed' | 'failed' | 'blocked';
  criterionResults: NssStudioCriterionResult[];
  summary: string;
}

export function validateTaskCriteria(
  taskId: string,
  acceptanceCriteria: readonly string[],
  evidenceResults: readonly NssStudioCriterionResult[] | undefined,
  evidencePath?: string,
): TaskCriteriaValidationResult {
  if (!acceptanceCriteria || acceptanceCriteria.length === 0) {
    return {
      status: 'completed',
      criterionResults: [],
      summary: 'No acceptance criteria required.',
    };
  }

  const results: NssStudioCriterionResult[] = [];
  const seenCriterionIds = new Set<string>();
  let hasFailed = false;
  let hasBlocked = false;

  for (let i = 0; i < acceptanceCriteria.length; i++) {
    const rawCriterion = acceptanceCriteria[i];
    const spec = parseCriterionSpec(rawCriterion, i);

    // Find matching result in returned evidence by criterionId, description, or index
    const match = evidenceResults?.find(item =>
      (item.criterionId && item.criterionId === spec.id) ||
      (item.description && item.description === spec.description) ||
      (item.criterion && item.criterion === spec.description),
    );

    if (!match) {
      // Rule A: Missing evidence for required criterion blocks completion
      results.push({
        criterionId: spec.id,
        description: spec.description,
        checkType: spec.checkType,
        target: spec.target,
        expected: spec.expected,
        outcome: 'blocked',
        executionId: taskId,
      });
      hasBlocked = true;
      continue;
    }

    // Rule B: Duplicate criterion detection
    if (seenCriterionIds.has(match.criterionId || spec.id)) {
      results.push({
        criterionId: spec.id,
        description: spec.description,
        checkType: spec.checkType,
        outcome: 'blocked',
        executionId: taskId,
      });
      hasBlocked = true;
      continue;
    }
    seenCriterionIds.add(match.criterionId || spec.id);

    // Rule C: Execution ID mismatch
    if (match.executionId && match.executionId !== taskId) {
      results.push({
        criterionId: spec.id,
        description: spec.description,
        checkType: spec.checkType,
        outcome: 'blocked',
        executionId: taskId,
      });
      hasBlocked = true;
      continue;
    }

    // Rule F: Missing or unreferenced evidence URI for non-generic checks
    if (match.outcome === 'passed' && !match.evidenceUri && !evidencePath) {
      results.push({
        criterionId: spec.id,
        description: spec.description,
        checkType: spec.checkType,
        outcome: 'blocked',
        executionId: taskId,
      });
      hasBlocked = true;
      continue;
    }

    // Rule D & E: Verify measurement outcome
    const evaluatedOutcome = verifyCriterionMeasurement(spec, match);

    if (evaluatedOutcome === 'failed') hasFailed = true;
    if (evaluatedOutcome === 'blocked') hasBlocked = true;

    results.push({
      criterionId: match.criterionId ?? spec.id,
      description: spec.description,
      checkType: spec.checkType,
      target: match.target ?? spec.target,
      expected: match.expected ?? spec.expected,
      actual: match.actual,
      outcome: evaluatedOutcome,
      evidenceUri: match.evidenceUri ?? evidencePath,
      executionId: taskId,
      timestamp: match.timestamp ?? new Date().toISOString(),
      criterion: spec.description,
    });
  }

  const status = hasFailed ? 'failed' : hasBlocked ? 'blocked' : 'completed';
  const passedCount = results.filter(r => r.outcome === 'passed').length;
  const summary = status === 'completed'
    ? `All ${results.length} criterion check(s) passed.`
    : status === 'failed'
      ? `${results.filter(r => r.outcome === 'failed').length} of ${results.length} criterion check(s) failed.`
      : `${results.filter(r => r.outcome === 'blocked').length} of ${results.length} criterion check(s) blocked due to missing or invalid evidence.`;

  return {
    status,
    criterionResults: results,
    summary,
  };
}
