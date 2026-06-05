import type { AnimationController } from '../schema/types.js';

export function evaluateController(
  controller: AnimationController,
  time: number,
  _duration: number
): number {
  const { formulaPreset, params } = controller;
  const { speed, amplitude, phase, offset } = params;

  const t = time * speed + phase;

  switch (formulaPreset) {
    case 'breathingY':
      return Math.sin(t * Math.PI * 2) * amplitude + offset;

    case 'bobPosition':
      return Math.sin(t * Math.PI * 2) * amplitude + offset;

    case 'hoverFloat':
      return Math.sin(t * Math.PI * 2) * amplitude + offset;

    case 'swayRotation':
      return Math.sin(t * Math.PI * 2) * amplitude + offset;

    case 'walkCycle':
      return Math.sin(t * Math.PI * 2) * amplitude + offset;

    case 'runCycle':
      return Math.sin(t * Math.PI * 2) * amplitude + offset;

    case 'runLean':
      return offset;

    case 'legCycle':
      return Math.sin(t * Math.PI * 2) * amplitude + offset;

    case 'weaponSwing':
      return Math.sin(t * Math.PI * 2) * amplitude + offset;

    case 'capeLag':
      return Math.sin(t * Math.PI * 2 - 0.5) * amplitude + offset;

    case 'staffSway':
      return Math.sin(t * Math.PI * 2) * amplitude + offset;

    case 'clawTwitch': {
      const normalized = (time * speed) % 1;
      if (normalized < 0.1) {
        return offset + amplitude * (normalized / 0.1);
      } else if (normalized < 0.3) {
        return offset + amplitude * (1 - (normalized - 0.1) / 0.2);
      }
      return offset;
    }

    case 'squashStretch':
      return 1 + Math.sin(t * Math.PI * 2) * (amplitude / 100);

    case 'blinkScale': {
      const n = (time * speed) % 1;
      return n > 0.9 ? 0 : 1;
    }

    case 'recoil': {
      const n = (time * speed) % 1;
      return n < 0.15 ? -amplitude * (n / 0.15) : -amplitude * (1 - (n - 0.15) / 0.85);
    }

    case 'impactShake': {
      const decay = Math.exp(-time * speed * 3);
      return Math.sin(t * Math.PI * 12) * amplitude * decay + offset;
    }

    case 'shieldBrace':
      return offset;

    case 'deathFall': {
      const n = Math.min(time * speed, 1);
      return n * amplitude + offset;
    }

    default:
      return Math.sin(t * Math.PI * 2) * amplitude + offset;
  }
}
