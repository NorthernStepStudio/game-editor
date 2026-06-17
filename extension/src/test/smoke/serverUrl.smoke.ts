import { strict as assert } from "node:assert";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { DEFAULT_BACKEND_URL } from "../../config/defaults.js";
import { resolveServerUrl } from "../../helpers/serverUrl.js";

export async function runServerUrlSmoke(): Promise<void> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nstep-workspace-ai-"));
  const workspaceRoot = path.join(tempRoot, "workspace");
  await fs.mkdir(workspaceRoot, { recursive: true });

  try {
    const portStateFilePath = path.join(workspaceRoot, ".nstep-workspace-ai-server-port.json");
    await fs.writeFile(
      portStateFilePath,
      JSON.stringify(
        {
          pid: 12345,
          port: 4321,
          startedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
      "utf8",
    );

    const resolvedFromPortFile = resolveServerUrl({
      configuredServerUrl: DEFAULT_BACKEND_URL,
      workspaceRoot,
      defaultServerUrl: DEFAULT_BACKEND_URL,
    });
    assert.equal(resolvedFromPortFile.serverUrl, "http://127.0.0.1:4321");
    assert.equal(resolvedFromPortFile.source, "workspace-port-file");

    const resolvedConfigured = resolveServerUrl({
      configuredServerUrl: "http://127.0.0.1:9000",
      workspaceRoot,
      defaultServerUrl: DEFAULT_BACKEND_URL,
    });
    assert.equal(resolvedConfigured.serverUrl, "http://127.0.0.1:9000");
    assert.equal(resolvedConfigured.source, "configured");
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}
