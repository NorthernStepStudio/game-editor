import { ProjectState } from '../state/projectState';
import { exportToGDScript } from '@nstep-core/exporters/godot/gdscript';
import { exportToCanvas2D, exportStandaloneHTML } from '@nstep-core/exporters/canvas2d/runtime';
import { downloadFile } from '../shared/fileUtils';
import { normalizeProject } from '@nstep-core/schema/validators';
import { renderFrameToCanvas } from './frameRenderer';
import { exportToUnityCSharp } from './unityExporter';
import { zipSync } from 'fflate';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — gifenc has no bundled type declarations
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

export function exportJSON() {
  const { project } = ProjectState;
  const json = JSON.stringify(project, null, 2);
  const filename = project.name.replace(/\s+/g, '-') + '.motion.json';
  downloadFile(filename, json, 'application/json');
}

export function exportGodot() {
  const { project } = ProjectState;
  const code = exportToGDScript(project);
  const filename = project.name.replace(/\s+/g, '-') + '.gd';
  downloadFile(filename, code, 'text/plain');
}

export function exportCanvasRuntime() {
  const { project } = ProjectState;
  const { code } = exportToCanvas2D(project);
  const filename = project.name.replace(/\s+/g, '-') + '.runtime.ts';
  downloadFile(filename, code, 'text/typescript');
}

export function exportDemoHTML() {
  const { project } = ProjectState;
  const { code } = exportToCanvas2D(project);
  const html = exportStandaloneHTML(project, code);
  const filename = project.name.replace(/\s+/g, '-') + '.demo.html';
  downloadFile(filename, html, 'text/html');
}

export async function importJSON(file: File): Promise<any> {
  try {
    const text = await file.text();
    const p = JSON.parse(text);
    return normalizeProject(p);
  } catch (e) {
    alert('Invalid .motion.json file');
    return null;
  }
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

export interface SequenceExportOptions {
  animId:      string;
  fps:         number;
  width:       number;
  height:      number;
  bgColor:     string | null;
  onProgress?: (pct: number, label: string) => void;
}

function canvasToUint8Array(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) { reject(new Error('toBlob failed')); return; }
      blob.arrayBuffer().then(buf => resolve(new Uint8Array(buf)));
    }, 'image/png');
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Image sequence (ZIP of PNGs) ───────────────────────────────────────────────

export async function exportImageSequence(opts: SequenceExportOptions) {
  const { project } = ProjectState;
  const anim = (project.animations as any[]).find(a => a.id === opts.animId);
  if (!anim) throw new Error('Animation not found');

  const dur       = anim.duration || 1;
  const numFrames = Math.max(1, Math.round(dur * opts.fps));
  const files: Record<string, Uint8Array> = {};

  for (let i = 0; i < numFrames; i++) {
    const time   = i / opts.fps;
    const canvas = renderFrameToCanvas(project, opts.animId, time, {
      width:   opts.width,
      height:  opts.height,
      bgColor: opts.bgColor,
    });
    const name = `frame_${String(i).padStart(4, '0')}.png`;
    files[name] = await canvasToUint8Array(canvas);
    opts.onProgress?.(Math.round((i + 1) / numFrames * 100), `Frame ${i + 1} / ${numFrames}`);
    await new Promise(r => setTimeout(r, 0));
  }

  const zipped = zipSync(files, { level: 1 });
  const blob   = new Blob([zipped], { type: 'application/zip' });
  const slug   = project.name.replace(/\s+/g, '-');
  downloadBlob(blob, `${slug}-${anim.name.replace(/\s+/g, '-')}-sequence.zip`);
}

// ── Animated GIF ───────────────────────────────────────────────────────────────

export async function exportGIF(opts: SequenceExportOptions) {
  const { project } = ProjectState;
  const anim = (project.animations as any[]).find(a => a.id === opts.animId);
  if (!anim) throw new Error('Animation not found');

  const dur         = anim.duration || 1;
  const numFrames   = Math.max(1, Math.round(dur * opts.fps));
  const delayMs     = Math.round(1000 / opts.fps);
  const transparent = opts.bgColor === null;
  const gif         = GIFEncoder();

  for (let i = 0; i < numFrames; i++) {
    const time   = i / opts.fps;
    const canvas = renderFrameToCanvas(project, opts.animId, time, {
      width:   opts.width,
      height:  opts.height,
      bgColor: opts.bgColor,
    });
    const ctx       = canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const palette = quantize(imageData.data, 256, {
      format:      transparent ? 'rgba4444' : 'rgb565',
      oneBitAlpha: transparent,
    });
    const index = applyPalette(imageData.data, palette);

    const frameOpts: Record<string, any> = { palette, delay: delayMs };
    if (transparent) { frameOpts.transparent = true; frameOpts.transparentIndex = 0; }

    gif.writeFrame(index, canvas.width, canvas.height, frameOpts);

    opts.onProgress?.(Math.round((i + 1) / numFrames * 100), `Frame ${i + 1} / ${numFrames}`);
    await new Promise(r => setTimeout(r, 0));
  }

  gif.finish();
  const rawBytes = gif.bytes();
  const blob  = new Blob([new Uint8Array(rawBytes as ArrayBuffer)], { type: 'image/gif' });
  const slug  = project.name.replace(/\s+/g, '-');
  downloadBlob(blob, `${slug}-${anim.name.replace(/\s+/g, '-')}.gif`);
}

// ── Unity C# runtime ───────────────────────────────────────────────────────────

export function exportUnityCSharp(): string | null {
  const { project } = ProjectState;
  if (!project) return null;
  return exportToUnityCSharp(project);
}
