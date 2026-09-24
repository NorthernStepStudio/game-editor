export { BlenderAdapter, type BlenderAdapterOptions, findBlenderExecutable } from "./blenderAdapter.js";
export {
  executeBlenderPython,
  executeBlenderPythonAsync,
  queryBlenderVersion,
} from "./blenderProcess.js";
export { generateBlenderCrateScript, type BlenderCrateSpec } from "./blenderScriptGenerator.js";
export { compileBlenderTaskScript } from "./blenderScriptCompiler.js";
export { validateBlenderTaskSpec, type BlenderTaskSpec } from "./blenderTaskSpec.js";
export { buildCrateTaskSpec, buildHumanoidPrototypeTaskSpec } from "./blenderFixtures.js";
export {
  buildYunPlayerBaseTaskSpec,
  buildYunPlayerBaseOperations,
  YUN_PLAYER_BASE_ASSET_NAME,
  YUN_PLAYER_BASE_TEAM_COLOR_MATERIAL,
  YUN_PLAYER_BASE_MATERIALS,
  YUN_PLAYER_BASE_BONES,
} from "./yunPlayerBaseFixture.js";
export {
  buildYunPlayerBaseV2TaskSpec,
  buildYunPlayerBaseV2Operations,
  YUN_PLAYER_BASE_V2_ASSET_NAME,
  YUN_PLAYER_BASE_V2_REVISION,
} from "./yunPlayerBaseV2Fixture.js";
export {
  runYunCharacterVisualSanity,
  type YunCharacterVisualSanityReport,
} from "./yunCharacterVisualSanity.js";
export {
  YUN_ROSTER_REVISION,
  YUN_ROSTER_VARIANTS,
  YUN_ROSTER_GENERATED_VARIANTS,
  YUN_ROSTER_GEOMETRY_BUDGET,
  YUN_ROSTER_TEAM_COLOR_MATERIAL,
  assertYunRosterUnique,
  getYunRosterVariant,
  validateYunCharacterVariantSpec,
  type YunCharacterVariantSpec,
} from "./yunCharacterVariantSpec.js";
export {
  buildYunCharacterVariantTaskSpec,
  buildYunCharacterVariantOperations,
  appendSharedYunLocomotionAnimations,
  resolveYunRosterVariantFromGoal,
} from "./yunCharacterVariantFixture.js";
export {
  BLENDER_OPERATION_KINDS,
  IMPLEMENTED_BLENDER_CAPABILITIES,
  type BlenderOperation,
  type BlenderOperationKind,
} from "./blenderOperations.js";
export { validateExpectedArtifacts, resolveConfinedPath } from "./blenderArtifacts.js";
export { YUN_CHARACTER_CONTRACT, matchYunAnimationClips } from "./yunCharacterContract.js";

export {
  YUN_ENVIRONMENT_REVISION,
  YUN_COURT_CONTRACT,
  YUN_COURT_WORLD_METRICS,
  YUN_ENVIRONMENT_PROP_FOOTPRINTS,
  YUN_FIRST_ENVIRONMENT_SPEC,
  validateYunEnvironmentSpec,
  type YunEnvironmentTheme,
  type YunEnvironmentPropSpec,
  type YunEnvironmentAssetSpec,
} from "./yunEnvironmentContract.js";
export {
  YUN_CALLE_MATERIALS,
  YUN_ENVIRONMENT_PLAY_X,
  buildYunEnvironmentOperations,
  buildYunEnvironmentTaskSpec,
} from "./yunEnvironmentFixture.js";
export {
  runYunEnvironmentVisualSanity,
  type YunEnvironmentVisualSanityCheck,
  type YunEnvironmentVisualSanityReport,
} from "./yunEnvironmentVisualSanity.js";

export {
  YUN_ENVIRONMENT_MATERIAL_PALETTES,
  YUN_ENVIRONMENT_WORLD_PREVIEWS,
  YUN_MALECON_ENVIRONMENT_SPEC,
  YUN_PARQUE_ENVIRONMENT_SPEC,
  YUN_NOCHE_ENVIRONMENT_SPEC,
  YUN_ENVIRONMENT_SPECS,
  getYunEnvironmentSpec,
  resolveYunEnvironmentSpecFromGoal,
  type YunEnvironmentMaterialName,
  type YunEnvironmentMaterialPalette,
} from "./yunEnvironmentVariantSpec.js";
