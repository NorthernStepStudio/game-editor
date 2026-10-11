/**
 * Matterhorn brand: two marks from the brand boards — Summit (faceted peaks) and
 * Circuit (peaks with circuit traces and nodes) — with the wordmark, tagline and
 * every variation. Drawn as SVG (sharp at any size, downloadable) using DOM APIs
 * only, so the page's Content-Security-Policy stays strict.
 */

const NS = 'http://www.w3.org/2000/svg';

export const BRAND = {
  name: 'MATTERHORN',
  tagline: 'IDEAS UNDER CONTROL',
  motto: ['Create', 'Orchestrate', 'Refine', 'Further'],
  attributes: [
    { id: 'precise', label: 'Precise', means: 'Clean, exact facets — every asset and change is checked before Matterhorn calls it done.' },
    { id: 'orchestrated', label: 'Orchestrated', means: 'Layered peaks — many specialists (Blender, Godot, Claude, local AI) working as one.' },
    { id: 'technical', label: 'Technical', means: 'Built on a construction grid; in Circuit, real wiring inside the mountain — real tools, real evidence.' },
    { id: 'forward', label: 'Forward-moving', means: 'The rising blue blade — your ideas climbing from a description to a finished game.' },
    { id: 'control', label: 'Creative AI control center', means: 'The glow at the summit — you stay in control; Matterhorn does the climbing.' },
  ],
};

/**
 * Mark geometry on a 120×80 grid, back to front. `role` picks the paint:
 * blade = the rising blue, ice = the bright summit, flank = background peak,
 * deep = the dark inner facet, core = the light inner peak.
 */
export const MARKS = {
  summit: {
    label: 'Summit', note: 'Faceted peaks: a rising blue blade, an icy summit and a dark inner facet.',
    glow: { cx: 58, cy: 22, rx: 26, ry: 22 },
    shapes: [
      { role: 'flank', points: '76,74 96,40 118,74', dir: 'down' },
      { role: 'ice', points: '58,4 104,74 84,74 60,30', dir: 'down' },
      { role: 'deep', points: '30,74 46,46 62,74', dir: 'up' },
      { role: 'blade', points: '8,74 58,4 67,17 28,74', dir: 'up' },
    ],
    traces: [],
    nodes: [],
  },
  circuit: {
    label: 'Circuit', note: 'The mountain with its wiring showing: the AI pathways that connect your tools.',
    glow: { cx: 60, cy: 18, rx: 22, ry: 18 },
    shapes: [
      { role: 'blade', points: '2,74 32,28 56,74', dir: 'up' },
      { role: 'blade', points: '64,74 88,28 118,74', dir: 'up' },
      { role: 'ice', points: '22,74 60,2 98,74', dir: 'down' },
      { role: 'deep', points: '34,74 60,26 86,74', dir: 'up' },
      { role: 'core', points: '47,74 60,51 73,74', dir: 'down' },
    ],
    traces: ['M60 16 V32', 'M60 32 L45 49 V74', 'M60 32 L75 49 V74'],
    nodes: [{ x: 60, y: 15, r: 3.6 }, { x: 45, y: 49, r: 2.6 }, { x: 75, y: 49, r: 2.6 }],
  },
};

/** Paint per style: [from, to] gradient stops for each role, plus traces, nodes and text. */
export const STYLES = {
  glacier: {
    label: 'Glacier', note: 'Blue and ice on dark — the main logo.', ground: '#0B1220',
    blade: ['#1E5BFF', '#7CC0FF'], ice: ['#F4F9FF', '#8CC4FF'], flank: ['#DCE6F2', '#8FA3BD'],
    deep: ['#16305E', '#0B1730'], core: ['#EAF3FF', '#9FD0FF'],
    trace: '#7FC0FF', node: '#E6F2FF', glow: '#6FB7FF', word: '#F3F7FC', tag: '#7FB2FF',
  },
  daylight: {
    label: 'Daylight', note: 'For light backgrounds — documents, store pages, slides.', ground: '#F4F6FA',
    blade: ['#1E5BFF', '#5AA8FF'], ice: ['#0E1A33', '#24406E'], flank: ['#2A3F66', '#0E1A33'],
    deep: ['#0B1220', '#1A2A4A'], core: ['#5AA8FF', '#1E5BFF'],
    trace: '#9FD0FF', node: '#FFFFFF', word: '#0B1220', tag: '#2A5BD7',
  },
  frost: {
    label: 'Monochrome', note: 'One quiet color on dark — photos, video, splash screens.', ground: '#0B1220',
    blade: ['#E8EEF7', '#B9C6D8'], ice: ['#FFFFFF', '#D7E0EC'], flank: ['#9FB0C8', '#7D8CA3'],
    deep: ['#3F4C60', '#2A3444'], core: ['#FFFFFF', '#C9D6E6'],
    trace: '#D7E0EC', node: '#FFFFFF', word: '#FFFFFF', tag: '#C9D6E6',
  },
  ink: {
    label: 'Ink', note: 'One color on light — print, stamps, merch.', ground: '#F4F6FA',
    blade: ['#2A2E35', '#0E1014'], ice: ['#16181C', '#2C3038'], flank: ['#5A5F68', '#3C4048'],
    deep: ['#F4F6FA', '#DDE2EA'], core: ['#16181C', '#2C3038'],
    trace: '#F4F6FA', node: '#F4F6FA', word: '#0E1014', tag: '#3C4048',
  },
};

/** What the app itself shows in the sidebar (dark), and in the browser tab. */
export const APP_STYLES = [
  { id: 'glacier', label: 'Glacier', note: 'Blue and ice — the main logo.' },
  { id: 'frost', label: 'Monochrome', note: 'Quiet white version.' },
  { id: 'tile', label: 'App icon', note: 'The rounded icon tile.' },
];

const PREF = 'matterhorn.logo';

export function logoPreference() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(PREF) ?? '{}') ?? {};
  } catch {
    saved = {};
  }
  return {
    mark: MARKS[saved.mark] ? saved.mark : 'circuit',
    style: APP_STYLES.some((s) => s.id === saved.style) ? saved.style : 'glacier',
    tagline: saved.tagline !== false,
  };
}

export function setLogoPreference(patch) {
  const next = { ...logoPreference(), ...patch };
  try {
    localStorage.setItem(PREF, JSON.stringify(next));
  } catch {
    // Storage can be unavailable (private windows); the choice then lasts for this page.
  }
  window.dispatchEvent(new window.CustomEvent('matterhorn-logo', { detail: next }));
  return next;
}

let uid = 0;

function el(tag, attrs = {}, ...children) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) node.setAttribute(k, String(v));
  for (const child of children) if (child) node.append(child);
  return node;
}

function gradient(id, [from, to], dir) {
  const coords = dir === 'up' ? { x1: 0, y1: 1, x2: 0.6, y2: 0 } : { x1: 0, y1: 0, x2: 1, y2: 1 };
  return el('linearGradient', { id, ...coords },
    el('stop', { offset: '0', 'stop-color': from }),
    el('stop', { offset: '1', 'stop-color': to }));
}

/** The mark alone as a <g> on the 120×80 grid. */
function markGroup(markId, styleId, defs, prefix) {
  const mark = MARKS[markId] ?? MARKS.circuit;
  const paint = STYLES[styleId] ?? STYLES.glacier;
  const g = el('g');
  if (paint.glow) {
    const glowId = `${prefix}-glow`;
    defs.append(el('radialGradient', { id: glowId, cx: '0.5', cy: '0.5', r: '0.5' },
      el('stop', { offset: '0', 'stop-color': paint.glow, 'stop-opacity': '0.6' }),
      el('stop', { offset: '1', 'stop-color': paint.glow, 'stop-opacity': '0' })));
    g.append(el('ellipse', { ...mark.glow, fill: `url(#${glowId})` }));
  }
  mark.shapes.forEach((shape, index) => {
    const id = `${prefix}-s${index}`;
    defs.append(gradient(id, paint[shape.role], shape.dir));
    g.append(el('polygon', { points: shape.points, fill: `url(#${id})` }));
  });
  for (const d of mark.traces) {
    g.append(el('path', { d, fill: 'none', stroke: paint.trace, 'stroke-width': 1.7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  }
  for (const node of mark.nodes) {
    if (paint.glow) g.append(el('circle', { cx: node.x, cy: node.y, r: node.r * 2.2, fill: paint.glow, 'fill-opacity': 0.35 }));
    g.append(el('circle', { cx: node.x, cy: node.y, r: node.r, fill: paint.node, stroke: paint.trace, 'stroke-width': 1.2 }));
  }
  return g;
}

/**
 * Builds an <svg>.
 * layout: 'mark' (peaks only), 'lockup' (peaks over wordmark, optional tagline), 'row' (peaks beside wordmark), 'tile' (app icon).
 */
export function logo(markId = 'circuit', styleId = 'glacier', { layout = 'lockup', tagline = true, title = 'Matterhorn' } = {}) {
  const prefix = `mh${++uid}`;
  const defs = el('defs');
  const tile = layout === 'tile' || styleId === 'tile';
  const paint = STYLES[tile ? 'glacier' : styleId] ?? STYLES.glacier;
  const text = (value, x, y, size, anchor, fill, weight, spacing) => el('text', {
    x, y, 'text-anchor': anchor, fill, 'font-family': 'Segoe UI, system-ui, sans-serif',
    'font-weight': weight, 'font-size': size, 'letter-spacing': size * spacing,
  }, document.createTextNode(value));

  let svg;
  if (tile) {
    svg = el('svg', { viewBox: '0 0 120 120', role: 'img' });
    defs.append(el('linearGradient', { id: `${prefix}-tile`, x1: 0, y1: 0, x2: 0, y2: 1 },
      el('stop', { offset: '0', 'stop-color': '#16233A' }), el('stop', { offset: '1', 'stop-color': '#070D18' })));
    svg.append(defs, el('rect', { x: 2, y: 2, width: 116, height: 116, rx: 28, fill: `url(#${prefix}-tile)` }));
    const g = markGroup(markId, 'glacier', defs, prefix);
    g.setAttribute('transform', 'translate(15 30) scale(0.75)');
    svg.append(g);
  } else if (layout === 'mark') {
    svg = el('svg', { viewBox: '0 0 120 78', role: 'img' });
    svg.append(defs, markGroup(markId, styleId, defs, prefix));
  } else if (layout === 'row') {
    svg = el('svg', { viewBox: '0 0 400 80', role: 'img' });
    const g = markGroup(markId, styleId, defs, prefix);
    g.setAttribute('transform', 'translate(0 2) scale(0.95)');
    svg.append(defs, g,
      text(BRAND.name, 126, tagline ? 46 : 54, 26, 'start', paint.word, 600, 0.22),
      tagline ? text(BRAND.tagline, 128, 68, 9.5, 'start', paint.tag, 500, 0.42) : null);
  } else {
    svg = el('svg', { viewBox: `0 0 360 ${tagline ? 168 : 146}`, role: 'img' });
    const g = markGroup(markId, styleId, defs, prefix);
    g.setAttribute('transform', 'translate(109 0) scale(1.18)');
    svg.append(defs, g,
      text(BRAND.name, 182, 128, 30, 'middle', paint.word, 600, 0.22),
      tagline ? text(BRAND.tagline, 182, 156, 11, 'middle', paint.tag, 500, 0.42) : null);
  }
  svg.setAttribute('xmlns', NS);
  svg.setAttribute('aria-label', title);
  svg.prepend(el('title', {}, document.createTextNode(title)));
  return svg;
}

/** The construction drawing: the mark over its grid and circle guides. */
export function construction(markId = 'circuit') {
  const mark = MARKS[markId] ?? MARKS.circuit;
  const svg = el('svg', { viewBox: '0 0 240 160', role: 'img', 'aria-label': `${mark.label} construction grid` });
  svg.append(el('title', {}, document.createTextNode(`${mark.label} construction grid`)));
  const guide = { stroke: '#3A5276', 'stroke-width': 0.6, fill: 'none' };
  for (let x = 0; x <= 240; x += 20) svg.append(el('line', { x1: x, y1: 0, x2: x, y2: 160, ...guide, 'stroke-dasharray': '2 3' }));
  for (let y = 0; y <= 160; y += 20) svg.append(el('line', { x1: 0, y1: y, x2: 240, y2: y, ...guide, 'stroke-dasharray': '2 3' }));
  svg.append(el('circle', { cx: 120, cy: 70, r: 64, ...guide, stroke: '#4A8CFA' }));
  svg.append(el('circle', { cx: 120, cy: 46, r: 30, ...guide, stroke: '#4A8CFA' }));
  const g = el('g', { transform: 'translate(53 8) scale(1.12)' });
  for (const shape of mark.shapes) {
    g.append(el('polygon', { points: shape.points, fill: '#C9D6E6', 'fill-opacity': shape.role === 'deep' ? 0.18 : 0.4, stroke: '#E8EEF7', 'stroke-width': 0.6 }));
  }
  for (const d of mark.traces) g.append(el('path', { d, fill: 'none', stroke: '#E8EEF7', 'stroke-width': 0.9 }));
  for (const n of mark.nodes) g.append(el('circle', { cx: n.x, cy: n.y, r: n.r, fill: '#E8EEF7' }));
  svg.append(g);
  return svg;
}

/** Line icons for the five attributes, as on the board. */
export function attributeIcon(id) {
  const svg = el('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', class: 'attr-icon' });
  const s = { fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
  const paths = {
    precise: ['M12 3 3 20h18z', 'M12 3v17'],
    orchestrated: ['M12 3 3 8l9 5 9-5z', 'M3 12l9 5 9-5', 'M3 16l9 5 9-5'],
    technical: ['M12 4v4M12 16v4M4 12h4M16 12h4', 'M12 12m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0', 'M12 10.5l1.5 1.5-1.5 1.5-1.5-1.5z'],
    forward: ['M6 18 18 6', 'M9 6h9v9'],
    control: ['M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0'],
  }[id] ?? [];
  for (const d of paths) svg.append(el('path', { d, ...s }));
  return svg;
}

/** Serializes an SVG for download (fonts fall back to the viewer's sans-serif). */
export function svgText(svg) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new window.XMLSerializer().serializeToString(svg)}`;
}
