export interface FormulaPreset {
  id: string;
  name: string;
  description: string;
  defaultProperty: 'x' | 'y' | 'rotation' | 'scaleX' | 'scaleY' | 'opacity';
  defaultAmplitude: number;
  defaultSpeed: number;
}

export const FORMULA_PRESETS: FormulaPreset[] = [
  { id: 'sine',          name: 'Sine Wave',         description: 'Pure sinusoidal oscillation',              defaultProperty: 'y',        defaultAmplitude: 8,  defaultSpeed: 1 },
  { id: 'breathingY',    name: 'Breathing (Y)',      description: 'Gentle up-down breathing bob',             defaultProperty: 'y',        defaultAmplitude: 6,  defaultSpeed: 1 },
  { id: 'hoverFloat',    name: 'Hover Float',        description: 'Smooth floating with eased pauses',        defaultProperty: 'y',        defaultAmplitude: 8,  defaultSpeed: 0.8 },
  { id: 'bobPosition',   name: 'Bob Position',       description: 'Faster bounce-like position oscillation',  defaultProperty: 'y',        defaultAmplitude: 5,  defaultSpeed: 2 },
  { id: 'swayRotation',  name: 'Sway',               description: 'Gentle rotation sway',                     defaultProperty: 'rotation', defaultAmplitude: 8,  defaultSpeed: 1 },
  { id: 'walkCycle',     name: 'Walk Cycle',         description: 'Smooth walk locomotion oscillation',       defaultProperty: 'rotation', defaultAmplitude: 22, defaultSpeed: 2 },
  { id: 'runCycle',      name: 'Run Cycle',          description: 'Snappier run-stride oscillation',          defaultProperty: 'rotation', defaultAmplitude: 35, defaultSpeed: 2.5 },
  { id: 'runLean',       name: 'Run Lean',           description: 'Forward lean offset for running',          defaultProperty: 'rotation', defaultAmplitude: 0,  defaultSpeed: 0 },
  { id: 'legCycle',      name: 'Leg Cycle',          description: 'Leg-specific stride with natural feel',    defaultProperty: 'rotation', defaultAmplitude: 28, defaultSpeed: 2 },
  { id: 'armSwing',      name: 'Arm Swing',          description: 'Arm swing counter to legs',                defaultProperty: 'rotation', defaultAmplitude: 20, defaultSpeed: 2 },
  { id: 'weaponSwing',   name: 'Weapon Swing',       description: 'Attack arc sweep',                         defaultProperty: 'rotation', defaultAmplitude: 60, defaultSpeed: 3 },
  { id: 'capeLag',       name: 'Cape / Cloth Lag',   description: 'Trailing cloth physics simulation',        defaultProperty: 'rotation', defaultAmplitude: 12, defaultSpeed: 1.5 },
  { id: 'staffSway',     name: 'Staff Sway',         description: 'Weapon/staff pendulum bob',                defaultProperty: 'rotation', defaultAmplitude: 6,  defaultSpeed: 0.8 },
  { id: 'tailWag',       name: 'Tail Wag',           description: 'Continuous tail or fin wagging',           defaultProperty: 'rotation', defaultAmplitude: 20, defaultSpeed: 3 },
  { id: 'headBob',       name: 'Head Bob',           description: 'Head nod synced to walk',                  defaultProperty: 'y',        defaultAmplitude: 4,  defaultSpeed: 2 },
  { id: 'clawTwitch',    name: 'Claw Twitch',        description: 'Rapid snap attack twitch',                 defaultProperty: 'rotation', defaultAmplitude: 35, defaultSpeed: 8 },
  { id: 'squashStretch', name: 'Squash & Stretch',   description: 'Scale bounce for cartoon impact',          defaultProperty: 'scaleY',   defaultAmplitude: 0.2,defaultSpeed: 2 },
  { id: 'breathScale',   name: 'Breath Scale',       description: 'Subtle scale inhale/exhale',               defaultProperty: 'scaleX',   defaultAmplitude: 0.05,defaultSpeed: 1 },
  { id: 'blinkScale',    name: 'Blink',              description: 'Eye blink — periodic scale collapse',      defaultProperty: 'scaleY',   defaultAmplitude: 1,  defaultSpeed: 0.3 },
  { id: 'recoil',        name: 'Recoil',             description: 'One-shot recoil kick-back',                defaultProperty: 'x',        defaultAmplitude: 12, defaultSpeed: 4 },
  { id: 'impactShake',   name: 'Impact Shake',       description: 'Damped vibration on hit',                  defaultProperty: 'x',        defaultAmplitude: 10, defaultSpeed: 6 },
  { id: 'shieldBrace',   name: 'Shield Brace',       description: 'Static offset for guard pose',             defaultProperty: 'x',        defaultAmplitude: 0,  defaultSpeed: 0 },
  { id: 'deathFall',     name: 'Death Fall',         description: 'One-shot fall rotation/drop',              defaultProperty: 'rotation', defaultAmplitude: 90, defaultSpeed: 1 },
  { id: 'pulse',         name: 'Pulse / Flash',      description: 'Opacity pulse for glows or alerts',        defaultProperty: 'opacity',  defaultAmplitude: 0.4,defaultSpeed: 2 },
  { id: 'easeInOut',     name: 'Ease In-Out',        description: 'Smooth eased back-and-forth',              defaultProperty: 'y',        defaultAmplitude: 10, defaultSpeed: 1 },
  { id: 'spring',        name: 'Spring',             description: 'Bouncy spring oscillation',                defaultProperty: 'y',        defaultAmplitude: 12, defaultSpeed: 2 },
  { id: 'noise',         name: 'Organic Noise',      description: 'Pseudo-random noise for organic feel',     defaultProperty: 'rotation', defaultAmplitude: 5,  defaultSpeed: 1.5 },
];
