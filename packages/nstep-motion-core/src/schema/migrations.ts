import type { CharacterProject } from './types.js';
import { CURRENT_PROJECT_SCHEMA_VERSION, getProjectSchemaVersion, stampProjectSchemaVersion } from './version.js';
import { ensureProjectRestPose } from './restPose.js';

export interface MigrationResult {
  project: CharacterProject;
  fromVersion: number;
  toVersion: number;
  changed: boolean;
  notes: string[];
}

function migrateLegacyToV1(project: CharacterProject, notes: string[]) {
  ensureProjectRestPose(project);
  if (!(project as any).schemaVersion) {
    notes.push('Added schemaVersion.');
  }
  if (!project.skins || project.skins.length === 0) {
    project.skins = [{ id: 'skin-default', name: 'Default', slots: {} }];
    project.activeSkinId = 'skin-default';
    notes.push('Added default skin.');
  }
  stampProjectSchemaVersion(project as any);
}

export function migrateProject(project: CharacterProject): MigrationResult {
  const fromVersion = getProjectSchemaVersion(project as any);
  const notes: string[] = [];

  if (fromVersion > CURRENT_PROJECT_SCHEMA_VERSION) {
    throw new Error(`Project schemaVersion ${fromVersion} is newer than supported version ${CURRENT_PROJECT_SCHEMA_VERSION}.`);
  }

  if (fromVersion < 1) migrateLegacyToV1(project, notes);

  return {
    project,
    fromVersion,
    toVersion: CURRENT_PROJECT_SCHEMA_VERSION,
    changed: fromVersion !== CURRENT_PROJECT_SCHEMA_VERSION || notes.length > 0,
    notes,
  };
}
