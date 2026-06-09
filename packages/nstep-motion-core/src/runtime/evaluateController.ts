import type { AnimationController, Keyframe } from '../schema/types.js';

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

function springDecay(t: number, freq: number, decay: number): number {
  return Math.exp(-t * decay) * Math.cos(t * TAU * freq);
}

// ── Cubic Bézier helpers ──────────────────────────────────────────────────────
function cubicBezier1D(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

/**
 * Solve for the parametric t that gives Bx(t) = targetX using binary search.
 * p0x=0 and p3x=1 are assumed (normalised segment).
 */
function solveBezierT(cp1x: number, cp2x: number, targetX: number): number {
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) * 0.5;
    if (cubicBezier1D(mid, 0, cp1x, cp2x, 1) < targetX) lo = mid; else hi = mid;
  }
  return (lo + hi) * 0.5;
}

// ── Keyframe interpolation ────────────────────────────────────────────────────
function interpolateKeyframes(keyframes: Keyframe[], time: number, _duration: number): number {
  if (!keyframes || keyframes.length === 0) return 0;
  const sorted = [...keyframes].sort((a, b) => a.time - b.time);
  if (time <= sorted[0].time) return sorted[0].value;
  if (time >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].value;

  let lo = sorted[0];
  let hi = sorted[sorted.length - 1];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].time <= time && sorted[i + 1].time >= time) {
      lo = sorted[i];
      hi = sorted[i + 1];
      break;
    }
  }

  const span = hi.time - lo.time;
  if (span <= 0) return lo.value;
  const t = (time - lo.time) / span;

  // Bézier easing: tangents stored on lo keyframe, normalised [0,1]×[0,1]
  if (lo.easing === 'bezier' && lo.tangentOut && lo.tangentIn) {
    const bT = solveBezierT(lo.tangentOut.x, lo.tangentIn.x, t);
    const bY = cubicBezier1D(bT, 0, lo.tangentOut.y, lo.tangentIn.y, 1);
    return lo.value + (hi.value - lo.value) * bY;
  }

  switch (lo.easing) {
    case 'step':      return t < 1 ? lo.value : hi.value;
    case 'easeInOut': return lo.value + (hi.value - lo.value) * easeInOut(t);
    case 'spring': {
      const s = lo.value + (hi.value - lo.value) * t;
      const bounce = Math.sin(t * Math.PI * 3) * Math.exp(-t * 4) * (hi.value - lo.value) * 0.15;
      return s + bounce;
    }
    default: return lo.value + (hi.value - lo.value) * t; // linear
  }
}

// ── Main evaluator ────────────────────────────────────────────────────────────
export function evaluateController(
  controller: AnimationController,
  time: number,
  _duration: number
): number {

  // Keyframe mode — bypass formula entirely
  if (controller.mode === 'keyframe' && controller.keyframes && controller.keyframes.length > 0) {
    return interpolateKeyframes(controller.keyframes, time, _duration);
  }

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
      if (n < 0.2)  return offset + amplitude * (1 - (n - 0.08) / 0.12);
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

    // ── NEW: Jump formulas ─────────────────────────────────────────────────
    case 'jumpArc': {
      // Goes up quickly, then falls with gravity — parabola shaped
      const n = Math.min(tWrapped, 1);
      const arc = 4 * n * (1 - n); // parabola peak at 0.5
      return -arc * amplitude + offset; // negative = up
    }

    case 'jumpRise': {
      // Rapid rise at start (first 35% of duration)
      const n = tWrapped;
      if (n < 0.35) {
        const rise = smoothstep(n / 0.35);
        return -rise * amplitude + offset;
      }
      const fall = smoothstep((n - 0.35) / 0.65);
      return -(1 - fall) * amplitude + offset;
    }

    case 'landSquash': {
      // Squash/stretch on landing — scaleY squash when hitting ground
      const n = tWrapped;
      if (n < 0.08) return 1 - amplitude * smoothstep(n / 0.08) + offset; // compress on hit
      if (n < 0.2)  return 1 - amplitude * (1 - smoothstep((n - 0.08) / 0.12)) + offset; // spring back
      if (n < 0.3)  return 1 + amplitude * 0.5 * Math.sin((n - 0.2) / 0.1 * Math.PI) + offset; // overshoot
      return 1 + offset;
    }

    case 'jumpLegExtend': {
      // Legs extend straight on jump apex, bend on landing
      const n = tWrapped;
      if (n < 0.5) {
        return amplitude * smoothstep(n / 0.5) + offset; // extend up
      }
      const bend = Math.sin((n - 0.5) / 0.5 * Math.PI);
      return amplitude * (1 - bend) + offset; // bend back
    }

    // ── NEW: Hit formulas ─────────────────────────────────────────────────
    case 'hitKnockback': {
      // Sharp X/Y displacement then spring return
      const n = tWrapped;
      const kick = Math.exp(-n * 6);
      return Math.sin(n * TAU * 0.5) * amplitude * kick + offset;
    }

    case 'hitFlash': {
      // Starts visible, dips twice on impact then settles — amplitude controls dim depth
      const n = tWrapped;
      const dim = Math.max(0, 1 - amplitude);
      if (n < 0.10) return 1 + offset;           // visible at moment of hit
      if (n < 0.18) return dim + offset;          // dim — impact frame
      if (n < 0.26) return 1 + offset;            // flash back
      if (n < 0.34) return dim + offset;          // second dim
      return 1 + offset;                           // settled
    }

    case 'hitStagger': {
      // Shaky rotation stagger
      const decay = Math.exp(-tWrapped * 4);
      const shake = Math.sin(t * TAU * 5) * amplitude * decay;
      return shake + offset;
    }

    case 'hitRebound': {
      // Spring-y rebound back to position
      const n = tWrapped;
      return springDecay(n, 2, 5) * amplitude + offset;
    }

    // ── NEW: Death formulas ───────────────────────────────────────────────
    case 'deathSlump': {
      // Slow forward slump rotation
      const n = Math.min(tWrapped, 1);
      const slump = easeInOut(Math.min(n * 2, 1));
      return slump * amplitude + offset;
    }

    case 'deathDrop': {
      // Drop down with gravity acceleration
      const n = Math.min(tWrapped, 1);
      const drop = n * n; // accelerate
      return drop * amplitude + offset;
    }

    case 'deathFade': {
      // Opacity fade out
      const n = Math.min(tWrapped, 1);
      const fade = 1 - smoothstep(n);
      return fade * amplitude + offset;
    }

    case 'deathTwitch': {
      // Brief twitch before going still
      const n = tWrapped;
      if (n > 0.6) return offset;
      const twitch = Math.sin(t * TAU * 8) * Math.exp(-n * 5);
      return twitch * amplitude + offset;
    }

    // ── NEW: Idle extras ──────────────────────────────────────────────────
    case 'idleShift': {
      // Slow weight-shift side to side
      const shift = Math.sin(t * TAU) * 0.4 + Math.sin(t * TAU * 0.37 + 1.1) * 0.6;
      return shift * amplitude + offset;
    }

    case 'wobbleOut': {
      // Damped wobble — good for hit recovery or landing
      const n = Math.min(tWrapped, 1);
      return springDecay(n * 2, 3, 4) * amplitude + offset;
    }

    default:
      return Math.sin(t * TAU) * amplitude + offset;
  }
}
