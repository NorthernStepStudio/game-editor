import type { CharacterPart, CharacterProject } from './types.js';

export interface PartRestPose {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  originX: number;
  originY: number;
}

export type RestPoseMap = Record<string, PartRestPose>;

export function getPartRestPose(part: CharacterPart): PartRestPose {
  const stored = (part as any).restPose as Partial<PartRestPose> | undefined;
  return {
    x: Number(stored?.x ?? part.baseX ?? 0),
    y: Number(stored?.y ?? part.baseY ?? 0),
    rotation: Number(stored?.rotation ?? part.baseRotation ?? 0),
    scaleX: Number(stored?.scaleX ?? part.baseScaleX ?? 1),
    scaleY: Number(stored?.scaleY ?? part.baseScaleY ?? 1),
    originX: Number(stored?.originX ?? part.origin?.x ?? 20),
    originY: Number(stored?.originY ?? part.origin?.y ?? 20),
  };
}

export function capturePartRestPose(part: CharacterPart): PartRestPose {
  const pose: PartRestPose = {
    x: Number(part.baseX ?? 0),
    y: Number(part.baseY ?? 0),
    rotation: Number(part.baseRotation ?? 0),
    scaleX: Number(part.baseScaleX ?? 1),
    scaleY: Number(part.baseScaleY ?? 1),
    originX: Number(part.origin?.x ?? 20),
    originY: Number(part.origin?.y ?? 20),
  };
  (part as any).restPose = pose;
  return pose;
}

export function applyPartRestPose(part: CharacterPart) {
  const pose = getPartRestPose(part);
  part.baseX = pose.x;
  part.baseY = pose.y;
  part.baseRotation = pose.rotation;
  part.baseScaleX = pose.scaleX;
  part.baseScaleY = pose.scaleY;
  part.origin = { x: pose.originX, y: pose.originY };
}

export function captureProjectRestPose(project: CharacterProject): RestPoseMap {
  const map: RestPoseMap = {};
  project.parts.forEach(part => {
    map[part.id] = capturePartRestPose(part);
  });
  return map;
}

export function applyProjectRestPose(project: CharacterProject) {
  project.parts.forEach(applyPartRestPose);
}

export function ensureProjectRestPose(project: CharacterProject) {
  project.parts.forEach(part => {
    if (!(part as any).restPose) capturePartRestPose(part);
  });
}
