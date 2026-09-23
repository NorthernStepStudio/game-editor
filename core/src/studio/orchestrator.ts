import {
  getStudioSpecialist,
  resolveDefaultStudioSpecialist,
  specialistSupportsDomain,
} from "./specialistRegistry.js";
import type {
  NssStudioHandoff,
  NssStudioPlan,
  NssStudioPlanInput,
  NssStudioPlanValidation,
  NssStudioTask,
  NssStudioSpecialistId,
} from "./types.js";

export function createStudioPlan(input: NssStudioPlanInput): NssStudioPlan {
  const goal = input.goal.trim();
  if (!goal) {
    throw new Error("Studio plan goal must be non-empty.");
  }

  const tasks: NssStudioTask[] = input.tasks.map((task) => ({
    id: task.id.trim(),
    title: task.title.trim(),
    goal: task.goal.trim(),
    domain: task.domain,
    specialistId: task.specialistId ?? resolveDefaultStudioSpecialist(task.domain),
    status: "planned",
    dependsOn: task.dependsOn ?? [],
    acceptanceCriteria: task.acceptanceCriteria,
    inputArtifacts: task.inputArtifacts,
  }));

  const plan: NssStudioPlan = {
    id: input.id?.trim() || `studio-plan-${Date.now()}`,
    goal,
    createdAt: new Date().toISOString(),
    tasks,
    finalAcceptanceCriteria: input.finalAcceptanceCriteria ?? [],
  };

  const validation = validateStudioPlan(plan);
  if (!validation.valid) {
    throw new Error(`Invalid studio plan: ${validation.errors.join(" ")}`);
  }

  return plan;
}

export function validateStudioPlan(plan: NssStudioPlan): NssStudioPlanValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!plan.goal.trim()) {
    errors.push("Plan goal must be non-empty.");
  }

  const ids = new Set<string>();
  for (const task of plan.tasks) {
    if (!task.id) {
      errors.push("Every task must have a non-empty id.");
      continue;
    }

    if (ids.has(task.id)) {
      errors.push(`Duplicate task id: ${task.id}.`);
    }
    ids.add(task.id);

    if (!task.title) {
      errors.push(`Task ${task.id} must have a title.`);
    }
    if (!task.goal) {
      errors.push(`Task ${task.id} must have a goal.`);
    }
    if (task.acceptanceCriteria.length === 0) {
      errors.push(`Task ${task.id} must define at least one acceptance criterion.`);
    }

    try {
      const specialist = getStudioSpecialist(task.specialistId);
      if (!specialistSupportsDomain(task.specialistId, task.domain)) {
        errors.push(
          `Task ${task.id} assigns ${task.domain} work to ${task.specialistId}, which does not own that domain.`,
        );
      }
      if (specialist.availability !== "available") {
        warnings.push(
          `Task ${task.id} targets ${specialist.title}, whose current availability is ${specialist.availability}.`,
        );
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  for (const task of plan.tasks) {
    for (const dependency of task.dependsOn) {
      if (dependency === task.id) {
        errors.push(`Task ${task.id} cannot depend on itself.`);
      } else if (!ids.has(dependency)) {
        errors.push(`Task ${task.id} depends on missing task ${dependency}.`);
      }
    }
  }

  const cycle = findDependencyCycle(plan.tasks);
  if (cycle.length > 0) {
    errors.push(`Task dependency cycle detected: ${cycle.join(" -> ")}.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function createStudioHandoff(
  task: NssStudioTask,
  from: NssStudioSpecialistId = "matterhorn",
): NssStudioHandoff {
  getStudioSpecialist(from);
  getStudioSpecialist(task.specialistId);

  if (!specialistSupportsDomain(task.specialistId, task.domain)) {
    throw new Error(
      `Cannot hand off ${task.domain} task ${task.id} to specialist ${task.specialistId}.`,
    );
  }

  return {
    protocol: "nss.studio-handoff.v1",
    id: `handoff-${task.id}-${Date.now()}`,
    taskId: task.id,
    from,
    to: task.specialistId,
    goal: task.goal,
    acceptanceCriteria: task.acceptanceCriteria,
    inputArtifacts: task.inputArtifacts ?? [],
  };
}

function findDependencyCycle(tasks: readonly NssStudioTask[]): readonly string[] {
  const dependencies = new Map(tasks.map((task) => [task.id, task.dependsOn] as const));
  const visited = new Set<string>();
  const active = new Set<string>();
  const stack: string[] = [];

  function visit(id: string): readonly string[] {
    if (active.has(id)) {
      const start = stack.indexOf(id);
      return [...stack.slice(start), id];
    }
    if (visited.has(id)) {
      return [];
    }

    visited.add(id);
    active.add(id);
    stack.push(id);

    for (const dependency of dependencies.get(id) ?? []) {
      if (!dependencies.has(dependency)) {
        continue;
      }
      const cycle = visit(dependency);
      if (cycle.length > 0) {
        return cycle;
      }
    }

    stack.pop();
    active.delete(id);
    return [];
  }

  for (const task of tasks) {
    const cycle = visit(task.id);
    if (cycle.length > 0) {
      return cycle;
    }
  }

  return [];
}
