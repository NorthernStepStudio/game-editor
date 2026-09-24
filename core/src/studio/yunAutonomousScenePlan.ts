import { createStudioPlan } from "./orchestrator.js";
import type { NssStudioPlan } from "./types.js";
import {
  YUN_ENVIRONMENT_SPECS,
  getYunEnvironmentSpec,
  resolveYunEnvironmentSpecFromGoal,
} from "./adapters/blender/yunEnvironmentVariantSpec.js";
import { yunEnvironmentAcceptanceCriteria } from "./adapters/blender/yunEnvironmentFixture.js";
import type { YunEnvironmentTheme } from "./adapters/blender/yunEnvironmentContract.js";

export interface YunAutonomousSceneRequest {
  readonly id?: string;
  readonly goal: string;
  readonly godotProjectPath: string;
  readonly theme?: YunEnvironmentTheme;
  readonly target?: "disposable" | "production-opt-in";
  readonly playerCount?: number;
}

export const YUN_FULL_SCENE_FLYRAIL_CRITERIA = [
  "Godot validation passes",
  "Scenario checks pass",
  "QA checks pass",
  JSON.stringify({
    id: "scene-environment-root",
    description: "Matterhorn environment root exists",
    checkType: "node_exists",
    target: "MatterhornEnvironment",
    expected: true,
  }),
  JSON.stringify({
    id: "scene-player-count",
    description: "Six Yun players are visible",
    checkType: "property_equals",
    target: "playerCount",
    expected: 6,
  }),
  JSON.stringify({
    id: "scene-route-return",
    description: "Yun route returns to home",
    checkType: "property_equals",
    target: "route.returned_to_yun",
    expected: true,
  }),
  JSON.stringify({
    id: "scene-tag-role-swap",
    description: "Yun tag and role swap succeeds",
    checkType: "property_equals",
    target: "tagGameplayOk",
    expected: true,
  }),
] as const;

export function resolveYunSceneTheme(request: Pick<YunAutonomousSceneRequest, "goal" | "theme">): YunEnvironmentTheme {
  if (request.theme) return request.theme;
  const resolved = resolveYunEnvironmentSpecFromGoal(request.goal);
  if (resolved) return resolved.theme;

  const normalized = request.goal.toLowerCase();
  if (normalized.includes("malecon") || normalized.includes("malecón")) return "malecon";
  if (normalized.includes("parque") || normalized.includes("park")) return "parque";
  if (normalized.includes("noche") || normalized.includes("night")) return "noche";
  if (normalized.includes("calle") || normalized.includes("street")) return "calle";

  throw new Error(
    `Yun full-scene request must identify a supported theme: ${YUN_ENVIRONMENT_SPECS.map((spec) => spec.theme).join(", ")}.`,
  );
}

export function createYunAutonomousScenePlan(request: YunAutonomousSceneRequest): NssStudioPlan {
  const goal = request.goal.trim();
  const projectPath = request.godotProjectPath.trim();
  if (!goal) throw new Error("Yun full-scene goal must be non-empty.");
  if (!projectPath) throw new Error("Yun full-scene request requires a Godot project path.");

  const theme = resolveYunSceneTheme(request);
  const environment = getYunEnvironmentSpec(theme);
  const target = request.target ?? "disposable";
  const players = request.playerCount ?? 6;
  if (players !== 6) {
    throw new Error("The current Yun full-scene gate requires exactly six players.");
  }

  const environmentCriteria = yunEnvironmentAcceptanceCriteria(environment);
  const sceneGoal = [
    `Assemble and validate a Yun ${environment.displayName} full scene.`,
    `Use the dependency GLB artifact ${environment.assetId}.glb produced by Blender.`,
    `Target mode: ${target}.`,
    "Preserve authoritative YunCourt geometry and gameplay rules.",
    "Use six visible Yun players and the production match camera.",
    "Run the YUN → tube → TURN → YUN route and production tag/role-swap probe.",
    "Do not report completion unless the dependency environment artifact is actually imported and instantiated.",
  ].join(" ");

  return createStudioPlan({
    id: request.id ?? `yun-full-scene-${theme}`,
    goal,
    tasks: [
      {
        id: "generate-environment",
        title: `Generate ${environment.displayName}`,
        goal: `Generate Yun environment ${theme} as ${environment.assetId}`,
        domain: "blender",
        specialistId: "blender-engine",
        acceptanceCriteria: environmentCriteria,
        requiredCapabilities: [
          "blender.create",
          "blender.render.preview",
          "blender.export.glb",
          "blender.qa",
        ],
        outputArtifacts: [
          {
            kind: "glb",
            uri: "",
            label: `${environment.assetId}.glb`,
            producedBy: "blender-engine",
          },
        ],
      },
      {
        id: "assemble-validate-scene",
        title: "Assemble and validate Yun scene in Godot",
        goal: sceneGoal,
        domain: "godot",
        specialistId: "flyrail",
        dependsOn: ["generate-environment"],
        acceptanceCriteria: [...YUN_FULL_SCENE_FLYRAIL_CRITERIA],
        requiredCapabilities: [
          "godot.project.inspect",
          "godot.project.run",
          "godot.validation.run",
          "godot.screenshot.capture",
        ],
        inputArtifacts: [
          {
            kind: "godot-project",
            uri: projectPath,
            label: target === "production-opt-in" ? "Yun production project" : "Yun disposable project",
          },
        ],
      },
    ],
    finalAcceptanceCriteria: [...YUN_FULL_SCENE_FLYRAIL_CRITERIA],
  });
}
