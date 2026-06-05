export interface SourceRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Origin {
  x: number;
  y: number;
}

export interface Keyframe {
  time: number;
  value: number;
  easing: 'linear' | 'easeInOut' | 'step' | 'spring';
}

export interface ControllerParams {
  speed: number;
  amplitude: number;
  phase: number;
  offset: number;
  min: number;
  max: number;
}

export interface AnimationController {
  id: string;
  targetPartId: string;
  property: 'x' | 'y' | 'rotation' | 'scaleX' | 'scaleY' | 'opacity';
  formulaPreset: string;
  enabled: boolean;
  params: ControllerParams;
  mode?: 'formula' | 'keyframe';
  keyframes?: Keyframe[];
}

export interface CharacterAnimation {
  id: string;
  name: string;
  duration: number;
  loop: boolean;
  controllers: AnimationController[];
}

export interface CharacterAsset {
  id: string;
  name: string;
  type: string;
  dataUrl: string;
  width: number;
  height: number;
}

export interface Constraint {
  type: 'lookAt' | 'copyRotation' | 'limitRotation';
  targetPartId: string;
  influence: number;
  offset: number;
  min?: number;
  max?: number;
}

export interface FrameAnimation {
  frameCount: number;
  fps: number;
  startFrame: number;
  columns: number;
  frameWidth: number;
  frameHeight: number;
}

export interface IKChain {
  targetPartId: string;
  chainLength: number;
  bendDirection: number;
}

export interface CharacterPart {
  id: string;
  name: string;
  parentId: string | null;
  baseX: number;
  baseY: number;
  baseRotation: number;
  baseScaleX: number;
  baseScaleY: number;
  origin: Origin;
  zIndex: number;
  color?: string;
  renderMode?: 'image' | 'shape';
  shapeType?: string;
  imageAssetId?: string;
  sourceRect?: SourceRect;
  visible?: boolean;
  locked?: boolean;
  opacity?: number;
  flipX?: boolean;
  flipY?: boolean;
  inheritTransform?: boolean;
  constraint?: Constraint;
  ikChain?: IKChain;
  frameAnimation?: FrameAnimation;
}

export interface CharacterProject {
  id: string;
  name: string;
  assets: CharacterAsset[];
  animations: CharacterAnimation[];
  parts: CharacterPart[];
  renderQuality?: 'pixel' | 'smooth';
  lastSelectedAnimId?: string;
  lastSelectedPartId?: string;
}

export interface SpriteSheetSource {
  dataUrl: string;
  width: number;
  height: number;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
  marginX: number;
  marginY: number;
  spacingX: number;
  spacingY: number;
}

export interface ExtractedSpritePart {
  id: string;
  name: string;
  sourceFrameIndex: number;
  sourceRect: SourceRect;
  pivot: Origin;
  dataUrl: string;
  width: number;
  height: number;
}
