import type {
  MatterhornToolDefinition,
  MatterhornToolPolicy,
  MatterhornToolPolicyMode,
} from "./types.js";

export function defaultMatterhornToolPolicy(
  tool: MatterhornToolDefinition,
): MatterhornToolPolicy {
  switch (tool.risk) {
    case "read":
    case "proposal":
      return { mode: "auto" };
    case "write":
    case "execute":
    case "network":
    case "external_cost":
      return { mode: "approval" };
  }
}

export function resolveMatterhornToolPolicy(
  tool: MatterhornToolDefinition,
  policies: Readonly<Record<string, MatterhornToolPolicy>> | undefined,
): MatterhornToolPolicy {
  const override = policies?.[tool.name];
  return override ?? defaultMatterhornToolPolicy(tool);
}

export function assertToolPolicyMode(value: string): asserts value is MatterhornToolPolicyMode {
  if (!["auto", "approval", "disabled"].includes(value)) {
    throw new Error(`Unsupported tool policy mode: ${value}`);
  }
}
