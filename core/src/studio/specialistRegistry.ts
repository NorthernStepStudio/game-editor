import type {
  NssStudioDomain,
  NssStudioSpecialist,
  NssStudioSpecialistId,
} from "./types.js";

export const STUDIO_SPECIALISTS: readonly NssStudioSpecialist[] = [
  {
    id: "matterhorn",
    title: "Matterhorn",
    role: "Northern Step Studio director and cross-system orchestrator.",
    executionMode: "orchestrator",
    availability: "available",
    capabilities: [
      {
        id: "studio.plan",
        domain: "orchestration",
        description: "Break a user goal into specialist-owned tasks with dependencies and acceptance criteria.",
      },
      {
        id: "studio.coordinate",
        domain: "orchestration",
        description: "Coordinate handoffs, evidence, retries, and final validation across specialist systems.",
      },
      {
        id: "software.workspace",
        domain: "software",
        description: "Use Matterhorn's existing workspace tools for general software tasks outside specialist-owned domains.",
      },
      {
        id: "studio.qa",
        domain: "qa",
        description: "Aggregate specialist evidence and verify that the overall plan satisfies its acceptance criteria.",
      },
      {
        id: "studio.release",
        domain: "release",
        description: "Coordinate final packaging and release readiness after specialist validation.",
      },
    ],
  },
  {
    id: "flyrail",
    title: "Flyrail",
    role: "Godot execution specialist for game implementation, playtesting, validation, and builds.",
    executionMode: "executor",
    availability: "available",
    capabilities: [
      {
        id: "godot.project",
        domain: "godot",
        description: "Own Godot project changes, scene/gameplay work, deterministic playtests, and Godot-specific repair loops.",
      },
      {
        id: "godot.qa",
        domain: "qa",
        description: "Produce Godot-specific test and playtest evidence for Matterhorn.",
      },
      {
        id: "godot.release",
        domain: "release",
        description: "Produce validated Godot exports and build evidence.",
      },
    ],
  },
  {
    id: "blender-engine",
    title: "Blender Engine",
    role: "Blender execution specialist for 3D creation, animation, visual inspection, optimization, and export.",
    executionMode: "executor",
    availability: "available",
    capabilities: [
      {
        id: "blender.create",
        domain: "blender",
        description: "Create and modify Blender scenes, meshes, materials, lighting, and procedural content via structured operations.",
      },
      {
        id: "blender.rig.create",
        domain: "blender",
        description: "Create armatures and named bones for skinned character assets.",
      },
      {
        id: "blender.rig.skin",
        domain: "blender",
        description: "Parent meshes to armatures and assign automatic weights.",
      },
      {
        id: "blender.animation.create",
        domain: "blender",
        description: "Create animation actions and insert bone keyframes (idle/walk/run foundation).",
      },
      {
        id: "blender.animation.inspect",
        domain: "blender",
        description: "Inspect animation actions present in a Blender scene.",
      },
      {
        id: "blender.character.inspect",
        domain: "blender",
        description: "Inspect skeleton and character export readiness.",
      },
      {
        id: "blender.export.character_glb",
        domain: "blender",
        description: "Export skinned animated character GLB for Godot.",
      },
      {
        id: "blender.art",
        domain: "art",
        description: "Produce visual assets and scene outputs owned by the Blender pipeline.",
      },
      {
        id: "blender.qa",
        domain: "qa",
        description: "Produce render, geometry, rig, material, and export validation evidence.",
      },
    ],
  },
  {
    id: "foundry",
    title: "Foundry",
    role: "Studio asset production coordinator using configured Foundry providers and provenance storage.",
    executionMode: "executor",
    availability: "available",
    capabilities: [
      {
        id: "foundry.asset.generate",
        domain: "art",
        description: "Generate, edit, and register project assets through Matterhorn's Foundry services with provider policy and provenance.",
      },
    ],
  },
];

export function listStudioSpecialists(): readonly NssStudioSpecialist[] {
  return STUDIO_SPECIALISTS;
}

export function getStudioSpecialist(id: NssStudioSpecialistId): NssStudioSpecialist {
  const specialist = STUDIO_SPECIALISTS.find((entry) => entry.id === id);
  if (!specialist) {
    throw new Error(`Unknown studio specialist: ${id}`);
  }
  return specialist;
}

export function listStudioSpecialistsForDomain(domain: NssStudioDomain): readonly NssStudioSpecialist[] {
  return STUDIO_SPECIALISTS.filter((specialist) =>
    specialist.capabilities.some((capability) => capability.domain === domain),
  );
}

export function resolveDefaultStudioSpecialist(domain: NssStudioDomain): NssStudioSpecialistId {
  switch (domain) {
    case "godot":
      return "flyrail";
    case "blender":
      return "blender-engine";
    case "art":
      return "foundry";
    case "orchestration":
    case "software":
    case "qa":
    case "release":
      return "matterhorn";
    case "audio":
      throw new Error("No default studio specialist is registered for the audio domain yet.");
  }
}

export function specialistSupportsDomain(
  specialistId: NssStudioSpecialistId,
  domain: NssStudioDomain,
): boolean {
  return getStudioSpecialist(specialistId).capabilities.some((capability) => capability.domain === domain);
}

export function specialistIsExecutable(specialistId: NssStudioSpecialistId): boolean {
  return getStudioSpecialist(specialistId).availability === "available";
}
