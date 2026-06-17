import { strict as assert } from "node:assert";

import { NSS_COMMANDS } from "../../commands/registry.js";

export function runCommandRegistrySmoke(): void {
  const commandIds = NSS_COMMANDS.map((command) => command.id);

  assert.equal(new Set(commandIds).size, commandIds.length, "Expected NSS command ids to be unique.");
  assert(commandIds.includes("nssWorkspaceAi.proposeMultiFileChange"));
  assert(commandIds.includes("nssWorkspaceAi.askAboutErrorFile"));
  assert(commandIds.includes("nssWorkspaceAi.proposeFixForErrorFile"));
}
