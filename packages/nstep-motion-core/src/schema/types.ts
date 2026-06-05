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
