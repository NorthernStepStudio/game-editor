import type { CharacterProject, CharacterPart, CharacterAnimation, AnimationController } from './types.js';

function normalizeKeyframe(k: any): any {
  const kf: any = {
    id:     k.id || 'kf-' + Math.random().toString(36).substr(2, 9),
    time:   Number(k.time ?? 0),
    value:  Number(k.value ?? 0),
    easing: k.easing || 'easeInOut',
  };
  if (k.tangentOut) kf.tangentOut = { x: Number(k.tangentOut.x), y: Number(k.tangentOut.y) };
  if (k.tangentIn)  kf.tangentIn  = { x: Number(k.tangentIn.x),  y: Number(k.tangentIn.y)  };
  return kf;
}

function normalizeController(c: any): AnimationController {
  return {
    id: c.id || 'ctrl-' + Math.random().toString(36).substr(2, 9),
    targetPartId: c.targetPartId || '',
    property: c.property || 'y',
    formulaPreset: c.formulaPreset || 'breathingY',
    enabled: c.enabled !== undefined ? !!c.enabled : true,
    params: {
      speed: Number(c.params?.speed ?? 1),
      amplitude: Number(c.params?.amplitude ?? 0),
      phase: Number(c.params?.phase ?? 0),
      offset: Number(c.params?.offset ?? 0),
      min: Number(c.params?.min ?? 0),
      max: Number(c.params?.max ?? 0)
    },
    ...(c.mode !== undefined       ? { mode:      c.mode      } : {}),
    ...(Array.isArray(c.keyframes) ? { keyframes: c.keyframes.map(normalizeKeyframe) } : { keyframes: [] }),
  };
}

function normalizeAnimation(a: any): CharacterAnimation {
  return {
    id: a.id || 'anim-' + Math.random().toString(36).substr(2, 9),
    name: a.name || 'Animation',
    duration: Number(a.duration ?? 1),
    loop: a.loop !== undefined ? !!a.loop : true,
    controllers: Array.isArray(a.controllers) ? a.controllers.map(normalizeController) : []
  };
}

function normalizeIKChain(ik: any): any {
  if (!ik || typeof ik !== 'object') return undefined;
  const out: any = {};
  if (ik.targetPartId)    out.targetPartId    = String(ik.targetPartId);
  if (ik.chainLength != null) out.chainLength = Math.max(2, Math.min(20, parseInt(ik.chainLength) || 2));
  if (ik.bendDirection != null) out.bendDirection = Number(ik.bendDirection) >= 0 ? 1 : -1;
  if (ik.pin != null)     out.pin             = !!ik.pin;
  if (ik.pinnedWorldX != null) out.pinnedWorldX = Number(ik.pinnedWorldX);
  if (ik.pinnedWorldY != null) out.pinnedWorldY = Number(ik.pinnedWorldY);
  if (ik.poleTargetPartId) out.poleTargetPartId = String(ik.poleTargetPartId);
  return Object.keys(out).length ? out : undefined;
}

function normalizeConstraint(c: any): any {
  if (!c || typeof c !== 'object' || !c.type || c.type === 'none') return undefined;
  const out: any = { type: String(c.type) };
  if (c.targetPartId != null) out.targetPartId = String(c.targetPartId);
  if (c.influence    != null) out.influence    = Number(c.influence);
  if (c.offset       != null) out.offset       = Number(c.offset);
  if (c.min          != null) out.min          = Number(c.min);
  if (c.max          != null) out.max          = Number(c.max);
  return out;
}

function normalizeFrameAnimation(fa: any): any {
  if (!fa || typeof fa !== 'object') return undefined;
  const out: any = {};
  if (fa.frameCount  != null) out.frameCount  = parseInt(fa.frameCount)  || 1;
  if (fa.fps         != null) out.fps         = Number(fa.fps)           || 12;
  if (fa.startFrame  != null) out.startFrame  = parseInt(fa.startFrame)  || 0;
  if (fa.columns     != null) out.columns     = parseInt(fa.columns)     || 1;
  if (fa.frameWidth  != null) out.frameWidth  = Number(fa.frameWidth);
  if (fa.frameHeight != null) out.frameHeight = Number(fa.frameHeight);
  // Legacy field – keep if present so old projects don't lose data
  if (fa.rows        != null) out.rows        = parseInt(fa.rows)        || 1;
  if (fa.enabled     != null) out.enabled     = !!fa.enabled;
  return Object.keys(out).length ? out : undefined;
}

function normalizePart(p: any): CharacterPart {
  const out: any = {
    id: p.id || 'part-' + Math.random().toString(36).substr(2, 9),
    name: p.name || 'Part',
    parentId: p.parentId ?? null,
    baseX: Number(p.baseX ?? 0),
    baseY: Number(p.baseY ?? 0),
    baseRotation: Number(p.baseRotation ?? 0),
    baseScaleX: Number(p.baseScaleX ?? 1),
    baseScaleY: Number(p.baseScaleY ?? 1),
    origin: { x: Number(p.origin?.x ?? 20), y: Number(p.origin?.y ?? 20) },
    zIndex: Number(p.zIndex ?? 0),
    color: p.color,
    tintColor: p.tintColor,
    renderMode: p.renderMode,
    shapeType: p.shapeType,
    imageAssetId: p.imageAssetId,
    sourceRect: p.sourceRect,
    visible: p.visible,
    locked: p.locked,
    opacity: p.opacity,
    flipX: p.flipX,
    flipY: p.flipY,
    inheritTransform: p.inheritTransform
  };

  // Preserve optional extended fields — omit entirely when not present so
  // JSON serialization stays lean and round-trips without spurious undefined keys.
  if (p.fkOverride != null)           out.fkOverride           = !!p.fkOverride;
  if (p.editChildrenTogether != null) out.editChildrenTogether = !!p.editChildrenTogether;
  const ikNorm = normalizeIKChain(p.ikChain);
  if (ikNorm)                         out.ikChain              = ikNorm;
  const conNorm = normalizeConstraint(p.constraint);
  if (conNorm)                        out.constraint           = conNorm;
  const faNorm = normalizeFrameAnimation(p.frameAnimation);
  if (faNorm)                         out.frameAnimation       = faNorm;

  return out as CharacterPart;
}

export function normalizeProject(p: any): CharacterProject {
  if (!p || typeof p !== 'object') {
    throw new Error('Invalid project data');
  }
  return {
    id: p.id || 'proj-' + Math.random().toString(36).substr(2, 9),
    name: p.name || 'Untitled',
    assets: Array.isArray(p.assets) ? p.assets : [],
    animations: Array.isArray(p.animations) ? p.animations.map(normalizeAnimation) : [],
    parts: Array.isArray(p.parts) ? p.parts.map(normalizePart) : [],
    renderQuality: p.renderQuality,
    lastSelectedAnimId: p.lastSelectedAnimId,
    lastSelectedPartId: p.lastSelectedPartId
  };
}
