import { ExtractedSpritePart, CharacterPart } from '../../../../packages/nstep-motion-core/src/schema/types';
import { CutterAppState } from './spriteCutterState';
import { ProjectState } from '../state/projectState';
import { DirtyState } from '../state/dirtyState';

export function extractSelectedPart(name: string): ExtractedSpritePart | null {
  if (!CutterAppState.source || !CutterAppState.selection) {
    alert('Please upload a sprite sheet and draw a selection rectangle first.');
    return null;
  }
  
  const s = CutterAppState.source;
  const sel = CutterAppState.selection;
  
  // Guard against tiny or invalid selections
  if (sel.w < 1 || sel.h < 1) {
    alert('Selection area is too small.');
    return null;
  }

  // Guard against huge selections (performance)
  if (sel.w > 4096 || sel.h > 4096) {
    alert('Selection area is too large.');
    return null;
  }

  const idx = CutterAppState.selectedFrameIndex;
  const r = Math.floor(idx / s.columns);
  const c = idx % s.columns;
  const sx = s.marginX + c * (s.frameWidth + s.spacingX) + sel.x;
  const sy = s.marginY + r * (s.frameHeight + s.spacingY) + sel.y;
  
  const canvas = document.createElement('canvas');
  canvas.width = sel.w;
  canvas.height = sel.h;
  const ctx = canvas.getContext('2d')!;
  
  const sourceImg = new Image();
  sourceImg.src = s.dataUrl;
  
  ctx.drawImage(sourceImg, sx, sy, sel.w, sel.h, 0, 0, sel.w, sel.h);

  // Check if selection is empty/transparent
  const pixels = ctx.getImageData(0, 0, sel.w, sel.h).data;
  let hasVisible = false;
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] > 2) {
      hasVisible = true;
      break;
    }
  }

  if (!hasVisible) {
    alert('The selected area is completely transparent.');
    return null;
  }
  
  let finalCanvas = canvas;
  let finalWidth = sel.w;
  let finalHeight = sel.h;
  let offset = { x: 0, y: 0 };

  if (CutterAppState.autoTrim) {
    const trimmed = trimCanvas(canvas);
    finalCanvas = trimmed.canvas;
    finalWidth = trimmed.width;
    finalHeight = trimmed.height;
    offset = trimmed.offset;
  }

  let pivotX = finalWidth / 2;
  let pivotY = finalHeight / 2;

  if (CutterAppState.pivot) {
    pivotX = CutterAppState.pivot.x - offset.x;
    pivotY = CutterAppState.pivot.y - offset.y;
  }

  const part: ExtractedSpritePart = {
    id: 'extracted-' + Date.now(),
    name: name || 'part',
    sourceFrameIndex: idx,
    sourceRect: { x: sx, y: sy, width: sel.w, height: sel.h },
    pivot: { x: pivotX, y: pivotY },
    dataUrl: finalCanvas.toDataURL(),
    width: finalWidth,
    height: finalHeight
  };

  CutterAppState.extractedParts.push(part);
  return part;
}

function trimCanvas(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;
  const pixels = ctx.getImageData(0, 0, w, h);
  const l = pixels.data.length;
  let bound = { top: h, left: w, bottom: 0, right: 0 };
  
  let hasContent = false;
  for (let i = 0; i < l; i += 4) {
    if (pixels.data[i + 3] > 0) {
      hasContent = true;
      const x = (i / 4) % w;
      const y = Math.floor((i / 4) / w);
      if (x < bound.left) bound.left = x;
      if (x > bound.right) bound.right = x;
      if (y < bound.top) bound.top = y;
      if (y > bound.bottom) bound.bottom = y;
    }
  }

  if (!hasContent) return { canvas, width: w, height: h, offset: { x: 0, y: 0 } };

  const trimW = bound.right - bound.left + 1;
  const trimH = bound.bottom - bound.top + 1;
  const trimCanvas = document.createElement('canvas');
  trimCanvas.width = trimW;
  trimCanvas.height = trimH;
  const trimCtx = trimCanvas.getContext('2d')!;
  trimCtx.drawImage(canvas, bound.left, bound.top, trimW, trimH, 0, 0, trimW, trimH);
  
  return {
    canvas: trimCanvas,
    width: trimW,
    height: trimH,
    offset: { x: bound.left, y: bound.top }
  };
}

export function sendPartsToEditor() {
  if (CutterAppState.extractedParts.length === 0) {
    alert('No parts to send. Extract some parts first.');
    return;
  }
  
  const source = CutterAppState.source!;
  
  CutterAppState.extractedParts.forEach((part, index) => {
    const assetId = 'asset-' + part.id;
    if (!ProjectState.project.assets) ProjectState.project.assets = [];
    
    // 1. Add Asset
    ProjectState.project.assets.push({
      id: assetId,
      name: part.name,
      type: 'image/png',
      dataUrl: part.dataUrl,
      width: part.width,
      height: part.height
    });
    
    // 2. Calculate frame-relative position
    // We want parts from the same frame to stay aligned.
    // Reference point: center of the source frame.
    const frameR = Math.floor(part.sourceFrameIndex / source.columns);
    const frameC = part.sourceFrameIndex % source.columns;
    const frameX = source.marginX + frameC * (source.frameWidth + source.spacingX);
    const frameY = source.marginY + frameR * (source.frameHeight + source.spacingY);
    const frameCenterX = frameX + source.frameWidth / 2;
    const frameCenterY = frameY + source.frameHeight / 2;

    // Part center in sheet space
    const partCenterX = part.sourceRect.x + part.sourceRect.width / 2;
    const partCenterY = part.sourceRect.y + part.sourceRect.height / 2;

    const relX = partCenterX - frameCenterX;
    const relY = partCenterY - frameCenterY;

    // 3. Create CharacterPart
    const newPart: CharacterPart = {
      id: 'part-' + part.id,
      name: part.name,
      parentId: null,
      baseX: relX,
      baseY: relY,
      baseRotation: 0,
      baseScaleX: 1,
      baseScaleY: 1,
      origin: { x: part.pivot.x, y: part.pivot.y },
      zIndex: 10 + index, // Slight stack
      renderMode: 'image',
      imageAssetId: assetId
    };
    
    ProjectState.project.parts.push(newPart);
  });
  
  DirtyState.markDirty();
  alert(`Sent ${CutterAppState.extractedParts.length} parts to the Motion Editor.`);
}

export function detectFrames() {
  if (!CutterAppState.source || !CutterAppState.source.dataUrl) return;
  const s = CutterAppState.source;
  
  if (s.width > 0 && s.height > 0) {
    if (s.height < 64) {
       s.frameHeight = s.height;
       s.frameWidth = s.height;
       s.columns = Math.floor(s.width / s.frameWidth);
       s.rows = 1;
    } else {
       s.frameWidth = 32;
       s.frameHeight = 32;
       s.columns = Math.floor(s.width / 32);
       s.rows = Math.floor(s.height / 32);
    }
  }
}

export async function cleanupSelection(targetColor: string, tolerance: number): Promise<boolean> {
  if (!CutterAppState.source || !CutterAppState.selection) return false;
  
  const s = CutterAppState.source;
  const sel = CutterAppState.selection;
  
  const canvas = document.createElement('canvas');
  canvas.width = s.width;
  canvas.height = s.height;
  const ctx = canvas.getContext('2d')!;
  
  const img = new Image();
  img.src = s.dataUrl;
  await new Promise(r => img.onload = r);
  
  ctx.drawImage(img, 0, 0);
  
  // Calculate area in sheet space
  const idx = CutterAppState.selectedFrameIndex;
  const r = Math.floor(idx / s.columns);
  const c = idx % s.columns;
  const sx = s.marginX + c * (s.frameWidth + s.spacingX) + sel.x;
  const sy = s.marginY + r * (s.frameHeight + s.spacingY) + sel.y;
  
  const imageData = ctx.getImageData(sx, sy, sel.w, sel.h);
  const data = imageData.data;
  
  const targetR = parseInt(targetColor.slice(1, 3), 16);
  const targetG = parseInt(targetColor.slice(3, 5), 16);
  const targetB = parseInt(targetColor.slice(5, 7), 16);
  
  for (let i = 0; i < data.length; i += 4) {
    const dr = data[i] - targetR;
    const dg = data[i+1] - targetG;
    const db = data[i+2] - targetB;
    const dist = Math.sqrt(dr*dr + dg*dg + db*db);
    
    if (dist <= tolerance) {
      data[i+3] = 0; // Transparent
    }
  }
  
  ctx.putImageData(imageData, sx, sy);
  s.dataUrl = canvas.toDataURL();
  return true;
}
