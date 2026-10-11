import { api, el } from './api.js';

let activeCharacter = null;
let activeSession = null;
let eventSource = null;
let currentCameraView = 'front';
let currentDisplayMode = 'side-by-side';
let currentOverlayOpacity = 0.5;
let currentActiveTab = 'model3d'; // 'model3d' | 'refine' | 'motion' | 'art2d' | 'game-preview'
let selectedRightTab = 'compare'; // 'inspect' | 'compare' | 'correct' | 'history'
let annotations = [];
let activeAnnotationTool = null;
let isDrawerOpen = false;
let eventLog = [];
let liveTickInterval = null;
let lastPreviewTime = Date.now();
let isPartZoomEnabled = true;
let currentShadingMode = 'clay'; // 'clay' | 'wire'
let isGuidesVisible = true;
let isAnnotateExpanded = false;
let viewportResizeObserver = null;

const CAMERA_VIEWS = [
  { id: 'front', label: 'Front' },
  { id: 'side', label: 'Side' },
  { id: 'three_quarter', label: '3/4' },
  { id: 'back', label: 'Back' },
];

const DISPLAY_MODES = [
  { id: 'side-by-side', label: 'Split' },
  { id: 'overlay', label: 'Overlay' },
  { id: 'live-only', label: '3D Only' },
  { id: 'reference-only', label: '2D Ref' },
];

const SHADING_MODES = [
  { id: 'clay', label: 'Clay' },
  { id: 'wire', label: 'Wire' },
];

export const BODY_PARTS_PIPELINE = [
  {
    id: 'head',
    label: 'Head & Face',
    description: 'Skull shape, jawline, chin, eye sockets, and facial planes',
    icon: '👤',
    zoom: 1.0,
    yOffset: 0,
    guides: [
      { name: 'Hair Crest', top: 8, label: 'Hair Crest' },
      { name: 'Crown', top: 16, label: 'Crown (100%)' },
      { name: 'Forehead', top: 44, label: 'Forehead' },
      { name: 'Eyes', top: 54, label: 'Eye Line' },
      { name: 'Nose', top: 65, label: 'Nose Tip' },
      { name: 'Lips', top: 69, label: 'Lip Line' },
      { name: 'Chin', top: 79, label: 'Chin Baseline' },
    ],
  },
  {
    id: 'torso',
    label: 'Neck, Chest & Shoulders',
    description: 'Isolated upper torso chunk: cervical neck, clavicles, deltoids, and ribcage',
    icon: '🫁',
    zoom: 1.0,
    yOffset: 0,
    guides: [
      { name: 'Neck Top', top: 6, label: 'Neck Top (6%)' },
      { name: 'Throat', top: 10, label: 'Throat / Mid-Neck (10%)' },
      { name: 'Clavicles', top: 15, label: 'Clavicles (Collarbone) (15%)' },
      { name: 'Shoulders', top: 20, label: 'Shoulder Crest (20%)' },
      { name: 'Chest', top: 42, label: 'Chest / Pectoral Line (42%)' },
      { name: 'Ribcage', top: 67, label: 'Lower Ribcage (67%)' },
      { name: 'Abdomen', top: 88, label: 'Abdomen Base (88%)' },
    ],
  },
  {
    id: 'arms_hands',
    label: 'Arms & Hands',
    description: 'Biceps, sleeve cuffs, wrist angle, and clean finger topology',
    icon: '🧤',
    zoom: 1.6,
    yOffset: 42,
    guides: [
      { name: 'Elbows', top: 32, label: 'Elbows (52%)' },
      { name: 'Wrists', top: 64, label: 'Wrists (40%)' },
      { name: 'Hands', top: 86, label: 'Fingertips (32%)' },
    ],
  },
  {
    id: 'lower_body',
    label: 'Waist & Hips',
    description: 'Beltline, hip volume, waistband, and pelvic core drape',
    icon: '🩳',
    zoom: 1.7,
    yOffset: 54,
    guides: [
      { name: 'Belt', top: 14, label: 'Beltline (50%)' },
      { name: 'Hips', top: 42, label: 'Hips (44%)' },
      { name: 'Shorts', top: 76, label: 'Shorts Hem (38%)' },
    ],
  },
  {
    id: 'legs',
    label: 'Legs & Knees',
    description: 'Thigh alignment, knee joint height, and calf silhouette',
    icon: '🦵',
    zoom: 1.5,
    yOffset: 68,
    guides: [
      { name: 'Thighs', top: 22, label: 'Thighs (34%)' },
      { name: 'Knees', top: 50, label: 'Knees (26%)' },
      { name: 'Calves', top: 78, label: 'Calves (18%)' },
    ],
  },
  {
    id: 'footwear',
    label: 'Footwear & Shoes',
    description: 'Sneakers/boots silhouette, ankle cuffs, and ground baseline',
    icon: '👟',
    zoom: 2.2,
    yOffset: 90,
    guides: [
      { name: 'Ankles', top: 30, label: 'Ankles (20%)' },
      { name: 'Feet', top: 70, label: 'Foot Baseline (0%)' },
    ],
  },
  {
    id: 'hair',
    label: 'Hair & Headgear',
    description: 'Hairstyle volume chunks, silhouette contour, and bang placement',
    icon: '💇',
    zoom: 2.2,
    yOffset: 12,
    guides: [
      { name: 'Hair Crest', top: 8, label: 'Hair Crest (105%)' },
      { name: 'Crown', top: 24, label: 'Crown (100%)' },
      { name: 'Bangs', top: 48, label: 'Bang Clearance (87%)' },
      { name: 'Sides', top: 70, label: 'Side Taper (80%)' },
    ],
  },
  {
    id: 'clothing',
    label: 'Clothing & Gear',
    description: 'Jacket drape, crop top, cargo shorts, straps, and pouches',
    icon: '🧥',
    zoom: 1.8,
    yOffset: 32,
    guides: [
      { name: 'Collar', top: 12, label: 'Collar Line (74%)' },
      { name: 'Shoulders', top: 28, label: 'Shoulders (68%)' },
      { name: 'Chest', top: 52, label: 'Chest Drape (60%)' },
      { name: 'Waist', top: 82, label: 'Waistline (52%)' },
    ],
  },
  {
    id: 'full_assembly',
    label: 'Full Body Assembly',
    description: 'Integrated character mesh, rig hierarchy, and motion deformation',
    icon: '🧍',
    zoom: 1.0,
    yOffset: 50,
    guides: [
      { name: 'Crown', top: 5, label: 'Crown' },
      { name: 'Eyes', top: 16, label: 'Eye Line' },
      { name: 'Chin', top: 22, label: 'Chin' },
      { name: 'Shoulders', top: 27, label: 'Shoulders' },
      { name: 'Waist', top: 42, label: 'Waist' },
      { name: 'Hips', top: 52, label: 'Hips' },
      { name: 'Knees', top: 72, label: 'Knees' },
      { name: 'Feet', top: 98, label: 'Ground Baseline' },
    ],
  },
];

export async function initCharacterWorkbench(mode = 'model3d') {
  currentActiveTab = mode;
  await loadCharacterData();
  await loadActiveSession();
  setupLiveEventStream();
  renderWorkbench();
  startLiveClock();

  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', fitViewportBoxes);
    window.addEventListener('resize', fitViewportBoxes);
    if (window.ResizeObserver) {
      if (viewportResizeObserver) viewportResizeObserver.disconnect();
      viewportResizeObserver = new ResizeObserver(fitViewportBoxes);
      const stage = document.querySelector('#workbench-shell');
      if (stage) viewportResizeObserver.observe(stage);
    }
  }
}

export function setWorkbenchMode(mode) {
  currentActiveTab = mode;
  renderWorkbench();
}

async function loadCharacterData() {
  try {
    const res = await api('/api/characters/yun_urban_adventurer');
    if (res?.character) {
      activeCharacter = res.character;
      return;
    }
  } catch (err) {
    console.warn('Fallback character loading:', err);
  }

  // Robust fallback
  activeCharacter = {
    assetId: 'yun_urban_adventurer',
    displayName: 'Yun Urban Adventurer (Production Character)',
    type: 'character',
    meshFormat: 'GLB',
    rigStatus: 'Rigged (18 bones)',
    skinWeightStatus: 'Normalized (Clean Hierarchy)',
    animations: ['idle', 'walk', 'run', 'sprint', 'jump', 'turn'],
    godotValidated: true,
    previewUrl: '/previews/yun_3d_clay_front.png',
    referenceImages: {
      front: '/previews/yun_head_ref_front.png',
      side: '/previews/yun_head_ref_side.png',
      threeQuarter: '/previews/yun_head_ref_three_quarter.png',
      back: '/previews/yun_head_ref_back.png',
      aPose: '/previews/yun_urban_adventurer-a-pose.png',
      fullBodyFront: '/previews/yun_urban_adventurer-front.png',
      fullBodySide: '/previews/yun_urban_adventurer-side.png',
      fullBodyThreeQuarter: '/previews/yun_urban_adventurer-three-quarter.png',
      fullBodyBack: '/previews/yun_urban_adventurer-back.png',
    },
  };
}

async function loadActiveSession() {
  try {
    const res = await api('/api/live-sessions');
    if (res?.sessions?.length) {
      activeSession = res.sessions[0];
      annotations = [...(activeSession.annotations ?? [])];
      return;
    }
  } catch (err) {
    console.warn('Fallback session loading:', err);
  }

  activeSession = {
    sessionId: 'live-workbench-default',
    characterId: 'yun_urban_adventurer',
    characterRevision: 'mesh-v14',
    tool: 'blender',
    specialist: 'blender-specialist',
    stage: 'Neck, Chest & Shoulders',
    activePart: 'torso',
    completedParts: ['head'],
    status: 'waiting-for-review',
    progress: 88,
    previewUri: '/previews/yun_neck_chest_clay_front.png',
    checkpointId: 'neck-chest-polish-v1',
    canPause: true,
    canResume: false,
    canStop: true,
    canRetry: true,
    canRevert: true,
    lastMessage: 'Waiting for visual review on isolated Neck, Chest & Shoulders modular blockout',
    toolState: {
      connected: true,
      mode: 'live',
      processName: 'blender.exe',
      activeAction: 'Waiting for review',
    },
  };
}

function setupLiveEventStream() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }

  if (!activeSession?.sessionId) return;

  try {
    eventSource = new EventSource(`/api/live-sessions/${activeSession.sessionId}/events`);

    if (typeof eventSource.addEventListener === 'function') {
      eventSource.addEventListener('session-state', (e) => {
        try {
          const data = JSON.parse(e.data);
          activeSession = data;
          lastPreviewTime = Date.now();
          renderHeader();
          renderCenterPanel();
          renderRightPanel();
        } catch (err) {
          console.error('Error parsing session-state:', err);
        }
      });
      const eventTypes = [
        'tool-started', 'stage-changed', 'progress-updated', 'preview-updated',
        'render-completed', 'revision-created', 'waiting-for-review',
        'paused', 'resumed', 'approved', 'failed', 'stopped', 'corrected', 'reverted'
      ];

      for (const evtType of eventTypes) {
        eventSource.addEventListener(evtType, (e) => {
          try {
            const event = JSON.parse(e.data);
            eventLog.unshift(event);
            if (eventLog.length > 50) eventLog.pop();
            lastPreviewTime = Date.now();
            handleIncomingEvent(event);
          } catch (err) {
            console.error(`Error handling ${evtType}:`, err);
          }
        });
      }
    }

    eventSource.onerror = () => {
      // Reconnect silently handled by browser EventSource
    };
  } catch (err) {
    console.warn('Could not establish EventSource:', err);
  }
}

function handleIncomingEvent(event) {
  if (event.previewUri && activeSession) {
    activeSession = { ...activeSession, previewUri: event.previewUri };
  }
  if (event.revisionId && activeSession) {
    activeSession = { ...activeSession, characterRevision: event.revisionId, activeRevisionId: event.revisionId };
  }
  if (event.stage && activeSession) {
    activeSession = { ...activeSession, stage: event.stage };
  }
  if (event.type === 'paused' && activeSession) {
    activeSession = { ...activeSession, status: 'paused', canPause: false, canResume: true };
  }
  if (event.type === 'resumed' && activeSession) {
    activeSession = { ...activeSession, status: 'working', canPause: true, canResume: false };
  }
  if (event.type === 'waiting-for-review' && activeSession) {
    activeSession = { ...activeSession, status: 'waiting-for-review' };
  }

  renderHeader();
  renderCenterPanel();
  renderRightPanel();
  renderDrawer();
}

export function stopCharacterWorkbench() {
  if (liveTickInterval) {
    clearInterval(liveTickInterval);
    liveTickInterval = null;
  }
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  if (viewportResizeObserver) {
    viewportResizeObserver.disconnect();
    viewportResizeObserver = null;
  }
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', fitViewportBoxes);
  }
}

function startLiveClock() {
  if (liveTickInterval) clearInterval(liveTickInterval);
  liveTickInterval = setInterval(() => {
    const elapsedEl = document.querySelector('#workbench-elapsed-time');
    if (elapsedEl) {
      const sec = Math.max(0, Math.floor((Date.now() - lastPreviewTime) / 1000));
      elapsedEl.textContent = `${sec}s ago`;
    }
  }, 1000);
  if (typeof liveTickInterval?.unref === 'function') {
    liveTickInterval.unref();
  }
}

export function renderWorkbench() {
  const container = document.querySelector('#workbench-shell');
  if (!container) return;
  container.replaceChildren();

  // Top header status bar
  const header = el('header', undefined, 'workbench-topbar');
  header.id = 'workbench-header';
  container.append(header);

  // Character Local Navigation
  const localNav = el('nav', undefined, 'workbench-local-nav');
  const modes = [
    { id: 'characters', label: 'Characters', hash: '#create' },
    { id: 'art2d', label: '2D Art', hash: '#characters/yun_urban_adventurer/art2d' },
    { id: 'model3d', label: '3D Model', hash: '#characters/yun_urban_adventurer/model3d' },
    { id: 'refine', label: 'Form Refinement', hash: '#characters/yun_urban_adventurer/model3d/refine' },
    { id: 'motion', label: 'Rig & Motion', hash: '#characters/yun_urban_adventurer/motion' },
    { id: 'game-preview', label: 'Game Preview', hash: '#characters/yun_urban_adventurer/game-preview' },
  ];

  for (const m of modes) {
    const btn = el('a', m.label, `nav-pill-btn${currentActiveTab === m.id ? ' active' : ''}`);
    btn.href = m.hash;
    btn.onclick = (e) => {
      e.preventDefault();
      location.hash = m.hash;
      setWorkbenchMode(m.id);
    };
    localNav.append(btn);
  }
  container.append(localNav);

  // 3-Panel Main Workstation Layout
  const mainWorkspace = el('div', undefined, 'workbench-workspace-grid');

  // Left Panel
  const leftPanel = el('aside', undefined, 'workbench-panel workbench-left-panel wb-panel wb-left-panel');
  leftPanel.id = 'workbench-left-panel';
  mainWorkspace.append(leftPanel);

  // Center Panel (Dominant 60-70%)
  const centerPanel = el('main', undefined, 'workbench-panel workbench-center-panel wb-panel wb-center-panel');
  centerPanel.id = 'workbench-center-panel';
  mainWorkspace.append(centerPanel);

  // Right Panel
  const rightPanel = el('aside', undefined, 'workbench-panel workbench-right-panel wb-panel wb-right-panel');
  rightPanel.id = 'workbench-right-panel';
  mainWorkspace.append(rightPanel);

  container.append(mainWorkspace);

  // Bottom Drawer
  const bottomDrawer = el('div', undefined, 'workbench-bottom-drawer');
  bottomDrawer.id = 'workbench-bottom-drawer';
  container.append(bottomDrawer);

  renderHeader();
  renderLeftPanel();
  renderCenterPanel();
  renderRightPanel();
  renderDrawer();
}

function renderHeader() {
  const header = document.querySelector('#workbench-header');
  if (!header) return;
  header.replaceChildren();

  const activePart = activeSession?.activePart || 'head';
  const currentPartDef = BODY_PARTS_PIPELINE.find(p => p.id === activePart) || BODY_PARTS_PIPELINE[0];
  const partIdx = BODY_PARTS_PIPELINE.findIndex(p => p.id === activePart);
  const nextPartDef = partIdx >= 0 && partIdx < BODY_PARTS_PIPELINE.length - 1 ? BODY_PARTS_PIPELINE[partIdx + 1] : null;

  const leftGroup = el('div', undefined, 'wb-header-left');
  const title = el('h2', activeCharacter?.displayName ?? 'Yun Urban Adventurer', 'wb-character-title');
  const partBadge = el('span', `${currentPartDef.icon} ${currentPartDef.label} (Part ${partIdx + 1}/9)`, 'wb-badge-rev');
  const revBadge = el('span', activeSession?.characterRevision ?? 'mesh-v12', 'wb-badge-rev');
  const stageBadge = el('span', `Stage: ${activeSession?.stage ?? 'Head / Face'}`, 'wb-badge-stage');
  leftGroup.append(title, partBadge, revBadge, stageBadge);

  const centerGroup = el('div', undefined, 'wb-header-center');
  const isMock = activeSession?.toolState?.mode === 'mock';
  const toolPill = el('div', undefined, `wb-tool-pill ${isMock ? 'mock-mode' : 'live-mode'}`);
  const toolDot = el('span', undefined, 'live-pulse-dot');
  const toolText = el(
    'span',
    isMock ? 'SIMULATION / MOCK' : `${(activeSession?.tool ?? 'BLENDER').toUpperCase()} ● LIVE`,
    'wb-tool-text'
  );
  toolPill.append(toolDot, toolText);

  const statusText = el('span', activeSession?.status?.toUpperCase() ?? 'WAITING FOR REVIEW', `wb-status-tag ${activeSession?.status}`);
  centerGroup.append(toolPill, statusText);

  const rightGroup = el('div', undefined, 'wb-header-right');

  const timeWrapper = el('div', undefined, 'wb-time-wrapper');
  timeWrapper.append(el('span', 'Last preview: ', 'subtle-lbl'));
  const elapsedSpan = el('span', '0s ago', 'wb-elapsed-val');
  elapsedSpan.id = 'workbench-elapsed-time';
  timeWrapper.append(elapsedSpan);

  const checkpointWrapper = el('div', undefined, 'wb-checkpoint-wrapper');
  checkpointWrapper.append(el('span', `Checkpoint: ${activeSession?.checkpointId ?? 'head-polish-v3'}`, 'wb-checkpoint-lbl'));

  const actions = el('div', undefined, 'wb-header-actions');

  const approvePartBtn = el(
    'button',
    nextPartDef ? `✓ Approve ${currentPartDef.label.split(' ')[0]} ➔ ${nextPartDef.label.split(' ')[0]}` : `✓ Complete`,
    'btn-approve-part',
  );
  approvePartBtn.onclick = triggerApprovePart;

  const pauseBtn = el('button', activeSession?.status === 'paused' ? '▶ Resume' : '⏸ Pause', 'btn-wb-action');
  pauseBtn.onclick = () => {
    if (activeSession?.status === 'paused') triggerResume();
    else triggerPause();
  };

  const stopBtn = el('button', '⏹ Stop', 'btn-wb-action btn-danger');
  stopBtn.onclick = triggerStop;

  actions.append(approvePartBtn, pauseBtn, stopBtn);
  rightGroup.append(timeWrapper, checkpointWrapper, actions);

  header.append(leftGroup, centerGroup, rightGroup);
}

function renderLeftPanel() {
  const panel = document.querySelector('#workbench-left-panel');
  if (!panel) return;
  panel.replaceChildren();

  // Character Selector Card
  const charCard = el('div', undefined, 'wb-card');
  charCard.append(el('h3', 'Active Character', 'wb-card-title'));
  const charSelect = el('select', undefined, 'wb-select');
  const optYun = document.createElement('option');
  optYun.value = 'yun_urban_adventurer';
  optYun.textContent = 'Yun Urban Adventurer (Approved Production)';
  optYun.selected = true;
  const optKenney = document.createElement('option');
  optKenney.value = 'character-male-a';
  optKenney.textContent = 'Kenney Male A (Fallback Reference)';
  charSelect.append(optYun, optKenney);
  charCard.append(charSelect);
  panel.append(charCard);

  // Creation Sequence (Head to Bottom) Card
  const currentPartId = activeSession?.activePart || 'head';
  const completedParts = activeSession?.completedParts || [];

  const pipelineCard = el('div', undefined, 'wb-card');
  pipelineCard.append(el('h3', 'Creation Sequence (Head to Bottom)', 'wb-card-title'));
  const partList = el('div', undefined, 'part-pipeline-list');

  for (let i = 0; i < BODY_PARTS_PIPELINE.length; i++) {
    const p = BODY_PARTS_PIPELINE[i];
    const isActive = p.id === currentPartId;
    const isCompleted = completedParts.includes(p.id);

    const item = el('div', undefined, `part-pipeline-item${isActive ? ' active' : ''}${isCompleted ? ' completed' : ''}`);
    item.onclick = () => switchBodyPart(p.id);

    const icon = el('span', p.icon, 'part-icon');
    const info = el('div', undefined, 'part-info');
    info.append(
      el('span', `${i + 1}. ${p.label}`, 'part-name'),
      el('span', p.description, 'part-sub'),
    );

    let statusText = 'Pending';
    let statusClass = 'badge-pending';
    if (isCompleted) {
      statusText = '✓ Approved';
      statusClass = 'badge-approved';
    } else if (isActive) {
      statusText = '● In Progress';
      statusClass = 'badge-in-progress';
    }
    const badge = el('span', statusText, `part-status-badge ${statusClass}`);

    item.append(icon, info, badge);
    partList.append(item);
  }
  pipelineCard.append(partList);
  panel.append(pipelineCard);

  // Active Part Quick Action in Pipeline Card
  const activePartDef = BODY_PARTS_PIPELINE.find(p => p.id === currentPartId) || BODY_PARTS_PIPELINE[0];
  const nextPartDef = BODY_PARTS_PIPELINE[BODY_PARTS_PIPELINE.findIndex(p => p.id === currentPartId) + 1];

  const partActionBox = el('div', undefined, 'part-action-box');
  const approveBtn = el(
    'button',
    nextPartDef ? `✓ Approve ${activePartDef.label.split(' ')[0]} ➔ ${nextPartDef.label.split(' ')[0]}` : '✓ Finalize',
    'btn-approve-part w-full',
  );
  approveBtn.type = 'button';
  approveBtn.onclick = triggerApprovePart;
  partActionBox.append(approveBtn);
  pipelineCard.append(partActionBox);
  panel.append(pipelineCard);

  // Tool Adapter Status Card
  const toolCard = el('div', undefined, 'wb-card');
  toolCard.append(el('h3', 'Tool Runtime', 'wb-card-title'));
  const toolInfo = el('div', undefined, 'wb-tool-specs');
  toolInfo.append(
    el('div', 'Adapter: Blender Native 5.2.1 LTS', 'spec-row'),
    el('div', 'Host: 127.0.0.1 (Loopback safe)', 'spec-row'),
    el('div', 'File: yun_urban_adventurer.blend', 'spec-row'),
    el('div', 'Render Engine: EEVEE Next Viewport', 'spec-row'),
  );
  toolCard.append(toolInfo);
  panel.append(toolCard);
}

function renderCenterPanel() {
  const panel = document.querySelector('#workbench-center-panel');
  if (!panel) return;
  panel.replaceChildren();

  const activePart = activeSession?.activePart || 'head';
  const currentPartDef = BODY_PARTS_PIPELINE.find(p => p.id === activePart) || BODY_PARTS_PIPELINE[0];

  const applyPartZoom = (img) => {
    if (!img) return;
    const activePart = activeSession?.activePart || 'torso';
    if (activePart === 'head' || activePart === 'torso') {
      img.style.transform = 'none';
      img.style.transition = 'transform 0.2s ease';
      return;
    }
    const isRef = img.classList.contains('ref-img') || img.classList.contains('ref-full') || img.classList.contains('overlay-base');
    if (isPartZoomEnabled) {
      if (isRef) {
        img.style.transform = 'scale(2.35)';
        img.style.transformOrigin = '50% 17%';
      } else {
        img.style.transform = 'scale(1.02)';
        img.style.transformOrigin = '50% 50%';
      }
      img.style.transition = 'transform 0.25s ease';
    } else {
      img.style.transform = 'none';
      img.style.transition = 'transform 0.25s ease';
    }
  };

  // Top Viewport Toolbar (Sleek single-row workstation bar)
  const toolbar = el('div', undefined, 'wb-viewport-toolbar');

  // 1. Left Group: Camera Angles
  const camGroup = el('div', undefined, 'toolbar-group cam-group');
  camGroup.append(el('span', 'View:', 'toolbar-label'));
  for (const cam of CAMERA_VIEWS) {
    const btn = el('button', cam.label, `vp-btn${currentCameraView === cam.id ? ' active' : ''}`);
    btn.type = 'button';
    btn.onclick = () => {
      currentCameraView = cam.id;
      renderCenterPanel();
    };
    camGroup.append(btn);
  }
  toolbar.append(camGroup);

  // 2. Center Group: View Modes & Shading
  const centerGroup = el('div', undefined, 'toolbar-group center-tools-group');
  centerGroup.append(el('span', 'Mode:', 'toolbar-label'));
  for (const dm of DISPLAY_MODES) {
    const btn = el('button', dm.label, `vp-btn${currentDisplayMode === dm.id ? ' active' : ''}`);
    btn.type = 'button';
    btn.onclick = () => {
      currentDisplayMode = dm.id;
      renderCenterPanel();
    };
    centerGroup.append(btn);
  }

  // 3D Shading Toggle (Clay vs Wire)
  const shadingGroup = el('div', undefined, 'toolbar-subgroup shading-subgroup');
  for (const sm of SHADING_MODES) {
    const btn = el('button', sm.label, `vp-btn vp-shading-btn${currentShadingMode === sm.id ? ' active' : ''}`);
    btn.type = 'button';
    btn.title = `Switch 3D Viewport Shading to ${sm.label}`;
    btn.onclick = () => {
      currentShadingMode = sm.id;
      renderCenterPanel();
    };
    shadingGroup.append(btn);
  }
  centerGroup.append(shadingGroup);
  toolbar.append(centerGroup);

  // 3. Right Group: Focus, Guides, and Markup
  const rightGroup = el('div', undefined, 'toolbar-group right-tools-group');

  // Focus Toggle (only for parts that use whole-body ref zoom)
  if (activePart !== 'head' && activePart !== 'torso') {
    const zoomBtn = el(
      'button',
      isPartZoomEnabled ? `🔍 ${currentPartDef.label.split(' ')[0]}` : '🧍 Full',
      `vp-btn part-zoom-toggle${isPartZoomEnabled ? ' active' : ''}`,
    );
    zoomBtn.type = 'button';
    zoomBtn.title = 'Toggle part focus vs full-body context';
    zoomBtn.onclick = () => {
      isPartZoomEnabled = !isPartZoomEnabled;
      renderCenterPanel();
    };
    rightGroup.append(zoomBtn);
  }

  // Guides Toggle
  const guidesBtn = el(
    'button',
    isGuidesVisible ? '📏 Guides' : '📏 Off',
    `vp-btn guides-toggle${isGuidesVisible ? ' active' : ''}`,
  );
  guidesBtn.type = 'button';
  guidesBtn.title = 'Show or hide anatomical reference guide lines';
  guidesBtn.onclick = () => {
    isGuidesVisible = !isGuidesVisible;
    renderCenterPanel();
  };
  rightGroup.append(guidesBtn);

  // Markup Toggle
  const annotToggleBtn = el(
    'button',
    '✎ Markup',
    `vp-btn annot-toggle${isAnnotateExpanded ? ' active' : ''}`,
  );
  annotToggleBtn.type = 'button';
  annotToggleBtn.title = 'Open visual markup annotation tools';
  annotToggleBtn.onclick = () => {
    isAnnotateExpanded = !isAnnotateExpanded;
    renderCenterPanel();
  };
  rightGroup.append(annotToggleBtn);
  toolbar.append(rightGroup);

  panel.append(toolbar);

  // Secondary Strip: When Markup is open or Overlay opacity is active
  if (isAnnotateExpanded || currentDisplayMode === 'overlay') {
    const subToolbar = el('div', undefined, 'wb-viewport-subtoolbar');

    if (currentDisplayMode === 'overlay') {
      const sliderGroup = el('div', undefined, 'toolbar-group opacity-group');
      sliderGroup.append(el('span', 'Overlay Opacity: ', 'subtle-lbl'));
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = '0';
      slider.max = '1';
      slider.step = '0.05';
      slider.value = `${currentOverlayOpacity}`;
      slider.oninput = (e) => {
        currentOverlayOpacity = parseFloat(e.target.value);
        const liveLayer = document.querySelector('#overlay-live-layer');
        if (liveLayer) liveLayer.style.opacity = `${currentOverlayOpacity}`;
      };
      sliderGroup.append(slider);
      subToolbar.append(sliderGroup);
    }

    if (isAnnotateExpanded) {
      const annotGroup = el('div', undefined, 'toolbar-group annot-group');
      annotGroup.append(el('span', 'Tools:', 'toolbar-label'));
      const tools = [
        { id: 'point', label: '● Point' },
        { id: 'rect', label: '□ Rect' },
        { id: 'arrow', label: '➔ Arrow' },
        { id: 'freehand', label: '✎ Draw' },
        { id: 'clear', label: 'Clear' },
      ];
      for (const t of tools) {
        const btn = el('button', t.label, `vp-btn-xs${activeAnnotationTool === t.id ? ' active' : ''}`);
        btn.type = 'button';
        btn.onclick = () => {
          if (t.id === 'clear') {
            annotations = [];
            renderCenterPanel();
          } else {
            activeAnnotationTool = activeAnnotationTool === t.id ? null : t.id;
            renderCenterPanel();
          }
        };
        annotGroup.append(btn);
      }
      subToolbar.append(annotGroup);
    }

    panel.append(subToolbar);
  }

  // Viewport Container (Dominant Canvas)
  const viewportContainer = el('div', undefined, 'wb-viewport-stage');
  viewportContainer.id = 'viewport-stage';

  const refUrl = getReferenceImageUrl(currentCameraView);
  const liveUrl = getLiveImageUrl(currentCameraView);

  if (currentDisplayMode === 'side-by-side') {
    const splitWrapper = el('div', undefined, 'split-viewport-wrapper');

    // Left: 2D Canonical Reference
    const leftPane = el('div', undefined, 'split-pane ref-pane');
    const refHeader = el('div', undefined, 'pane-header');
    refHeader.append(el('span', `2D REFERENCE · ${currentPartDef.label.toUpperCase()}`, 'pane-tag ref-tag'));
    refHeader.append(el('span', `Angle: ${currentCameraView.toUpperCase()}`, 'pane-sub'));
    leftPane.append(refHeader);

    const refFrame = el('div', undefined, 'pane-viewport-frame');
    if (isPartZoomEnabled) refFrame.classList.add('zoom-enabled');
    const refBox = el('div', undefined, 'viewport-image-box');
    const refImg = document.createElement('img');
    refImg.src = refUrl;
    refImg.alt = 'Reference turnaround';
    refImg.className = 'viewport-img ref-img';
    applyPartZoom(refImg);
    refBox.append(refImg);
    const refGuides = renderAlignmentGuides();
    refBox.append(refGuides);
    refFrame.append(refBox);
    leftPane.append(refFrame);

    // Right: 3D Live Blender Viewport
    const rightPane = el('div', undefined, 'split-pane live-pane');
    const liveHeader = el('div', undefined, 'pane-header');
    liveHeader.append(el('span', `LIVE BLENDER 3D · ${currentPartDef.label.toUpperCase()}`, 'pane-tag live-tag'));
    liveHeader.append(el('span', `Revision: ${activeSession?.characterRevision ?? 'mesh-v12'} (${currentShadingMode.toUpperCase()})`, 'pane-sub'));
    rightPane.append(liveHeader);

    const liveFrame = el('div', undefined, 'pane-viewport-frame');
    if (isPartZoomEnabled) liveFrame.classList.add('zoom-enabled');

    // Perspective Floor Grid Overlay
    const floorGrid = el('div', undefined, 'live-perspective-grid');
    liveFrame.append(floorGrid);

    // 3D Orientation Gizmo
    const gizmo = el('div', undefined, 'viewport-gizmo');
    gizmo.title = 'Blender 3D Orientation';
    const axisX = el('span', 'X', 'gizmo-axis gizmo-x');
    const axisY = el('span', 'Y', 'gizmo-axis gizmo-y');
    const axisZ = el('span', 'Z', 'gizmo-axis gizmo-z');
    gizmo.append(axisX, axisY, axisZ);
    liveFrame.append(gizmo);

    // Viewport Camera Info Badge
    const camTag = el(
      'div',
      `Blender 5.2 EEVEE · 65mm Ortho · ${currentShadingMode === 'wire' ? 'Wireframe Mesh' : 'Clay Blockout'}`,
      'viewport-cam-tag',
    );
    liveFrame.append(camTag);

    const liveBox = el('div', undefined, 'viewport-image-box');
    const liveImg = document.createElement('img');
    liveImg.src = liveUrl;
    liveImg.alt = 'Live tool render';
    liveImg.className = 'viewport-img live-img';
    applyPartZoom(liveImg);
    liveBox.append(liveImg);

    // Alignment guides overlay
    const guides = renderAlignmentGuides();
    liveBox.append(guides);

    // Annotations overlay
    const annotCanvas = renderAnnotationCanvas();
    liveBox.append(annotCanvas);

    liveFrame.append(liveBox);
    rightPane.append(liveFrame);
    splitWrapper.append(leftPane, rightPane);
    viewportContainer.append(splitWrapper);
  } else if (currentDisplayMode === 'overlay') {
    const overlayWrapper = el('div', undefined, 'overlay-viewport-wrapper');
    const box = el('div', undefined, 'viewport-image-box');
    const refImg = document.createElement('img');
    refImg.src = refUrl;
    refImg.className = 'viewport-img overlay-base';
    applyPartZoom(refImg);

    const liveImg = document.createElement('img');
    liveImg.id = 'overlay-live-layer';
    liveImg.src = liveUrl;
    liveImg.className = 'viewport-img overlay-top';
    liveImg.style.opacity = `${currentOverlayOpacity}`;
    applyPartZoom(liveImg);

    box.append(refImg, liveImg, renderAlignmentGuides(), renderAnnotationCanvas());
    overlayWrapper.append(box);
    viewportContainer.append(overlayWrapper);
  } else if (currentDisplayMode === 'live-only') {
    const singleWrapper = el('div', undefined, 'single-viewport-wrapper live-pane');
    
    // Perspective Floor Grid Overlay
    singleWrapper.append(el('div', undefined, 'live-perspective-grid'));

    // 3D Gizmo
    const gizmo = el('div', undefined, 'viewport-gizmo');
    gizmo.append(el('span', 'X', 'gizmo-axis gizmo-x'), el('span', 'Y', 'gizmo-axis gizmo-y'), el('span', 'Z', 'gizmo-axis gizmo-z'));
    singleWrapper.append(gizmo);

    singleWrapper.append(el('div', `Blender 5.2 EEVEE · 65mm Ortho · ${currentShadingMode === 'wire' ? 'Wireframe Mesh' : 'Clay Blockout'}`, 'viewport-cam-tag'));

    const liveBox = el('div', undefined, 'viewport-image-box');
    const liveImg = document.createElement('img');
    liveImg.src = liveUrl;
    liveImg.className = 'viewport-img live-full';
    applyPartZoom(liveImg);
    liveBox.append(liveImg, renderAlignmentGuides(), renderAnnotationCanvas());
    singleWrapper.append(liveBox);
    viewportContainer.append(singleWrapper);
  } else if (currentDisplayMode === 'reference-only') {
    const singleWrapper = el('div', undefined, 'single-viewport-wrapper');
    const refBox = el('div', undefined, 'viewport-image-box');
    const refImg = document.createElement('img');
    refImg.src = refUrl;
    refImg.className = 'viewport-img ref-full';
    applyPartZoom(refImg);
    refBox.append(refImg, renderAlignmentGuides());
    singleWrapper.append(refBox);
    viewportContainer.append(singleWrapper);
  }

  panel.append(viewportContainer);
  fitViewportBoxes();
}

export function fitViewportBoxes() {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('.pane-viewport-frame, .overlay-viewport-wrapper, .single-viewport-wrapper').forEach(frame => {
    const box = frame.querySelector('.viewport-image-box');
    if (!box) return;
    const pad = 16;
    const w = frame.clientWidth - pad;
    const h = frame.clientHeight - pad;
    if (w <= 0 || h <= 0) return;
    const size = Math.floor(Math.min(w, h));
    box.style.width = `${size}px`;
    box.style.height = `${size}px`;
  });
}

function renderAlignmentGuides() {
  const guideContainer = el('div', undefined, `alignment-guides-overlay${isGuidesVisible ? '' : ' hidden'}`);
  if (!isGuidesVisible) return guideContainer;

  const activePart = activeSession?.activePart || 'torso';
  const partDef = BODY_PARTS_PIPELINE.find(p => p.id === activePart);
  const guidesList = partDef?.guides || [
    { top: 14, label: 'Chin Baseline (14%)' },
    { top: 26, label: 'Throat / Mid-Neck (26%)' },
    { top: 38, label: 'Clavicles / Collarbone (38%)' },
    { top: 43, label: 'Shoulder Crest (43%)' },
    { top: 61, label: 'Chest / Pectoral Line (61%)' },
    { top: 81, label: 'Lower Ribcage (81%)' },
  ];

  for (const g of guidesList) {
    const line = el('div', undefined, 'guide-line');
    line.style.top = `${g.top}%`;
    const label = el('span', g.label, 'guide-part-label');
    line.append(label);
    guideContainer.append(line);
  }
  return guideContainer;
}

function renderAnnotationCanvas() {
  const canvas = el('div', undefined, 'annotation-layer');
  canvas.id = 'annotation-layer';

  // Render existing annotations
  for (const ann of annotations) {
    const marker = el('div', ann.text || '', `annot-mark mark-${ann.type}`);
    marker.style.left = `${ann.x}%`;
    marker.style.top = `${ann.y}%`;
    canvas.append(marker);
  }

  // Interactive click to add note / marker
  canvas.onclick = (e) => {
    if (!activeAnnotationTool) return;
    const rect = canvas.getBoundingClientRect();
    const x = Number((((e.clientX - rect.left) / rect.width) * 100).toFixed(1));
    const y = Number((((e.clientY - rect.top) / rect.height) * 100).toFixed(1));

    const note = prompt('Enter annotation note for active revision:', 'Adjust contour');
    if (note) {
      const newAnn = {
        id: `ann-${Date.now()}`,
        sessionId: activeSession?.sessionId,
        revisionId: activeSession?.characterRevision,
        type: activeAnnotationTool,
        x,
        y,
        text: note,
        region: y < 35 ? 'head' : y < 60 ? 'shoulders' : 'torso',
        createdAt: new Date().toISOString(),
      };
      annotations.push(newAnn);
      renderCenterPanel();
      renderRightPanel();
    }
  };

  return canvas;
}

function renderRightPanel() {
  const panel = document.querySelector('#workbench-right-panel');
  if (!panel) return;
  panel.replaceChildren();

  // Tabs Header
  const tabStrip = el('div', undefined, 'wb-tab-strip');
  const tabs = [
    { id: 'compare', label: 'COMPARE' },
    { id: 'correct', label: 'CORRECT' },
    { id: 'inspect', label: 'INSPECT' },
    { id: 'history', label: 'HISTORY' },
  ];
  for (const t of tabs) {
    const btn = el('button', t.label, `wb-tab-btn${selectedRightTab === t.id ? ' active' : ''}`);
    btn.type = 'button';
    btn.onclick = () => {
      selectedRightTab = t.id;
      renderRightPanel();
    };
    tabStrip.append(btn);
  }
  panel.append(tabStrip);

  const contentBox = el('div', undefined, 'wb-right-content');

  if (selectedRightTab === 'compare') {
    contentBox.append(renderCompareTab());
  } else if (selectedRightTab === 'correct') {
    contentBox.append(renderCorrectTab());
  } else if (selectedRightTab === 'inspect') {
    contentBox.append(renderInspectTab());
  } else if (selectedRightTab === 'history') {
    contentBox.append(renderHistoryTab());
  }

  panel.append(contentBox);
}

function renderCompareTab() {
  const wrap = el('div', undefined, 'tab-content-wrap');
  wrap.append(el('h3', 'Reference vs Live Landmark Deltas', 'tab-sub-title'));

  const table = el('table', undefined, 'wb-diff-table');
  const thead = el('thead');
  thead.append(el('tr', undefined, undefined));
  thead.children[0].append(
    el('th', 'Landmark'),
    el('th', 'Target'),
    el('th', 'Current'),
    el('th', 'Delta'),
    el('th', 'Status'),
  );
  table.append(thead);

  const tbody = el('tbody');
  const measurements = activeSession?.measurements ?? [
    { name: 'Crown', target: 100.0, current: 100.0, delta: 0.0, unit: '%', status: 'pass' },
    { name: 'Eyes', target: 88.5, current: 88.5, delta: 0.0, unit: '%', status: 'pass' },
    { name: 'Chin', target: 79.0, current: 79.2, delta: 0.2, unit: '%', status: 'pass' },
    { name: 'Shoulders', target: 31.2, current: 35.8, delta: 4.6, unit: '%', status: 'fail' },
    { name: 'Waist', target: 24.2, current: 24.5, delta: 0.3, unit: '%', status: 'pass' },
    { name: 'Hips', target: 28.5, current: 28.9, delta: 0.4, unit: '%', status: 'pass' },
    { name: 'Knees', target: 26.0, current: 26.0, delta: 0.0, unit: '%', status: 'pass' },
    { name: 'Feet', target: 0.0, current: 0.0, delta: 0.0, unit: '%', status: 'pass' },
    { name: 'Silhouette', target: 95.0, current: 92.4, delta: -2.6, unit: '%', status: 'fail' },
  ];

  for (const m of measurements) {
    const tr = el('tr', undefined, `row-${m.status}`);
    const deltaVal = Number(m.delta ?? 0);
    const deltaStr = (deltaVal > 0 ? '+' : '') + deltaVal.toFixed(1);
    tr.append(
      el('td', m.name),
      el('td', `${Number(m.target).toFixed(1)}${m.unit}`),
      el('td', `${Number(m.current).toFixed(1)}${m.unit}`),
      el('td', `${deltaStr}${m.unit}`, m.status === 'fail' ? 'delta-fail' : 'delta-pass'),
      el('td', m.status.toUpperCase(), `badge-status badge-${m.status}`),
    );
    tbody.append(tr);
  }
  table.append(tbody);
  wrap.append(table);

  const passCount = measurements.filter((m) => m.status === 'pass').length;
  const matchPct = Math.round((passCount / measurements.length) * 100);
  const summaryBox = el('div', undefined, `measurement-summary-card ${matchPct === 100 ? 'summary-pass' : 'summary-review'}`);
  summaryBox.append(
    el('span', `Landmark Match Score: ${matchPct}%`, 'score-title'),
    el('p', matchPct === 100
      ? '✓ All active landmarks within tolerance (±1.5%). Ready for approval.'
      : 'Review required: Some landmarks exceed tolerance threshold.', 'subtle-p'),
  );
  wrap.append(summaryBox);
  return wrap;
}

function renderCorrectTab() {
  const wrap = el('div', undefined, 'tab-content-wrap');
  wrap.append(el('h3', 'Human-in-the-Loop Feedback', 'tab-sub-title'));

  const statusAlert = el('div', undefined, 'wb-alert-box alert-warning');
  statusAlert.append(
    el('strong', 'WAITING FOR REVIEW · SILHOUETTE POLISH'),
    el('p', 'The workflow is paused. Approve the current revision or submit targeted corrections to continue.'),
  );
  wrap.append(statusAlert);

  const form = el('form', undefined, 'wb-correction-form');
  const regionLabel = el('label', 'Target Anatomy / Asset Region', 'wb-form-label');
  const regionSelect = el('select', undefined, 'wb-select');
  regionSelect.id = 'correct-region-select';
  const regions = ['shoulders', 'jacket', 'head', 'torso', 'legs', 'hair', 'all'];
  for (const r of regions) {
    const opt = document.createElement('option');
    opt.value = r;
    opt.textContent = r.toUpperCase();
    if (r === 'shoulders') opt.selected = true;
    regionSelect.append(opt);
  }
  form.append(regionLabel, regionSelect);

  const feedbackLabel = el('label', 'Correction Note', 'wb-form-label');
  const textarea = el('textarea', undefined, 'wb-textarea');
  textarea.id = 'correct-feedback-text';
  textarea.rows = 4;
  textarea.placeholder = 'Example: Shoulders too wide. Make jacket softer. Keep head size unchanged.';
  textarea.value = 'Shoulders too wide. Make jacket softer.';
  form.append(feedbackLabel, textarea);

  // Active annotations note
  if (annotations.length) {
    const annotList = el('div', undefined, 'annotations-chip-list');
    annotList.append(el('span', `Attached Annotations (${annotations.length}): `, 'subtle-lbl'));
    for (const a of annotations) {
      annotList.append(el('span', `${a.type}: ${a.text}`, 'annot-chip'));
    }
    form.append(annotList);
  }

  // Big primary action buttons
  const btnRow = el('div', undefined, 'correction-actions-stack');
  const correctBtn = el('button', '✎ Send Correction to Blender', 'btn-primary-gradient');
  correctBtn.type = 'button';
  correctBtn.onclick = () => {
    const feedback = textarea.value.trim();
    if (!feedback) {
      alert('Please enter a correction note.');
      return;
    }
    triggerCorrect(feedback, regionSelect.value);
  };

  const approveBtn = el('button', '✓ Approve Revision & Advance', 'btn-success');
  approveBtn.type = 'button';
  approveBtn.onclick = () => triggerApprove('Visual review passed.');

  const retryBtn = el('button', '↻ Retry Viewport Render', 'btn-secondary-sm');
  retryBtn.type = 'button';
  retryBtn.onclick = triggerRetry;

  btnRow.append(correctBtn, approveBtn, retryBtn);
  form.append(btnRow);
  wrap.append(form);

  return wrap;
}

function renderInspectTab() {
  const wrap = el('div', undefined, 'tab-content-wrap');
  wrap.append(el('h3', '3D Technical Mesh State', 'tab-sub-title'));

  const stats = [
    { label: 'Character', val: 'Yun Urban Adventurer' },
    { label: 'Asset ID', val: 'yun_urban_adventurer' },
    { label: 'Revision', val: activeSession?.characterRevision ?? 'mesh-v12' },
    { label: 'Checkpoint', val: activeSession?.checkpointId ?? 'silhouette-v6' },
    { label: 'Tool Status', val: `${(activeSession?.tool ?? 'blender').toUpperCase()} (Connected)` },
    { label: 'Vertices', val: '14,280' },
    { label: 'Triangles', val: '26,450' },
    { label: 'Bones', val: '18 (Humanoid Armature)' },
    { label: 'Materials', val: '4 (Skin, Jacket, Pants, Shoes)' },
    { label: 'Blend File', val: 'artifacts/.../yun_urban_adventurer.blend' },
    { label: 'VRAM Usage', val: '240 MB' },
    { label: 'Elapsed', val: '4m 18s' },
  ];

  const statList = el('div', undefined, 'wb-stats-list');
  for (const s of stats) {
    const row = el('div', undefined, 'stat-row');
    row.append(el('span', s.label, 'stat-lbl'), el('span', s.val, 'stat-val'));
    statList.append(row);
  }
  wrap.append(statList);
  return wrap;
}

function renderHistoryTab() {
  const wrap = el('div', undefined, 'tab-content-wrap');
  wrap.append(el('h3', 'Revision Timeline', 'tab-sub-title'));

  const revisions = activeSession?.revisions ?? [
    {
      revisionId: 'mesh-v9',
      checkpointId: 'blockout-v3',
      stage: 'Base Blockout',
      timestamp: '18 min ago',
      description: 'Base blockout primitive proportions aligned',
    },
    {
      revisionId: 'mesh-v10',
      checkpointId: 'proportion-v4',
      stage: 'Proportion Match',
      timestamp: '12 min ago',
      description: 'Normalized head-to-body 7.2 heads ratio',
    },
    {
      revisionId: 'mesh-v11',
      checkpointId: 'silhouette-v5',
      stage: 'Silhouette Match',
      timestamp: '5 min ago',
      description: 'Athletic silhouette and jacket volume matching reference turnaround',
    },
    {
      revisionId: 'mesh-v12',
      checkpointId: 'silhouette-v6',
      stage: 'Form Refinement / Silhouette Polish',
      timestamp: 'Just now',
      description: 'Current active revision awaiting review',
    },
  ];

  const list = el('div', undefined, 'wb-revision-list');
  for (const rev of [...revisions].reverse()) {
    const isCurrent = rev.revisionId === activeSession?.characterRevision;
    const item = el('div', undefined, `revision-card${isCurrent ? ' current' : ''}`);

    const top = el('div', undefined, 'rev-card-top');
    top.append(el('strong', rev.revisionId, 'rev-id'), el('span', rev.checkpointId, 'rev-chk'));
    if (isCurrent) top.append(el('span', 'CURRENT', 'badge-current'));

    const desc = el('p', rev.description, 'rev-desc');
    item.append(top, desc);

    if (!isCurrent) {
      const revertBtn = el('button', `↶ Revert to ${rev.revisionId}`, 'btn-revert-xs');
      revertBtn.type = 'button';
      revertBtn.onclick = () => triggerRevert(rev.revisionId);
      item.append(revertBtn);
    }

    list.append(item);
  }
  wrap.append(list);
  return wrap;
}

function renderDrawer() {
  const drawer = document.querySelector('#workbench-bottom-drawer');
  if (!drawer) return;
  drawer.replaceChildren();

  const handle = el('div', undefined, 'drawer-handle-bar');
  handle.onclick = () => {
    isDrawerOpen = !isDrawerOpen;
    drawer.classList.toggle('open', isDrawerOpen);
  };

  const handleLeft = el('div', undefined, 'handle-title-row');
  handleLeft.append(
    el('span', isDrawerOpen ? '▼' : '▲', 'drawer-arrow'),
    el('strong', `Tool Events Feed (${eventLog.length})`, 'drawer-title'),
  );
  const handleRight = el('div', undefined, 'handle-status');
  handleRight.append(el('span', activeSession?.lastMessage ?? 'Blender connected', 'subtle-last-msg'));
  handle.append(handleLeft, handleRight);
  drawer.append(handle);

  const drawerBody = el('div', undefined, 'drawer-content-body');
  if (eventLog.length === 0) {
    drawerBody.append(
      el('div', '08:43:02 Blender connected (PID 39120)', 'event-row'),
      el('div', '08:43:08 Loaded yun_urban_adventurer.blend', 'event-row'),
      el('div', '08:43:19 Shoulder width adjusted (shape key: jacket_fit)', 'event-row'),
      el('div', '08:43:24 Viewport preview updated (mesh-v12)', 'event-row'),
      el('div', '08:43:30 Waiting for user review', 'event-row'),
    );
  } else {
    for (const ev of eventLog) {
      const timeStr = new Date(ev.timestamp).toLocaleTimeString();
      drawerBody.append(el('div', `${timeStr} [${ev.type.toUpperCase()}] ${ev.message}`, 'event-row'));
    }
  }
  drawer.append(drawerBody);
}

function getReferenceImageUrl(cameraView) {
  const activePart = activeSession?.activePart || 'torso';
  if (activePart === 'head') {
    if (cameraView === 'front') return '/previews/yun_head_ref_front.png';
    if (cameraView === 'side') return '/previews/yun_head_ref_side.png';
    if (cameraView === 'three_quarter') return '/previews/yun_head_ref_three_quarter.png';
    if (cameraView === 'back') return '/previews/yun_head_ref_back.png';
    return '/previews/yun_head_ref_front.png';
  }
  if (activePart === 'torso') {
    if (cameraView === 'front') return '/previews/yun_neck_chest_ref_front.png';
    if (cameraView === 'side') return '/previews/yun_neck_chest_ref_side.png';
    if (cameraView === 'three_quarter') return '/previews/yun_neck_chest_ref_three_quarter.png';
    if (cameraView === 'back') return '/previews/yun_neck_chest_ref_back.png';
    return '/previews/yun_neck_chest_ref_front.png';
  }
  const refs = activeCharacter?.referenceImages ?? {};
  if (cameraView === 'front') return refs.fullBodyFront || refs.front || '/previews/yun_urban_adventurer-front.png';
  if (cameraView === 'side') return refs.fullBodySide || refs.side || '/previews/yun_urban_adventurer-side.png';
  if (cameraView === 'three_quarter') return refs.fullBodyThreeQuarter || refs.threeQuarter || '/previews/yun_urban_adventurer-three-quarter.png';
  if (cameraView === 'back') return refs.fullBodyBack || refs.back || '/previews/yun_urban_adventurer-back.png';
  return refs.fullBodyFront || refs.front || '/previews/yun_urban_adventurer-front.png';
}

function getLiveImageUrl(cameraView) {
  const activePart = activeSession?.activePart || 'torso';
  if (activePart === 'torso') {
    const prefix = currentShadingMode === 'wire' ? '/previews/yun_neck_chest_wire_' : '/previews/yun_neck_chest_clay_';
    if (cameraView === 'front') return `${prefix}front.png`;
    if (cameraView === 'side') return `${prefix}side.png`;
    if (cameraView === 'three_quarter' || cameraView === 'beauty') return `${prefix}three_quarter.png`;
    if (cameraView === 'back') return `${prefix}back.png`;
    return `${prefix}front.png`;
  }
  const prefix = currentShadingMode === 'wire' ? '/previews/yun_3d_wire_' : '/previews/yun_3d_clay_';
  if (cameraView === 'front') return `${prefix}front.png`;
  if (cameraView === 'side') return `${prefix}side.png`;
  if (cameraView === 'three_quarter' || cameraView === 'beauty') return `${prefix}three_quarter.png`;
  if (cameraView === 'back') return `${prefix}back.png`;
  return `${prefix}front.png`;
}

async function triggerPause() {
  if (!activeSession) return;
  try {
    const res = await api(`/api/live-sessions/${activeSession.sessionId}/pause`, {});
    if (res?.session) {
      activeSession = res.session;
      renderHeader();
    }
  } catch (err) {
    console.error('Failed to pause:', err);
  }
}

async function triggerResume() {
  if (!activeSession) return;
  try {
    const res = await api(`/api/live-sessions/${activeSession.sessionId}/resume`, {});
    if (res?.session) {
      activeSession = res.session;
      renderHeader();
    }
  } catch (err) {
    console.error('Failed to resume:', err);
  }
}

async function triggerStop() {
  if (!activeSession) return;
  try {
    const res = await api(`/api/live-sessions/${activeSession.sessionId}/stop`, {});
    if (res?.session) {
      activeSession = res.session;
      renderHeader();
    }
  } catch (err) {
    console.error('Failed to stop:', err);
  }
}

async function triggerApprove(note) {
  if (!activeSession) return;
  try {
    const res = await api(`/api/live-sessions/${activeSession.sessionId}/approve`, { note });
    if (res?.session) {
      activeSession = res.session;
      renderHeader();
      renderLeftPanel();
      renderCenterPanel();
      renderRightPanel();
    }
  } catch (err) {
    console.error('Failed to approve:', err);
  }
}

async function triggerCorrect(feedback, region) {
  if (!activeSession) return;
  try {
    const res = await api(`/api/live-sessions/${activeSession.sessionId}/correct`, {
      feedback,
      region,
      annotations,
    });
    if (res?.session) {
      activeSession = res.session;
      annotations = [];
      renderHeader();
      renderCenterPanel();
      renderRightPanel();
    }
  } catch (err) {
    console.error('Failed to submit correction:', err);
  }
}

async function triggerRetry() {
  if (!activeSession) return;
  try {
    const res = await api(`/api/live-sessions/${activeSession.sessionId}/retry`, {});
    if (res?.session) {
      activeSession = res.session;
      renderHeader();
      renderCenterPanel();
    }
  } catch (err) {
    console.error('Failed to retry:', err);
  }
}

async function triggerRevert(targetId) {
  if (!activeSession) return;
  try {
    const res = await api(`/api/live-sessions/${activeSession.sessionId}/revert`, {
      method: 'POST',
      body: JSON.stringify({ revisionId: targetId }),
    });
    if (res?.session) {
      activeSession = res.session;
      renderHeader();
      renderCenterPanel();
      renderRightPanel();
    }
  } catch (err) {
    console.error('Failed to revert:', err);
  }
}

async function switchBodyPart(partId) {
  if (!activeSession) return;
  try {
    const res = await api(`/api/live-sessions/${activeSession.sessionId}/part`, { partId });
    if (res?.session) {
      activeSession = res.session;
      renderHeader();
      renderLeftPanel();
      renderCenterPanel();
      renderRightPanel();
    }
  } catch (err) {
    console.error('Failed to switch body part:', err);
  }
}

async function triggerApprovePart() {
  if (!activeSession) return;
  try {
    const activePart = activeSession.activePart || 'head';
    const currentPartDef = BODY_PARTS_PIPELINE.find(p => p.id === activePart) || BODY_PARTS_PIPELINE[0];
    const res = await api(`/api/live-sessions/${activeSession.sessionId}/approve-part`, {
      note: `Approved ${currentPartDef.label} after visual review`,
    });
    if (res?.session) {
      activeSession = res.session;
      renderHeader();
      renderLeftPanel();
      renderCenterPanel();
      renderRightPanel();
    }
  } catch (err) {
    console.error('Failed to approve part:', err);
  }
}
