export type FoundryOperationClass =
  | "read_only"
  | "mutating"
  | "runtime"
  | "destructive"
  | "external_cost"
  | "network";

export interface FoundryCostBudget {
  readonly currency: string;
  readonly maxAmount: number;
}

export interface FoundryOperationPolicy {
  readonly classes: readonly FoundryOperationClass[];
  readonly dryRunSupported: boolean;
  readonly requiresApproval: boolean;
  readonly costBudget?: FoundryCostBudget;
}

export function requiresFoundryApproval(policy: FoundryOperationPolicy): boolean {
  return (
    policy.requiresApproval ||
    policy.classes.includes("destructive") ||
    policy.classes.includes("external_cost")
  );
}

export function validateFoundryOperationPolicy(policy: FoundryOperationPolicy): readonly string[] {
  const errors: string[] = [];
  if (policy.classes.length === 0) errors.push("Operation policy requires at least one class.");
  if (new Set(policy.classes).size !== policy.classes.length) {
    errors.push("Operation policy classes cannot contain duplicates.");
  }
  if (policy.classes.includes("external_cost") && !policy.costBudget) {
    errors.push("External-cost operations require an explicit cost budget.");
  }
  if (policy.costBudget && policy.costBudget.maxAmount < 0) {
    errors.push("Cost budget cannot be negative.");
  }
  return errors;
}
