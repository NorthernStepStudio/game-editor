import { CharacterProject } from '@nstep-core/schema/types';

export function exportToUnityCSharp(project: CharacterProject): string {
  const safeClassName = project.name.replace(/[^a-zA-Z0-9_]/g, '_') || 'NStepAnimator';

  const animNames = (project.animations as any[]).map(a =>
    `        public const string ${sanitizeIdent(a.name)} = "${a.name}";`
  ).join('\n');

  const animDurations = (project.animations as any[]).map(a =>
    `            { "${a.name}", ${(a.duration || 1).toFixed(4)}f },`
  ).join('\n');

  const animLoop = (project.animations as any[]).map(a =>
    `            { "${a.name}", ${a.loop ? 'true' : 'false'} },`
  ).join('\n');

  const partIdToName = new Map((project.parts as any[]).map(p => [p.id, p.name]));

  const controllerEntries = (project.animations as any[]).map(a => {
    const ctrlLines = a.controllers
      .filter((c: any) => c.enabled)
      .map((c: any) => buildControllerEntry(c, partIdToName))
      .join(',\n                ');
    return `            { "${a.name}", new ControllerData[] {\n                ${ctrlLines}\n            } },`;
  }).join('\n');

  const partNames = (project.parts as any[]).map(p =>
    `        public const string ${sanitizeIdent(p.name)} = "${p.name}";`
  ).join('\n');

  return `// ──────────────────────────────────────────────────────────────────────────────
// NStep Code Motion — Unity Runtime
// Auto-generated for project: ${project.name}
// Drop this file into your Unity project.
//
// Usage:
//   1. Attach ${safeClassName} to a root GameObject.
//   2. Make sure child GameObjects are named to match PartNames constants.
//   3. Assign sprite assets in the inspector (or let the runtime skip image parts).
//   4. Call Play(PartNames.<AnimName>) to start an animation.
// ──────────────────────────────────────────────────────────────────────────────
using System;
using System.Collections.Generic;
using UnityEngine;

namespace NStep
{
    [AddComponentMenu("NStep/Animator")]
    public class ${safeClassName} : MonoBehaviour
    {
        // ── Animation name constants ───────────────────────────────────────────
        public static class AnimNames
        {
${animNames}
        }

        // ── Part name constants ────────────────────────────────────────────────
        public static class PartNames
        {
${partNames}
        }

        // ── Inspector ─────────────────────────────────────────────────────────
        [Header("Playback")]
        public string currentAnimation = "${(project.animations as any[])[0]?.name ?? ''}";
        [Range(0f, 4f)]
        public float speedMultiplier   = 1f;
        public bool  playOnAwake       = true;

        // ── Internal state ─────────────────────────────────────────────────────
        private float   _time        = 0f;
        private bool    _playing     = false;
        private string  _activeAnim  = null;

        // Child transform cache
        private readonly Dictionary<string, Transform>       _transforms  = new();
        private readonly Dictionary<string, SpriteRenderer>  _renderers   = new();

        // ── Part base data ─────────────────────────────────────────────────────
        private static readonly Dictionary<string, PartBase> _partBases = new()
        {
${buildPartBases(project)}
        };

        // ── Animation data ─────────────────────────────────────────────────────
        private static readonly Dictionary<string, float>  _durations = new()
        {
${animDurations}
        };

        private static readonly Dictionary<string, bool>   _loops = new()
        {
${animLoop}
        };

        // ── Controller data ────────────────────────────────────────────────────
        private static readonly Dictionary<string, ControllerData[]> _controllers = new()
        {
${controllerEntries}
        };

        // ── Unity lifecycle ────────────────────────────────────────────────────
        private void Awake()
        {
            CacheChildren(transform);
        }

        private void Start()
        {
            if (playOnAwake && !string.IsNullOrEmpty(currentAnimation))
                Play(currentAnimation);
        }

        private void Update()
        {
            if (!_playing || string.IsNullOrEmpty(_activeAnim)) return;

            if (!_durations.TryGetValue(_activeAnim, out float dur)) dur = 1f;
            _time += Time.deltaTime * speedMultiplier;

            bool loops = _loops.TryGetValue(_activeAnim, out bool lo) && lo;
            if (loops) { _time %= dur; }
            else if (_time > dur) { _time = dur; _playing = false; }

            ApplyAnimation(_activeAnim, _time, dur);
        }

        // ── Public API ─────────────────────────────────────────────────────────
        public void Play(string animName)
        {
            if (!_durations.ContainsKey(animName))
            {
                Debug.LogWarning($"[NStep] Animation '{animName}' not found.");
                return;
            }
            _activeAnim = animName;
            _time       = 0f;
            _playing    = true;
        }

        public void Stop()  { _playing = false; }
        public void Resume() { _playing = true; }
        public void SeekTo(float time) { _time = time; }

        public float GetTime()     => _time;
        public bool  IsPlaying()   => _playing;
        public string GetAnimation() => _activeAnim;

        // ── Internal helpers ───────────────────────────────────────────────────
        private void CacheChildren(Transform root)
        {
            foreach (Transform child in root.GetComponentsInChildren<Transform>(true))
            {
                string n = child.name;
                if (!_transforms.ContainsKey(n)) _transforms[n] = child;
                var sr = child.GetComponent<SpriteRenderer>();
                if (sr != null && !_renderers.ContainsKey(n)) _renderers[n] = sr;
            }
        }

        private void ApplyAnimation(string animName, float time, float dur)
        {
            if (!_controllers.TryGetValue(animName, out ControllerData[] ctrls)) return;

            // Accumulate deltas per part
            var deltas = new Dictionary<string, PartDelta>();
            foreach (var p in _partBases)
            {
                deltas[p.Key] = new PartDelta
                {
                    x       = p.Value.baseX,
                    y       = p.Value.baseY,
                    rot     = p.Value.baseRot,
                    scaleX  = p.Value.baseScaleX,
                    scaleY  = p.Value.baseScaleY,
                    opacity = p.Value.opacity,
                };
            }

            foreach (var c in ctrls)
            {
                if (!deltas.TryGetValue(c.partName, out PartDelta d)) continue;
                float val = EvaluateController(c, time, dur);

                // Apply per-controller min/max clamp on the delta, matching web evaluator:
                //   tv = base + val; if (min != max) tv = clamp(base + min, base + max, tv)
                //   → val itself is clamped to [minDelta, maxDelta] when constrained.
                bool constrained = !Mathf.Approximately(c.minDelta, c.maxDelta);
                if (constrained) val = Mathf.Clamp(val, c.minDelta, c.maxDelta);

                // val is a delta — add it onto whatever the current accumulated value is,
                // matching the web evaluator: tform[property] = currentValue + evaluatedDelta
                switch (c.property)
                {
                    case "x":       d.x       += val; break;
                    case "y":       d.y       += val; break;
                    case "rotation":d.rot     += val; break;
                    case "scaleX":  d.scaleX  += val; break;
                    case "scaleY":  d.scaleY  += val; break;
                    case "opacity": d.opacity  = Mathf.Clamp01(d.opacity + val); break;
                }
                deltas[c.partName] = d;
            }

            // Apply to Unity transforms
            foreach (var kv in deltas)
            {
                if (!_transforms.TryGetValue(kv.Key, out Transform t)) continue;
                var d = kv.Value;
                // NStep uses a Y-down canvas; Unity uses Y-up — flip Y
                t.localPosition = new Vector3(d.x * 0.01f, -d.y * 0.01f, t.localPosition.z);
                t.localRotation = Quaternion.Euler(0f, 0f, -d.rot);
                t.localScale    = new Vector3(d.scaleX, d.scaleY, 1f);

                if (_renderers.TryGetValue(kv.Key, out SpriteRenderer sr))
                {
                    var col = sr.color;
                    col.a = d.opacity;
                    sr.color = col;
                }
            }
        }

        // ── Formula evaluator — parity with evaluateController.ts ─────────────
        private static float EvaluateController(ControllerData c, float time, float dur)
        {
            if (c.mode == ControllerMode.Keyframe && c.keyframes != null && c.keyframes.Length > 0)
                return InterpolateKeyframes(c.keyframes, time, dur);

            float t   = time * c.speed + c.phase;
            float n   = ((t % 1f) + 1f) % 1f;
            float TAU = Mathf.PI * 2f;

            switch (c.preset)
            {
                case "sine":
                case "breathingY":
                case "swayRotation":
                case "tailWag":        return Mathf.Sin(t * TAU) * c.amplitude + c.offset;

                case "hoverFloat":
                {
                    float up = (Mathf.Sin(t * TAU) + 1f) / 2f;
                    return (EaseInOut(up) * 2f - 1f) * c.amplitude + c.offset;
                }
                case "bobPosition":    return (Mathf.Abs(Mathf.Sin(t * Mathf.PI)) * 2f - 1f) * c.amplitude + c.offset;

                case "walkCycle":      return Mathf.Sin(t * TAU) * c.amplitude + c.offset;
                case "runCycle":
                {
                    float s = Mathf.Sin(t * TAU);
                    return Mathf.Sign(s) * Mathf.Pow(Mathf.Abs(s), 0.7f) * c.amplitude + c.offset;
                }
                case "runLean":        return (c.offset == 0f ? c.amplitude * 0.12f : c.offset);
                case "legCycle":       return (Mathf.Sin(t * TAU) - 0.15f * Mathf.Sin(t * TAU * 2f)) * c.amplitude + c.offset;
                case "armSwing":       return -Mathf.Sin(t * TAU) * c.amplitude + c.offset;

                case "weaponSwing":
                {
                    if (n < 0.3f) return -c.amplitude + c.amplitude * 2f * (n / 0.3f) + c.offset;
                    if (n < 0.5f) return c.amplitude - c.amplitude * ((n - 0.3f) / 0.2f) + c.offset;
                    return -c.amplitude * 0.5f + c.amplitude * 0.5f * ((n - 0.5f) / 0.5f) + c.offset;
                }
                case "capeLag":        return Mathf.Sin(t * TAU - 0.6f) * c.amplitude + c.offset;
                case "staffSway":      return (Mathf.Sin(t * TAU) * 0.7f + Mathf.Sin(t * TAU * 1.3f + 0.5f) * 0.3f) * c.amplitude + c.offset;

                case "headBob":        return -Mathf.Abs(Mathf.Sin(t * TAU)) * c.amplitude + c.offset;
                case "clawTwitch":
                {
                    if (n < 0.08f) return c.offset + c.amplitude * (n / 0.08f);
                    if (n < 0.20f) return c.offset + c.amplitude * (1f - (n - 0.08f) / 0.12f);
                    if (n < 0.28f) return c.offset + c.amplitude * 0.4f * ((n - 0.20f) / 0.08f);
                    if (n < 0.36f) return c.offset + c.amplitude * 0.4f * (1f - (n - 0.28f) / 0.08f);
                    return c.offset;
                }
                case "squashStretch":  return 1f + Mathf.Sin(t * TAU) * c.amplitude + c.offset;
                case "breathScale":    return 1f + ((Mathf.Sin(t * TAU) + 1f) / 2f) * c.amplitude + c.offset;
                case "blinkScale":
                {
                    if (n > 0.9f && n < 0.93f)  return 0f;
                    if (n >= 0.93f && n < 0.96f) return (n - 0.93f) / 0.03f;
                    return 1f;
                }
                case "recoil":
                {
                    if (n < 0.12f) return -c.amplitude * Smoothstep(n / 0.12f) + c.offset;
                    if (n < 0.45f) return -c.amplitude * (1f - Smoothstep((n - 0.12f) / 0.33f)) + c.offset;
                    return c.offset;
                }
                case "impactShake":    return Mathf.Sin(t * TAU * 7f) * c.amplitude * Mathf.Exp(-n * 5f) + c.offset;
                case "shieldBrace":    return c.offset != 0f ? c.offset : c.amplitude;
                case "deathFall":
                {
                    float nf = Mathf.Min(n * 1.5f, 1f);
                    return (1f - Mathf.Pow(1f - nf, 3f)) * c.amplitude + c.offset;
                }
                case "pulse":
                {
                    float p = (Mathf.Sin(t * TAU) + 1f) / 2f;
                    return (1f - c.amplitude) + p * c.amplitude + c.offset;
                }
                case "easeInOut":
                {
                    float cycle = (Mathf.Sin(t * TAU) + 1f) / 2f;
                    return (EaseInOut(cycle) * 2f - 1f) * c.amplitude + c.offset;
                }
                case "spring":
                {
                    float decay = Mathf.Exp(-n * 3f);
                    float osc   = Mathf.Cos(t * TAU * 2f);
                    return osc * c.amplitude * (1f - decay * 0.5f) + c.offset;
                }
                case "noise":
                {
                    float s1 = Mathf.Sin(t * 0.65f + 0f)      * 43758.5453f;
                    float s2 = Mathf.Sin(t * 1.35f + 22.173f) * 17341.9274f;
                    float s3 = Mathf.Sin(t * 0.45f + 80.5f)   * 28496.2847f;
                    float nv = ((s1 - Mathf.Floor(s1)) + (s2 - Mathf.Floor(s2)) + (s3 - Mathf.Floor(s3))) / 3f;
                    return (nv * 2f - 1f) * c.amplitude + c.offset;
                }
                case "jumpArc":        return -(4f * n * (1f - n)) * c.amplitude + c.offset;
                case "jumpRise":
                {
                    if (n < 0.35f) { return -Smoothstep(n / 0.35f) * c.amplitude + c.offset; }
                    return -(1f - Smoothstep((n - 0.35f) / 0.65f)) * c.amplitude + c.offset;
                }
                case "landSquash":
                {
                    if (n < 0.08f) return 1f - c.amplitude * Smoothstep(n / 0.08f) + c.offset;
                    if (n < 0.20f) return 1f - c.amplitude * (1f - Smoothstep((n - 0.08f) / 0.12f)) + c.offset;
                    if (n < 0.30f) return 1f + c.amplitude * 0.5f * Mathf.Sin((n - 0.2f) / 0.1f * Mathf.PI) + c.offset;
                    return 1f + c.offset;
                }
                case "jumpLegExtend":
                {
                    if (n < 0.5f) return c.amplitude * Smoothstep(n / 0.5f) + c.offset;
                    return c.amplitude * (1f - Mathf.Sin((n - 0.5f) / 0.5f * Mathf.PI)) + c.offset;
                }
                case "hitKnockback":
                {
                    float kick = Mathf.Exp(-n * 6f);
                    return Mathf.Sin(n * TAU * 0.5f) * c.amplitude * kick + c.offset;
                }
                case "hitFlash":
                {
                    float dim = Mathf.Max(0f, 1f - c.amplitude);
                    if (n < 0.10f) return 1f + c.offset;
                    if (n < 0.18f) return dim + c.offset;
                    if (n < 0.26f) return 1f + c.offset;
                    if (n < 0.34f) return dim + c.offset;
                    return 1f + c.offset;
                }
                case "hitStagger":     return Mathf.Sin(t * TAU * 5f) * c.amplitude * Mathf.Exp(-n * 4f) + c.offset;
                case "hitRebound":     return SpringDecay(n, 2f, 5f) * c.amplitude + c.offset;

                case "deathSlump":     return EaseInOut(Mathf.Min(n * 2f, 1f)) * c.amplitude + c.offset;
                case "deathDrop":      return n * n * c.amplitude + c.offset;
                case "deathFade":      return (1f - Smoothstep(n)) * c.amplitude + c.offset;
                case "deathTwitch":
                {
                    if (n > 0.6f) return c.offset;
                    return Mathf.Sin(t * TAU * 8f) * Mathf.Exp(-n * 5f) * c.amplitude + c.offset;
                }
                case "idleShift":
                {
                    float shift = Mathf.Sin(t * TAU) * 0.4f + Mathf.Sin(t * TAU * 0.37f + 1.1f) * 0.6f;
                    return shift * c.amplitude + c.offset;
                }
                case "wobbleOut":      return SpringDecay(n * 2f, 3f, 4f) * c.amplitude + c.offset;

                default:               return Mathf.Sin(t * TAU) * c.amplitude + c.offset;
            }
        }

        private static float SpringDecay(float t, float freq, float decay) =>
            Mathf.Exp(-t * decay) * Mathf.Cos(t * Mathf.PI * 2f * freq);

        private static float InterpolateKeyframes(KeyframeData[] kfs, float time, float dur)
        {
            if (kfs.Length == 0) return 0f;
            Array.Sort(kfs, (a, b) => a.time.CompareTo(b.time));
            if (time <= kfs[0].time) return kfs[0].value;
            if (time >= kfs[kfs.Length - 1].time) return kfs[kfs.Length - 1].value;
            int lo = 0, hi = kfs.Length - 1;
            for (int i = 0; i < kfs.Length - 1; i++)
            {
                if (kfs[i].time <= time && kfs[i + 1].time >= time) { lo = i; hi = i + 1; break; }
            }
            float span = kfs[hi].time - kfs[lo].time;
            if (span <= 0f) return kfs[lo].value;
            float t = (time - kfs[lo].time) / span;

            // Bezier easing
            if (kfs[lo].easing == "bezier" && kfs[lo].hasTangents)
            {
                float bt = SolveBezierT(kfs[lo].cp1x, kfs[lo].cp2x, t);
                float by = CubicBezier1D(bt, 0f, kfs[lo].cp1y, kfs[lo].cp2y, 1f);
                return kfs[lo].value + (kfs[hi].value - kfs[lo].value) * by;
            }
            switch (kfs[lo].easing)
            {
                case "step":
                    return t < 1f ? kfs[lo].value : kfs[hi].value;
                case "easeInOut":
                    return Mathf.Lerp(kfs[lo].value, kfs[hi].value, EaseInOut(t));
                case "spring":
                {
                    float s      = kfs[lo].value + (kfs[hi].value - kfs[lo].value) * t;
                    float bounce = Mathf.Sin(t * Mathf.PI * 3f) * Mathf.Exp(-t * 4f)
                                   * (kfs[hi].value - kfs[lo].value) * 0.15f;
                    return s + bounce;
                }
                default:
                    return Mathf.Lerp(kfs[lo].value, kfs[hi].value, t);
            }
        }

        private static float CubicBezier1D(float t, float p0, float p1, float p2, float p3)
        {
            float u = 1f - t;
            return u*u*u*p0 + 3f*u*u*t*p1 + 3f*u*t*t*p2 + t*t*t*p3;
        }

        private static float SolveBezierT(float cp1x, float cp2x, float targetX)
        {
            float lo = 0f, hi = 1f;
            for (int i = 0; i < 24; i++)
            {
                float mid = (lo + hi) * 0.5f;
                if (CubicBezier1D(mid, 0f, cp1x, cp2x, 1f) < targetX) lo = mid; else hi = mid;
            }
            return (lo + hi) * 0.5f;
        }

        private static float EaseInOut(float t) => t < 0.5f ? 2f * t * t : -1f + (4f - 2f * t) * t;
        private static float Smoothstep(float x) { float c = Mathf.Clamp01(x); return c * c * (3f - 2f * c); }

        // ── Data types ─────────────────────────────────────────────────────────
        private enum ControllerMode { Formula, Keyframe }

        [Serializable]
        private struct PartBase
        {
            public float baseX, baseY, baseRot, baseScaleX, baseScaleY, opacity;
        }

        private struct PartDelta
        {
            public float x, y, rot, scaleX, scaleY, opacity;
        }

        [Serializable]
        private struct KeyframeData
        {
            public float  time, value;
            public string easing;
            public bool   hasTangents;
            public float  cp1x, cp1y, cp2x, cp2y;
        }

        [Serializable]
        private struct ControllerData
        {
            public string           partName;
            public string           property;
            public string           preset;
            public float            speed, amplitude, phase, offset;
            public float            minDelta, maxDelta;   // == c.params.min / c.params.max (0 = unconstrained when equal)
            public ControllerMode   mode;
            public KeyframeData[]   keyframes;
        }
    }
}
`;
}

function sanitizeIdent(s: string): string {
  return s.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^([0-9])/, '_$1') || '_part';
}

function buildPartBases(project: CharacterProject): string {
  return (project.parts as any[]).map(p => {
    const sx = (p.baseScaleX ?? 1).toFixed(4);
    const sy = (p.baseScaleY ?? 1).toFixed(4);
    const op = (p.opacity ?? 1).toFixed(4);
    return `            { "${p.name}", new PartBase { baseX=${(p.baseX??0).toFixed(2)}f, baseY=${(p.baseY??0).toFixed(2)}f, baseRot=${(p.baseRotation??0).toFixed(2)}f, baseScaleX=${sx}f, baseScaleY=${sy}f, opacity=${op}f } },`;
  }).join('\n');
}

function buildControllerEntry(c: any, partIdToName: Map<string, string>): string {
  const partName = partIdToName.get(c.targetPartId) ?? c.targetPartId;
  const mode = (c.mode === 'keyframe' && c.keyframes?.length > 0) ? 'ControllerMode.Keyframe' : 'ControllerMode.Formula';
  const kfs  = (c.mode === 'keyframe' && c.keyframes?.length > 0)
    ? `new KeyframeData[] { ${c.keyframes.map((k: any) => {
        const hasTangents = k.easing === 'bezier' && k.tangentOut && k.tangentIn;
        const cp1x = hasTangents ? (k.tangentOut.x as number).toFixed(4) : '0';
        const cp1y = hasTangents ? (k.tangentOut.y as number).toFixed(4) : '0';
        const cp2x = hasTangents ? (k.tangentIn.x  as number).toFixed(4) : '0';
        const cp2y = hasTangents ? (k.tangentIn.y  as number).toFixed(4) : '0';
        return `new KeyframeData { time=${(k.time as number).toFixed(4)}f, value=${(k.value as number).toFixed(4)}f, easing="${k.easing}", hasTangents=${hasTangents ? 'true' : 'false'}, cp1x=${cp1x}f, cp1y=${cp1y}f, cp2x=${cp2x}f, cp2y=${cp2y}f }`;
      }).join(', ')} }`
    : 'null';
  const minD = (c.params.min ?? 0).toFixed(4);
  const maxD = (c.params.max ?? 0).toFixed(4);
  return `new ControllerData { partName="${partName}", property="${c.property}", preset="${c.formulaPreset}", speed=${(c.params.speed??1).toFixed(4)}f, amplitude=${(c.params.amplitude??0).toFixed(4)}f, phase=${(c.params.phase??0).toFixed(4)}f, offset=${(c.params.offset??0).toFixed(4)}f, minDelta=${minD}f, maxDelta=${maxD}f, mode=${mode}, keyframes=${kfs} }`;
}
