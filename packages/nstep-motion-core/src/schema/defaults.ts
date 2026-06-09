import type { CharacterProject, CharacterPart, AnimationController } from './types.js';
import { CURRENT_PROJECT_SCHEMA_VERSION } from './version.js';
import { capturePartRestPose } from './restPose.js';

export function createDefaultProject(): CharacterProject {
  const id = 'proj-' + Math.random().toString(36).substr(2, 9);
  return {
    schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
    id,
    name: 'New Project',
    assets: [],
    animations: [
      {
        id: 'anim-idle',
        name: 'Idle',
        duration: 1.5,
        loop: true,
        controllers: []
      }
    ],
    parts: [],
    skins: [{ id: 'skin-default', name: 'Default', slots: {} }],
    activeSkinId: 'skin-default',
  };
}

export function createDefaultPart(id: string, name: string): CharacterPart {
  const part: CharacterPart = {
    id,
    name,
    parentId: null,
    baseX: 0,
    baseY: 0,
    baseRotation: 0,
    baseScaleX: 1,
    baseScaleY: 1,
    origin: { x: 20, y: 20 },
    zIndex: 10,
    color: '#4b5563',
    renderMode: 'shape',
    shapeType: 'roundedRect',
    editChildrenTogether: true,
  };
  capturePartRestPose(part);
  return part;
}

export function createDefaultController(targetPartId: string): AnimationController {
  return {
    id: 'ctrl-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
    targetPartId,
    property: 'y',
    formulaPreset: 'breathingY',
    enabled: true,
    params: {
      speed: 1,
      amplitude: 5,
      phase: 0,
      offset: 0,
      min: 0,
      max: 0
    }
  };
}
