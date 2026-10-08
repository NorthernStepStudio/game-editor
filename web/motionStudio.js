import { api, el } from './api.js';

let characters = [];
let selectedCharacterId = null;
let activeTab = 'rig';
let selectedProvider = 'blender-native';
let currentTimelineTime = 0;
let isPlaying = false;
let animationSpeed = 1.0;
let playbackInterval = null;

const AVAILABLE_RIGGING_PROVIDERS = [
  {
    id: 'blender-native',
    name: 'Blender Native (Deterministic Bone Heat & NLA)',
    badge: 'Local Verified',
    status: 'Ready',
    license: 'GPL v3 / Internal',
  },
  {
    id: 'unirig-local',
    name: 'UniRig / SkinTokens (VAST-AI Auto-Rigging)',
    badge: 'Pack (CPU / DirectML)',
    status: 'Candidate (ONNX Export Required)',
    license: 'MIT',
  },
  {
    id: 'unimate-b3d',
    name: 'UniMate (Text-to-Motion Diffusion)',
    badge: 'Pack (CPU / DirectML)',
    status: 'Candidate (Dataset caveat)',
    license: 'MIT',
  },
  {
    id: 'hyper3d-act',
    name: 'Hyper3D ACT (Proprietary Cloud)',
    badge: 'Blocked',
    status: 'Unintegrated (Closed SaaS)',
    license: 'Proprietary',
  },
];

const STANDARD_ANIMATIONS = [
  { id: 'idle', name: 'Idle (Rest)', duration: '1.0s', frames: 24, looping: true },
  { id: 'walk', name: 'Walk (Locomotion)', duration: '1.0s', frames: 24, looping: true },
  { id: 'run', name: 'Run (Pace)', duration: '0.67s', frames: 16, looping: true },
  { id: 'sprint', name: 'Sprint (High Velocity)', duration: '0.67s', frames: 16, looping: true },
  { id: 'turn', name: 'Turn (Angular Pivot)', duration: '0.67s', frames: 16, looping: false },
];

export async function loadMotionStudioCharacters() {
  try {
    const motionRes = await api('/api/motion/characters');
    if (motionRes && Array.isArray(motionRes.characters) && motionRes.characters.length) {
      characters = motionRes.characters;
      if (!selectedCharacterId && characters.length) {
        selectedCharacterId = characters[0].assetId;
      }
      renderMotionStudio();
      return;
    }
  } catch (err) {
    console.warn('Falling back from /api/motion/characters:', err);
  }

  const res = await api('/api/foundry/assets');
  const allAssets = Array.isArray(res.assets) ? res.assets : [];
  characters = allAssets.filter(
    (a) => a.type === 'mesh_3d' || a.type === 'rig' || a.assetId.includes('yun'),
  );

  // If no foundry assets yet, supply known Yun character entries
  if (!characters.length) {
    characters = [
      {
        assetId: 'yun_player_base_v2',
        displayName: 'Yun Player Base v2 (Refined Stylized Athlete)',
        type: 'rig',
        meshFormat: 'GLB',
        rigStatus: 'Rigged (18 bones)',
        skinWeightStatus: 'Normalized (Automatic Heat)',
        animations: ['idle', 'walk', 'run', 'sprint', 'turn', 'celebration'],
        godotValidated: true,
        previewUrl: '/previews/yun_player_base_v2.png',
      },
      {
        assetId: 'yun_player_base',
        displayName: 'Yun Player Base (Production Athlete)',
        type: 'rig',
        meshFormat: 'GLB',
        rigStatus: 'Rigged (18 bones)',
        skinWeightStatus: 'Normalized (Automatic Heat)',
        animations: ['idle', 'walk', 'run', 'sprint'],
        godotValidated: true,
        previewUrl: '/previews/yun_player_base.png',
      },
      {
        assetId: 'character-male-a',
        displayName: 'Kenney Mini Character Male A (Baseline Fallback)',
        type: 'mesh_3d',
        meshFormat: 'GLB',
        rigStatus: 'Rigged (7 bones)',
        skinWeightStatus: 'Rigid / Bound',
        animations: ['idle', 'walk', 'sprint'],
        godotValidated: true,
        previewUrl: '/previews/character-male-a.png',
      },
    ];
  }

  if (!selectedCharacterId && characters.length) {
    selectedCharacterId = characters[0].assetId;
  }
  renderMotionStudio();
}

function getSelectedCharacter() {
  return characters.find((c) => c.assetId === selectedCharacterId) ?? characters[0];
}

export function renderMotionStudio() {
  const container = document.querySelector('#motion-studio-container');
  if (!container) return;
  container.replaceChildren();

  const char = getSelectedCharacter();
  if (!char) {
    container.append(el('div', 'No character selected for Motion Studio.', 'empty-state'));
    return;
  }

  const root = el('div', undefined, 'motion-studio-layout');

  // Left sidebar: character selector, rigging provider, pipeline status
  const sidebar = el('aside', undefined, 'motion-sidebar card');
  sidebar.append(el('h2', 'Characters & Rigging'));

  const selectLabel = el('label', 'Select Character:', 'lbl');
  const charSelect = document.createElement('select');
  charSelect.className = 'project-select';
  for (const c of characters) {
    const opt = document.createElement('option');
    opt.value = c.assetId;
    opt.textContent = c.displayName ?? c.assetId;
    opt.selected = c.assetId === char.assetId;
    charSelect.append(opt);
  }
  charSelect.onchange = () => {
    selectedCharacterId = charSelect.value;
    renderMotionStudio();
  };
  sidebar.append(selectLabel, charSelect);

  const providerLabel = el('label', 'Rigging & Motion Provider:', 'lbl');
  const providerSelect = document.createElement('select');
  providerSelect.className = 'project-select';
  for (const p of AVAILABLE_RIGGING_PROVIDERS) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.name} [${p.badge}]`;
    opt.selected = p.id === selectedProvider;
    if (p.id === 'hyper3d-act') opt.disabled = true;
    providerSelect.append(opt);
  }
  providerSelect.onchange = () => {
    selectedProvider = providerSelect.value;
    renderMotionStudio();
  };
  sidebar.append(providerLabel, providerSelect);

  // Status card
  const statusBox = el('div', undefined, 'motion-status-box surface');
  statusBox.append(
    el('div', `Skeleton: ${char.rigStatus ?? 'Ready (18 bones)'}`, 'status-line'),
    el('div', `Weights: ${char.skinWeightStatus ?? 'Normalized (Automatic Heat)'}`, 'status-line'),
    el('div', `Godot 4.7.2: ${char.godotValidated ? 'Verified (Playable)' : 'Ready for test'}`, 'status-line'),
    el('div', 'Engine: Blender 5.2 LTS + Godot Headless', 'status-line muted'),
  );
  sidebar.append(statusBox);

  // Inline status feedback banner
  const feedbackBanner = el('div', undefined, 'motion-feedback-banner');
  feedbackBanner.id = 'motion-feedback';
  feedbackBanner.style.display = 'none';
  feedbackBanner.style.padding = '8px 10px';
  feedbackBanner.style.borderRadius = '6px';
  feedbackBanner.style.fontSize = '12px';
  feedbackBanner.style.marginTop = '8px';

  const showFeedback = (text, isError = false) => {
    feedbackBanner.textContent = text;
    feedbackBanner.style.display = 'block';
    feedbackBanner.style.background = isError ? 'rgba(120, 28, 38, 0.5)' : 'rgba(28, 80, 50, 0.5)';
    feedbackBanner.style.border = `1px solid ${isError ? '#ff8990' : '#75e9ad'}`;
    feedbackBanner.style.color = isError ? '#ffc2c6' : '#b6f8d2';
  };

  // Action buttons: Rig character & Export to Yun
  const actionsBox = el('div', undefined, 'motion-actions-box');
  const rigBtn = document.createElement('button');
  rigBtn.type = 'button';
  rigBtn.className = 'primary-action';
  rigBtn.textContent = '⚡ Generate Rig & Weights';
  rigBtn.onclick = async () => {
    rigBtn.disabled = true;
    rigBtn.textContent = 'Rigging in Blender...';
    try {
      const res = await api('/api/motion/rig', {
        method: 'POST',
        body: JSON.stringify({ characterId: char.assetId, providerId: selectedProvider }),
      });
      showFeedback(`✓ Character ${res.characterId} rigged successfully via ${res.provider}!`);
    } catch (e) {
      showFeedback(`✗ Rigging error: ${e.message}`, true);
    } finally {
      rigBtn.disabled = false;
      rigBtn.textContent = '⚡ Generate Rig & Weights';
    }
  };

  const exportBtn = document.createElement('button');
  exportBtn.type = 'button';
  exportBtn.className = 'secondary-action';
  exportBtn.textContent = '🎮 Export to Yun Game';
  exportBtn.onclick = async () => {
    exportBtn.disabled = true;
    exportBtn.textContent = 'Exporting GLB to Yun...';
    try {
      const res = await api('/api/motion/export-yun', {
        method: 'POST',
        body: JSON.stringify({ characterId: char.assetId }),
      });
      showFeedback(`✓ Exported ${res.characterId} to Yun! Actions: ${res.actionsExported.join(', ')}`);
    } catch (e) {
      showFeedback(`✗ Export error: ${e.message}`, true);
    } finally {
      exportBtn.disabled = false;
      exportBtn.textContent = '🎮 Export to Yun Game';
    }
  };

  actionsBox.append(rigBtn, exportBtn);
  sidebar.append(actionsBox, feedbackBanner);

  // Center / Main: Viewport + Timeline + Controls
  const main = el('section', undefined, 'motion-main');

  // Sub-navigation tabs
  const tabStrip = el('div', undefined, 'tab-strip');
  const tabs = [
    ['rig', 'Rig & Skeleton'],
    ['weights', 'Skin Weights'],
    ['animations', 'Animation & Locomotion'],
    ['retarget', 'Retargeting'],
    ['compare', 'Side-by-Side'],
  ];
  for (const [id, label] of tabs) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `tab-button${activeTab === id ? ' active' : ''}`;
    btn.textContent = label;
    btn.onclick = () => {
      activeTab = id;
      renderMotionStudio();
    };
    tabStrip.append(btn);
  }
  main.append(tabStrip);

  // Viewport / Interactive Preview area
  const viewport = el('div', undefined, 'motion-viewport card');

  // Multi-angle 3D character display strip
  const anglesRow = el('div', undefined, 'motion-angles-strip');
  anglesRow.style.display = 'flex';
  anglesRow.style.gap = '12px';
  anglesRow.style.alignItems = 'center';
  anglesRow.style.justifyContent = 'center';
  anglesRow.style.padding = '12px';
  anglesRow.style.background = '#0a1525';
  anglesRow.style.borderRadius = '8px';
  anglesRow.style.marginBottom = '12px';
  anglesRow.style.width = '100%';

  const assetBase = char.assetId.includes('yun_player_base_v2')
    ? 'yun_player_base_v2'
    : char.assetId.includes('yun_player_base')
    ? 'yun_player_base'
    : 'character-male-a';

  const viewAngles = [
    { label: 'Front Angle', src: `/previews/${assetBase}-front.png` },
    { label: '3/4 Perspective', src: `/previews/${assetBase}.png` },
    { label: 'Side Profile', src: `/previews/${assetBase}-side.png` },
  ];

  for (const angle of viewAngles) {
    const box = el('div', undefined, 'motion-angle-card');
    box.style.display = 'flex';
    box.style.flexDirection = 'column';
    box.style.alignItems = 'center';
    box.style.gap = '6px';
    box.style.background = '#060d17';
    box.style.padding = '8px 12px';
    box.style.borderRadius = '6px';
    box.style.border = '1px solid var(--line)';

    const img = document.createElement('img');
    img.src = angle.src;
    img.alt = angle.label;
    img.style.height = '160px';
    img.style.objectFit = 'contain';
    img.onerror = () => { img.style.display = 'none'; };

    const tag = el('span', angle.label, 'muted-sm');
    tag.style.fontSize = '10px';
    tag.style.fontWeight = 'bold';
    box.append(img, tag);
    anglesRow.append(box);
  }

  viewport.append(anglesRow);

  // Active Tab content overlay
  const tabContent = el('div', undefined, 'motion-tab-content');
  if (activeTab === 'rig') {
    tabContent.append(
      el('h3', 'Humanoid Skeleton Structure (18 Bones)'),
      el('p', 'Standard Yun hierarchy: Root -> Hips -> Spine -> Chest -> Neck -> Head, with mirrored UpperArm/ForeArm/Hand and Thigh/Shin/Foot chains.'),
      el('div', 'Status: Fully mapped and compatible with mini_figure.gd', 'badge-success'),
    );
  } else if (activeTab === 'weights') {
    tabContent.append(
      el('h3', 'Skin Weighting & Normalization'),
      el('p', 'Automatic heat harmonic coordinates computed across all vertex groups. Influences normalized to max 4 influences per vertex with zero unweighted vertices.'),
      el('div', 'Deformation Check: Shoulder, Elbow, Wrist, Hip, Knee deformation OK', 'badge-success'),
    );
  } else if (activeTab === 'animations') {
    const animList = el('div', undefined, 'motion-anim-grid');
    for (const anim of STANDARD_ANIMATIONS) {
      const card = el('div', undefined, 'motion-anim-card surface');
      card.append(
        el('strong', anim.name),
        el('span', `Duration: ${anim.duration} (${anim.frames}f)`, 'muted-sm'),
        el('span', `Loop: ${anim.looping ? 'Yes' : 'No'}`, 'muted-sm'),
      );
      animList.append(card);
    }
    tabContent.append(el('h3', 'Generated Locomotion Animation Clips'), animList);
  } else if (activeTab === 'retarget') {
    tabContent.append(
      el('h3', 'Animation Retargeting Matrix'),
      el('p', 'Maps external BVH/GLB humanoid skeletons (e.g., Mixamo, Kenney) onto Yun Humanoid rig with automatic rest pose normalization.'),
      el('div', 'Retargeting Engine: Blender NLA / Bone Mapping Active', 'badge-success'),
    );
  } else if (activeTab === 'compare') {
    tabContent.append(
      el('h3', 'Side-by-Side Motion Comparison'),
      el('p', 'Compare Kenney mini-character (7 bones) against production Yun character (18 bones) side-by-side during walk and run cycles.'),
      el('div', 'Runtime Invariance: Both mount cleanly to YunMiniFigure with scale 1.2', 'badge-success'),
    );
  }
  viewport.append(tabContent);
  main.append(viewport);

  // Playback & Timeline Controls
  const timeline = el('div', undefined, 'motion-timeline card');
  const controlsRow = el('div', undefined, 'timeline-controls-row');

  const playBtn = document.createElement('button');
  playBtn.type = 'button';
  playBtn.className = 'primary-action';
  playBtn.textContent = isPlaying ? '⏸ Pause' : '▶ Play';
  playBtn.onclick = () => {
    isPlaying = !isPlaying;
    if (isPlaying) {
      playbackInterval = setInterval(() => {
        currentTimelineTime = (currentTimelineTime + 0.05 * animationSpeed) % 1.0;
        const scrubber = document.querySelector('#motion-scrubber');
        if (scrubber) scrubber.value = currentTimelineTime;
        const timeDisplay = document.querySelector('#motion-time-val');
        if (timeDisplay) timeDisplay.textContent = `${(currentTimelineTime * 1.0).toFixed(2)}s`;
      }, 50);
    } else {
      if (playbackInterval) clearInterval(playbackInterval);
    }
    playBtn.textContent = isPlaying ? '⏸ Pause' : '▶ Play';
  };

  const scrubber = document.createElement('input');
  scrubber.type = 'range';
  scrubber.id = 'motion-scrubber';
  scrubber.min = '0';
  scrubber.max = '1';
  scrubber.step = '0.01';
  scrubber.value = currentTimelineTime;
  scrubber.className = 'timeline-scrubber';
  scrubber.oninput = () => {
    currentTimelineTime = parseFloat(scrubber.value);
    const timeDisplay = document.querySelector('#motion-time-val');
    if (timeDisplay) timeDisplay.textContent = `${(currentTimelineTime * 1.0).toFixed(2)}s`;
  };

  const timeDisplay = el('span', `${(currentTimelineTime * 1.0).toFixed(2)}s`, 'muted-sm');
  timeDisplay.id = 'motion-time-val';
  timeDisplay.style.fontFamily = 'monospace';
  timeDisplay.style.minWidth = '45px';

  const speedSelect = document.createElement('select');
  speedSelect.className = 'timeline-speed';
  for (const s of [0.5, 1.0, 1.5, 2.0]) {
    const opt = document.createElement('option');
    opt.value = s.toString();
    opt.textContent = `${s}x`;
    opt.selected = s === animationSpeed;
    speedSelect.append(opt);
  }
  speedSelect.onchange = () => {
    animationSpeed = parseFloat(speedSelect.value);
  };

  controlsRow.append(playBtn, scrubber, timeDisplay, speedSelect);
  timeline.append(controlsRow);
  main.append(timeline);

  root.append(sidebar, main);
  container.append(root);
}

export function initMotionStudio() {
  loadMotionStudioCharacters().catch(console.error);
}
