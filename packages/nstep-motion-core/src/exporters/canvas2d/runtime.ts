import type { CharacterProject } from '../../schema/types.js';

export interface Canvas2DExport {
  code: string;
}

export function exportToCanvas2D(project: CharacterProject): Canvas2DExport {
  const json = JSON.stringify(project, null, 2);
  const code = `// NStep Code Motion - Canvas2D Runtime Export
// Project: ${project.name}

const PROJECT_DATA = ${json};

function evaluateFormula(preset, time, speed, amplitude, phase, offset) {
  const t = time * speed + phase;
  switch (preset) {
    case 'breathingY':
    case 'bobPosition':
    case 'hoverFloat':
    case 'swayRotation':
    case 'walkCycle':
    case 'runCycle':
    case 'legCycle':
    case 'weaponSwing':
    case 'capeLag':
    case 'staffSway':
      return Math.sin(t * Math.PI * 2) * amplitude + offset;
    case 'runLean':
      return offset;
    default:
      return Math.sin(t * Math.PI * 2) * amplitude + offset;
  }
}

function renderProject(canvas, project, time) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const anim = project.animations[0];
  const transforms = {};
  project.parts.forEach(p => {
    transforms[p.id] = { x: p.baseX, y: p.baseY, rotation: p.baseRotation, scaleX: p.baseScaleX, scaleY: p.baseScaleY };
  });

  if (anim) {
    anim.controllers.forEach(c => {
      if (!c.enabled) return;
      const t = transforms[c.targetPartId];
      if (!t) return;
      const val = evaluateFormula(c.formulaPreset, time, c.params.speed, c.params.amplitude, c.params.phase, c.params.offset);
      t[c.property] = (t[c.property] || 0) + val;
    });
  }

  const partsMap = {};
  const childrenMap = {};
  const roots = [];
  project.parts.forEach(p => {
    partsMap[p.id] = p;
    if (!p.parentId) roots.push(p.id);
    else {
      if (!childrenMap[p.parentId]) childrenMap[p.parentId] = [];
      childrenMap[p.parentId].push(p.id);
    }
  });

  const matrices = {};
  const rootMatrix = new DOMMatrix().translate(canvas.width / 2, canvas.height / 2);

  function computeMatrix(partId, parentMatrix) {
    const t = transforms[partId];
    const part = partsMap[partId];
    const m = DOMMatrix.fromMatrix(parentMatrix);
    m.translateSelf(t.x, t.y);
    m.rotateSelf(t.rotation);
    m.scaleSelf(t.scaleX, t.scaleY);
    matrices[partId] = m;
    (childrenMap[partId] || []).forEach(k => computeMatrix(k, m));
  }
  roots.forEach(r => computeMatrix(r, rootMatrix));

  const sorted = [...project.parts].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  sorted.forEach(part => {
    const m = matrices[part.id];
    if (!m) return;
    ctx.save();
    ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    ctx.translate(-part.origin.x, -part.origin.y);
    ctx.fillStyle = part.color || '#4b5563';
    const w = part.origin.x * 2 || 40;
    const h = part.origin.y * 2 || 40;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  });
}

// Usage:
// const canvas = document.getElementById('canvas');
// let t = 0;
// function loop() { t += 1/60; renderProject(canvas, PROJECT_DATA, t); requestAnimationFrame(loop); }
// loop();
`;
  return { code };
}

export function exportStandaloneHTML(project: CharacterProject, code: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${project.name} - NStep Motion Demo</title>
  <style>
    body { margin: 0; background: #1a1a2e; display: flex; align-items: center; justify-content: center; height: 100vh; }
    canvas { border: 1px solid #333; background: #0f0f1a; }
  </style>
</head>
<body>
  <canvas id="canvas" width="600" height="400"></canvas>
  <script>
${code}

const canvas = document.getElementById('canvas');
let t = 0;
function loop() {
  t += 1/60;
  renderProject(canvas, PROJECT_DATA, t);
  requestAnimationFrame(loop);
}
loop();
  </script>
</body>
</html>`;
}
