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
    availability: "integration-pending",
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
    availability: "planned",
    capabilities: [
      {
        id: "blender.create",
        domain: "blender",
        description: "Create and modify Blender scenes, meshes, materials, rigs, animation, lighting, and procedural content.",
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
    case "art":
      return "blender-engine";
    case "orchestration":
    case "software":
    case "qa":
    case "release":
    case "audio":
    default:
      return "matterhorn";
  }
}

export function specialistSupportsDomain(
  specialistId: NssStudioSpecialistId,
  domain: NssStudioDomain,
): boolean {
  return getStudioSpecialist(specialistId).capabilities.some((capability) => capability.domain === domain);
}
