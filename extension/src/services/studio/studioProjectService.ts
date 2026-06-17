import { STUDIO_PROJECTS } from "../../config/studioProjects.js";

export function getStudioProjectTitle(projectId: string): string {
  const normalizedId = normalizeProjectId(projectId);
  return STUDIO_PROJECTS.find((project) => project.id === normalizedId)?.title ?? normalizedId;
}

export function getStudioProjectDescription(projectId: string): string {
  const normalizedId = normalizeProjectId(projectId);
  return STUDIO_PROJECTS.find((project) => project.id === normalizedId)?.description ?? "";
}

export function suggestStudioProjectIdFromPath(pathValue: string | undefined): string {
  const normalized = (pathValue ?? "").toLowerCase();
  if (normalized.includes("responseos")) {
    return "synox";
  }

  return STUDIO_PROJECTS.map((project) => project.id).find((id) => normalized.includes(id)) ?? "general-nss-studio";
}

function normalizeProjectId(projectId: string): string {
  return projectId === "responseos" ? "synox" : projectId;
}
