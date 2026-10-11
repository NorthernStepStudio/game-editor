export type LiveToolType =
  | 'blender'
  | 'comfyui'
  | 'godot'
  | 'motion'
  | 'foundry'
  | 'canvas'
  | 'forge'
  | 'flyrail'
  | 'sentinel';

export type LiveSessionStatus =
  | 'idle'
  | 'starting'
  | 'working'
  | 'waiting-for-review'
  | 'paused'
  | 'approved'
  | 'failed'
  | 'stopped';

export type LivePreviewType = 'image' | 'render' | 'viewport' | 'video' | 'mesh' | 'stream';

export type BodyPartId =
  | 'head'
  | 'hair'
  | 'torso'
  | 'arms_hands'
  | 'lower_body'
  | 'legs'
  | 'footwear'
  | 'accessories'
  | 'full_assembly';

export interface BodyPartDefinition {
  readonly id: BodyPartId;
  readonly label: string;
  readonly description: string;
  readonly icon: string;
  readonly focusCrop: { readonly zoom: number; readonly yOffsetPercent: number };
  readonly defaultLandmarks: readonly string[];
}

export const BODY_PARTS_PIPELINE: readonly BodyPartDefinition[] = [
  {
    id: 'head',
    label: 'Head & Face',
    description: 'Skull shape, jawline, chin, eye sockets, and facial planes',
    icon: '👤',
    focusCrop: { zoom: 2.4, yOffsetPercent: 8 },
    defaultLandmarks: ['crown', 'eyes', 'chin', 'jaw'],
  },
  {
    id: 'torso',
    label: 'Neck, Chest & Shoulders',
    description: 'Cervical neck, throat, clavicles, shoulder width, and pectoral contour',
    icon: '🫁',
    focusCrop: { zoom: 1.0, yOffsetPercent: 0 },
    defaultLandmarks: ['chin', 'throat', 'clavicles', 'shoulders', 'chest', 'ribcage'],
  },
  {
    id: 'arms_hands',
    label: 'Arms & Hands',
    description: 'Biceps, sleeve cuffs, wrist angle, and clean finger topology',
    icon: '🧤',
    focusCrop: { zoom: 1.6, yOffsetPercent: 42 },
    defaultLandmarks: ['elbows', 'wrists', 'hands'],
  },
  {
    id: 'lower_body',
    label: 'Waist & Hips',
    description: 'Beltline, hip volume, waistband, and pelvic core drape',
    icon: '🩳',
    focusCrop: { zoom: 1.7, yOffsetPercent: 54 },
    defaultLandmarks: ['waist', 'hips', 'inseam'],
  },
  {
    id: 'legs',
    label: 'Legs & Knees',
    description: 'Thigh alignment, knee joint height, and calf silhouette',
    icon: '🦵',
    focusCrop: { zoom: 1.5, yOffsetPercent: 68 },
    defaultLandmarks: ['knees', 'calves', 'ankles'],
  },
  {
    id: 'footwear',
    label: 'Footwear & Shoes',
    description: 'Sneakers/boots silhouette, ankle cuffs, and ground baseline',
    icon: '👟',
    focusCrop: { zoom: 2.2, yOffsetPercent: 90 },
    defaultLandmarks: ['ankles', 'feet', 'baseline'],
  },
  {
    id: 'hair',
    label: 'Hair & Headgear',
    description: 'Hairstyle volume chunks, silhouette contour, and bang placement',
    icon: '💇',
    focusCrop: { zoom: 2.2, yOffsetPercent: 12 },
    defaultLandmarks: ['crown', 'silhouette_top', 'silhouette_side'],
  },
  {
    id: 'accessories',
    label: 'Clothing & Gear',
    description: 'Jacket drape, crop top, cargo shorts, straps, and pouches',
    icon: '🧥',
    focusCrop: { zoom: 1.8, yOffsetPercent: 32 },
    defaultLandmarks: ['collar', 'jacket', 'straps', 'pouches'],
  },
  {
    id: 'full_assembly',
    label: 'Full Body Assembly',
    description: 'Integrated character mesh, rig hierarchy, and motion deformation',
    icon: '🧍',
    focusCrop: { zoom: 1.0, yOffsetPercent: 50 },
    defaultLandmarks: ['crown', 'eyes', 'chin', 'shoulders', 'torso', 'waist', 'hips', 'knees', 'feet'],
  },
];

export function getNextBodyPart(currentPart: BodyPartId): BodyPartId | null {
  const index = BODY_PARTS_PIPELINE.findIndex(p => p.id === currentPart);
  if (index >= 0 && index < BODY_PARTS_PIPELINE.length - 1) {
    return BODY_PARTS_PIPELINE[index + 1].id;
  }
  return null;
}

export function getBodyPartDefinition(id: BodyPartId): BodyPartDefinition {
  return BODY_PARTS_PIPELINE.find(p => p.id === id) ?? BODY_PARTS_PIPELINE[0];
}

export interface LiveToolState {
  readonly connected: boolean;
  readonly pid?: number;
  readonly processName?: string;
  readonly host?: string;
  readonly currentFile?: string;
  readonly activeAction?: string;
  readonly mode: 'live' | 'mock';
  readonly lastHeartbeat?: string;
}

export interface VisualMeasurement {
  readonly name: string;
  readonly target: number;
  readonly current: number;
  readonly delta: number;
  readonly unit: string;
  readonly status: 'pass' | 'fail';
  readonly landmark?: string;
}

export interface LiveAnnotation {
  readonly id: string;
  readonly sessionId: string;
  readonly revisionId?: string;
  readonly type: 'point' | 'rect' | 'arrow' | 'freehand' | 'text';
  readonly x: number;
  readonly y: number;
  readonly width?: number;
  readonly height?: number;
  readonly text?: string;
  readonly points?: readonly { x: number; y: number }[];
  readonly color?: string;
  readonly region?: string;
  readonly createdAt: string;
}

export interface LiveRevision {
  readonly revisionId: string;
  readonly sessionId: string;
  readonly characterId: string;
  readonly checkpointId: string;
  readonly stage: string;
  readonly previewUri: string;
  readonly timestamp: string;
  readonly description: string;
  readonly tool: LiveToolType;
  readonly measurements?: readonly VisualMeasurement[];
  readonly userFeedback?: string;
  readonly annotations?: readonly LiveAnnotation[];
  readonly cameraView?: string;
  readonly parameters?: Readonly<Record<string, unknown>>;
}

export type LiveToolEventType =
  | 'tool-started'
  | 'stage-changed'
  | 'progress-updated'
  | 'preview-updated'
  | 'render-completed'
  | 'revision-created'
  | 'waiting-for-review'
  | 'paused'
  | 'resumed'
  | 'approved'
  | 'failed'
  | 'stopped'
  | 'corrected'
  | 'reverted'
  | 'heartbeat';

export interface LiveToolEvent {
  readonly id: string;
  readonly sessionId: string;
  readonly type: LiveToolEventType;
  readonly timestamp: string;
  readonly message: string;
  readonly stage?: string;
  readonly revisionId?: string;
  readonly progress?: number;
  readonly previewUri?: string;
  readonly data?: Readonly<Record<string, unknown>>;
}

export interface LiveToolSession {
  readonly sessionId: string;
  readonly characterId: string;
  readonly characterRevision: string;
  readonly tool: LiveToolType;
  readonly specialist: string;
  readonly stage: string;
  readonly status: LiveSessionStatus;
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly progress: number;
  readonly activeAssetId: string;
  readonly activeRevisionId: string;
  readonly previewType: LivePreviewType;
  readonly previewUri: string;
  readonly toolState: LiveToolState;
  readonly checkpointId: string;
  readonly canPause: boolean;
  readonly canResume: boolean;
  readonly canStop: boolean;
  readonly canRetry: boolean;
  readonly canRevert: boolean;
  readonly lastMessage: string;
  readonly error?: string;
  readonly revisions?: readonly LiveRevision[];
  readonly events?: readonly LiveToolEvent[];
  readonly annotations?: readonly LiveAnnotation[];
  readonly measurements?: readonly VisualMeasurement[];
  readonly reviewRequired?: boolean;
  readonly activePart?: BodyPartId;
  readonly completedParts?: readonly BodyPartId[];
  readonly partFraming?: {
    readonly zoom: number;
    readonly yOffsetPercent: number;
    readonly focusRegion: string;
  };
}

export const WORKBENCH_3D_STAGES = [
  'Reference Alignment',
  'Base Blockout',
  'Proportion Match',
  'Silhouette Match',
  'Head / Face',
  'Torso / Body',
  'Clothing Volume',
  'Hair',
  'Shoes / Accessories',
  'Form Refinement / Silhouette Polish',
  'Retopo',
  'UV / Materials',
  'Rig',
  'Motion',
  'Godot Preview',
] as const;

export const REVIEW_REQUIRED_STAGES: ReadonlySet<string> = new Set([
  'Base Blockout',
  'Proportion Match',
  'Silhouette Match',
  'Head / Face',
  'Form Refinement / Silhouette Polish',
  'Final Model Before Rig',
]);

export function isStageReviewRequired(stage: string): boolean {
  return REVIEW_REQUIRED_STAGES.has(stage);
}

export function createLiveToolSession(params: {
  sessionId: string;
  characterId: string;
  characterRevision?: string;
  tool: LiveToolType;
  specialist?: string;
  stage?: string;
  status?: LiveSessionStatus;
  previewType?: LivePreviewType;
  previewUri?: string;
  toolState?: Partial<LiveToolState>;
  checkpointId?: string;
  activePart?: BodyPartId;
  completedParts?: readonly BodyPartId[];
}): LiveToolSession {
  const now = new Date().toISOString();
  const stage = params.stage ?? WORKBENCH_3D_STAGES[0];
  const charRev = params.characterRevision ?? 'mesh-v1';
  const status = params.status ?? 'idle';
  const activePart = params.activePart ?? 'head';
  const partDef = getBodyPartDefinition(activePart);

  return {
    sessionId: params.sessionId,
    characterId: params.characterId,
    characterRevision: charRev,
    tool: params.tool,
    specialist: params.specialist ?? `${params.tool}-specialist`,
    stage,
    status,
    startedAt: now,
    updatedAt: now,
    progress: 0,
    activeAssetId: params.characterId,
    activeRevisionId: charRev,
    previewType: params.previewType ?? 'render',
    previewUri: params.previewUri ?? '',
    toolState: {
      connected: params.toolState?.connected ?? false,
      pid: params.toolState?.pid,
      processName: params.toolState?.processName ?? params.tool,
      host: params.toolState?.host ?? '127.0.0.1',
      currentFile: params.toolState?.currentFile,
      activeAction: params.toolState?.activeAction ?? 'Idle',
      mode: params.toolState?.mode ?? 'live',
      lastHeartbeat: now,
    },
    checkpointId: params.checkpointId ?? 'checkpoint-init',
    canPause: status === 'working',
    canResume: status === 'paused',
    canStop: ['starting', 'working', 'waiting-for-review', 'paused'].includes(status),
    canRetry: ['waiting-for-review', 'failed', 'paused'].includes(status),
    canRevert: true,
    lastMessage: 'Session initialized',
    revisions: [],
    events: [],
    annotations: [],
    reviewRequired: isStageReviewRequired(stage),
    activePart,
    completedParts: params.completedParts ?? [],
    partFraming: {
      zoom: partDef.focusCrop.zoom,
      yOffsetPercent: partDef.focusCrop.yOffsetPercent,
      focusRegion: activePart,
    },
  };
}
