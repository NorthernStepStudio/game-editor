import { CutterAppState } from './spriteCutterState';

const sheetCanvas = () => document.getElementById('sheet-canvas') as HTMLCanvasElement;
const frameCanvas = () => document.getElementById('frame-canvas') as HTMLCanvasElement;

const sourceImg = new Image();

export function loadCutterImage(url: string) {
  sourceImg.onload = () => {
    if (CutterAppState.source) {
      CutterAppState.source.width = sourceImg.width;
      CutterAppState.source.height = sourceImg.height;
    }
    renderCutter();
  };
  sourceImg.src = url;
}

export function renderCutter() {
  renderSheet();
  renderFrame();
}

function renderSheet() {
  const canvas = sheetCanvas();
  if (!canvas || !CutterAppState.source) return;
  const ctx = canvas.getContext('2d')!;
  const s = CutterAppState.source;
  
  canvas.width = s.width;
  canvas.height = s.height;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(sourceImg, 0, 0);
  
  // Grid
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1;
  for (let r = 0; r < s.rows; r++) {
    for (let c = 0; c < s.columns; c++) {
      const x = s.marginX + c * (s.frameWidth + s.spacingX);
      const y = s.marginY + r * (s.frameHeight + s.spacingY);
      ctx.strokeRect(x, y, s.frameWidth, s.frameHeight);
      
      if (r * s.columns + c === CutterAppState.selectedFrameIndex) {
        ctx.fillStyle = 'rgba(122, 162, 247, 0.3)';
        ctx.fillRect(x, y, s.frameWidth, s.frameHeight);
        ctx.strokeStyle = '#7aa2f7';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, s.frameWidth, s.frameHeight);
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      }
    }
  }
}

function renderFrame() {
  const canvas = frameCanvas();
  if (!canvas || !CutterAppState.source) return;
  const ctx = canvas.getContext('2d')!;
  const s = CutterAppState.source;
  const idx = CutterAppState.selectedFrameIndex;
  const zoom = CutterAppState.zoom;
  
  const r = Math.floor(idx / s.columns);
  const c = idx % s.columns;
  const sx = s.marginX + c * (s.frameWidth + s.spacingX);
  const sy = s.marginY + r * (s.frameHeight + s.spacingY);

  canvas.width = s.frameWidth * zoom;
  canvas.height = s.frameHeight * zoom;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Checkerboard
  drawCheckerboard(ctx, canvas.width, canvas.height);
  
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sourceImg, sx, sy, s.frameWidth, s.frameHeight, 0, 0, canvas.width, canvas.height);
  
  // Pixel grid
  if (zoom > 4) {
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    for (let x = 0; x <= s.frameWidth; x++) {
      ctx.beginPath(); ctx.moveTo(x * zoom, 0); ctx.lineTo(x * zoom, canvas.height); ctx.stroke();
    }
    for (let y = 0; y <= s.frameHeight; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * zoom); ctx.lineTo(canvas.width, y * zoom); ctx.stroke();
    }
  }

  // Selection
  if (CutterAppState.selection) {
    const sel = CutterAppState.selection;
    ctx.strokeStyle = '#7aa2f7';
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(sel.x * zoom, sel.y * zoom, sel.w * zoom, sel.h * zoom);
    ctx.setLineDash([]);
  }

  // Pivot
  if (CutterAppState.selection && CutterAppState.pivot) {
    const p = CutterAppState.pivot;
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc((CutterAppState.selection.x + p.x) * zoom, (CutterAppState.selection.y + p.y) * zoom, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawCheckerboard(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const size = 8;
  for (let _i = 0; _i < w; _i += size) {
    for (let _j = 0; _j < h; _j += size) {
      ctx.fillStyle = ((_i / size + _j / size) % 2 === 0) ? '#1a1b26' : '#24283b';
      ctx.fillRect(_i, _j, size, size);
    }
  }
}

export function getFrameCoord(mouseX: number, mouseY: number) {
  if (!CutterAppState.source) return null;
  const zoom = CutterAppState.zoom;
  return {
    x: Math.floor(mouseX / zoom),
    y: Math.floor(mouseY / zoom)
  };
}
