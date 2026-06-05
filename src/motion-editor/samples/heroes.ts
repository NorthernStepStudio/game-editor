import { CharacterProject } from '../../../../../packages/nstep-motion-core/src/schema/types';

export const HERO_RIGS: Record<string, CharacterProject> = {
  assassin: {
    id: 'hero_assassin', name: 'Assassin (High Quality)',
    assets: [
      { id: 'ast-assassin', name: 'Assassin Art', type: 'image/png', dataUrl: '/assets/rogue_full.png', width: 1024, height: 1024 }
    ],
    animations: [
      { id: 'idle', name: 'Idle', duration: 2.0, loop: true, controllers: [
          { id: 'as-i1', targetPartId: 'body', property: 'y', formulaPreset: 'breathingY', enabled: true, params: { speed: 1, amplitude: 5, phase: 0, offset: 0, min: 0, max: 0 }},
          { id: 'as-i2', targetPartId: 'body', property: 'rotation', formulaPreset: 'breathingY', enabled: true, params: { speed: 1, amplitude: 1, phase: 0.5, offset: 0, min: 0, max: 0 }}
      ]}
    ],
    parts: [
      { id: 'body', name: 'Assassin Body', parentId: null, renderMode: 'image', imageAssetId: 'ast-assassin', baseX: 0, baseY: 0, baseRotation: 0, baseScaleX: 0.5, baseScaleY: 0.5, origin: { x: 512, y: 700 }, zIndex: 10, color: '#222' }
    ]
  },
  shadowRogue: {
    id: 'hero_shadow_rogue', name: 'Shadow Rogue (HD)',
    assets: [
      { id: 'ast-rogue', name: 'Rogue Art', type: 'image/png', dataUrl: '/assets/shadow_rogue.png', width: 1024, height: 1024 }
    ],
    animations: [
      { id: 'idle', name: 'Idle', duration: 1.5, loop: true, controllers: [
          { id: 'sr-i1', targetPartId: 'body', property: 'y', formulaPreset: 'breathingY', enabled: true, params: { speed: 1, amplitude: 3, phase: 0, offset: 0, min: 0, max: 0 }},
          { id: 'sr-i2', targetPartId: 'head', property: 'rotation', formulaPreset: 'breathingY', enabled: true, params: { speed: 1, amplitude: 2, phase: 0.5, offset: 0, min: 0, max: 0 }}
      ]}
    ],
    parts: [
      { id: 'body', name: 'Rogue Body', parentId: null, renderMode: 'image', imageAssetId: 'ast-rogue', baseX: 0, baseY: 0, baseRotation: 0, baseScaleX: 0.5, baseScaleY: 0.5, origin: { x: 100, y: 150 }, zIndex: 10, color: '#333' },
      { id: 'head', name: 'Rogue Head', parentId: 'body', renderMode: 'image', imageAssetId: 'ast-rogue', baseX: 0, baseY: -80, baseRotation: 0, baseScaleX: 1, baseScaleY: 1, origin: { x: 80, y: 80 }, zIndex: 11, color: '#444' }
    ]
  },
  warrior_wip: {
    id: 'hero_warrior_wip', name: 'Warrior (Pro Rig - BROKEN / WIP)',
    assets: [
      { id: 'w-head', name: 'Head', type: 'image/png', dataUrl: '/assets/warrior/pro/head.png', width: 1024, height: 1024 },
      { id: 'w-torso', name: 'Torso', type: 'image/png', dataUrl: '/assets/warrior/pro/torso.png', width: 1024, height: 1024 },
      { id: 'w-arm', name: 'Arm', type: 'image/png', dataUrl: '/assets/warrior/pro/arm.png', width: 1024, height: 1024 },
      { id: 'w-leg', name: 'Leg', type: 'image/png', dataUrl: '/assets/warrior/pro/leg.png', width: 1024, height: 1024 },
      { id: 'w-sword', name: 'Sword', type: 'image/png', dataUrl: '/assets/warrior/pro/sword.png', width: 1024, height: 1024 }
    ],
    animations: [
      { id: 'idle', name: 'Idle', duration: 1.5, loop: true, controllers: [
          { id: 'w-i1', targetPartId: 'hip', property: 'y', formulaPreset: 'breathingY', enabled: true, params: { speed: 1, amplitude: 4, phase: 0, offset: 0, min: 0, max: 0 }},
          { id: 'w-i2', targetPartId: 'torso', property: 'rotation', formulaPreset: 'breathingY', enabled: true, params: { speed: 1, amplitude: 1, phase: 0.2, offset: 0, min: 0, max: 0 }},
          { id: 'w-i3', targetPartId: 'head', property: 'rotation', formulaPreset: 'breathingY', enabled: true, params: { speed: 1, amplitude: 2, phase: 0.4, offset: 0, min: 0, max: 0 }}
      ]}
    ],
    parts: [
      { id: 'hip', name: 'Hip Root', parentId: null, renderMode: 'shape', shapeType: 'circle', color: 'rgba(255,255,255,0.1)', baseX: 0, baseY: 0, baseRotation: 0, baseScaleX: 1, baseScaleY: 1, origin: { x: 0, y: 0 }, zIndex: 0 },
      { id: 'torso', name: 'Torso', parentId: 'hip', renderMode: 'image', imageAssetId: 'w-torso', baseX: 0, baseY: -10, baseRotation: 0, baseScaleX: 0.2, baseScaleY: 0.2, origin: { x: 512, y: 800 }, zIndex: 10 },
      { id: 'head', name: 'Head', parentId: 'torso', renderMode: 'image', imageAssetId: 'w-head', baseX: 0, baseY: -80, baseRotation: 0, baseScaleX: 1.0, baseScaleY: 1.0, origin: { x: 512, y: 850 }, zIndex: 11 },
      { id: 'arm_r', name: 'Arm R (Front)', parentId: 'torso', renderMode: 'image', imageAssetId: 'w-arm', baseX: 50, baseY: -80, baseRotation: -15, baseScaleX: 1.0, baseScaleY: 1.0, origin: { x: 512, y: 200 }, zIndex: 15 },
      { id: 'sword', name: 'Sword', parentId: 'arm_r', renderMode: 'image', imageAssetId: 'w-sword', baseX: 0, baseY: 80, baseRotation: 45, baseScaleX: 1.0, baseScaleY: 1.0, origin: { x: 512, y: 900 }, zIndex: 14 }
    ]
  },
  warrior: {
    id: 'hero_warrior', name: 'Warrior (Procedural)',
    assets: [],
    animations: [
      { id: 'idle', name: 'Idle', duration: 1.5, loop: true, controllers: [
          { id: 'w-i1', targetPartId: 'body', property: 'y', formulaPreset: 'breathingY', enabled: true, params: { speed: 1, amplitude: 2, phase: 0, offset: 0, min: 0, max: 0 }},
          { id: 'w-i2', targetPartId: 'head', property: 'rotation', formulaPreset: 'breathingY', enabled: true, params: { speed: 1, amplitude: 1, phase: 0.5, offset: 0, min: 0, max: 0 }}
      ]},
      { id: 'walk', name: 'Walk', duration: 1.2, loop: true, controllers: [
          { id: 'w-w1', targetPartId: 'body', property: 'y', formulaPreset: 'walkCycle', enabled: true, params: { speed: 2, amplitude: 3, phase: 0, offset: 0, min: 0, max: 0 }},
          { id: 'w-w2', targetPartId: 'leg_l', property: 'rotation', formulaPreset: 'walkCycle', enabled: true, params: { speed: 2, amplitude: 25, phase: 0, offset: 0, min: 0, max: 0 }},
          { id: 'w-w3', targetPartId: 'leg_r', property: 'rotation', formulaPreset: 'walkCycle', enabled: true, params: { speed: 2, amplitude: -25, phase: 3.14, offset: 0, min: 0, max: 0 }}
      ]}
    ],
    parts: [
      { id: 'body', name: 'Body', parentId: null, shapeType: 'polygon', color: '#3b82f6', baseX: 0, baseY: 0, baseRotation: 0, baseScaleX: 1, baseScaleY: 1, origin: { x: 15, y: 30 }, zIndex: 10 },
      { id: 'head', name: 'Head', parentId: 'body', shapeType: 'circle', color: '#60a5fa', baseX: 0, baseY: -35, baseRotation: 0, baseScaleX: 1, baseScaleY: 1, origin: { x: 12, y: 12 }, zIndex: 11 },
      { id: 'leg_l', name: 'Leg L', parentId: 'body', shapeType: 'line', color: '#1e3a8a', baseX: -10, baseY: 30, baseRotation: 0, baseScaleX: 1, baseScaleY: 1, origin: { x: 8, y: 5 }, zIndex: 8 },
      { id: 'leg_r', name: 'Leg R', parentId: 'body', shapeType: 'line', color: '#2563eb', baseX: 10, baseY: 30, baseRotation: 0, baseScaleX: 1, baseScaleY: 1, origin: { x: 8, y: 5 }, zIndex: 12 }
    ]
  },
  mage: {
    id: 'hero_mage', name: 'Mage',
    assets: [
       { id: 'ast-party', name: 'Hero Party', type: 'image/png', dataUrl: '/assets/hero_party.png', width: 2048, height: 2048 }
    ],
    animations: [
      { id: 'idle', name: 'Idle', duration: 2.0, loop: true, controllers: [
          { id: 'm-i1', targetPartId: 'body', property: 'y', formulaPreset: 'hoverFloat', enabled: true, params: { speed: 1, amplitude: 6, phase: 0, offset: -5, min: 0, max: 0 }},
          { id: 'm-i2', targetPartId: 'staff_arm', property: 'rotation', formulaPreset: 'breathingY', enabled: true, params: { speed: 0.5, amplitude: 4, phase: -0.5, offset: 0, min: 0, max: 0 }}
      ]},
      { id: 'walk', name: 'Walk', duration: 1.5, loop: true, controllers: [
          { id: 'm-w1', targetPartId: 'body', property: 'y', formulaPreset: 'hoverFloat', enabled: true, params: { speed: 1.5, amplitude: 4, phase: 0, offset: -5, min: 0, max: 0 }},
          { id: 'm-w2', targetPartId: 'front_leg', property: 'rotation', formulaPreset: 'walkCycle', enabled: true, params: { speed: 1.5, amplitude: 15, phase: 0, offset: 0, min: 0, max: 0 }},
          { id: 'm-w3', targetPartId: 'back_leg', property: 'rotation', formulaPreset: 'walkCycle', enabled: true, params: { speed: 1.5, amplitude: -15, phase: 3.14, offset: 0, min: 0, max: 0 }}
      ]},
      { id: 'run', name: 'Run', duration: 1.0, loop: true, controllers: [
          { id: 'm-r1', targetPartId: 'body', property: 'rotation', formulaPreset: 'runLean', enabled: true, params: { speed: 0, amplitude: 0, phase: 0, offset: 10, min: 0, max: 0 }},
          { id: 'm-r2', targetPartId: 'body', property: 'y', formulaPreset: 'runCycle', enabled: true, params: { speed: 2, amplitude: 3, phase: 0, offset: -5, min: 0, max: 0 }}
      ]}
    ],
    parts: [
      { 
        id: 'body', name: 'Body', parentId: null, renderMode: 'image', imageAssetId: 'ast-party', 
        sourceRect: { x: 500, y: 350, width: 350, height: 480 },
        color: '#8b5cf6', baseX: 0, baseY: 0, baseRotation: 0, baseScaleX: 0.8, baseScaleY: 0.8, 
        origin: { x: 175, y: 240 }, zIndex: 10 
      },
      { 
        id: 'head', name: 'Head', parentId: 'body', renderMode: 'image', imageAssetId: 'ast-party', 
        sourceRect: { x: 550, y: 80, width: 300, height: 300 },
        color: '#c4b5fd', baseX: 0, baseY: -220, baseRotation: 0, baseScaleX: 0.8, baseScaleY: 0.8, 
        origin: { x: 150, y: 150 }, zIndex: 11 
      },
      { id: 'robe', name: 'Robe', parentId: 'body', shapeType: 'polygon', color: '#7c3aed', baseX: 0, baseY: 20, baseRotation: 0, baseScaleX: 1, baseScaleY: 1, origin: { x: 18, y: 20 }, zIndex: 11 },
      { id: 'hat', name: 'Hat', parentId: 'head', shapeType: 'polygon', color: '#4c1d95', baseX: 0, baseY: -15, baseRotation: -10, baseScaleX: 1, baseScaleY: 1, origin: { x: 20, y: 15 }, zIndex: 12 },
      { id: 'back_leg', name: 'Back Leg', parentId: 'body', shapeType: 'line', color: '#4c1d95', baseX: -5, baseY: 30, baseRotation: 0, baseScaleX: 1, baseScaleY: 1, origin: { x: 6, y: 5 }, zIndex: 8 },
      { id: 'front_leg', name: 'Front Leg', parentId: 'body', shapeType: 'line', color: '#6d28d9', baseX: 5, baseY: 30, baseRotation: 0, baseScaleX: 1, baseScaleY: 1, origin: { x: 6, y: 5 }, zIndex: 9 },
      { id: 'staff_arm', name: 'Staff Arm', parentId: 'body', shapeType: 'line', color: '#a78bfa', baseX: 12, baseY: -20, baseRotation: -20, baseScaleX: 1, baseScaleY: 1, origin: { x: 6, y: 6 }, zIndex: 13 },
      { id: 'staff', name: 'Staff', parentId: 'staff_arm', shapeType: 'staff', color: '#b45309', baseX: 0, baseY: 20, baseRotation: -10, baseScaleX: 1, baseScaleY: 1, origin: { x: 3, y: 30 }, zIndex: 14 }
    ]
  },
  rogue: {
    id: 'hero_rogue', name: 'Rogue',
    assets: [],
    animations: [
      { id: 'idle', name: 'Idle', duration: 1.0, loop: true, controllers: [
          { id: 'ro-i1', targetPartId: 'body', property: 'y', formulaPreset: 'breathingY', enabled: true, params: { speed: 1.5, amplitude: 1.5, phase: 0, offset: 0, min: 0, max: 0 }},
          { id: 'ro-i2', targetPartId: 'cloak', property: 'rotation', formulaPreset: 'capeLag', enabled: true, params: { speed: 1, amplitude: 5, phase: 0, offset: 0, min: 0, max: 0 }}
      ]}
    ],
    parts: [
      { id: 'body', name: 'Body', parentId: null, shapeType: 'roundedRect', color: '#111827', baseX: 0, baseY: 0, baseRotation: 0, baseScaleX: 1, baseScaleY: 1, origin: { x: 15, y: 25 }, zIndex: 10 },
      { id: 'cloak', name: 'Cloak', parentId: 'body', shapeType: 'cape', color: '#030712', baseX: -10, baseY: -10, baseRotation: 15, baseScaleX: 1, baseScaleY: 1, origin: { x: 12, y: 5 }, zIndex: 5 },
      { id: 'head', name: 'Head', parentId: 'body', shapeType: 'circle', color: '#374151', baseX: 0, baseY: -30, baseRotation: 0, baseScaleX: 1, baseScaleY: 1, origin: { x: 12, y: 12 }, zIndex: 11 },
      { id: 'back_leg', name: 'Back Leg', parentId: 'body', shapeType: 'line', color: '#1f2937', baseX: -8, baseY: 25, baseRotation: 0, baseScaleX: 1, baseScaleY: 1, origin: { x: 6, y: 5 }, zIndex: 8 },
      { id: 'front_leg', name: 'Front Leg', parentId: 'body', shapeType: 'line', color: '#374151', baseX: 8, baseY: 25, baseRotation: 0, baseScaleX: 1, baseScaleY: 1, origin: { x: 6, y: 5 }, zIndex: 12 }
    ]
  },
  paladin: {
    id: 'hero_paladin', name: 'Paladin',
    assets: [],
    animations: [
      { id: 'idle', name: 'Idle', duration: 1.8, loop: true, controllers: [
          { id: 'p-i1', targetPartId: 'body', property: 'y', formulaPreset: 'breathingY', enabled: true, params: { speed: 0.8, amplitude: 1.5, phase: 0, offset: 0, min: 0, max: 0 }}
      ]}
    ],
    parts: [
      { id: 'body', name: 'Body', parentId: null, shapeType: 'roundedRect', color: '#fcd34d', baseX: 0, baseY: 0, baseRotation: 0, baseScaleX: 1, baseScaleY: 1, origin: { x: 25, y: 35 }, zIndex: 10 },
      { id: 'head', name: 'Head', parentId: 'body', shapeType: 'circle', color: '#fde68a', baseX: 0, baseY: -40, baseRotation: 0, baseScaleX: 1, baseScaleY: 1, origin: { x: 15, y: 15 }, zIndex: 11 },
      { id: 'shield', name: 'Shield', parentId: 'body', shapeType: 'shield', color: '#fbbf24', baseX: -15, baseY: 0, baseRotation: 0, baseScaleX: 1, baseScaleY: 1, origin: { x: 15, y: 25 }, zIndex: 15 }
    ]
  }
};
