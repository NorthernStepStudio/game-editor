import type { NssRoadmapNote } from "../../models/roadmap.types.js";

export function createRoadmapNote(projectId: string, note: string): NssRoadmapNote {
  return {
    id: `roadmap-${Date.now()}`,
    projectId,
    note,
    status: "open",
    createdAt: new Date().toISOString(),
  };
}

export function listRoadmapNotes(notes: readonly NssRoadmapNote[], projectId: string): NssRoadmapNote[] {
  return notes.filter((note) => note.projectId === projectId);
}
