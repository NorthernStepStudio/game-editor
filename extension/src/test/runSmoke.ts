import { runCommandRegistrySmoke } from "./smoke/commandRegistry.smoke.js";
import { runAskClientSmoke } from "./smoke/askClient.smoke.js";
import { runModePresetSmoke } from "./smoke/modePreset.smoke.js";
import { runBuildFoundationSmoke } from "./smoke/buildFoundation.smoke.js";
import { runRequestBuilderSmoke } from "./smoke/requestBuilder.smoke.js";
import { runReviewQueueSmoke } from "./smoke/reviewQueue.smoke.js";
import { runServerUrlSmoke } from "./smoke/serverUrl.smoke.js";
import { runWorkflowSmoke } from "./smoke/workflow.smoke.js";

async function main(): Promise<void> {
  runCommandRegistrySmoke();
  runModePresetSmoke();
  runBuildFoundationSmoke();
  runRequestBuilderSmoke();
  runReviewQueueSmoke();
  runServerUrlSmoke();
  runWorkflowSmoke();
  await runAskClientSmoke();
}

void main();
