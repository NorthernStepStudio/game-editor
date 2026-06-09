export const CURRENT_PROJECT_SCHEMA_VERSION = 1;

export interface VersionedProjectLike {
  schemaVersion?: number;
}

export function getProjectSchemaVersion(project: VersionedProjectLike | null | undefined): number {
  if (!project || typeof project !== 'object') return 0;
  const raw = Number(project.schemaVersion ?? 0);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
}

export function stampProjectSchemaVersion<T extends VersionedProjectLike>(project: T): T {
  project.schemaVersion = CURRENT_PROJECT_SCHEMA_VERSION;
  return project;
}
