import { evaluateController } from '@nstep-core/runtime/evaluateController';
import { ProjectState } from '../state/projectState';
import { ClipboardState, Pose, PoseTransform } from '../state/clipboardState';
import { DirtyState } from '../state/dirtyState';

const POSE_PROPS = ['x', 'y', 'rotation', 'scaleX', 'scaleY'] as const;
type PoseProp = typeof POSE_PROPS[number];

const KF_TIME_EPS = 0.0005;

// ── Pose capture ──────────────────────────────────────────────────────────────

export function capturePose(animId: string, time: number): Pose {
  const project = ProjectState.project;
  const anim    = project.animations.find((a: any) => a.id === animId);
  if (!anim) return {};

  const pose: Pose = {};

  for (const ctrl of anim.controllers as any[]) {
    if (!ctrl.enabled) continue;
    const prop = ctrl.property as string;
    if (!(POSE_PROPS as readonly string[]).includes(prop)) continue;

    const value = evaluateController(ctrl, time, anim.duration || 1);

    if (!pose[ctrl.targetPartId]) {
      pose[ctrl.targetPartId] = { x: 0, y: 0, rotation: 0, scaleX: 0, scaleY: 0 };
    }
    (pose[ctrl.targetPartId] as any)[prop] += value;
  }

  return pose;
}

// ── Pose paste ────────────────────────────────────────────────────────────────

export function pastePose(animId: string, time: number, pose: Pose): void {
  const project = ProjectState.project;
  const anim    = project.animations.find((a: any) => a.id === animId);
  if (!anim) return;

  for (const [partId, transforms] of Object.entries(pose)) {
    for (const prop of POSE_PROPS) {
      const value = (transforms as any)[prop] as number;
      _writeKeyframe(anim, partId, prop, time, value);
    }
  }

  DirtyState.markDirty();
}

function _writeKeyframe(anim: any, partId: string, prop: PoseProp, time: number, value: number): void {
  let ctrl = (anim.controllers as any[]).find(
    (c: any) => c.targetPartId === partId && c.property === prop && c.mode === 'keyframe'
  );

  if (!ctrl) {
    ctrl = {
      id:            'ctrl-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      targetPartId:  partId,
      property:      prop,
      formulaPreset: 'sine',
      enabled:       true,
      params:        { speed: 1, amplitude: 0, phase: 0, offset: 0, min: 0, max: 0 },
      mode:          'keyframe',
      keyframes:     [],
    };
    anim.controllers.push(ctrl);
  }

  const existing = ctrl.keyframes.find((kf: any) => Math.abs(kf.time - time) < KF_TIME_EPS);
  if (existing) {
    existing.value = value;
  } else {
    ctrl.keyframes.push({
      id:     'kf-' + Math.random().toString(36).slice(2, 11),
      time,
      value,
      easing: 'linear',
    });
  }
}

// ── Mirror pose ───────────────────────────────────────────────────────────────

function mirrorSuffix(name: string): string | null {
  const pairs: [RegExp, string][] = [
    [/(_L)$/,     '_R'],
    [/(_R)$/,     '_L'],
    [/(_l)$/,     '_r'],
    [/(_r)$/,     '_l'],
    [/(_left)$/,  '_right'],
    [/(_right)$/, '_left'],
    [/(Left)$/,   'Right'],
    [/(Right)$/,  'Left'],
  ];
  for (const [re, rep] of pairs) {
    if (re.test(name)) return name.replace(re, rep);
  }
  return null;
}

export function mirrorPose(pose: Pose, parts: { id: string; name: string }[]): Pose {
  const nameToId: Record<string, string> = {};
  parts.forEach(p => { nameToId[p.name] = p.id; });

  const processed = new Set<string>();
  const result: Pose = {};

  // Copy all entries first
  for (const [partId, t] of Object.entries(pose)) {
    result[partId] = { ...t };
  }

  for (const part of parts) {
    if (processed.has(part.id)) continue;

    const mirrorName = mirrorSuffix(part.name);
    if (!mirrorName) continue;

    const mirrorId = nameToId[mirrorName];
    if (!mirrorId) continue;

    processed.add(part.id);
    processed.add(mirrorId);

    const aEntry = pose[part.id];
    const bEntry = pose[mirrorId];

    const flipTransform = (t: PoseTransform): PoseTransform => ({
      ...t,
      x:        -t.x,
      rotation: -t.rotation,
    });

    if (aEntry && bEntry) {
      result[part.id]  = flipTransform(bEntry);
      result[mirrorId] = flipTransform(aEntry);
    } else if (aEntry) {
      result[mirrorId] = flipTransform(aEntry);
      result[part.id]  = flipTransform(aEntry);
    } else if (bEntry) {
      result[part.id]  = flipTransform(bEntry);
      result[mirrorId] = flipTransform(bEntry);
    }
  }

  return result;
}

// ── Reset pose ────────────────────────────────────────────────────────────────

export function resetPoseAtTime(animId: string, time: number): void {
  const project = ProjectState.project;
  const anim    = project.animations.find((a: any) => a.id === animId);
  if (!anim) return;

  for (const ctrl of anim.controllers as any[]) {
    if (ctrl.mode !== 'keyframe' || !ctrl.keyframes) continue;
    ctrl.keyframes = ctrl.keyframes.filter((kf: any) => Math.abs(kf.time - time) >= KF_TIME_EPS);
  }

  DirtyState.markDirty();
}

// ── Convenience: copy current pose to clipboard ───────────────────────────────

export function copyPoseToClipboard(animId: string, time: number): void {
  ClipboardState.copiedPose = capturePose(animId, time);
}
