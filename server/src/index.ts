import { getServerConfig, describeProvider } from "./config/env.js";
import { startNssWorkspaceAiServer } from "./server.js";

async function main(): Promise<void> {
  const config = getServerConfig();
  const started = await startNssWorkspaceAiServer(config);
  const portMessage =
    config.port !== 0 && started.port !== config.port ? ` (requested ${config.port} was busy)` : "";
  console.log(
    `Matterhorn server listening on http://127.0.0.1:${started.port}${portMessage} (${describeProvider(config)})`,
  );
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
