import { strict as assert } from "node:assert";

import { getModeDetails } from "../../services/studio/modeService.js";
import { suggestPresetIdFromPath } from "../../services/studio/presetService.js";
import { suggestStudioProjectIdFromPath } from "../../services/studio/studioProjectService.js";

export function runModePresetSmoke(): void {
  assert.equal(suggestPresetIdFromPath("D:\\dev\\Northern Step Studio\\apps\\nexusbuild"), "nexusbuild");
  assert.equal(suggestStudioProjectIdFromPath("D:\\dev\\Northern Step Studio\\apps\\provly"), "provly");
  assert.match(getModeDetails("debugging"), /Debugging mode/i);
}
