import { SpriteSheetSource, ExtractedSpritePart } from '../../../../packages/nstep-motion-core/src/schema/types';

export interface CutterState {
  currentPage: 'editor' | 'cutter';
  source: SpriteSheetSource | null;
  selectedFrameIndex: number;
  
  // UI state
  zoom: number;
  selection: { x: number; y: number; w: number; h: number } | null;
  pivot: { x: number; y: number } | null;
  isDraggingSelection: boolean;
  autoTrim: boolean;
  keepOriginalSize: boolean;
  
  extractedParts: ExtractedSpritePart[];
}

export const CutterAppState: CutterState = {
  currentPage: 'editor',
  source: null,
  selectedFrameIndex: 0,
  extractedParts: [],
  zoom: 2.0,
  selection: null,
  pivot: null,
  isDraggingSelection: false,
  autoTrim: true,
  keepOriginalSize: false,
};
