export interface FormulaPreset {
  id: string;
  name: string;
  description: string;
  defaultProperty: 'x' | 'y' | 'rotation' | 'scaleX' | 'scaleY' | 'opacity';
  defaultAmplitude: number;
  defaultSpeed: number;
  category: 'locomotion' | 'idle' | 'jump' | 'hit' | 'death' | 'physics' | 'utility';
}

export const FORMULA_PRESETS: FormulaPreset[] = [
  // ── Utility ───────────────────────────────────────────────────────────────
  { id: 'sine',          name: 'Sine Wave',         description: 'Pure sinusoidal oscillation',              defaultProperty: 'y',        defaultAmplitude: 8,   defaultSpeed: 1,   category: 'utility' },
  { id: 'easeInOut',     name: 'Ease In-Out',        description: 'Smooth eased back-and-forth',              defaultProperty: 'y',        defaultAmplitude: 10,  defaultSpeed: 1,   category: 'utility' },
  { id: 'spring',        name: 'Spring',             description: 'Bouncy spring oscillation',                defaultProperty: 'y',        defaultAmplitude: 12,  defaultSpeed: 2,   category: 'utility' },
  { id: 'noise',         name: 'Organic Noise',      description: 'Pseudo-random noise for organic feel',     defaultProperty: 'rotation', defaultAmplitude: 5,   defaultSpeed: 1.5, category: 'utility' },
  { id: 'pulse',         name: 'Pulse / Flash',      description: 'Opacity pulse for glows or alerts',        defaultProperty: 'opacity',  defaultAmplitude: 0.4, defaultSpeed: 2,   category: 'utility' },
  { id: 'wobbleOut',     name: 'Wobble Out',         description: 'Damped wobble — hit recovery / landing',   defaultProperty: 'rotation', defaultAmplitude: 15,  defaultSpeed: 2,   category: 'utility' },

  // ── Idle ─────────────────────────────────────────────────────────────────
  { id: 'breathingY',    name: 'Breathing (Y)',      description: 'Gentle up-down breathing bob',             defaultProperty: 'y',        defaultAmplitude: 6,   defaultSpeed: 1,   category: 'idle' },
  { id: 'hoverFloat',    name: 'Hover Float',        description: 'Smooth floating with eased pauses',        defaultProperty: 'y',        defaultAmplitude: 8,   defaultSpeed: 0.8, category: 'idle' },
  { id: 'bobPosition',   name: 'Bob Position',       description: 'Faster bounce-like position oscillation',  defaultProperty: 'y',        defaultAmplitude: 5,   defaultSpeed: 2,   category: 'idle' },
  { id: 'swayRotation',  name: 'Sway',               description: 'Gentle rotation sway',                     defaultProperty: 'rotation', defaultAmplitude: 8,   defaultSpeed: 1,   category: 'idle' },
  { id: 'idleShift',     name: 'Weight Shift',       description: 'Slow side-to-side weight shift',           defaultProperty: 'x',        defaultAmplitude: 3,   defaultSpeed: 0.6, category: 'idle' },
  { id: 'headBob',       name: 'Head Bob',           description: 'Head nod synced to walk',                  defaultProperty: 'y',        defaultAmplitude: 4,   defaultSpeed: 2,   category: 'idle' },
  { id: 'blinkScale',    name: 'Blink',              description: 'Eye blink — periodic scale collapse',      defaultProperty: 'scaleY',   defaultAmplitude: 1,   defaultSpeed: 0.3, category: 'idle' },
  { id: 'breathScale',   name: 'Breath Scale',       description: 'Subtle scale inhale/exhale',               defaultProperty: 'scaleX',   defaultAmplitude: 0.05,defaultSpeed: 1,   category: 'idle' },
  { id: 'squashStretch', name: 'Squash & Stretch',   description: 'Scale bounce for cartoon impact',          defaultProperty: 'scaleY',   defaultAmplitude: 0.2, defaultSpeed: 2,   category: 'idle' },
  { id: 'staffSway',     name: 'Staff / Weapon Sway',description: 'Weapon/staff pendulum bob',                defaultProperty: 'rotation', defaultAmplitude: 6,   defaultSpeed: 0.8, category: 'idle' },
  { id: 'tailWag',       name: 'Tail Wag',           description: 'Continuous tail or fin wagging',           defaultProperty: 'rotation', defaultAmplitude: 20,  defaultSpeed: 3,   category: 'idle' },
  { id: 'clawTwitch',    name: 'Claw Twitch',        description: 'Rapid snap attack twitch',                 defaultProperty: 'rotation', defaultAmplitude: 35,  defaultSpeed: 8,   category: 'idle' },

  // ── Locomotion ────────────────────────────────────────────────────────────
  { id: 'walkCycle',     name: 'Walk Cycle',         description: 'Smooth walk locomotion oscillation',       defaultProperty: 'rotation', defaultAmplitude: 22,  defaultSpeed: 2,   category: 'locomotion' },
  { id: 'runCycle',      name: 'Run Cycle',          description: 'Snappier run-stride oscillation',          defaultProperty: 'rotation', defaultAmplitude: 35,  defaultSpeed: 2.5, category: 'locomotion' },
  { id: 'runLean',       name: 'Run Lean',           description: 'Forward lean offset for running',          defaultProperty: 'rotation', defaultAmplitude: 0,   defaultSpeed: 0,   category: 'locomotion' },
  { id: 'legCycle',      name: 'Leg Cycle',          description: 'Leg-specific stride with natural feel',    defaultProperty: 'rotation', defaultAmplitude: 28,  defaultSpeed: 2,   category: 'locomotion' },
  { id: 'armSwing',      name: 'Arm Swing',          description: 'Arm swing counter to legs',                defaultProperty: 'rotation', defaultAmplitude: 20,  defaultSpeed: 2,   category: 'locomotion' },
  { id: 'capeLag',       name: 'Cape / Cloth Lag',   description: 'Trailing cloth physics simulation',        defaultProperty: 'rotation', defaultAmplitude: 12,  defaultSpeed: 1.5, category: 'physics' },

  // ── Jump ─────────────────────────────────────────────────────────────────
  { id: 'jumpArc',       name: 'Jump Arc (Y)',        description: 'Parabolic jump arc — body Y position',    defaultProperty: 'y',        defaultAmplitude: 80,  defaultSpeed: 1,   category: 'jump' },
  { id: 'jumpRise',      name: 'Jump Rise',           description: 'Fast rise then gravity fall',             defaultProperty: 'y',        defaultAmplitude: 60,  defaultSpeed: 1,   category: 'jump' },
  { id: 'landSquash',    name: 'Land Squash',         description: 'Squash scale on landing impact',          defaultProperty: 'scaleY',   defaultAmplitude: 0.4, defaultSpeed: 1,   category: 'jump' },
  { id: 'jumpLegExtend', name: 'Leg Extend (Jump)',   description: 'Legs extend on apex, bend on landing',    defaultProperty: 'rotation', defaultAmplitude: 30,  defaultSpeed: 1,   category: 'jump' },

  // ── Hit ───────────────────────────────────────────────────────────────────
  { id: 'hitKnockback',  name: 'Hit Knockback',       description: 'Sharp displacement then spring return',   defaultProperty: 'x',        defaultAmplitude: 20,  defaultSpeed: 1,   category: 'hit' },
  { id: 'hitStagger',    name: 'Hit Stagger',         description: 'Shaky rotation stagger on impact',        defaultProperty: 'rotation', defaultAmplitude: 15,  defaultSpeed: 1,   category: 'hit' },
  { id: 'hitFlash',      name: 'Hit Flash (Opacity)', description: 'Rapid opacity flash then settle',         defaultProperty: 'opacity',  defaultAmplitude: 0.5, defaultSpeed: 1,   category: 'hit' },
  { id: 'hitRebound',    name: 'Hit Rebound',         description: 'Spring-y rebound back to position',       defaultProperty: 'y',        defaultAmplitude: 15,  defaultSpeed: 1,   category: 'hit' },
  { id: 'impactShake',   name: 'Impact Shake',        description: 'Damped vibration on hit',                 defaultProperty: 'x',        defaultAmplitude: 10,  defaultSpeed: 6,   category: 'hit' },
  { id: 'recoil',        name: 'Recoil',              description: 'One-shot recoil kick-back',               defaultProperty: 'x',        defaultAmplitude: 12,  defaultSpeed: 4,   category: 'hit' },
  { id: 'weaponSwing',   name: 'Weapon Swing',        description: 'Attack arc sweep',                        defaultProperty: 'rotation', defaultAmplitude: 60,  defaultSpeed: 3,   category: 'hit' },

  // ── Death ─────────────────────────────────────────────────────────────────
  { id: 'deathFall',     name: 'Death Fall (Rot)',    description: 'One-shot fall rotation',                  defaultProperty: 'rotation', defaultAmplitude: 90,  defaultSpeed: 1,   category: 'death' },
  { id: 'deathSlump',    name: 'Death Slump',         description: 'Slow forward slump rotation',             defaultProperty: 'rotation', defaultAmplitude: 45,  defaultSpeed: 0.8, category: 'death' },
  { id: 'deathDrop',     name: 'Death Drop (Y)',      description: 'Drop down with gravity acceleration',     defaultProperty: 'y',        defaultAmplitude: 60,  defaultSpeed: 0.8, category: 'death' },
  { id: 'deathFade',     name: 'Death Fade Out',      description: 'Opacity fade out over duration',          defaultProperty: 'opacity',  defaultAmplitude: 1,   defaultSpeed: 0.5, category: 'death' },
  { id: 'deathTwitch',   name: 'Death Twitch',        description: 'Brief twitch before going still',         defaultProperty: 'rotation', defaultAmplitude: 20,  defaultSpeed: 1,   category: 'death' },

  // ── Physics extras ────────────────────────────────────────────────────────
  { id: 'shieldBrace',   name: 'Shield Brace',        description: 'Static offset for guard pose',            defaultProperty: 'x',        defaultAmplitude: 0,   defaultSpeed: 0,   category: 'physics' },
];
