import type { StudioProjectDefinition } from "../models/project.types.js";

export const STUDIO_PROJECTS: ReadonlyArray<StudioProjectDefinition> = [
  {
    id: "nexusbuild",
    title: "NexusBuild",
    description: "PC planning, parts guidance, and related studio work.",
    linkedPreset: "nexusbuild",
  },
  {
    id: "provly",
    title: "ProvLy",
    description: "Home inventory, exports, and insurance-readiness work.",
    linkedPreset: "provly",
  },
  {
    id: "neuromoves",
    title: "Workspace Ops",
    description: "Workspace planning, implementation support, and safe change coordination.",
    linkedPreset: "neuromoves",
  },
  {
    id: "synox",
    title: "Synox",
    description: "Automation, workflow, and local service business systems.",
    linkedPreset: "synox",
  },
  {
    id: "noobs-investing",
    title: "NooBS Investing",
    description: "Beginner investing education and product work.",
    linkedPreset: "noobs-investing",
  },
  {
    id: "general-nss-studio",
    title: "General NStep AI Studio",
    description: "Studio-wide planning, prioritization, and operations.",
    linkedPreset: "general-nss-studio",
  },
];
