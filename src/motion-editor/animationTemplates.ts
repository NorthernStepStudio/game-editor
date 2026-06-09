import { SelectionState } from '../state/selectionState';
import { DirtyState } from '../state/dirtyState';

export type AnimTemplateType = 'idle' | 'walk' | 'walkFront' | 'run' | 'runFront' | 'jump' | 'hit' | 'death';

export function addControllerSafe(
  anim: any,
  partId: string,
  partName: string,
  property: 'x' | 'y' | 'rotation' | 'scaleX' | 'scaleY' | 'opacity',
  formulaPreset: string,
  params: Partial<{ speed: number; amplitude: number; phase: number; offset: number; min: number; max: number; }>
) {
  if (!partId) return;
  const existing = anim.controllers.find((c: any) => c.targetPartId === partId && c.property === property);
  if (existing && !confirm(`"${partName}" already has a ${property} controller. Add another?`)) return;

  anim.controllers.push({
    id: 'ctrl-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    targetPartId: partId,
    property,
    formulaPreset,
    enabled: true,
    mode: 'formula',
    keyframes: [],
    params: {
      speed:     params.speed     ?? 1,
      amplitude: params.amplitude ?? 10,
      phase:     params.phase     ?? 0,
      offset:    params.offset    ?? 0,
      min:       params.min       ?? 0,
      max:       params.max       ?? 0,
    },
  });
}

export function applyTemplate(
  anim: any,
  type: AnimTemplateType,
  project: any,
  onUpdate: Function
) {
  const parts = project.parts as any[];
  const match = (name: string, ...terms: string[]) =>
    terms.some(t => name.toLowerCase().includes(t));

  const bodies  = parts.filter(p => match(p.name,'body','torso','chest','hip','pelvis','spine'));
  const heads   = parts.filter(p => match(p.name,'head','face'));
  const legs    = parts.filter(p => match(p.name,'leg','foot','thigh','shin','knee','calf'));
  const arms    = parts.filter(p => match(p.name,'arm','hand','elbow','shoulder','forearm'));
  const weapons = parts.filter(p => match(p.name,'weapon','sword','staff','shield','bow','gun'));
  const capes   = parts.filter(p => match(p.name,'cape','cloak','cloth','tail','hair','skirt'));
  const eyes    = parts.filter(p => match(p.name,'eye','brow','eyelid'));

  const sideIsRight = (name: string, i: number): boolean => {
    const n = name.toLowerCase();
    if (n.includes('front') || n.includes('right') || n.includes('_r')) return true;
    if (n.includes('back')  || n.includes('left')  || n.includes('_l')) return false;
    return i % 2 === 1;
  };

  const roots = bodies.filter((p: any) => !p.parentId);

  const hasAnyPart = bodies.length + legs.length + arms.length > 0;
  if (!hasAnyPart && type !== 'hit') {
    alert(`No matching parts found. Name your parts with words like "body", "leg", "arm", "head", etc.`);
    return;
  }

  let targetAnim = anim;
  if (['jump','hit','death'].includes(type)) {
    const animName = type.charAt(0).toUpperCase() + type.slice(1);
    let existing = project.animations.find((a: any) => a.name.toLowerCase() === type);
    if (!existing) {
      const durations = { jump: 0.9, hit: 0.7, death: 2.5 };
      existing = {
        id: 'anim-' + type + '-' + Date.now(),
        name: animName,
        duration: durations[type as keyof typeof durations],
        loop: false,
        controllers: [],
      };
      project.animations.push(existing);
    }
    SelectionState.activeAnimId = existing.id;
    targetAnim = existing;
  }

  targetAnim.controllers = [];

  const speed = type === 'walk' ? 1.5 : type === 'walkFront' ? 1.8 : type === 'run' || type === 'runFront' ? 2.5 : 1;

  if (type === 'idle') {
    anim.duration = 2.5;
    anim.loop = true;
    bodies.forEach(p => {
      addControllerSafe(anim, p.id, p.name, 'y',        'breathingY',   { speed: 0.8,  amplitude: 5 });
      addControllerSafe(anim, p.id, p.name, 'rotation', 'swayRotation', { speed: 0.5,  amplitude: 2 });
      addControllerSafe(anim, p.id, p.name, 'x',        'idleShift',    { speed: 0.4,  amplitude: 3 });
    });
    heads.forEach(p => {
      addControllerSafe(anim, p.id, p.name, 'rotation', 'swayRotation', { speed: 0.35, amplitude: 2.5, phase: 1.1 });
    });
    arms.forEach((p, i) => {
      addControllerSafe(anim, p.id, p.name, 'rotation', 'breathingY',   { speed: 0.8,  amplitude: 3, phase: i * 0.5 });
    });
    eyes.forEach(p => {
      addControllerSafe(anim, p.id, p.name, 'scaleY',   'blinkScale',   { speed: 0.25, amplitude: 1 });
    });
    capes.forEach(p => {
      addControllerSafe(anim, p.id, p.name, 'rotation', 'capeLag',      { speed: 0.5,  amplitude: 6, phase: 0.7 });
    });
    weapons.forEach(p => {
      addControllerSafe(anim, p.id, p.name, 'rotation', 'staffSway',    { speed: 0.6,  amplitude: 4 });
    });
  }

  else if (type === 'walk') {
    anim.duration = 1.0;
    anim.loop = true;
    bodies.forEach(p => {
      addControllerSafe(anim, p.id, p.name, 'y',        'headBob',      { speed, amplitude: 5 });
      addControllerSafe(anim, p.id, p.name, 'rotation', 'swayRotation', { speed, amplitude: 5, phase: 0.5, offset: 0 });
    });
    legs.forEach((p, i) => {
      const isRight = sideIsRight(p.name, i);
      addControllerSafe(anim, p.id, p.name, 'rotation', 'runCycle',     { speed, amplitude: 32, phase: isRight ? 0.5 : 0 });
    });
    arms.forEach((p, i) => {
      const isRight = sideIsRight(p.name, i);
      addControllerSafe(anim, p.id, p.name, 'rotation', 'armSwing',     { speed, amplitude: 24, phase: isRight ? 0.5 : 0 });
    });
    capes.forEach(p => {
      addControllerSafe(anim, p.id, p.name, 'rotation', 'capeLag',      { speed, amplitude: 10, phase: 0.75 });
    });
    weapons.forEach(p => {
      addControllerSafe(anim, p.id, p.name, 'rotation', 'runCycle',     { speed, amplitude: 5,  phase: 0.5 });
    });
  }

  else if (type === 'run') {
    anim.duration = 0.7;
    anim.loop = true;
    bodies.forEach(p => {
      addControllerSafe(anim, p.id, p.name, 'y',        'headBob',      { speed, amplitude: 6 });
      addControllerSafe(anim, p.id, p.name, 'rotation', 'swayRotation', { speed, amplitude: 6, phase: 0.5, offset: 0 });
    });
    heads.forEach(p => {
      addControllerSafe(anim, p.id, p.name, 'y',        'headBob',      { speed, amplitude: 3 });
    });
    legs.forEach((p, i) => {
      const isRight = sideIsRight(p.name, i);
      addControllerSafe(anim, p.id, p.name, 'rotation', 'runCycle',     { speed, amplitude: 35, phase: isRight ? 0.5 : 0 });
    });
    arms.forEach((p, i) => {
      const isRight = sideIsRight(p.name, i);
      addControllerSafe(anim, p.id, p.name, 'rotation', 'armSwing',     { speed, amplitude: 28, phase: isRight ? 0.5 : 0 });
    });
    capes.forEach(p => {
      addControllerSafe(targetAnim, p.id, p.name, 'rotation', 'capeLag', { speed, amplitude: 14, phase: 0.75 });
    });
  }

  else if (type === 'walkFront') {
    anim.duration = 1.0;
    anim.loop = true;
    bodies.forEach(p => {
      addControllerSafe(anim, p.id, p.name, 'y',        'headBob',      { speed, amplitude: 3 });
      addControllerSafe(anim, p.id, p.name, 'x',        'idleShift',    { speed: speed * 0.5, amplitude: 2, phase: 0.25 });
    });
    heads.forEach(p => {
      addControllerSafe(anim, p.id, p.name, 'y',        'headBob',      { speed, amplitude: 2 });
    });
    legs.forEach((p, i) => {
      const isRight = sideIsRight(p.name, i);
      addControllerSafe(anim, p.id, p.name, 'y',        'walkCycle',    { speed, amplitude: -14, phase: isRight ? 0.5 : 0 });
      addControllerSafe(anim, p.id, p.name, 'scaleX',   'walkCycle',    { speed, amplitude: 0.08, phase: isRight ? 0.5 : 0 });
    });
    arms.forEach((p, i) => {
      const isRight = sideIsRight(p.name, i);
      addControllerSafe(anim, p.id, p.name, 'rotation', 'armSwing',     { speed, amplitude: 12, phase: isRight ? 0.5 : 0 });
    });
    capes.forEach(p => {
      addControllerSafe(anim, p.id, p.name, 'rotation', 'capeLag',      { speed, amplitude: 8, phase: 0.75 });
    });
    weapons.forEach(p => {
      addControllerSafe(anim, p.id, p.name, 'y',        'walkCycle',    { speed, amplitude: -6, phase: 0.25 });
    });
  }

  else if (type === 'runFront') {
    anim.duration = 0.7;
    anim.loop = true;
    bodies.forEach(p => {
      addControllerSafe(anim, p.id, p.name, 'y',        'headBob',      { speed, amplitude: 6 });
      addControllerSafe(anim, p.id, p.name, 'x',        'idleShift',    { speed: speed * 0.5, amplitude: 3, phase: 0.25 });
    });
    heads.forEach(p => {
      addControllerSafe(anim, p.id, p.name, 'y',        'headBob',      { speed, amplitude: 4 });
    });
    legs.forEach((p, i) => {
      const isRight = sideIsRight(p.name, i);
      addControllerSafe(anim, p.id, p.name, 'y',        'walkCycle',    { speed, amplitude: -22, phase: isRight ? 0.5 : 0 });
      addControllerSafe(anim, p.id, p.name, 'scaleX',   'walkCycle',    { speed, amplitude: 0.12, phase: isRight ? 0.5 : 0 });
    });
    arms.forEach((p, i) => {
      const isRight = sideIsRight(p.name, i);
      addControllerSafe(anim, p.id, p.name, 'rotation', 'armSwing',     { speed, amplitude: 22, phase: isRight ? 0.5 : 0 });
    });
    capes.forEach(p => {
      addControllerSafe(anim, p.id, p.name, 'rotation', 'capeLag',      { speed, amplitude: 14, phase: 0.75 });
    });
  }

  else if (type === 'jump') {
    roots.forEach(p => {
      addControllerSafe(targetAnim, p.id, p.name, 'y',      'jumpArc',    { speed: 1, amplitude: 80 });
      addControllerSafe(targetAnim, p.id, p.name, 'scaleY', 'landSquash', { speed: 1, amplitude: 0.35 });
      addControllerSafe(targetAnim, p.id, p.name, 'scaleX', 'landSquash', { speed: 1, amplitude: -0.15 });
    });
    bodies.forEach(p => {
      addControllerSafe(targetAnim, p.id, p.name, 'rotation', 'jumpArc',  { speed: 1, amplitude: -8 });
    });
    legs.forEach((p, i) => {
      const isRight = sideIsRight(p.name, i);
      addControllerSafe(targetAnim, p.id, p.name, 'rotation', 'jumpLegExtend', { speed: 1, amplitude: isRight ? 32 : -32 });
    });
    arms.forEach((p, i) => {
      const isRight = sideIsRight(p.name, i);
      addControllerSafe(targetAnim, p.id, p.name, 'rotation', 'jumpArc',  { speed: 1, amplitude: -36, phase: isRight ? 0.08 : 0 });
    });
    capes.forEach(p => {
      addControllerSafe(targetAnim, p.id, p.name, 'rotation', 'jumpArc',  { speed: 1, amplitude: 18, phase: 0.3 });
    });
  }

  else if (type === 'hit') {
    roots.forEach(p => {
      addControllerSafe(targetAnim, p.id, p.name, 'x',       'hitKnockback', { speed: 1.2, amplitude: 22 });
      addControllerSafe(targetAnim, p.id, p.name, 'rotation','hitStagger',   { speed: 1.2, amplitude: 10 });
      addControllerSafe(targetAnim, p.id, p.name, 'opacity', 'hitFlash',     { speed: 1.2, amplitude: 0.6 });
    });
    heads.forEach(p => {
      addControllerSafe(targetAnim, p.id, p.name, 'rotation','hitStagger',   { speed: 1.2, amplitude: 20 });
    });
    arms.forEach(p => {
      addControllerSafe(targetAnim, p.id, p.name, 'rotation','hitStagger',   { speed: 1.2, amplitude: 38 });
    });
  }

  else if (type === 'death') {
    const ds = 0.38;
    roots.forEach(p => {
      addControllerSafe(targetAnim, p.id, p.name, 'y',        'deathDrop',   { speed: ds, amplitude: 80 });
    });
    bodies.forEach(p => {
      addControllerSafe(targetAnim, p.id, p.name, 'rotation', 'deathSlump',  { speed: ds, amplitude: 80 });
    });
    heads.forEach(p => {
      addControllerSafe(targetAnim, p.id, p.name, 'rotation', 'deathFall',   { speed: ds, amplitude: 42 });
    });
    arms.forEach((p, i) => {
      const isRight = sideIsRight(p.name, i);
      addControllerSafe(targetAnim, p.id, p.name, 'rotation', 'deathSlump',  { speed: ds, amplitude: isRight ? -55 : 55 });
    });
    legs.forEach(p => {
      addControllerSafe(targetAnim, p.id, p.name, 'rotation', 'deathTwitch', { speed: ds, amplitude: 13 });
    });
    capes.forEach(p => {
      addControllerSafe(targetAnim, p.id, p.name, 'rotation', 'capeLag',     { speed: ds * 2, amplitude: 28, phase: 0.5 });
    });
    parts.forEach(p => {
      addControllerSafe(targetAnim, p.id, p.name, 'opacity',  'deathFade',   { speed: ds, amplitude: 1 });
    });
  }

  DirtyState.markDirty();
  onUpdate();
}
