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

// Pivot near the top of a limb bone so it rotates around its joint.
const jointOrigin = { x: 20, y: 5 };

// ── 2D rigging principle ──────────────────────────────────────────────────────
// In 2D skeletal animation (Spine / DragonBones style) you add a bone ONLY where
// a sprite piece needs its own pivot. No anatomy-for-anatomy's-sake: ears are part
// of the head sprite (no bone), there is no neck unless the head tilts on its own,
// and the back is a SINGLE torso bone — not a chain of spine vertebrae (that's a
// 3D/cinematic concern). These presets are lean, side-view, game-ready rigs.

// ── Humanoid: lean side-view biped with elbows & knees ──
const HUMANOID: SkeletonPreset = {
  id: 'humanoid',
  name: 'Humanoid',
  icon: '🧍',
  description: 'Side-view 2D biped — hip, one torso, head, and arms & legs with elbows/knees. No neck or spine chain.',
  boneCount: 0,
  bones: [
    { localId: 'hip',          parentLocalId: null,         name: 'Hip',         x: 0,  y: 0,   z: 10, color: TORSO, shape: 'roundedRect', origin: { x: 20, y: 20 } },
    { localId: 'torso',        parentLocalId: 'hip',        name: 'Torso',       x: 0,  y: -30, z: 11, color: TORSO },
    { localId: 'head',         parentLocalId: 'torso',      name: 'Head',        x: 0,  y: -30, z: 12, color: HEAD, shape: 'circle', origin: { x: 20, y: 20 } },
    { localId: 'arm_back_u',   parentLocalId: 'torso',      name: 'Back Arm',    x: 3,  y: -24, z: 9,  color: ARM },
    { localId: 'arm_back_l',   parentLocalId: 'arm_back_u', name: 'Back Forearm',x: 0,  y: 28,  z: 9,  color: ARM },
    { localId: 'arm_front_u',  parentLocalId: 'torso',      name: 'Front Arm',   x: -3, y: -24, z: 14, color: ARM },
    { localId: 'arm_front_l',  parentLocalId: 'arm_front_u',name: 'Front Forearm',x: 0, y: 28,  z: 14, color: ARM },
    { localId: 'leg_back_u',   parentLocalId: 'hip',        name: 'Back Thigh',  x: 4,  y: 10,  z: 8,  color: LEG },
    { localId: 'leg_back_l',   parentLocalId: 'leg_back_u', name: 'Back Shin',   x: 0,  y: 32,  z: 8,  color: LEG },
    { localId: 'leg_front_u',  parentLocalId: 'hip',        name: 'Front Thigh', x: -4, y: 10,  z: 13, color: LEG },
    { localId: 'leg_front_l',  parentLocalId: 'leg_front_u',name: 'Front Shin',  x: 0,  y: 32,  z: 13, color: LEG },
  ],
};

// ── Stick Figure: ultra-minimal, single-segment limbs (crowds, quick start) ──
const SIMPLE_BIPED: SkeletonPreset = {
  id: 'simpleBiped',
  name: 'Stick Figure',
  icon: '🚶',
  description: 'Ultra-minimal — body, head, one bone per arm and leg. The leanest rig that can still walk.',
  boneCount: 0,
  bones: [
    { localId: 'body',  parentLocalId: null,   name: 'Body',      x: 0,  y: 0,   z: 10, color: TORSO, shape: 'roundedRect', origin: { x: 20, y: 20 } },
    { localId: 'head',  parentLocalId: 'body', name: 'Head',      x: 0,  y: -30, z: 12, color: HEAD, shape: 'circle', origin: { x: 20, y: 20 } },
    { localId: 'arm_b', parentLocalId: 'body', name: 'Back Arm',  x: 3,  y: -16, z: 9,  color: ARM },
    { localId: 'arm_f', parentLocalId: 'body', name: 'Front Arm', x: -3, y: -16, z: 13, color: ARM },
    { localId: 'leg_b', parentLocalId: 'body', name: 'Back Leg',  x: 4,  y: 18,  z: 8,  color: LEG },
    { localId: 'leg_f', parentLocalId: 'body', name: 'Front Leg', x: -4, y: 18,  z: 13, color: LEG },
  ],
};

// ── Quadruped: lean side-view animal (no neck, single-segment legs) ──
const QUADRUPED: SkeletonPreset = {
  id: 'quadruped',
  name: 'Quadruped',
  icon: '🐾',
  description: 'Side-view 2D animal — body, head, tail, and a near + far leg front and back. No neck.',
  boneCount: 0,
  bones: [
    { localId: 'body',   parentLocalId: null,   name: 'Body',          x: 0,   y: 0,  z: 10, color: TORSO, shape: 'roundedRect', origin: { x: 30, y: 15 } },
    { localId: 'head',   parentLocalId: 'body', name: 'Head',          x: 36,  y: -8, z: 12, color: HEAD, shape: 'circle', origin: { x: 20, y: 20 } },
    { localId: 'tail',   parentLocalId: 'body', name: 'Tail',          x: -34, y: -6, z: 9,  color: ACCENT, shape: 'cape' },
    { localId: 'fleg_n', parentLocalId: 'body', name: 'Front Leg',     x: 26,  y: 12, z: 13, color: LEG },
    { localId: 'fleg_f', parentLocalId: 'body', name: 'Front Leg Far', x: 22,  y: 12, z: 8,  color: LEG },
    { localId: 'bleg_n', parentLocalId: 'body', name: 'Back Leg',      x: -24, y: 12, z: 13, color: LEG },
    { localId: 'bleg_f', parentLocalId: 'body', name: 'Back Leg Far',  x: -28, y: 12, z: 8,  color: LEG },
  ],
};

// Keep the displayed counts in lockstep with the actual bone lists.
[HUMANOID, SIMPLE_BIPED, QUADRUPED].forEach(p => { p.boneCount = p.bones.length; });

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
