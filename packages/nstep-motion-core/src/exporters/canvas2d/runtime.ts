import type { CharacterProject } from '../../schema/types.js';

export interface Canvas2DExport {
  code: string;
}

// ── Self-contained runtime template ──────────────────────────────────────────

const RUNTIME_JS = `
// ─── NStep Code Motion — Canvas2D Runtime ────────────────────────────────────
// Self-contained, no dependencies. Drop into any HTML page.
// Usage: const player = new NStepPlayer(canvas, PROJECT_DATA); player.start();

const TAU = Math.PI * 2;

function smoothstep(x) {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function interpolateKeyframes(keyframes, time, duration) {
  if (!keyframes || keyframes.length === 0) return 0;
  const sorted = [...keyframes].sort((a, b) => a.time - b.time);
  if (time <= sorted[0].time) return sorted[0].value;
  if (time >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].value;
  let lo = sorted[0], hi = sorted[sorted.length - 1];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].time <= time && sorted[i + 1].time >= time) { lo = sorted[i]; hi = sorted[i + 1]; break; }
  }
  const span = hi.time - lo.time;
  if (span <= 0) return lo.value;
  const t = (time - lo.time) / span;
  switch (lo.easing) {
    case 'step':      return t < 1 ? lo.value : hi.value;
    case 'easeInOut': return lo.value + (hi.value - lo.value) * easeInOut(t);
    case 'spring': {
      const s = lo.value + (hi.value - lo.value) * t;
      const bounce = Math.sin(t * Math.PI * 3) * Math.exp(-t * 4) * (hi.value - lo.value) * 0.15;
      return s + bounce;
    }
    default: return lo.value + (hi.value - lo.value) * t;
  }
}

function evaluateController(c, time, duration) {
  if (c.mode === 'keyframe' && c.keyframes && c.keyframes.length > 0) {
    return interpolateKeyframes(c.keyframes, time, duration);
  }
  const { speed, amplitude, phase, offset } = c.params;
  const preset = c.formulaPreset;
  const t = time * speed + phase;
  const n = ((t % 1) + 1) % 1;

  switch (preset) {
    case 'sine': return Math.sin(t * TAU) * amplitude + offset;
    case 'breathingY':
    case 'swayRotation':
    case 'walkCycle':
    case 'legCycle':
    case 'armSwing':
    case 'capeLag':
    case 'tailWag':
    case 'idleShift':
    case 'staffSway':
    case 'hoverFloat':
      return Math.sin(t * TAU) * amplitude + offset;
    case 'headBob': return -Math.abs(Math.sin(t * TAU)) * amplitude + offset;
    case 'bobPosition': return (Math.abs(Math.sin(t * Math.PI)) * 2 - 1) * amplitude + offset;
    case 'runLean': return offset || amplitude * 0.12;
    case 'runCycle': {
      const s = Math.sin(t * TAU);
      return Math.sign(s) * Math.pow(Math.abs(s), 0.7) * amplitude + offset;
    }
    case 'blinkScale':
      if (n > 0.9 && n < 0.93) return 0;
      if (n >= 0.93 && n < 0.96) return (n - 0.93) / 0.03;
      return 1;
    case 'breathScale': return 1 + ((Math.sin(t * TAU) + 1) / 2) * amplitude + offset;
    case 'squashStretch': return 1 + Math.sin(t * TAU) * amplitude + offset;
    case 'pulse': return (1 - amplitude) + ((Math.sin(t * TAU) + 1) / 2) * amplitude + offset;
    case 'spring': return Math.cos(t * TAU * 2) * amplitude * (1 - Math.exp(-n * 1.5)) + offset;
    case 'easeInOut': return (easeInOut((Math.sin(t * TAU) + 1) / 2) * 2 - 1) * amplitude + offset;
    case 'noise': {
      const s1 = Math.sin(t * 1.3) * 43758.5453123;
      const s2 = Math.sin(t * 2.7) * 17341.9274632;
      const s3 = Math.sin(t * 0.9) * 28496.2847523;
      return (((s1-Math.floor(s1)) + (s2-Math.floor(s2)) + (s3-Math.floor(s3))) / 3 * 2 - 1) * amplitude + offset;
    }
    case 'recoil': {
      if (n < 0.12) return -amplitude * smoothstep(n / 0.12) + offset;
      if (n < 0.45) return -amplitude * (1 - smoothstep((n - 0.12) / 0.33)) + offset;
      return offset;
    }
    case 'impactShake': return Math.sin(t * TAU * 7) * amplitude * Math.exp(-n * 5) + offset;
    case 'weaponSwing': {
      if (n < 0.3) return -amplitude + (amplitude * 2) * (n / 0.3) + offset;
      if (n < 0.5) return amplitude - amplitude * ((n - 0.3) / 0.2) + offset;
      return -amplitude * 0.5 + amplitude * 0.5 * ((n - 0.5) / 0.5) + offset;
    }
    case 'deathFall': { const dn = Math.min(n * 1.5, 1); return (1 - Math.pow(1 - dn, 3)) * amplitude + offset; }
    case 'jumpArc': return -4 * n * (1 - n) * amplitude + offset;
    case 'jumpRise': {
      if (n < 0.35) return -smoothstep(n / 0.35) * amplitude + offset;
      return -(1 - smoothstep((n - 0.35) / 0.65)) * amplitude + offset;
    }
    case 'landSquash': {
      if (n < 0.08) return 1 - amplitude * smoothstep(n / 0.08) + offset;
      if (n < 0.20) return 1 - amplitude * (1 - smoothstep((n - 0.08) / 0.12)) + offset;
      if (n < 0.30) return 1 + amplitude * 0.5 * Math.sin((n - 0.2) / 0.1 * Math.PI) + offset;
      return 1 + offset;
    }
    case 'jumpLegExtend': {
      if (n < 0.5) return amplitude * smoothstep(n / 0.5) + offset;
      return amplitude * (1 - Math.sin((n - 0.5) / 0.5 * Math.PI)) + offset;
    }
    case 'hitKnockback': return Math.sin(n * TAU * 0.5) * amplitude * Math.exp(-n * 6) + offset;
    case 'hitFlash': {
      if (n < 0.05) return offset;
      if (n < 0.12 || (n >= 0.18 && n < 0.25)) return 1 + offset;
      if (n < 0.18) return offset;
      return 1 + offset * (1 - (n - 0.25) / 0.75);
    }
    case 'hitStagger': return Math.sin(t * TAU * 5) * amplitude * Math.exp(-n * 4) + offset;
    case 'hitRebound': return Math.exp(-n * 5) * Math.cos(t * TAU * 2) * amplitude + offset;
    case 'deathSlump': return easeInOut(Math.min(n * 2, 1)) * amplitude + offset;
    case 'deathDrop': return n * n * amplitude + offset;
    case 'deathFade': return (1 - smoothstep(n)) * amplitude + offset;
    case 'deathTwitch': {
      if (n > 0.6) return offset;
      return Math.sin(t * TAU * 8) * Math.exp(-n * 5) * amplitude + offset;
    }
    case 'idleShift': return (Math.sin(t * TAU) * 0.4 + Math.sin(t * TAU * 0.37 + 1.1) * 0.6) * amplitude + offset;
    case 'wobbleOut': return Math.exp(-n * 4) * Math.cos(t * TAU * 3) * amplitude + offset;
    default: return Math.sin(t * TAU) * amplitude + offset;
  }
}

class NStepPlayer {
  constructor(canvas, projectData, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.project = projectData;
    this.animIndex = options.animIndex ?? 0;
    this.time = 0;
    this.playing = false;
    this.speedMult = options.speed ?? 1;
    this._raf = null;
    this._lastT = null;
    this._images = {};
    this._preloadImages();
  }

  _preloadImages() {
    (this.project.assets || []).forEach(asset => {
      if (!asset.dataUrl) return;
      const img = new Image();
      img.src = asset.dataUrl;
      this._images[asset.id] = img;
    });
  }

  get anim() {
    return this.project.animations[this.animIndex] || this.project.animations[0];
  }

  start() { this.playing = true; this._loop(performance.now()); return this; }
  stop()  { this.playing = false; if (this._raf) cancelAnimationFrame(this._raf); return this; }
  pause() { this.playing = false; return this; }
  resume(){ this.playing = true; this._lastT = null; this._loop(performance.now()); return this; }
  seekTo(t) { this.time = t; this.render(); return this; }
  setAnim(idx) { this.animIndex = idx; this.time = 0; return this; }

  _loop(now) {
    if (!this.playing) return;
    if (this._lastT !== null) {
      const dt = (now - this._lastT) / 1000 * this.speedMult;
      const anim = this.anim;
      if (anim) {
        this.time += dt;
        const dur = anim.duration || 1;
        if (anim.loop) {
          if (this.time > dur) this.time = this.time % dur;
        } else if (this.time > dur) {
          this.time = dur;
          this.playing = false;
        }
      }
    }
    this._lastT = now;
    this.render();
    this._raf = requestAnimationFrame(t => this._loop(t));
  }

  render() {
    const { ctx, canvas, project } = this;
    const anim = this.anim;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!anim) return;
    const dur = anim.duration || 1;
    const t = anim.loop ? ((this.time % dur) + dur) % dur : Math.max(0, Math.min(dur, this.time));

    // Compute transforms
    const transforms = {};
    project.parts.forEach(p => {
      transforms[p.id] = {
        x: p.baseX ?? 0, y: p.baseY ?? 0,
        rotation: p.baseRotation ?? 0,
        scaleX: p.baseScaleX ?? 1, scaleY: p.baseScaleY ?? 1,
        opacity: p.opacity ?? 1,
      };
    });
    (anim.controllers || []).forEach(c => {
      if (!c.enabled) return;
      const tf = transforms[c.targetPartId];
      if (!tf) return;
      const val = evaluateController(c, t, dur);
      tf[c.property] = (tf[c.property] ?? 0) + val;
    });

    // Build hierarchy
    const partsMap = {}, childrenMap = {}, roots = [];
    project.parts.forEach(p => {
      partsMap[p.id] = p;
      if (!p.parentId) roots.push(p.id);
      else { (childrenMap[p.parentId] = childrenMap[p.parentId] || []).push(p.id); }
    });

    // Compute world matrices
    const matrices = {};
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const rootMat = new DOMMatrix().translate(cx, cy);

    function computeMatrix(id, parent) {
      const tf = transforms[id];
      if (!tf) return;
      const m = DOMMatrix.fromMatrix(parent);
      m.translateSelf(tf.x, tf.y);
      m.rotateSelf(tf.rotation);
      m.scaleSelf(tf.scaleX, tf.scaleY);
      matrices[id] = m;
      (childrenMap[id] || []).forEach(k => computeMatrix(k, m));
    }
    roots.forEach(r => computeMatrix(r, rootMat));

    // Draw parts sorted by zIndex
    const sorted = [...project.parts].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    sorted.forEach(part => {
      if (part.visible === false) return;
      const m = matrices[part.id];
      if (!m) return;
      const tf = transforms[part.id];
      const asset = (project.assets || []).find(a => a.id === part.imageAssetId);

      ctx.save();
      ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
      ctx.globalAlpha = Math.max(0, Math.min(1, tf.opacity ?? 1));
      if (part.flipX || part.flipY) ctx.scale(part.flipX ? -1 : 1, part.flipY ? -1 : 1);

      // Frame animation
      let srcRect = part.sourceRect || null;
      const fa = part.frameAnimation;
      if (fa && fa.frameCount && fa.fps && fa.frameWidth && fa.frameHeight) {
        const frame = Math.floor(t * fa.fps + (fa.startFrame || 0)) % fa.frameCount;
        const col = frame % (fa.columns || 1);
        const row = Math.floor(frame / (fa.columns || 1));
        srcRect = { x: col * fa.frameWidth, y: row * fa.frameHeight, width: fa.frameWidth, height: fa.frameHeight };
      }

      const ox = part.origin?.x ?? 0;
      const oy = part.origin?.y ?? 0;

      if (part.renderMode === 'image' && asset) {
        const img = this._images[asset.id];
        const w = srcRect ? srcRect.width  : asset.width;
        const h = srcRect ? srcRect.height : asset.height;
        ctx.translate(-ox, -oy);
        if (img && img.complete && img.naturalWidth > 0) {
          if (srcRect) ctx.drawImage(img, srcRect.x, srcRect.y, srcRect.width, srcRect.height, 0, 0, w, h);
          else ctx.drawImage(img, 0, 0, w, h);
        } else {
          ctx.fillStyle = part.color || '#4c8ef5';
          ctx.fillRect(0, 0, w, h);
        }
      } else {
        const w = (part.origin?.x ?? 20) * 2 || 40;
        const h = (part.origin?.y ?? 20) * 2 || 40;
        ctx.translate(-ox, -oy);
        ctx.fillStyle = part.color || '#4c8ef5';
        ctx.beginPath();
        if (part.shapeType === 'circle' || part.shapeType === 'ellipse') {
          ctx.ellipse(w/2, h/2, w/2, h/2, 0, 0, Math.PI * 2);
        } else {
          const r = Math.min(6, w * 0.15, h * 0.15);
          ctx.roundRect ? ctx.roundRect(0, 0, w, h, r) : ctx.rect(0, 0, w, h);
        }
        ctx.fill();
      }
      ctx.restore();
    });
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────
if (typeof module !== 'undefined' && module.exports) module.exports = { NStepPlayer, evaluateController };
else if (typeof window !== 'undefined') window.NStepPlayer = NStepPlayer;
`.trim();

export function exportToCanvas2D(project: CharacterProject): Canvas2DExport {
  const json = JSON.stringify(project, null, 2);

  const code = `${RUNTIME_JS}

// ─── Project data ─────────────────────────────────────────────────────────────
const PROJECT_DATA = ${json};

// ─── Auto-start (if in browser context) ──────────────────────────────────────
// Uncomment below to auto-play when the script loads:
// const canvas = document.getElementById('nstep-canvas');
// if (canvas) new NStepPlayer(canvas, PROJECT_DATA).start();
`;

  return { code };
}

export function exportStandaloneHTML(project: CharacterProject, runtimeCode: string): string {
  const anim = project.animations[0];
  const dur  = anim?.duration ?? 1;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${project.name} — NStep Motion Preview</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0b0d14; display: flex; flex-direction: column; align-items: center;
           justify-content: center; min-height: 100vh; font-family: system-ui, sans-serif; color: #b8c5e0; }
    canvas { background: #111520; border-radius: 8px; box-shadow: 0 10px 40px rgba(0,0,0,0.7); max-width: 100vw; }
    .controls { display: flex; gap: 10px; align-items: center; margin-top: 14px; }
    button { padding: 6px 16px; background: rgba(76,142,245,0.15); border: 1px solid rgba(76,142,245,0.4);
             color: #4c8ef5; border-radius: 6px; cursor: pointer; font-size: 13px; }
    button:hover { background: rgba(76,142,245,0.28); }
    select { padding: 5px 8px; background: #181d2e; border: 1px solid rgba(255,255,255,0.1);
             color: #b8c5e0; border-radius: 6px; font-size: 13px; }
    .time { font-size: 12px; font-family: monospace; color: #4d5b78; min-width: 90px; text-align: center; }
    h2 { font-size: 14px; font-weight: 600; color: #edf2ff; margin-bottom: 10px; letter-spacing: 0.04em; }
  </style>
</head>
<body>
  <h2>${project.name}</h2>
  <canvas id="nstep-canvas" width="600" height="500"></canvas>
  <div class="controls">
    <button id="btn-play">▶ Play</button>
    <button id="btn-stop">⏹ Stop</button>
    <select id="anim-select">
      ${project.animations.map((a, i) => `<option value="${i}">${a.name}</option>`).join('')}
    </select>
    <label style="font-size:12px; color:#4d5b78;">Speed
      <input type="range" id="speed" min="0.1" max="3" step="0.1" value="1" style="width:70px; vertical-align:middle;">
      <span id="speed-label">1.0×</span>
    </label>
    <span class="time" id="time-display">0.00 / ${dur.toFixed(2)}s</span>
  </div>

  <script>
${runtimeCode}

  const canvas = document.getElementById('nstep-canvas');
  const player = new NStepPlayer(canvas, PROJECT_DATA);

  document.getElementById('btn-play').onclick = () => player.resume();
  document.getElementById('btn-stop').onclick = () => { player.stop(); player.time = 0; player.render(); };

  document.getElementById('anim-select').onchange = (e) => {
    player.setAnim(+e.target.value);
    player.resume();
  };

  const speedRange = document.getElementById('speed');
  const speedLabel = document.getElementById('speed-label');
  speedRange.oninput = () => { player.speedMult = +speedRange.value; speedLabel.textContent = speedRange.value + '×'; };

  const timeEl = document.getElementById('time-display');
  const origLoop = player._loop.bind(player);
  player._loop = function(now) {
    origLoop(now);
    const a = player.anim;
    if (a) timeEl.textContent = player.time.toFixed(2) + ' / ' + a.duration.toFixed(2) + 's';
  };

  player.start();
  </script>
</body>
</html>`;
}
