import type {
  FoundryRuntimeNode,
  FoundryRuntimeSnapshot,
} from "../runtime/types.js";
import type {
  FoundryCriterionEvidenceV2,
  FoundryCriterionV2,
} from "./types.js";

export function measureFoundryCriterionFromSnapshot(
  criterion: FoundryCriterionV2,
  snapshot: FoundryRuntimeSnapshot,
  executionId: string,
  evidenceUri: string,
): FoundryCriterionEvidenceV2 {
  const base = {
    criterionId: criterion.id,
    executionId,
    evidenceUris: [evidenceUri],
    timestamp: snapshot.capturedAt,
  } as const;

  switch (criterion.type) {
    case "node_exists": {
      const path = criterion.target?.trim();
      if (!path) return unknown(base);
      return {
        ...base,
        outcome: "passed",
        actual: findNode(snapshot.tree, path) !== null,
      };
    }

    case "performance_budget": {
      const target = criterion.target ?? "performance.frameTimeMs";
      const value = performanceValue(snapshot, target);
      return value === undefined ? unknown(base) : { ...base, outcome: "passed", actual: value };
    }

    case "memory_budget":
      return {
        ...base,
        outcome: "passed",
        actual: snapshot.performance.memoryMb,
      };

    case "property_equals":
    case "property_range":
    case "movement_position":
    case "health_damage":
    case "world_state":
    case "animation_state":
    case "input_response": {
      const measured = nodeProperty(snapshot.tree, criterion.target);
      return measured.found
        ? { ...base, outcome: "passed", actual: measured.value }
        : unknown(base);
    }

    default:
      return unknown(base);
  }
}

export function findFoundryRuntimeNode(
  root: FoundryRuntimeNode | null,
  path: string,
): FoundryRuntimeNode | null {
  return findNode(root, path);
}

function findNode(
  root: FoundryRuntimeNode | null,
  path: string,
): FoundryRuntimeNode | null {
  if (!root) return null;
  const stack: FoundryRuntimeNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.path === path) return node;
    stack.push(...node.children);
  }
  return null;
}

function nodeProperty(
  root: FoundryRuntimeNode | null,
  target: string | undefined,
): { readonly found: boolean; readonly value?: unknown } {
  if (!target) return { found: false };
  const separator = target.lastIndexOf("::");
  if (separator <= 0 || separator >= target.length - 2) return { found: false };

  const path = target.slice(0, separator);
  const propertyPath = target.slice(separator + 2);
  const node = findNode(root, path);
  if (!node) return { found: false };

  let current: unknown = node.properties;
  for (const segment of propertyPath.split(".")) {
    if (!current || typeof current !== "object" || !(segment in current)) {
      return { found: false };
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return { found: true, value: current };
}

function performanceValue(
  snapshot: FoundryRuntimeSnapshot,
  target: string,
): number | undefined {
  switch (target) {
    case "performance.fps":
      return snapshot.performance.fps;
    case "performance.frameTimeMs":
      return snapshot.performance.frameTimeMs;
    case "performance.memoryMb":
      return snapshot.performance.memoryMb;
    case "performance.objectCount":
      return snapshot.performance.objectCount;
    default:
      return undefined;
  }
}

function unknown(
  base: {
    readonly criterionId: string;
    readonly executionId: string;
    readonly evidenceUris: readonly string[];
    readonly timestamp: string;
  },
): FoundryCriterionEvidenceV2 {
  return { ...base, outcome: "unknown" };
}
