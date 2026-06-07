import { CharacterProject } from '../../../../../packages/nstep-motion-core/src/schema/types';

export const DOOMED_RIGS = {
  rotRat: {
    id: 'rotrat', name: 'Rot Rat',
    assets: [],
    animations: [
      { id: 'idle', name: 'Idle', duration: 1, loop: true, controllers: [
          { id: 'rr-c1', targetPartId: 'body', property: 'y', formulaPreset: 'breathingY', enabled: true, params: { speed: 2, amplitude: 3, phase: 0, offset: 0, min: 0, max: 0 }}
      ]},
      { id: 'walk', name: 'Walk', duration: 1, loop: true, controllers: [
          { id: 'rr-c2', targetPartId: 'body', property: 'y', formulaPreset: 'bobPosition', enabled: true, params: { speed: 4, amplitude: 5, phase: 0, offset: 0, min: 0, max: 0 }},
          { id: 'rr-c3', targetPartId: 'leg-f', property: 'rotation', formulaPreset: 'legCycle', enabled: true, params: { speed: 4, amplitude: 25, phase: 0, offset: 0, min: 0, max: 0 }},
          { id: 'rr-c4', targetPartId: 'leg-b', property: 'rotation', formulaPreset: 'legCycle', enabled: true, params: { speed: 4, amplitude: 25, phase: 0.5, offset: 0, min: 0, max: 0 }}
      ]},
      { id: 'attack', name: 'Attack', duration: 1, loop: false, controllers: [
          { id: 'rr-c5', targetPartId: 'head', property: 'rotation', formulaPreset: 'clawTwitch', enabled: true, params: { speed: 10, amplitude: 30, phase: 0, offset: -20, min: 0, max: 0 }}
      ]},
      { id: 'hurt', name: 'Hurt', duration: 0.5, loop: false, controllers: [
          { id: 'rr-c6', targetPartId: 'body', property: 'x', formulaPreset: 'bobPosition', enabled: true, params: { speed: 15, amplitude: 10, phase: 0, offset: 0, min: 0, max: 0 }}
      ]},
      { id: 'death', name: 'Death', duration: 1, loop: false, controllers: [
          { id: 'rr-c7', targetPartId: 'body', property: 'y', formulaPreset: 'breathingY', enabled: true, params: { speed: 0, amplitude: 0, phase: 0, offset: 20, min: 0, max: 0 }},
          { id: 'rr-c8', targetPartId: 'body', property: 'rotation', formulaPreset: 'breathingY', enabled: true, params: { speed: 0, amplitude: 0, phase: 0, offset: 90, min: 0, max: 0 }}
      ]}
    ],
    parts: [
      { id: 'body', name: 'Body', parentId: null, color: '#4b5563', baseX: 0, baseY: 0, baseRotation: 0, baseScaleX: 1, baseScaleY: 1, origin: { x: 30, y: 15 }, zIndex: 10 },
      { id: 'head', name: 'Head', parentId: 'body', color: '#374151', baseX: 30, baseY: -5, baseRotation: 0, baseScaleX: 1, baseScaleY: 1, origin: { x: 10, y: 10 }, zIndex: 11 },
      { id: 'tail', name: 'Tail', parentId: 'body', color: '#9ca3af', baseX: -30, baseY: 0, baseRotation: -20, baseScaleX: 1, baseScaleY: 1, origin: { x: 20, y: 3 }, zIndex: 9 },
      { id: 'leg-f', name: 'Front Leg', parentId: 'body', color: '#1f2937', baseX: 15, baseY: 15, baseRotation: 0, baseScaleX: 1, baseScaleY: 1, origin: { x: 4, y: 10 }, zIndex: 11 },
      { id: 'leg-b', name: 'Back Leg', parentId: 'body', color: '#1f2937', baseX: -15, baseY: 15, baseRotation: 0, baseScaleX: 1, baseScaleY: 1, origin: { x: 4, y: 10 }, zIndex: 11 },
    ]
  } as CharacterProject,
  boneWalker: {
    id: 'bonewalker', name: 'Bone Walker',
    assets: [],
    animations: [
      { id: 'idle', name: 'Idle', duration: 1, loop: true, controllers: [
          { id: 'bw-1', targetPartId: 'torso', property: 'y', formulaPreset: 'breathingY', enabled: true, params: { speed: 0.8, amplitude: 2, phase: 0, offset: 0, min: 0, max: 0 }},
          { id: 'bw-2', targetPartId: 'arm-l', property: 'rotation', formulaPreset: 'swayRotation', enabled: true, params: { speed: 0.8, amplitude: 5, phase: 0, offset: 0, min: 0, max: 0 }}
      ]},
      { id: 'walk', name: 'Walk', duration: 1, loop: true, controllers: [
          { id: 'bw-3', targetPartId: 'leg-l', property: 'rotation', formulaPreset: 'legCycle', enabled: true, params: { speed: 1.5, amplitude: 30, phase: 0, offset: 0, min: 0, max: 0 }},
          { id: 'bw-4', targetPartId: 'leg-r', property: 'rotation', formulaPreset: 'legCycle', enabled: true, params: { speed: 1.5, amplitude: 30, phase: 0.5, offset: 0, min: 0, max: 0 }}
      ]},
      { id: 'attack', name: 'Attack', duration: 1, loop: false, controllers: []},
      { id: 'hurt', name: 'Hurt', duration: 0.5, loop: false, controllers: []},
      { id: 'death', name: 'Death', duration: 1, loop: false, controllers: []}
    ],
    parts: [
      { id: 'torso', name: 'Torso', parentId: null, color: '#e5e7eb', baseX: 0, baseY: -10, baseRotation: 0, baseScaleX: 1, baseScaleY: 1, origin: { x: 15, y: 25 }, zIndex: 10 },
      { id: 'head', name: 'Skull', parentId: 'torso', color: '#f3f4f6', baseX: 0, baseY: -30, baseRotation: 0, baseScaleX: 1, baseScaleY: 1, origin: { x: 12, y: 12 }, zIndex: 11 },
      { id: 'arm-l', name: 'Left Arm', parentId: 'torso', color: '#d1d5db', baseX: -15, baseY: -20, baseRotation: 15, baseScaleX: 1, baseScaleY: 1, origin: { x: 5, y: 5 }, zIndex: 12 },
      { id: 'arm-r', name: 'Right Arm', parentId: 'torso', color: '#d1d5db', baseX: 15, baseY: -20, baseRotation: -15, baseScaleX: 1, baseScaleY: 1, origin: { x: 5, y: 5 }, zIndex: 8 },
      { id: 'leg-l', name: 'Left Leg', parentId: 'torso', color: '#9ca3af', baseX: -10, baseY: 20, baseRotation: 0, baseScaleX: 1, baseScaleY: 1, origin: { x: 5, y: 5 }, zIndex: 11 },
      { id: 'leg-r', name: 'Right Leg', parentId: 'torso', color: '#9ca3af', baseX: 10, baseY: 20, baseRotation: 0, baseScaleX: 1, baseScaleY: 1, origin: { x: 5, y: 5 }, zIndex: 9 },
    ]
  } as CharacterProject,
  graveGhoul: { id: 'graveghoul', name: 'Grave Ghoul', assets: [], animations: [{id: 'idle', name: 'Idle', duration:1, loop:true, controllers: []}, {id: 'walk', name: 'Walk', duration:1, loop:true, controllers: []}, {id: 'attack', name: 'Attack', duration:1, loop:false, controllers: []}, {id: 'hurt', name: 'Hurt', duration:1, loop:false, controllers: []}, {id: 'death', name: 'Death', duration:1, loop:false, controllers: []}], parts: [] } as CharacterProject,
  bladeImp: { id: 'bladeimp', name: 'Blade Imp', assets: [], animations: [{id: 'idle', name: 'Idle', duration:1, loop:true, controllers: []}, {id: 'walk', name: 'Walk', duration:1, loop:true, controllers: []}, {id: 'attack', name: 'Attack', duration:1, loop:false, controllers: []}, {id: 'hurt', name: 'Hurt', duration:1, loop:false, controllers: []}, {id: 'death', name: 'Death', duration:1, loop:false, controllers: []}], parts: [] } as CharacterProject,
  shieldHusk: { id: 'shieldhusk', name: 'Shield Husk', assets: [], animations: [{id: 'idle', name: 'Idle', duration:1, loop:true, controllers: []}, {id: 'walk', name: 'Walk', duration:1, loop:true, controllers: []}, {id: 'attack', name: 'Attack', duration:1, loop:false, controllers: []}, {id: 'hurt', name: 'Hurt', duration:1, loop:false, controllers: []}, {id: 'death', name: 'Death', duration:1, loop:false, controllers: []}], parts: [] } as CharacterProject,
  ashCultist: { id: 'ashcultist', name: 'Ash Cultist', assets: [], animations: [{id: 'idle', name: 'Idle', duration:1, loop:true, controllers: []}, {id: 'walk', name: 'Walk', duration:1, loop:true, controllers: []}, {id: 'attack', name: 'Attack', duration:1, loop:false, controllers: []}, {id: 'hurt', name: 'Hurt', duration:1, loop:false, controllers: []}, {id: 'death', name: 'Death', duration:1, loop:false, controllers: []}], parts: [] } as CharacterProject,
};
