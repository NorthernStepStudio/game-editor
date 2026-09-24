/**
 * Yun character contract derived from Flyrail games/yun wrapper expectations.
 *
 * Source of truth inspected (read-only, production Yun not modified):
 * - apps/flyrail/games/yun/scripts/mini_figure.gd (YunMiniFigure)
 *
 * Do not invent requirements that cannot be traced to the project.
 */

export const YUN_CHARACTER_CONTRACT_VERSION = "1.0.0";

/**
 * Clip binding rules from YunMiniFigure._bind_clips():
 * - idle: first AnimationPlayer clip whose lowercased name contains "idle"
 * - walk: first clip containing "walk" and not "wheel"
 * - sprint/run: first clip containing "sprint" OR "run"
 * Fallbacks: sprint falls back to walk; walk falls back to idle.
 */
export interface YunAnimationNameContract {
  readonly idleSubstring: "idle";
  readonly walkSubstring: "walk";
  readonly walkExcludeSubstring: "wheel";
  readonly runSubstrings: readonly ["sprint", "run"];
  /** Preferred explicit clip names for a Blender-produced replacement. */
  readonly preferredClipNames: readonly ["idle", "walk", "run"];
}

export interface YunRootNodeContract {
  /**
   * Wrapper instantiates the packed GLB as a Node3D child named "Kenney"
   * under the host. A Blender-produced Yun replacement should remain a
   * Node3D-rooted PackedScene instantiable the same way.
   */
  readonly instantiatedChildName: "Kenney";
  readonly rootType: "Node3D";
  readonly mustInstantiate: true;
}

export interface YunSkeletonContract {
  /**
   * mini_figure.gd does not require a specific Skeleton3D path by name;
   * it binds AnimationPlayer via find_child("AnimationPlayer", true, false).
   * Skinning is expected for character GLBs used by the wrapper.
   */
  readonly requiresAnimationPlayerNamed: "AnimationPlayer";
  readonly animationPlayerSearchRecursive: true;
  readonly skeletonRequiredForSkinnedReplacement: true;
}

export interface YunScaleOrientationContract {
  /** mount(..., scale := 1.2) multiplies the instance by Vector3.ONE * scale. */
  readonly wrapperDefaultScale: 1.2;
  /**
   * Gameplay characters move in a mostly XZ court plane (see match/attacker).
   * Kenney mini characters face along the model forward used by the court;
   * Blender exports should keep Godot-forward compatibility (-Z Godot / +Y up).
   */
  readonly godotUpAxis: "Y";
  readonly preferredForward: "-Z";
}

export interface YunMaterialContract {
  /**
   * Wrapper adds TeamSash; production opt-in may also tint materials whose name
   * contains "TeamShirt" (MAT_TeamShirt). Candidates expose MAT_TeamShirt as the
   * primary configurable team surface.
   */
  readonly wrapperOwnsTeamSash: true;
  readonly sashNodeName: "TeamSash";
  readonly characterMaterialsOwnedByAsset: true;
  readonly preferredTeamColorMaterial: "MAT_TeamShirt";
}

export interface YunColliderContract {
  /**
   * Colliders / CharacterBody ownership live on attacker/defender hosts,
   * not inside the Kenney GLB. A Blender Yun mesh should not become the
   * physics body; attachment is visual-only under the host.
   */
  readonly colliderOwnedByHostNotGlb: true;
}

export interface YunAttachmentContract {
  readonly youTagNodeName: "YouTag";
  readonly teamSashNodeName: "TeamSash";
  /** No required named bones in mini_figure.gd — sash/tag are positioned from mesh AABB. */
  readonly requiredBoneNames: readonly [];
}

export interface YunCharacterContract {
  readonly schemaVersion: typeof YUN_CHARACTER_CONTRACT_VERSION;
  readonly sourceFiles: readonly [
    "games/yun/scripts/mini_figure.gd",
  ];
  readonly animations: YunAnimationNameContract;
  readonly root: YunRootNodeContract;
  readonly skeleton: YunSkeletonContract;
  readonly scaleOrientation: YunScaleOrientationContract;
  readonly materials: YunMaterialContract;
  readonly collider: YunColliderContract;
  readonly attachments: YunAttachmentContract;
  readonly requiredAnimationPresence: readonly ["idle", "walk", "run_or_sprint"];
}

export const YUN_CHARACTER_CONTRACT: YunCharacterContract = {
  schemaVersion: YUN_CHARACTER_CONTRACT_VERSION,
  sourceFiles: ["games/yun/scripts/mini_figure.gd"],
  animations: {
    idleSubstring: "idle",
    walkSubstring: "walk",
    walkExcludeSubstring: "wheel",
    runSubstrings: ["sprint", "run"],
    preferredClipNames: ["idle", "walk", "run"],
  },
  root: {
    instantiatedChildName: "Kenney",
    rootType: "Node3D",
    mustInstantiate: true,
  },
  skeleton: {
    requiresAnimationPlayerNamed: "AnimationPlayer",
    animationPlayerSearchRecursive: true,
    skeletonRequiredForSkinnedReplacement: true,
  },
  scaleOrientation: {
    wrapperDefaultScale: 1.2,
    godotUpAxis: "Y",
    preferredForward: "-Z",
  },
  materials: {
    wrapperOwnsTeamSash: true,
    sashNodeName: "TeamSash",
    characterMaterialsOwnedByAsset: true,
    preferredTeamColorMaterial: "MAT_TeamShirt",
  },
  collider: {
    colliderOwnedByHostNotGlb: true,
  },
  attachments: {
    youTagNodeName: "YouTag",
    teamSashNodeName: "TeamSash",
    requiredBoneNames: [],
  },
  requiredAnimationPresence: ["idle", "walk", "run_or_sprint"],
};

export function matchYunAnimationClips(clipNames: readonly string[]): {
  idle?: string;
  walk?: string;
  sprint?: string;
  missing: string[];
} {
  let idle = "";
  let walk = "";
  let sprint = "";
  for (const clip of clipNames) {
    const low = clip.toLowerCase();
    if (!idle && low.includes("idle")) idle = clip;
    else if (!walk && low.includes("walk") && !low.includes("wheel")) walk = clip;
    else if (!sprint && (low.includes("sprint") || low.includes("run"))) sprint = clip;
  }
  if (!sprint) sprint = walk;
  if (!walk) walk = idle;
  const missing: string[] = [];
  if (!idle) missing.push("idle");
  if (!walk) missing.push("walk");
  if (!sprint) missing.push("run_or_sprint");
  return {
    ...(idle ? { idle } : {}),
    ...(walk ? { walk } : {}),
    ...(sprint ? { sprint } : {}),
    missing,
  };
}
