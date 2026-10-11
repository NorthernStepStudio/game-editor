import { h, clear, btn, action, toast } from './ui.js';
import { APP_STYLES, BRAND, MARKS, STYLES, attributeIcon, construction, logo, logoPreference, setLogoPreference, svgText } from './brand.js';

/** What each word of the motto means inside Matterhorn. */
const MOTTO_MEANING = {
  Create: 'Describe an asset and it is built — Assets.',
  Orchestrate: 'Blender, Godot, Claude and local AI work as one — Studio.',
  Refine: 'Change it, check it, keep the best version — asset pages and Checks.',
  Further: 'Every approved change moves your game forward — My Game.',
};

const VERSIONS = [
  { id: 'primary-dark', label: 'Primary · dark', style: 'glacier', layout: 'lockup', ground: 'dark' },
  { id: 'primary-light', label: 'Primary · light', style: 'daylight', layout: 'lockup', ground: 'light' },
  { id: 'icon', label: 'App icon', style: 'tile', layout: 'tile', ground: 'light' },
  { id: 'mono-dark', label: 'Monochrome · dark', style: 'frost', layout: 'lockup', ground: 'dark', tagline: false },
  { id: 'mono-light', label: 'Monochrome · light', style: 'ink', layout: 'lockup', ground: 'light', tagline: false },
  { id: 'icon-light', label: 'Icon (light)', style: 'glacier', layout: 'mark', ground: 'dark' },
  { id: 'icon-mono', label: 'Icon (mono)', style: 'frost', layout: 'mark', ground: 'dark' },
  { id: 'row', label: 'Horizontal', style: 'glacier', layout: 'row', ground: 'dark' },
];

export function renderBrand(host) {
  const pref = logoPreference();
  const markId = pref.mark;

  clear(host,
    h('section', { class: 'brand-hero', 'aria-label': 'Matterhorn logo' },
      h('div', { class: 'brand-hero-logo' }, logo(markId, 'glacier', { layout: 'lockup', tagline: true })),
      h('ul', { class: 'motto', 'aria-label': 'Motto' }, BRAND.motto.map((word) => h('li', {}, word.toUpperCase())))),

    h('section', { class: 'card', 'aria-labelledby': 'brand-use' },
      h('h2', { id: 'brand-use' }, 'Logo in the app'),
      h('p', { class: 'muted' }, 'Your choice shows in the sidebar and the browser tab right away. It is saved in this browser.'),
      h('span', { class: 'label' }, 'Design'),
      h('div', { class: 'choice-grid', role: 'radiogroup', 'aria-label': 'Logo design' },
        Object.entries(MARKS).map(([id, mark]) => choiceCard(
          id === markId, `${mark.label}`, mark.note, logo(id, 'glacier', { layout: 'mark' }),
          () => { setLogoPreference({ mark: id }); toast(`Logo design: ${mark.label}.`); renderBrand(host); }))),
      h('span', { class: 'label' }, 'Style'),
      h('div', { class: 'choice-grid', role: 'radiogroup', 'aria-label': 'Logo style' },
        APP_STYLES.map((style) => choiceCard(
          style.id === pref.style, style.label, style.note,
          style.id === 'tile' ? logo(markId, 'tile', { layout: 'tile' }) : logo(markId, style.id, { layout: 'row', tagline: pref.tagline }),
          () => { setLogoPreference({ style: style.id }); toast(`Logo style: ${style.label}.`); renderBrand(host); }))),
      h('label', { class: 'check', for: 'brand-tagline' },
        h('input', { id: 'brand-tagline', type: 'checkbox', checked: pref.tagline, onchange: (e) => {
          setLogoPreference({ tagline: e.target.checked });
          toast(e.target.checked ? 'Tagline shown.' : 'Tagline hidden.');
          renderBrand(host);
        } }),
        h('span', {}, `Show the tagline “${BRAND.tagline}”`)),
      btn('Reset to default', () => { setLogoPreference({ mark: 'circuit', style: 'glacier', tagline: true }); toast('Logo reset.'); renderBrand(host); }, 'quiet')),

    h('section', { class: 'card', 'aria-labelledby': 'brand-meaning' },
      h('h2', { id: 'brand-meaning' }, 'What it means'),
      h('p', {}, `${BRAND.name} — ${BRAND.tagline.toLowerCase()}. A mountain you climb one checked step at a time: you bring the idea, Matterhorn does the climbing, and you stay in control at the summit.`),
      h('div', { class: 'attributes' }, BRAND.attributes.map((a) => h('div', { class: 'attribute' },
        attributeIcon(a.id), h('div', {}, h('strong', {}, a.label), h('p', { class: 'muted small' }, a.means))))),
      h('h3', {}, 'Create · Orchestrate · Refine · Further'),
      h('dl', { class: 'motto-meaning' }, BRAND.motto.map((word) => [h('dt', {}, word), h('dd', {}, MOTTO_MEANING[word])]))),

    h('section', { class: 'card', 'aria-labelledby': 'brand-versions' },
      h('h2', { id: 'brand-versions' }, `All versions · ${MARKS[markId].label}`),
      h('p', { class: 'muted' }, 'Download any version as SVG (sharp at any size) or PNG (1024 px).'),
      h('div', { class: 'version-grid' }, VERSIONS.map((v) => versionCard(markId, v)))),

    h('section', { class: 'card', 'aria-labelledby': 'brand-construction' },
      h('h2', { id: 'brand-construction' }, 'Construction'),
      h('p', { class: 'muted' }, 'Peaks sit on a 20-unit grid; the summit and its glow sit on the inner circle, the base on the outer one.'),
      h('div', { class: 'construction' }, construction(markId))),
  );
}

function choiceCard(active, title, note, preview, onPick) {
  return h('button', {
    type: 'button', class: `choice${active ? ' active' : ''}`, role: 'radio', 'aria-checked': active ? 'true' : 'false', onclick: onPick,
  }, h('span', { class: 'choice-preview' }, preview), h('strong', {}, title), h('span', { class: 'muted small' }, note));
}

function versionCard(markId, version) {
  const make = () => logo(markId, version.style, { layout: version.layout, tagline: version.tagline !== false });
  const name = `matterhorn-${markId}-${version.id}`;
  return h('figure', { class: `version-card ${version.ground}` },
    h('div', { class: 'version-art' }, make()),
    h('figcaption', {},
      h('span', {}, version.label),
      h('span', { class: 'row' },
        btn('SVG', () => saveFile(`${name}.svg`, new Blob([svgText(make())], { type: 'image/svg+xml' })), 'small quiet'),
        action('PNG', async () => saveFile(`${name}.png`, await toPng(make(), version.ground)), 'small quiet'))));
}

function saveFile(name, blob) {
  const url = URL.createObjectURL(blob);
  const link = h('a', { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast(`Saved ${name}.`);
}

function toPng(svg, ground) {
  const [, , w, hgt] = svg.getAttribute('viewBox').split(' ').map(Number);
  const scale = 1024 / Math.max(w, hgt);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(hgt * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('This browser cannot make PNG files.'));
      if (ground === 'dark' && !svg.querySelector('rect')) {
        ctx.fillStyle = STYLES.glacier.ground;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not create the PNG.'))), 'image/png');
    };
    image.onerror = () => reject(new Error('Could not draw the logo.'));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText(svg))}`;
  });
}
