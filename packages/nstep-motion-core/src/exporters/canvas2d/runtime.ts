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

class _SpringSim {
  constructor() { this._s = {}; }
  reset() { this._s = {}; }
  update(id, len, ph, px, py, pa, rx, ry, dt) {
    const dtc = Math.min(dt, 0.05);
    let s = this._s[id];
    if (!s) {
      s = { tx: rx, ty: ry, vx: 0, vy: 0 };
      this._s[id] = s;
      return Math.atan2(ry - py, rx - px) * (180 / Math.PI) - pa;
    }
    const fx = (rx - s.tx) * ph.stiffness - s.vx * ph.damping;
    const fy = (ry - s.ty) * ph.stiffness - s.vy * ph.damping + ph.gravity;
    s.vx += fx * dtc; s.vy += fy * dtc;
    s.tx += s.vx * dtc; s.ty += s.vy * dtc;
    const tdx = s.tx - px, tdy = s.ty - py;
    const dist = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
    const sc = len / dist;
    s.tx = px + tdx * sc; s.ty = py + tdy * sc;
    let worldA = Math.atan2(s.ty - py, s.tx - px) * (180 / Math.PI);
    let localA = worldA - pa;
    if (ph.maxAngle != null) {
      const nwA = Math.atan2(ry - py, rx - px) * (180 / Math.PI);
      const nL = nwA - pa;
      let diff = ((localA - nL + 180) % 360 + 360) % 360 - 180;
      diff = Math.max(-ph.maxAngle, Math.min(ph.maxAngle, diff));
      localA = nL + diff;
      const cwa = (localA + pa) * Math.PI / 180;
      s.tx = px + Math.cos(cwa) * len; s.ty = py + Math.sin(cwa) * len;
    }
    return localA;
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
    this._blend = null;
    this._xfade = null;
    this._activeSkinId = projectData.activeSkinId || null;
    this._spring = new _SpringSim();
    this._springDt = 0;
    this._eventCbs = [];
    this._preloadImages();
  }

  /**
   * Register a callback fired when an animation event marker is crossed.
   * Callback signature: (name, payload, time) where payload has optional
   * stringValue, intValue, floatValue fields.
   * Returns this for chaining.
   */
  onEvent(cb) {
    if (typeof cb === 'function') this._eventCbs.push(cb);
    return this;
  }

  _fireEvents(prevTime, newTime, anim, wrapped) {
    const events = anim.events;
    if (!events || events.length === 0) return;
    events.forEach(ev => {
      const crossed = wrapped
        ? (ev.time > prevTime || ev.time <= newTime)
        : (prevTime < ev.time && newTime >= ev.time);
      if (crossed) {
        const payload = {};
        if (ev.stringValue !== undefined) payload.stringValue = ev.stringValue;
        if (ev.intValue    !== undefined) payload.intValue    = ev.intValue;
        if (ev.floatValue  !== undefined) payload.floatValue  = ev.floatValue;
        this._eventCbs.forEach(cb => { try { cb(ev.name, payload, ev.time); } catch (_) {} });
      }
    });
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
  stop()  { this.playing = false; if (this._raf) cancelAnimationFrame(this._raf); this._blend = null; this._xfade = null; this._spring.reset(); this._springDt = 0; return this; }
  pause() { this.playing = false; this._springDt = 0; return this; }
  resume(){ this.playing = true; this._lastT = null; this._loop(performance.now()); return this; }
  seekTo(t) { this.time = t; this.render(); return this; }
  setAnim(idx) { this.animIndex = idx; this.time = 0; this._blend = null; this._xfade = null; this._spring.reset(); this._springDt = 0; return this; }

  /**
   * Switch the active skin by name.
   * @param name  The skin name to activate, or null to clear.
   */
  setSkin(name) {
    if (name === null || name === undefined) {
      this._activeSkinId = null;
    } else {
      const skin = (this.project.skins || []).find(s => s.name === name);
      if (!skin) { console.warn('NStepPlayer: skin "' + name + '" not found'); return this; }
      this._activeSkinId = skin.id;
    }
    this.render();
    return this;
  }

  /**
   * Preview a weighted blend between two named animations.
   * weight=0 shows animA, weight=1 shows animB.
   * @param animAName  Name of the first animation (or index for backwards compat)
   * @param animBName  Name of the second animation (or index for backwards compat)
   * @param weight     Blend weight: 0 = full A, 1 = full B
   */
  playWithBlend(animAName, animBName, weight) {
    const idxA = typeof animAName === 'number' ? animAName
      : this.project.animations.findIndex(a => a.name === animAName);
    const idxB = typeof animBName === 'number' ? animBName
      : this.project.animations.findIndex(a => a.name === animBName);
    if (idxA === -1) { console.warn('NStepPlayer.playWithBlend: animation "' + animAName + '" not found'); return this; }
    if (idxB === -1) { console.warn('NStepPlayer.playWithBlend: animation "' + animBName + '" not found'); return this; }
    this._blend = { animAIdx: idxA, animBIdx: idxB, weight: Math.max(0, Math.min(1, weight)) };
    this._xfade = null;
    if (!this.playing) this.resume();
    return this;
  }

  /**
   * Set the blend weight when playWithBlend is active (0 = full A, 1 = full B).
   */
  setBlendWeight(weight) {
    if (this._blend) this._blend.weight = Math.max(0, Math.min(1, weight));
    return this;
  }

  /**
   * Crossfade from the currently playing animation to the named animation.
   * @param animName  The name of the target animation.
   * @param duration  Crossfade duration in seconds.
   */
  crossfadeTo(animName, duration) {
    const idx = this.project.animations.findIndex(a => a.name === animName);
    if (idx === -1) { console.warn('NStepPlayer: animation "' + animName + '" not found'); return this; }
    this._xfade = {
      fromIdx: this.animIndex,
      fromTimeSnapshot: this.time,
      toIdx: idx,
      elapsed: 0,
      duration: Math.max(0.001, duration),
    };
    this._blend = null;
    this.animIndex = idx;
    this.time = 0;
    if (!this.playing) this.resume();
    return this;
  }

  _loop(now) {
    if (!this.playing) return;
    if (this._lastT !== null) {
      const dt = (now - this._lastT) / 1000 * this.speedMult;
      this._springDt = dt;
      // Advance crossfade timer
      if (this._xfade) {
        this._xfade.elapsed += dt;
        if (this._xfade.elapsed >= this._xfade.duration) this._xfade = null;
      }
      const anim = this.anim;
      if (anim) {
        const prevTime = this.time;
        this.time += dt;
        const dur = anim.duration || 1;
        let wrapped = false;
        if (anim.loop) {
          if (this.time > dur) { this.time = this.time % dur; wrapped = true; }
        } else if (this.time > dur) {
          this.time = dur;
          this.playing = false;
          this._springDt = 0;
        }
        this._fireEvents(prevTime, this.time, anim, wrapped);
      }
    }
    this._lastT = now;
    this.render();
    this._raf = requestAnimationFrame(t => this._loop(t));
  }

  _computeTransforms(anim, time) {
    const tforms = {};
    const project = this.project;
    project.parts.forEach(p => {
      tforms[p.id] = {
        x: p.baseX ?? 0, y: p.baseY ?? 0,
        rotation: p.baseRotation ?? 0,
        scaleX: p.baseScaleX ?? 1, scaleY: p.baseScaleY ?? 1,
        opacity: p.opacity ?? 1,
        zIndex: p.zIndex ?? 0,
        color: 0,
      };
    });
    const dur = anim.duration || 1;
    (anim.controllers || []).forEach(c => {
      if (!c.enabled) return;
      const tf = tforms[c.targetPartId];
      if (!tf) return;
      const val = evaluateController(c, time, dur);
      tf[c.property] = (tf[c.property] ?? 0) + val;
    });
    Object.values(tforms).forEach(tf => {
      tf.zIndex = Math.round(tf.zIndex);
      tf.color = Math.max(0, Math.min(1, tf.color));
    });
    return tforms;
  }

  render() {
    const { ctx, canvas, project } = this;
    const anim = this.anim;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!anim) return;
    const dur = anim.duration || 1;
    const t = anim.loop ? ((this.time % dur) + dur) % dur : Math.max(0, Math.min(dur, this.time));

    // Compute transforms — with blend / crossfade support
    let transforms;
    const BLEND_PROPS = ['x','y','rotation','scaleX','scaleY','opacity','zIndex','color'];

    if (this._xfade) {
      const fromAnim = project.animations[this._xfade.fromIdx];
      const w = Math.min(this._xfade.elapsed / this._xfade.duration, 1);
      if (fromAnim) {
        const tA = this._computeTransforms(fromAnim, this._xfade.fromTimeSnapshot);
        const tB = this._computeTransforms(anim, t);
        transforms = {};
        project.parts.forEach(p => {
          const a = tA[p.id], b = tB[p.id];
          if (!a && !b) return;
          const out = {};
          BLEND_PROPS.forEach(k => { out[k] = (a?.[k] ?? 0) + ((b?.[k] ?? 0) - (a?.[k] ?? 0)) * w; });
          out.zIndex = Math.round(out.zIndex);
          transforms[p.id] = out;
        });
      } else {
        transforms = this._computeTransforms(anim, t);
      }
    } else if (this._blend) {
      const animA = project.animations[this._blend.animAIdx];
      const animB = project.animations[this._blend.animBIdx];
      const w = this._blend.weight;
      if (animA && animB) {
        const durA = animA.duration || 1;
        const durB = animB.duration || 1;
        const tA = animA.loop ? ((this.time % durA) + durA) % durA : Math.max(0, Math.min(durA, this.time));
        const tB = animB.loop ? ((this.time % durB) + durB) % durB : Math.max(0, Math.min(durB, this.time));
        const tfA = this._computeTransforms(animA, tA);
        const tfB = this._computeTransforms(animB, tB);
        transforms = {};
        project.parts.forEach(p => {
          const a = tfA[p.id], b = tfB[p.id];
          if (!a && !b) return;
          const out = {};
          BLEND_PROPS.forEach(k => { out[k] = (a?.[k] ?? 0) + ((b?.[k] ?? 0) - (a?.[k] ?? 0)) * w; });
          out.zIndex = Math.round(out.zIndex);
          transforms[p.id] = out;
        });
      } else {
        transforms = this._computeTransforms(anim, t);
      }
    } else {
      transforms = this._computeTransforms(anim, t);
    }

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

    // Spring physics pass (only during playback)
    if (this._springDt > 0 && project.parts.some(p => p.physics)) {
      project.parts.forEach(p => {
        if (!p.physics) return;
        const m = matrices[p.id];
        if (!m) return;
        const pm = p.parentId ? matrices[p.parentId] : null;
        const px = pm ? pm.e : 0, py = pm ? pm.f : 0;
        const pa = pm ? Math.atan2(pm.b, pm.a) * (180 / Math.PI) : 0;
        const bl = Math.sqrt((p.baseX || 0) ** 2 + (p.baseY || 0) ** 2) || 40;
        const lr = this._spring.update(p.id, bl, p.physics, px, py, pa, m.e, m.f, this._springDt);
        if (transforms[p.id]) transforms[p.id].rotation = lr;
      });
      Object.keys(matrices).forEach(k => delete matrices[k]);
      roots.forEach(r => computeMatrix(r, rootMat));
    }

    // Compute rest matrices for SSD mesh skinning (lazy — only when needed)
    const _hasMesh = project.parts.some(p => p.mesh && p.mesh.vertices && p.mesh.vertices.length >= 3);
    const _restMats = _hasMesh ? _buildRestMatrices(project, canvas) : null;

    // Draw parts sorted by animated zIndex
    const sorted = [...project.parts].sort((a, b) =>
      ((transforms[a.id]?.zIndex) ?? (a.zIndex || 0)) - ((transforms[b.id]?.zIndex) ?? (b.zIndex || 0))
    );
    sorted.forEach(part => {
      if (part.visible === false) return;
      const m = matrices[part.id];
      if (!m) return;
      const tf = transforms[part.id];
      // Resolve active skin slot override
      const _aSkin = this._activeSkinId && (project.skins || []).find(s => s.id === this._activeSkinId);
      const _sSlot = _aSkin && _aSkin.slots && _aSkin.slots[part.id];
      const effImgId   = (_sSlot && _sSlot.imageAssetId) || part.imageAssetId;
      const effColor   = (_sSlot && _sSlot.color)        || part.color;
      const effSrcRect = (_sSlot && _sSlot.sourceRect)   || null;
      const asset = (project.assets || []).find(a => a.id === effImgId);

      // Frame animation
      let srcRect = effSrcRect || part.sourceRect || null;
      const fa = part.frameAnimation;
      if (fa && fa.frameCount && fa.fps && fa.frameWidth && fa.frameHeight) {
        const frame = Math.floor(t * fa.fps + (fa.startFrame || 0)) % fa.frameCount;
        const col = frame % (fa.columns || 1);
        const row = Math.floor(frame / (fa.columns || 1));
        srcRect = { x: col * fa.frameWidth, y: row * fa.frameHeight, width: fa.frameWidth, height: fa.frameHeight };
      }

      const ox = part.origin?.x ?? 0;
      const oy = part.origin?.y ?? 0;
      const opacity = Math.max(0, Math.min(1, tf.opacity ?? 1));

      // ── Mesh deformation rendering ─────────────────────────────────────────
      const mesh = part.mesh;
      if (mesh && mesh.vertices && mesh.vertices.length >= 3 && mesh.triangles && mesh.triangles.length > 0
          && part.renderMode === 'image' && asset && _restMats) {
        const img = this._images[asset.id];
        const w = srcRect ? srcRect.width : asset.width;
        const h = srcRect ? srcRect.height : asset.height;
        if (img && img.complete && img.naturalWidth > 0) {
          const deformed = _deformMesh(mesh, part, matrices, _restMats);
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          for (const tri of mesh.triangles) {
            if (tri.length < 3) continue;
            const v0 = mesh.vertices[tri[0]], v1 = mesh.vertices[tri[1]], v2 = mesh.vertices[tri[2]];
            const d0 = deformed[tri[0]], d1 = deformed[tri[1]], d2 = deformed[tri[2]];
            if (!v0 || !v1 || !v2 || !d0 || !d1 || !d2) continue;
            _drawTri(ctx, img, srcRect, w, h,
              [v0.x, v0.y, v1.x, v1.y, v2.x, v2.y],
              [d0.x, d0.y, d1.x, d1.y, d2.x, d2.y],
              opacity);
          }
          ctx.restore();
          return; // Skip normal rendering
        }
      }

      // ── Normal rendering ───────────────────────────────────────────────────
      ctx.save();
      ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
      ctx.globalAlpha = opacity;
      if (part.flipX || part.flipY) ctx.scale(part.flipX ? -1 : 1, part.flipY ? -1 : 1);

      const colorInfluence = Math.max(0, Math.min(1, tf.color ?? 0));
      const tintColor = part.tintColor;

      if (part.renderMode === 'image' && asset) {
        const img = this._images[asset.id];
        const w = srcRect ? srcRect.width  : asset.width;
        const h = srcRect ? srcRect.height : asset.height;
        ctx.translate(-ox, -oy);
        if (img && img.complete && img.naturalWidth > 0) {
          if (srcRect) ctx.drawImage(img, srcRect.x, srcRect.y, srcRect.width, srcRect.height, 0, 0, w, h);
          else ctx.drawImage(img, 0, 0, w, h);
        } else {
          ctx.fillStyle = effColor || '#4c8ef5';
          ctx.fillRect(0, 0, w, h);
        }
        // Tint overlay for image parts
        if (colorInfluence > 0.001 && tintColor) {
          const tc = _hexToRgb(tintColor);
          if (tc) {
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = 'rgba(' + tc[0] + ',' + tc[1] + ',' + tc[2] + ',' + colorInfluence + ')';
            ctx.fillRect(0, 0, w, h);
            ctx.globalCompositeOperation = 'source-over';
          }
        }
      } else {
        const w = (part.origin?.x ?? 20) * 2 || 40;
        const h = (part.origin?.y ?? 20) * 2 || 40;
        ctx.translate(-ox, -oy);
        const baseColor = effColor || '#4c8ef5';
        ctx.fillStyle = (colorInfluence > 0.001 && tintColor)
          ? _blendHex(baseColor, tintColor, colorInfluence)
          : baseColor;
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

function _hexToRgb(hex) {
  const h = hex.replace('#', '');
  if (h.length !== 6) return null;
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}

function _blendHex(c1, c2, t) {
  const a = _hexToRgb(c1), b = _hexToRgb(c2);
  if (!a || !b) return c1;
  return 'rgb(' + Math.round(a[0]+(b[0]-a[0])*t) + ',' + Math.round(a[1]+(b[1]-a[1])*t) + ',' + Math.round(a[2]+(b[2]-a[2])*t) + ')';
}

function _drawTri(ctx, img, srcRect, dispW, dispH, sx, dstPts, opacity) {
  const [x0,y0,x1,y1,x2,y2] = sx;
  const [dx0,dy0,dx1,dy1,dx2,dy2] = dstPts;
  const det = (x0-x2)*(y1-y2) - (x1-x2)*(y0-y2);
  if (Math.abs(det) < 0.01) return;
  const a = ((dx0-dx2)*(y1-y2) - (dx1-dx2)*(y0-y2)) / det;
  const b = ((dx1-dx2)*(x0-x2) - (dx0-dx2)*(x1-x2)) / det;
  const c = dx0 - a*x0 - b*y0;
  const d = ((dy0-dy2)*(y1-y2) - (dy1-dy2)*(y0-y2)) / det;
  const ef = ((dy1-dy2)*(x0-x2) - (dy0-dy2)*(x1-x2)) / det;
  const f = dy0 - d*x0 - ef*y0;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
  ctx.beginPath();
  ctx.moveTo(dx0,dy0); ctx.lineTo(dx1,dy1); ctx.lineTo(dx2,dy2);
  ctx.closePath(); ctx.clip();
  ctx.transform(a, d, b, ef, c, f);
  if (srcRect) ctx.drawImage(img, srcRect.x, srcRect.y, srcRect.width, srcRect.height, 0, 0, dispW, dispH);
  else ctx.drawImage(img, 0, 0, dispW, dispH);
  ctx.restore();
}

function _buildRestMatrices(project, canvas) {
  const partsMap = {}, childrenMap = {}, roots = [];
  project.parts.forEach(p => {
    partsMap[p.id] = p;
    if (!p.parentId) roots.push(p.id);
    else { (childrenMap[p.parentId] = childrenMap[p.parentId] || []).push(p.id); }
  });
  const mats = {};
  const cx = canvas.width / 2, cy = canvas.height / 2;
  const rootMat = new DOMMatrix().translate(cx, cy);
  function compute(id, parent) {
    const p = partsMap[id];
    if (!p) return;
    const m = DOMMatrix.fromMatrix(parent);
    m.translateSelf(p.baseX ?? 0, p.baseY ?? 0);
    m.rotateSelf(p.baseRotation ?? 0);
    m.scaleSelf(p.baseScaleX ?? 1, p.baseScaleY ?? 1);
    mats[id] = m;
    (childrenMap[id] || []).forEach(k => compute(k, m));
  }
  roots.forEach(r => compute(r, rootMat));
  return mats;
}

function _deformMesh(mesh, part, matrices, restMats) {
  const ox = part.origin?.x ?? 0, oy = part.origin?.y ?? 0;
  const partCurr = matrices[part.id];
  const partRest = restMats[part.id];
  return mesh.vertices.map((v, vi) => {
    if (!partCurr) return { x: v.x - ox, y: v.y - oy };
    const bw = mesh.boneWeights[vi] || {};
    const entries = Object.entries(bw).filter(([,w]) => w > 0);
    if (entries.length === 0 || !partRest) {
      const wp = partCurr.transformPoint(new DOMPoint(v.x - ox, v.y - oy));
      return { x: wp.x, y: wp.y };
    }
    const restWorld = partRest.transformPoint(new DOMPoint(v.x - ox, v.y - oy));
    let totalW = 0, dx = 0, dy = 0;
    for (const [boneId, w] of entries) {
      const bc = matrices[boneId], br = restMats[boneId];
      if (!bc || !br) continue;
      try {
        const brInv = br.inverse();
        const inB = brInv.transformPoint(restWorld);
        const def = bc.transformPoint(inB);
        dx += w * def.x; dy += w * def.y; totalW += w;
      } catch {}
    }
    if (totalW <= 0) {
      const wp = partCurr.transformPoint(new DOMPoint(v.x - ox, v.y - oy));
      return { x: wp.x, y: wp.y };
    }
    return { x: dx / totalW, y: dy / totalW };
  });
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
