export interface FormulaPreset {
  id: string;
  name: string;
}

export const FORMULA_PRESETS: FormulaPreset[] = [
  { id: 'breathingY', name: 'Breathing (Y)' },
  { id: 'bobPosition', name: 'Bob Position' },
  { id: 'hoverFloat', name: 'Hover Float' },
  { id: 'swayRotation', name: 'Sway Rotation' },
  { id: 'walkCycle', name: 'Walk Cycle' },
  { id: 'runCycle', name: 'Run Cycle' },
  { id: 'runLean', name: 'Run Lean' },
  { id: 'legCycle', name: 'Leg Cycle' },
  { id: 'weaponSwing', name: 'Weapon Swing' },
  { id: 'capeLag', name: 'Cape Lag' },
  { id: 'staffSway', name: 'Staff Sway' },
  { id: 'clawTwitch', name: 'Claw Twitch' },
  { id: 'squashStretch', name: 'Squash & Stretch' },
  { id: 'blinkScale', name: 'Blink Scale' },
  { id: 'recoil', name: 'Recoil' },
  { id: 'impactShake', name: 'Impact Shake' },
  { id: 'shieldBrace', name: 'Shield Brace' },
  { id: 'deathFall', name: 'Death Fall' }
];
