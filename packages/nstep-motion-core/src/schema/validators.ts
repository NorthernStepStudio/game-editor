import type { CharacterProject, CharacterPart, CharacterAnimation, AnimationController } from './types.js';

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
    }
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

function normalizePart(p: any): CharacterPart {
  return {
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
