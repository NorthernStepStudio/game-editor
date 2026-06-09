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

        // ── Formula evaluator ──────────────────────────────────────────────────
        private static float EvaluateController(ControllerData c, float time, float dur)
        {
            if (c.mode == ControllerMode.Keyframe && c.keyframes != null && c.keyframes.Length > 0)
                return InterpolateKeyframes(c.keyframes, time, dur);

            float t  = time * c.speed + c.phase;
            float n  = ((t % 1f) + 1f) % 1f;
            float TAU = Mathf.PI * 2f;

            switch (c.preset)
            {
                case "sine":           return Mathf.Sin(t * TAU) * c.amplitude + c.offset;
                case "breathingY":     return Mathf.Sin(t * TAU) * c.amplitude + c.offset;
                case "hoverFloat":
                {
                    float up = (Mathf.Sin(t * TAU) + 1f) / 2f;
                    float eased = EaseInOut(up);
                    return (eased * 2f - 1f) * c.amplitude + c.offset;
                }
                case "bobPosition":    return (Mathf.Abs(Mathf.Sin(t * Mathf.PI)) * 2f - 1f) * c.amplitude + c.offset;
                case "swayRotation":   return Mathf.Sin(t * TAU) * c.amplitude + c.offset;
                case "walkCycle":      return Mathf.Sin(t * TAU) * c.amplitude + c.offset;
                case "runCycle":
                {
                    float s = Mathf.Sin(t * TAU);
                    float snap = Mathf.Sign(s) * Mathf.Pow(Mathf.Abs(s), 0.7f);
                    return snap * c.amplitude + c.offset;
                }
                case "legCycle":
                {
                    float leg = Mathf.Sin(t * TAU) - 0.15f * Mathf.Sin(t * TAU * 2f);
                    return leg * c.amplitude + c.offset;
                }
                case "armSwing":       return -Mathf.Sin(t * TAU) * c.amplitude + c.offset;
                case "headBob":        return -Mathf.Abs(Mathf.Sin(t * TAU)) * c.amplitude + c.offset;
                case "tailWag":        return Mathf.Sin(t * TAU) * c.amplitude + c.offset;
                case "squashStretch":  return 1f + Mathf.Sin(t * TAU) * c.amplitude + c.offset;
                case "breathScale":    return 1f + ((Mathf.Sin(t * TAU) + 1f) / 2f) * c.amplitude + c.offset;
                case "noise":
                {
                    float nv = (Mathf.Sin(t * 1.3f) * 43758.5453f) % 1f;
                    return (nv * 2f - 1f) * c.amplitude + c.offset;
                }
                case "jumpArc":
                {
                    float arc = 4f * n * (1f - n);
                    return -arc * c.amplitude + c.offset;
                }
                case "recoil":
                {
                    if (n < 0.12f) return -c.amplitude * Smoothstep(n / 0.12f) + c.offset;
                    if (n < 0.45f) return -c.amplitude * (1f - Smoothstep((n - 0.12f) / 0.33f)) + c.offset;
                    return c.offset;
                }
                case "hitStagger":
                {
                    float decay = Mathf.Exp(-n * 4f);
                    return Mathf.Sin(t * TAU * 5f) * c.amplitude * decay + c.offset;
                }
                case "deathSlump":
                {
                    float sl = EaseInOut(Mathf.Min(n * 2f, 1f));
                    return sl * c.amplitude + c.offset;
                }
                case "deathFade":      return (1f - Smoothstep(n)) * c.amplitude + c.offset;
                case "pulse":          return (1f - c.amplitude) + ((Mathf.Sin(t * TAU) + 1f) / 2f) * c.amplitude + c.offset;
                case "easeInOut":
                {
                    float cycle = (Mathf.Sin(t * TAU) + 1f) / 2f;
                    return (EaseInOut(cycle) * 2f - 1f) * c.amplitude + c.offset;
                }
                default:               return Mathf.Sin(t * TAU) * c.amplitude + c.offset;
            }
        }

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
            return kfs[lo].easing switch
            {
                "step"      => t < 1f ? kfs[lo].value : kfs[hi].value,
                "easeInOut" => Mathf.Lerp(kfs[lo].value, kfs[hi].value, EaseInOut(t)),
                _           => Mathf.Lerp(kfs[lo].value, kfs[hi].value, t),
            };
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
            public float time, value;
            public string easing;
        }

        [Serializable]
        private struct ControllerData
        {
            public string           partName;
            public string           property;
            public string           preset;
            public float            speed, amplitude, phase, offset;
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
    ? `new KeyframeData[] { ${c.keyframes.map((k: any) => `new KeyframeData { time=${k.time.toFixed(4)}f, value=${k.value.toFixed(4)}f, easing="${k.easing}" }`).join(', ')} }`
    : 'null';
  return `new ControllerData { partName="${partName}", property="${c.property}", preset="${c.formulaPreset}", speed=${(c.params.speed??1).toFixed(4)}f, amplitude=${(c.params.amplitude??0).toFixed(4)}f, phase=${(c.params.phase??0).toFixed(4)}f, offset=${(c.params.offset??0).toFixed(4)}f, mode=${mode}, keyframes=${kfs} }`;
}
