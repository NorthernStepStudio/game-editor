import type { NssCommandDefinition, NssCommandMethodName } from "../models/command.types.js";

export function defineCommand(id: string, methodName: NssCommandMethodName): NssCommandDefinition {
  return {
    id,
    run: (host) => host[methodName](),
  };
}
