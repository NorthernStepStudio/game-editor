import type { AnimationController } from '../schema/types.js';

const TAU = Math.PI * 2;

function smoothstep(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function pseudoNoise(t: number, seed: number = 0): number {
  const s1 = Math.sin(t * 1.3 + seed * 7.31) * 43758.5453123;
  const s2 = Math.sin(t * 2.7 + seed * 3.17) * 17341.9274632;
  const s3 = Math.sin(t * 0.9 + seed * 11.5) * 28496.2847523;
  return ((s1 - Math.floor(s1)) + (s2 - Math.floor(s2)) + (s3 - Math.floor(s3))) / 3;
}

export function evaluateController(
  controller: AnimationController,
  time: number,
  _duration: number
): number {
  const { formulaPreset, params } = controller;
  const { speed, amplitude, phase, offset } = params;

  const t = time * speed + phase;
  const tWrapped = ((t % 1) + 1) % 1;

  switch (formulaPreset) {

    case 'sine':
      return Math.sin(t * TAU) * amplitude + offset;

    case 'breathingY': {
      const breathe = Math.sin(t * TAU);
      return breathe * amplitude + offset;
    }

    case 'hoverFloat': {
      const up = Math.sin(t * TAU);
      const ease = (up + 1) / 2;
      const eased = easeInOut(ease);
      return (eased * 2 - 1) * amplitude + offset;
    }

    case 'bobPosition': {
      const bob = Math.abs(Math.sin(t * Math.PI)) * 2 - 1;
      return bob * amplitude + offset;
    }

    case 'swayRotation':
      return Math.sin(t * TAU) * amplitude + offset;

    case 'walkCycle': {
      const stride = Math.sin(t * TAU);
      return stride * amplitude + offset;
    }

    case 'runCycle': {
      const stride = Math.sin(t * TAU);
      const snap = Math.sign(stride) * Math.pow(Math.abs(stride), 0.7);
      return snap * amplitude + offset;
    }

    case 'runLean':
      return offset === 0 ? amplitude * 0.12 : offset;

    case 'legCycle': {
      const leg = Math.sin(t * TAU);
      const naturalLeg = leg - 0.15 * Math.sin(t * TAU * 2);
      return naturalLeg * amplitude + offset;
    }

    case 'armSwing': {
      const arm = -Math.sin(t * TAU);
      return arm * amplitude + offset;
    }

    case 'weaponSwing': {
      const n = tWrapped;
      if (n < 0.3) return -amplitude + (amplitude * 2) * (n / 0.3) + offset;
      if (n < 0.5) return amplitude - amplitude * ((n - 0.3) / 0.2) + offset;
      return (-amplitude * 0.5) + (amplitude * 0.5) * ((n - 0.5) / 0.5) + offset;
    }

    case 'capeLag': {
      const lag = Math.sin(t * TAU - 0.6);
      return lag * amplitude + offset;
    }

    case 'staffSway': {
      const sway = Math.sin(t * TAU) * 0.7 + Math.sin(t * TAU * 1.3 + 0.5) * 0.3;
      return sway * amplitude + offset;
    }

    case 'tailWag':
      return Math.sin(t * TAU) * amplitude + offset;

    case 'headBob': {
      const bob = Math.abs(Math.sin(t * TAU));
      return -bob * amplitude + offset;
    }

    case 'clawTwitch': {
      const n = tWrapped;
      if (n < 0.08) return offset + amplitude * (n / 0.08);
      if (n < 0.2) return offset + amplitude * (1 - (n - 0.08) / 0.12);
      if (n < 0.28) return offset + amplitude * 0.4 * ((n - 0.2) / 0.08);
      if (n < 0.36) return offset + amplitude * 0.4 * (1 - (n - 0.28) / 0.08);
      return offset;
    }

    case 'squashStretch': {
      const sq = Math.sin(t * TAU);
      return 1 + sq * amplitude + offset;
    }

    case 'breathScale': {
      const inhale = (Math.sin(t * TAU) + 1) / 2;
      return 1 + inhale * amplitude + offset;
    }

    case 'blinkScale': {
      const n = tWrapped;
      if (n > 0.9 && n < 0.93) return 0;
      if (n >= 0.93 && n < 0.96) return (n - 0.93) / 0.03;
      return 1;
    }

    case 'recoil': {
      const n = tWrapped;
      if (n < 0.12) return -amplitude * smoothstep(n / 0.12) + offset;
      if (n < 0.45) return -amplitude * (1 - smoothstep((n - 0.12) / 0.33)) + offset;
      return offset;
    }

    case 'impactShake': {
      const decay = Math.exp(-tWrapped * 5);
      const shake = Math.sin(t * TAU * 7);
      return shake * amplitude * decay + offset;
    }

    case 'shieldBrace':
      return offset || amplitude;

    case 'deathFall': {
      const n = Math.min(tWrapped * 1.5, 1);
      const eased = 1 - Math.pow(1 - n, 3);
      return eased * amplitude + offset;
    }

    case 'pulse': {
      const p = (Math.sin(t * TAU) + 1) / 2;
      return (1 - amplitude) + p * amplitude + offset;
    }

    case 'easeInOut': {
      const cycle = (Math.sin(t * TAU) + 1) / 2;
      const e = easeInOut(cycle);
      return (e * 2 - 1) * amplitude + offset;
    }

    case 'spring': {
      const decay = Math.exp(-tWrapped * 3);
      const osc = Math.cos(t * TAU * 2);
      return osc * amplitude * (1 - decay * 0.5) + offset;
    }

    case 'noise': {
      const n = pseudoNoise(t * 0.5, 0) * 2 - 1;
      return n * amplitude + offset;
    }

    default:
      return Math.sin(t * TAU) * amplitude + offset;
  }
}
