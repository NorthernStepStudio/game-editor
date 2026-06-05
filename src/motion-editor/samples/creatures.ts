import { CharacterProject } from '../../../../../packages/nstep-motion-core/src/schema/types';

export const crabProject: CharacterProject = {
  id: 'crab', name: 'Sample Crab',
  assets: [],
  animations: [{
    id: 'idle', name: 'Idle', duration: 1, loop: true,
    controllers: [
      { id: 'c1', targetPartId: 'body', property: 'y', formulaPreset: 'breathingY', enabled: true, params: { speed: 1, amplitude: 5, phase: 0, offset: 0, min: 0, max: 0 }},
      { id: 'c2', targetPartId: 'claw-l', property: 'rotation', formulaPreset: 'swayRotation', enabled: true, params: { speed: 2, amplitude: 10, phase: 0, offset: 0, min: 0, max: 0 }},
      { id: 'c3', targetPartId: 'claw-r', property: 'rotation', formulaPreset: 'swayRotation', enabled: true, params: { speed: 2, amplitude: -10, phase: 1, offset: 0, min: 0, max: 0 }},
      { id: 'c4', targetPartId: 'leg-l', property: 'rotation', formulaPreset: 'legCycle', enabled: true, params: { speed: 1, amplitude: 15, phase: 0, offset: 0, min: 0, max: 0 }},
      { id: 'c5', targetPartId: 'leg-r', property: 'rotation', formulaPreset: 'legCycle', enabled: true, params: { speed: 1, amplitude: -15, phase: 3.14, offset: 0, min: 0, max: 0 }},
    ]
  }],
  parts: [
    { id: 'body', name: 'Body', parentId: null, color: '#f87171', baseX: 0, baseY: 0, baseRotation: 0, baseScaleX: 1, baseScaleY: 1, origin: { x: 40, y: 30 }, zIndex: 10, renderMode: 'shape', shapeType: 'roundedRect' },
    { id: 'eye-l', name: 'Left Eye', parentId: 'body', color: 'white', baseX: -15, baseY: -20, baseRotation: 0, baseScaleX: 1, baseScaleY: 1, origin: { x: 5, y: 5 }, zIndex: 11, renderMode: 'shape', shapeType: 'circle' },
    { id: 'eye-r', name: 'Right Eye', parentId: 'body', color: 'white', baseX: 15, baseY: -20, baseRotation: 0, baseScaleX: 1, baseScaleY: 1, origin: { x: 5, y: 5 }, zIndex: 11, renderMode: 'shape', shapeType: 'circle' },
    { id: 'claw-l', name: 'Left Claw', parentId: 'body', color: '#b91c1c', baseX: -30, baseY: 10, baseRotation: -20, baseScaleX: 1, baseScaleY: 1, origin: { x: 15, y: 15 }, zIndex: 12, renderMode: 'shape', shapeType: 'roundedRect' },
    { id: 'claw-r', name: 'Right Claw', parentId: 'body', color: '#b91c1c', baseX: 30, baseY: 10, baseRotation: 20, baseScaleX: 1, baseScaleY: 1, origin: { x: 15, y: 15 }, zIndex: 12, renderMode: 'shape', shapeType: 'roundedRect' },
    { id: 'leg-l', name: 'Left Leg', parentId: 'body', color: '#7f1d1d', baseX: -20, baseY: 30, baseRotation: 0, baseScaleX: 1, baseScaleY: 1, origin: { x: 5, y: 20 }, zIndex: 9, renderMode: 'shape', shapeType: 'roundedRect' },
    { id: 'leg-r', name: 'Right Leg', parentId: 'body', color: '#7f1d1d', baseX: 20, baseY: 30, baseRotation: 0, baseScaleX: 1, baseScaleY: 1, origin: { x: 5, y: 20 }, zIndex: 9, renderMode: 'shape', shapeType: 'roundedRect' },
  ]
};

export const owlProject: CharacterProject = {
  id: 'owl', name: 'Sample Owl',
  assets: [],
  animations: [{
    id: 'idle', name: 'Idle', duration: 1, loop: true,
    controllers: [
      { id: 'c1', targetPartId: 'body', property: 'y', formulaPreset: 'breathingY', enabled: true, params: { speed: 0.5, amplitude: 5, phase: 0, offset: 0, min: 0, max: 0 }},
      { id: 'c2', targetPartId: 'wing-l', property: 'rotation', formulaPreset: 'swayRotation', enabled: true, params: { speed: 1, amplitude: 10, phase: 0, offset: 0, min: 0, max: 0 }},
      { id: 'c3', targetPartId: 'wing-r', property: 'rotation', formulaPreset: 'swayRotation', enabled: true, params: { speed: 1, amplitude: -10, phase: 0, offset: 0, min: 0, max: 0 }},
      { id: 'c4', targetPartId: 'tail', property: 'rotation', formulaPreset: 'swayRotation', enabled: true, params: { speed: 0.5, amplitude: 5, phase: 1.5, offset: 0, min: 0, max: 0 }},
    ]
  }],
  parts: [
    { id: 'body', name: 'Body', parentId: null, color: '#8b5cf6', baseX: 0, baseY: 0, baseRotation: 0, baseScaleX: 1, baseScaleY: 1, origin: { x: 30, y: 40 }, zIndex: 10, renderMode: 'shape', shapeType: 'roundedRect' },
    { id: 'head', name: 'Head', parentId: 'body', color: '#a78bfa', baseX: 0, baseY: -35, baseRotation: 0, baseScaleX: 1, baseScaleY: 1, origin: { x: 25, y: 25 }, zIndex: 11, renderMode: 'shape', shapeType: 'circle' },
    { id: 'wing-l', name: 'Left Wing', parentId: 'body', color: '#c4b5fd', baseX: -25, baseY: -10, baseRotation: -10, baseScaleX: 1, baseScaleY: 1, origin: { x: 20, y: 10 }, zIndex: 12, renderMode: 'shape', shapeType: 'roundedRect' },
    { id: 'wing-r', name: 'Right Wing', parentId: 'body', color: '#c4b5fd', baseX: 25, baseY: -10, baseRotation: 10, baseScaleX: 1, baseScaleY: 1, origin: { x: 20, y: 10 }, zIndex: 12, renderMode: 'shape', shapeType: 'roundedRect' },
    { id: 'tail', name: 'Tail', parentId: 'body', color: '#7c3aed', baseX: 0, baseY: 35, baseRotation: 0, baseScaleX: 1, baseScaleY: 1, origin: { x: 15, y: 5 }, zIndex: 9, renderMode: 'shape', shapeType: 'polygon' },
  ]
};
