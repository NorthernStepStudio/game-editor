import { ProjectState } from '../state/projectState';
import { SelectionState } from '../state/selectionState';
import { DirtyState } from '../state/dirtyState';
import { createDefaultPart } from '../../../../packages/nstep-motion-core/src/schema/defaults';

export interface BoneDef {
  localId: string;
  parentLocalId: string | null;
  name: string;
  x: number;
  y: number;
  z?: number;
  color?: string;
  shape?: string;
  origin?: { x: number; y: number };
}

export interface SkeletonPreset {
  id: string;
  name: string;
  icon: string;
  description: string;
  boneCount: number;
  bones: BoneDef[];
}

const TORSO = '#3b5bdb';
const HEAD = '#5c7cfa';
const ARM = '#1098ad';
const LEG = '#7048e8';
const ACCENT = '#e8590c';

const jointOrigin = { x: 20, y: 5 };

// ── Humanoid: full skeleton with 2-segment limbs (the previously-missing parts) ──
const HUMANOID: SkeletonPreset = {
  id: 'humanoid',
  name: 'Humanoid',
  icon: '🧍',
  description: 'Full biped — spine, head, two-segment arms & legs (thigh + shin + foot).',
  boneCount: 15,
  bones: [
    { localId: 'hips',      parentLocalId: null,        name: 'Hips',       x: 0,   y: 0,   z: 10, color: TORSO, shape: 'roundedRect', origin: { x: 20, y: 20 } },
    { localId: 'spine',     parentLocalId: 'hips',      name: 'Spine',      x: 0,   y: -28, z: 11, color: TORSO },
    { localId: 'chest',     parentLocalId: 'spine',     name: 'Chest',      x: 0,   y: -28, z: 12, color: TORSO },
    { localId: 'head',      parentLocalId: 'chest',     name: 'Head',       x: 0,   y: -26, z: 13, color: HEAD,  shape: 'circle', origin: { x: 20, y: 20 } },
    { localId: 'arm_l',     parentLocalId: 'chest',     name: 'Arm L',      x: -22, y: -20, z: 9,  color: ARM },
    { localId: 'forearm_l', parentLocalId: 'arm_l',     name: 'Forearm L',  x: 0,   y: 30,  z: 9,  color: ARM },
    { localId: 'hand_l',    parentLocalId: 'forearm_l', name: 'Hand L',     x: 0,   y: 26,  z: 9,  color: ACCENT },
    { localId: 'arm_r',     parentLocalId: 'chest',     name: 'Arm R',      x: 22,  y: -20, z: 14, color: ARM },
    { localId: 'forearm_r', parentLocalId: 'arm_r',     name: 'Forearm R',  x: 0,   y: 30,  z: 14, color: ARM },
    { localId: 'hand_r',    parentLocalId: 'forearm_r', name: 'Hand R',     x: 0,   y: 26,  z: 14, color: ACCENT },
    { localId: 'thigh_l',   parentLocalId: 'hips',      name: 'Thigh L',    x: -12, y: 14,  z: 8,  color: LEG },
    { localId: 'shin_l',    parentLocalId: 'thigh_l',   name: 'Shin L',     x: 0,   y: 34,  z: 8,  color: LEG },
    { localId: 'foot_l',    parentLocalId: 'shin_l',    name: 'Foot L',     x: 0,   y: 30,  z: 8,  color: ACCENT },
    { localId: 'thigh_r',   parentLocalId: 'hips',      name: 'Thigh R',    x: 12,  y: 14,  z: 8,  color: LEG },
    { localId: 'shin_r',    parentLocalId: 'thigh_r',   name: 'Shin R',     x: 0,   y: 34,  z: 8,  color: LEG },
    { localId: 'foot_r',    parentLocalId: 'shin_r',    name: 'Foot R',     x: 0,   y: 30,  z: 8,  color: ACCENT },
  ],
};
// Correct the count to match the actual bone list length.
HUMANOID.boneCount = HUMANOID.bones.length;

// ── Simple Biped: single-segment limbs for a quick start ──
const SIMPLE_BIPED: SkeletonPreset = {
  id: 'simpleBiped',
  name: 'Simple Biped',
  icon: '🚶',
  description: 'Quick start — body, head, one-segment arms and legs.',
  boneCount: 6,
  bones: [
    { localId: 'body',  parentLocalId: null,   name: 'Body',  x: 0,   y: 0,   z: 10, color: TORSO, shape: 'roundedRect', origin: { x: 20, y: 20 } },
    { localId: 'head',  parentLocalId: 'body', name: 'Head',  x: 0,   y: -30, z: 13, color: HEAD, shape: 'circle', origin: { x: 20, y: 20 } },
    { localId: 'arm_l', parentLocalId: 'body', name: 'Arm L', x: -22, y: -14, z: 9,  color: ARM },
    { localId: 'arm_r', parentLocalId: 'body', name: 'Arm R', x: 22,  y: -14, z: 14, color: ARM },
    { localId: 'leg_l', parentLocalId: 'body', name: 'Leg L', x: -12, y: 20,  z: 8,  color: LEG },
    { localId: 'leg_r', parentLocalId: 'body', name: 'Leg R', x: 12,  y: 20,  z: 8,  color: LEG },
  ],
};

// ── Quadruped: body, head, tail, four two-segment legs ──
const QUADRUPED: SkeletonPreset = {
  id: 'quadruped',
  name: 'Quadruped',
  icon: '🐾',
  description: 'Four-legged creature — body, head, tail, two-segment legs.',
  boneCount: 12,
  bones: [
    { localId: 'body',     parentLocalId: null,       name: 'Body',        x: 0,   y: 0,  z: 10, color: TORSO, shape: 'roundedRect', origin: { x: 30, y: 15 } },
    { localId: 'neck',     parentLocalId: 'body',     name: 'Neck',        x: 34,  y: -6, z: 11, color: TORSO },
    { localId: 'head',     parentLocalId: 'neck',     name: 'Head',        x: 10,  y: -10,z: 12, color: HEAD, shape: 'circle', origin: { x: 20, y: 20 } },
    { localId: 'tail',     parentLocalId: 'body',     name: 'Tail',        x: -34, y: -2, z: 9,  color: ACCENT, shape: 'cape' },
    { localId: 'fleg_l_u', parentLocalId: 'body',     name: 'Front Leg L', x: 24,  y: 12, z: 8,  color: LEG },
    { localId: 'fleg_l_d', parentLocalId: 'fleg_l_u', name: 'Front Shin L',x: 0,   y: 28, z: 8,  color: LEG },
    { localId: 'fleg_r_u', parentLocalId: 'body',     name: 'Front Leg R', x: 24,  y: 12, z: 13, color: LEG },
    { localId: 'fleg_r_d', parentLocalId: 'fleg_r_u', name: 'Front Shin R',x: 0,   y: 28, z: 13, color: LEG },
    { localId: 'bleg_l_u', parentLocalId: 'body',     name: 'Back Leg L',  x: -24, y: 12, z: 8,  color: LEG },
    { localId: 'bleg_l_d', parentLocalId: 'bleg_l_u', name: 'Back Shin L', x: 0,   y: 28, z: 8,  color: LEG },
    { localId: 'bleg_r_u', parentLocalId: 'body',     name: 'Back Leg R',  x: -24, y: 12, z: 13, color: LEG },
    { localId: 'bleg_r_d', parentLocalId: 'bleg_r_u', name: 'Back Shin R', x: 0,   y: 28, z: 13, color: LEG },
  ],
};

export const SKELETON_PRESETS: SkeletonPreset[] = [HUMANOID, SIMPLE_BIPED, QUADRUPED];

/**
 * Install a preset skeleton into the current project. Remaps the preset's local
 * bone ids to fresh unique ids so multiple installs never collide.
 * Returns the id of the root bone so callers can select it.
 */
export function installSkeleton(preset: SkeletonPreset, replace: boolean): string | null {
  const project = ProjectState.project;
  if (replace) {
    project.parts = [];
    project.animations.forEach((a: any) => { a.controllers = []; });
    SelectionState.activePartId = null;
  }

  const stamp = Date.now().toString(36);
  const idMap: Record<string, string> = {};
  preset.bones.forEach((b, i) => { idMap[b.localId] = `${preset.id}-${stamp}-${i}`; });

  let rootId: string | null = null;
  preset.bones.forEach(b => {
    const id = idMap[b.localId];
    const part: any = createDefaultPart(id, b.name);
    part.parentId = b.parentLocalId ? idMap[b.parentLocalId] : null;
    part.baseX = b.x;
    part.baseY = b.y;
    part.zIndex = b.z ?? 10;
    part.color = b.color ?? '#4b5563';
    part.shapeType = b.shape ?? 'bone';
    part.renderMode = 'shape';
    part.origin = b.origin ?? { ...jointOrigin };
    project.parts.push(part);
    if (!part.parentId && rootId === null) rootId = id;
  });

  if (rootId) SelectionState.activePartId = rootId;
  DirtyState.markDirty();
  return rootId;
}
