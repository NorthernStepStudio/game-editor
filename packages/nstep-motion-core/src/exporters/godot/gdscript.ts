import type { CharacterProject } from '../../schema/types.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function animVarName(name: string): string {
  return name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() || 'anim';
}

function partVarName(name: string): string {
  return name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase().replace(/^(\d)/, '_$1') || 'part';
}

function formulaToGD(preset: string, params: any, tVar: string): string {
  const s   = params.speed?.toFixed(4)     ?? '1.0';
  const a   = params.amplitude?.toFixed(4) ?? '0.0';
  const ph  = params.phase?.toFixed(4)     ?? '0.0';
  const off = params.offset?.toFixed(4)    ?? '0.0';
  const t   = `(${tVar} * ${s} + ${ph})`;

  switch (preset) {
    case 'sine':
    case 'breathingY':
    case 'swayRotation':
    case 'walkCycle':
    case 'runCycle':
    case 'legCycle':
    case 'armSwing':
    case 'capeLag':
    case 'tailWag':
    case 'idleShift':
    case 'hoverFloat':
    case 'easeInOut':
    case 'staffSway':
      return `sin(${t} * TAU) * ${a} + ${off}`;

    case 'headBob':
      return `-abs(sin(${t} * TAU)) * ${a} + ${off}`;

    case 'bobPosition':
      return `(abs(sin(${t} * PI)) * 2.0 - 1.0) * ${a} + ${off}`;

    case 'runLean':
      return off;

    case 'squashStretch':
    case 'breathScale':
    case 'blinkScale':
      return `1.0 + sin(${t} * TAU) * ${a} + ${off}`;

    case 'impactShake':
      return `sin(${t} * TAU * 7.0) * ${a} * exp(-fmod(${t}, 1.0) * 5.0) + ${off}`;

    case 'spring':
      return `cos(${t} * TAU * 2.0) * ${a} * exp(-fmod(${t}, 1.0) * 1.5) + ${off}`;

    case 'noise':
      return `(sin(${t} * 1.3) * 0.5 + sin(${t} * 2.7) * 0.3 + sin(${t} * 0.9) * 0.2) * ${a} + ${off}`;

    case 'jumpArc': {
      const n = `fmod(${t}, 1.0)`;
      return `(-4.0 * ${n} * (1.0 - ${n})) * ${a} + ${off}`;
    }

    case 'jumpRise': {
      const n = `fmod(${t}, 1.0)`;
      return `(-(1.0 - ${n}) * step(${n}, 0.35) - (${n} - 0.35) / 0.65 * step(0.35, ${n})) * ${a} + ${off}`;
    }

    case 'landSquash': {
      const n = `fmod(${t}, 1.0)`;
      return `(1.0 - clamp(${n} / 0.08, 0.0, 1.0) * ${a}) + ${off}`;
    }

    case 'hitKnockback': {
      const n = `fmod(${t}, 1.0)`;
      return `sin(${n} * TAU * 0.5) * ${a} * exp(-${n} * 6.0) + ${off}`;
    }

    case 'hitFlash':
      return `(1.0 - step(fmod(${t}, 1.0), 0.05) + step(fmod(${t}, 1.0), 0.12)) * ${a} + ${off}`;

    case 'hitStagger': {
      const n = `fmod(${t}, 1.0)`;
      return `sin(${t} * TAU * 5.0) * ${a} * exp(-${n} * 4.0) + ${off}`;
    }

    case 'hitRebound': {
      const n = `fmod(${t}, 1.0)`;
      return `exp(-${n} * 5.0) * cos(${t} * TAU * 2.0) * ${a} + ${off}`;
    }

    case 'deathSlump': {
      const n = `min(fmod(${t}, 1.0) * 2.0, 1.0)`;
      return `(${n} * ${n} * (3.0 - 2.0 * ${n})) * ${a} + ${off}`;
    }

    case 'deathDrop': {
      const n = `min(fmod(${t}, 1.0), 1.0)`;
      return `${n} * ${n} * ${a} + ${off}`;
    }

    case 'deathFade': {
      const n = `min(fmod(${t}, 1.0), 1.0)`;
      return `(1.0 - ${n} * ${n} * (3.0 - 2.0 * ${n})) * ${a} + ${off}`;
    }

    case 'deathFall': {
      const n = `min(fmod(${t}, 1.0) * 1.5, 1.0)`;
      return `(1.0 - pow(1.0 - ${n}, 3.0)) * ${a} + ${off}`;
    }

    case 'deathTwitch': {
      const n = `fmod(${t}, 1.0)`;
      return `sin(${t} * TAU * 8.0) * ${a} * exp(-${n} * 5.0) * step(${n}, 0.6) + ${off}`;
    }

    case 'wobbleOut': {
      const n = `min(fmod(${t}, 1.0) * 2.0, 1.0)`;
      return `exp(-${n} * 4.0) * cos(${t} * TAU * 3.0) * ${a} + ${off}`;
    }

    case 'pulse':
      return `((sin(${t} * TAU) + 1.0) * 0.5) * ${a} + ${off}`;

    default:
      return `sin(${t} * TAU) * ${a} + ${off}`;
  }
}

function keyframesToGD(keyframes: any[], tVar: string): string {
  if (!keyframes || keyframes.length === 0) return '0.0';
  if (keyframes.length === 1) return keyframes[0].value.toFixed(4);
  const sorted = [...keyframes].sort((a, b) => a.time - b.time);
  const arr = sorted.map(k => `[${k.time.toFixed(4)}, ${k.value.toFixed(4)}]`).join(', ');
  return `_kf_lerp([${arr}], ${tVar})`;
}

// ── Animation Tree helper (BlendSpace1D + crossfade) ─────────────────────────

function emitAnimationTree(project: CharacterProject, lines: string[]): void {
  const hasBlends    = !!project.blendConfigs?.length;
  const hasCrossfade = project.animations.some(a => (a as any).crossfadeDuration > 0);
  if (!hasBlends && !hasCrossfade) return;

  lines.push(``);
  lines.push(`# ══════════════════════════════════════════════════════════════════════`);
  lines.push(`# AnimationTree — Blending & Crossfade`);
  lines.push(`# Requires: AnimationPlayer node named "AnimationPlayer" as sibling.`);
  lines.push(`# ══════════════════════════════════════════════════════════════════════`);
  lines.push(``);

  // ── Export vars for each blend weight ──────────────────────────────────────
  if (hasBlends) {
    project.blendConfigs!.forEach((bc) => {
      const animA = project.animations.find(a => a.id === bc.animAId);
      const animB = project.animations.find(a => a.id === bc.animBId);
      const nameA = animA ? animVarName(animA.name) : 'unknown_a';
      const nameB = animB ? animVarName(animB.name) : 'unknown_b';
      const varName = `blend_weight_${nameA}_${nameB}`;
      lines.push(`@export_range(0.0, 1.0, 0.01) var ${varName}: float = ${bc.weight.toFixed(2)}`);
    });
    lines.push(``);
  }

  // ── @onready refs ───────────────────────────────────────────────────────────
  lines.push(`@onready var _anim_player: AnimationPlayer = $AnimationPlayer`);
  if (hasBlends) {
    project.blendConfigs!.forEach((_bc, i) => {
      lines.push(`@onready var _anim_tree_${i}: AnimationTree = _setup_blend_tree_${i}()`);
    });
  }
  if (hasCrossfade) {
    lines.push(`var _xfade_tween: Tween = null`);
  }
  lines.push(``);

  // ── _setup_blend_tree_N functions ───────────────────────────────────────────
  if (hasBlends) {
    project.blendConfigs!.forEach((bc, i) => {
      const animA = project.animations.find(a => a.id === bc.animAId);
      const animB = project.animations.find(a => a.id === bc.animBId);
      const nameA = animA ? animVarName(animA.name) : 'unknown_a';
      const nameB = animB ? animVarName(animB.name) : 'unknown_b';
      const varName = `blend_weight_${nameA}_${nameB}`;

      lines.push(`func _setup_blend_tree_${i}() -> AnimationTree:`);
      lines.push(`\tvar tree := AnimationTree.new()`);
      lines.push(`\ttree.anim_player = tree.get_path_to(_anim_player)`);
      lines.push(`\tvar space := AnimationNodeBlendSpace1D.new()`);
      lines.push(`\tvar node_a := AnimationNodeAnimation.new()`);
      lines.push(`\tvar node_b := AnimationNodeAnimation.new()`);
      lines.push(`\tnode_a.animation = "${animA?.name ?? nameA}"`);
      lines.push(`\tnode_b.animation = "${animB?.name ?? nameB}"`);
      lines.push(`\tspace.add_blend_point(node_a, 0.0)`);
      lines.push(`\tspace.add_blend_point(node_b, 1.0)`);
      lines.push(`\ttree.tree_root = space`);
      lines.push(`\ttree.active = true`);
      lines.push(`\tadd_child(tree)`);
      lines.push(`\treturn tree`);
      lines.push(``);

      // Setter helper for runtime blend control
      lines.push(`func set_blend_${nameA}_${nameB}(w: float) -> void:`);
      lines.push(`\t${varName} = clamp(w, 0.0, 1.0)`);
      lines.push(`\t_anim_tree_${i}["parameters/BlendSpace1D/blend_position"] = ${varName}`);
      lines.push(``);

      // _process integration
      lines.push(`# In _process, apply the blend position (call this or inline it):`);
      lines.push(`# _anim_tree_${i}["parameters/BlendSpace1D/blend_position"] = ${varName}`);
      lines.push(``);
    });
  }

  // ── Crossfade helper ────────────────────────────────────────────────────────
  if (hasCrossfade) {
    lines.push(`# crossfade_to: smoothly transitions to a named animation over 'duration' seconds.`);
    lines.push(`# Requires an AnimationNodeStateMachine or AnimationNodeBlend2 named "Crossfader"`);
    lines.push(`# connected in an AnimationTree.`);
    lines.push(`func crossfade_to(anim_name: String, duration: float) -> void:`);
    lines.push(`\tif _xfade_tween:`);
    lines.push(`\t\t_xfade_tween.kill()`);
    lines.push(`\t_anim_player.play(anim_name)`);
    lines.push(`\tvar crossfader_path := NodePath("Crossfader")`);
    lines.push(`\tvar has_tree := has_node("AnimationTree")`);
    lines.push(`\tif has_tree:`);
    lines.push(`\t\tvar anim_tree: AnimationTree = get_node("AnimationTree")`);
    lines.push(`\t\tanim_tree["parameters/Transition/transition_request"] = anim_name`);
    lines.push(`\t\tanim_tree["parameters/BlendAmount/blend_amount"] = 0.0`);
    lines.push(`\t\t_xfade_tween = create_tween()`);
    lines.push(`\t\t_xfade_tween.tween_property(`);
    lines.push(`\t\t\tanim_tree, "parameters/BlendAmount/blend_amount", 1.0, duration`);
    lines.push(`\t\t)`);
    lines.push(``);

    // Per-animation crossfade convenience calls
    project.animations.forEach(a => {
      const xf = (a as any).crossfadeDuration;
      if (!xf || xf <= 0) return;
      const vn = animVarName(a.name);
      lines.push(`func crossfade_to_${vn}() -> void:`);
      lines.push(`\tcrossfade_to("${a.name}", ${(xf as number).toFixed(3)})`);
      lines.push(``);
    });
  }
}

// ── Main exporter ─────────────────────────────────────────────────────────────

export function exportToGDScript(project: CharacterProject): string {
  const lines: string[] = [
    `# Generated by NStep Code Motion`,
    `# Project: ${project.name}`,
    `# Export includes: ${project.animations.length} animation(s), ${project.parts.length} part(s)`,
    ...(project.blendConfigs?.length ? [`# Blend configs: ${project.blendConfigs.length}`] : []),
    `extends Node2D`,
    ``,
    `const TAU := PI * 2.0`,
    ``,
  ];

  // Collect unique event names across all animations for signal declarations
  const allEventNames = new Set<string>();
  project.animations.forEach(anim => {
    ((anim as any).events ?? []).forEach((ev: any) => allEventNames.add(ev.name));
  });
  if (allEventNames.size > 0) {
    lines.push(`# Timeline event signals`);
    allEventNames.forEach(name => {
      const sigName = name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1') || 'event';
      lines.push(`signal ${sigName}(name: String, string_value: String, int_value: int, float_value: float)`);
    });
    lines.push('');
  }

  // Per-animation timer variables
  project.animations.forEach(anim => {
    const vn = animVarName(anim.name);
    lines.push(`var ${vn}_time: float = 0.0`);
    lines.push(`var ${vn}_playing: bool = ${anim.loop ? 'true' : 'false'}`);
    const events: any[] = (anim as any).events ?? [];
    if (events.length > 0) {
      lines.push(`var _${vn}_prev_time: float = -1.0`);
    }
  });
  lines.push('');

  // _ready
  lines.push(`func _ready() -> void:`);
  project.animations.forEach(anim => {
    if (!anim.loop) {
      const vn = animVarName(anim.name);
      lines.push(`\t# Call play_${vn}() to trigger this one-shot animation`);
    }
  });
  if (project.animations.every(a => !a.loop)) lines.push(`\tpass`);
  lines.push('');

  // _process
  lines.push(`func _process(delta: float) -> void:`);
  project.animations.forEach(anim => {
    const vn = animVarName(anim.name);
    lines.push(`\tif ${vn}_playing:`);
    lines.push(`\t\t_apply_${vn}(delta)`);
  });
  lines.push('');

  // Play helpers for one-shot anims
  project.animations.filter(a => !a.loop).forEach(anim => {
    const vn = animVarName(anim.name);
    lines.push(`func play_${vn}() -> void:`);
    lines.push(`\t${vn}_time = 0.0`);
    lines.push(`\t_${vn}_prev_time = -1.0`);
    lines.push(`\t${vn}_playing = true`);
    lines.push('');
  });

  // Per-animation apply functions
  project.animations.forEach(anim => {
    const vn  = animVarName(anim.name);
    const dur = (anim.duration || 1).toFixed(4);

    const animEvents: any[] = (anim as any).events ?? [];

    lines.push(`func _apply_${vn}(delta: float) -> void:`);
    if (anim.loop) {
      lines.push(`\t${vn}_time = fmod(${vn}_time + delta, ${dur})`);
    } else {
      lines.push(`\t${vn}_time += delta`);
      lines.push(`\tif ${vn}_time >= ${dur}:`);
      lines.push(`\t\t${vn}_time = ${dur}`);
      lines.push(`\t\t${vn}_playing = false`);
    }
    lines.push(`\tvar t: float = ${vn}_time`);
    lines.push('');

    // Emit signals for events crossed this frame
    if (animEvents.length > 0) {
      lines.push(`\t# Timeline events`);
      lines.push(`\tif _${vn}_prev_time >= 0.0:`);
      animEvents.forEach((ev: any) => {
        const sigName = ev.name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1') || 'event';
        const sv = JSON.stringify(ev.stringValue ?? '');
        const iv = Math.round(ev.intValue ?? 0);
        const fv = (ev.floatValue ?? 0).toFixed(4);
        if (anim.loop) {
          lines.push(`\t\tif (_${vn}_prev_time < ${ev.time.toFixed(4)} and t >= ${ev.time.toFixed(4)}) or (_${vn}_prev_time > t and (t >= ${ev.time.toFixed(4)} or _${vn}_prev_time < ${ev.time.toFixed(4)})):`);
        } else {
          lines.push(`\t\tif _${vn}_prev_time < ${ev.time.toFixed(4)} and t >= ${ev.time.toFixed(4)}:`);
        }
        lines.push(`\t\t\temit_signal("${sigName}", "${ev.name}", ${sv}, ${iv}, ${fv})`);
      });
      lines.push(`\t_${vn}_prev_time = t`);
      lines.push('');
    }

    // Group enabled controllers by part
    const byPart = new Map<string, any[]>();
    (anim.controllers as any[]).forEach(c => {
      if (!c.enabled) return;
      if (!byPart.has(c.targetPartId)) byPart.set(c.targetPartId, []);
      byPart.get(c.targetPartId)!.push(c);
    });

    if (byPart.size === 0) {
      lines.push(`\tpass`);
    }

    byPart.forEach((ctrls, partId) => {
      const part = project.parts.find(p => p.id === partId);
      if (!part) return;
      const pv = partVarName(part.name);

      lines.push(`\tvar ${pv} := get_node_or_null("${part.name}")`);
      lines.push(`\tif ${pv}:`);

      ctrls.forEach(c => {
        let expr: string;
        if (c.mode === 'keyframe' && c.keyframes?.length > 0) {
          expr = keyframesToGD(c.keyframes, 't');
        } else {
          expr = formulaToGD(c.formulaPreset, c.params, 't');
        }

        const base = (
          c.property === 'x'       ? (part.baseX ?? 0) :
          c.property === 'y'       ? (part.baseY ?? 0) :
          c.property === 'rotation'? (part.baseRotation ?? 0) :
          c.property === 'scaleX'  ? (part.baseScaleX ?? 1) :
          c.property === 'scaleY'  ? (part.baseScaleY ?? 1) :
          c.property === 'zIndex'  ? (part.zIndex ?? 0) :
          c.property === 'color'   ? 0 :
          /* opacity */               (part.opacity ?? 1)
        ).toFixed(4);

        switch (c.property) {
          case 'x':        lines.push(`\t\t${pv}.position.x = ${base} + (${expr})`); break;
          case 'y':        lines.push(`\t\t${pv}.position.y = ${base} + (${expr})`); break;
          case 'rotation': lines.push(`\t\t${pv}.rotation_degrees = ${base} + (${expr})`); break;
          case 'scaleX':   lines.push(`\t\t${pv}.scale.x = ${base} + (${expr})`); break;
          case 'scaleY':   lines.push(`\t\t${pv}.scale.y = ${base} + (${expr})`); break;
          case 'opacity':  lines.push(`\t\t${pv}.modulate.a = clamp(${base} + (${expr}), 0.0, 1.0)`); break;
          case 'zIndex':   lines.push(`\t\t${pv}.z_index = roundi(${base} + (${expr}))`); break;
          case 'color': {
            const tc = (part as any).tintColor || '#ff0000';
            const hex = tc.replace('#', '');
            const tr = (parseInt(hex.slice(0,2),16)/255).toFixed(3);
            const tg = (parseInt(hex.slice(2,4),16)/255).toFixed(3);
            const tb = (parseInt(hex.slice(4,6),16)/255).toFixed(3);
            const infl = `clamp(${expr}, 0.0, 1.0)`;
            lines.push(`\t\t${pv}.modulate.r = lerp(1.0, ${tr}, ${infl})`);
            lines.push(`\t\t${pv}.modulate.g = lerp(1.0, ${tg}, ${infl})`);
            lines.push(`\t\t${pv}.modulate.b = lerp(1.0, ${tb}, ${infl})`);
            break;
          }
        }
      });

      // Frame animation
      const fa = (part as any).frameAnimation;
      if (fa?.frameCount) {
        lines.push(`\t\t# Frame animation`);
        lines.push(`\t\tif ${pv} is AnimatedSprite2D:`);
        lines.push(`\t\t\t${pv}.frame = (int(t * ${fa.fps}.0) + ${fa.startFrame ?? 0}) % ${fa.frameCount}`);
      }

      // IK chain note
      const ik = (part as any).ikChain;
      if (ik?.targetPartId) {
        const tp = project.parts.find(p => p.id === ik.targetPartId);
        lines.push(`\t\t# IK: Use SkeletonModification2DTwoBoneIK targeting "${tp?.name ?? 'target'}"`);
      }

      // Constraint note
      const con = (part as any).constraint;
      if (con?.type && con.type !== 'none') {
        lines.push(`\t\t# Constraint (${con.type}): Use SkeletonModification2DLookAt or LimitRotation`);
      }

      lines.push('');
    });

    lines.push('');
  });

  // Keyframe lerp helper (always included, only used when needed)
  const hasKeyframes = project.animations.some(a =>
    (a.controllers as any[]).some(c => c.mode === 'keyframe' && c.keyframes?.length > 0)
  );

  if (hasKeyframes) {
    lines.push(`# Keyframe interpolation helper`);
    lines.push(`func _kf_lerp(keyframes: Array, time: float) -> float:`);
    lines.push(`\tif keyframes.is_empty(): return 0.0`);
    lines.push(`\tif time <= keyframes[0][0]: return keyframes[0][1]`);
    lines.push(`\tif time >= keyframes[-1][0]: return keyframes[-1][1]`);
    lines.push(`\tfor i in range(keyframes.size() - 1):`);
    lines.push(`\t\tif time >= keyframes[i][0] and time <= keyframes[i + 1][0]:`);
    lines.push(`\t\t\tvar tt: float = (time - keyframes[i][0]) / (keyframes[i + 1][0] - keyframes[i][0])`);
    lines.push(`\t\t\treturn lerp(keyframes[i][1], keyframes[i + 1][1], tt)`);
    lines.push(`\treturn keyframes[-1][1]`);
  }

  // AnimationTree / BlendSpace1D section
  emitAnimationTree(project, lines);

  return lines.join('\n');
}
