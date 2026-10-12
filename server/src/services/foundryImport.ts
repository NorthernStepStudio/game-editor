import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import type { FoundryAssetManifest } from '../../../core/out/index.js';
import { findBlenderExecutable } from '../../../core/out/index.js';
import type { FoundryAssetService } from './foundryAssetService.js';

/**
 * Brings assets that already exist on disk (game folders, work folders) into the Foundry
 * library so everything made for a game is in one place. Files are referenced where they
 * are — never moved or copied — and get a preview: an existing render when there is one,
 * otherwise Blender renders one in the background.
 */

export interface ImportRoot {
  readonly label: string;
  readonly path: string;
  readonly kind: 'game' | 'workspace';
}

const SKIP_DIRS = new Set(['backups', 'archive', 'blender-work', 'textures', 'node_modules', '.godot', '.git', '.import', 'mockup-sandbox', 'review_boards', 'gate-0-live-proof', 'svg_source', 'generated', 'matterhorn']);
const MODEL_EXT = new Set(['.glb', '.gltf']);
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const AUDIO_EXT = new Set(['.ogg', '.wav', '.mp3']);
const RENDER_HINT = /(three[-_]?quarter|preview|front|render|thumb|turntable|beauty)/i;
/** Textures Godot extracts from an imported model (<model>_Image_0.png …): neither previews nor assets of their own. */
const GODOT_EXTRACTED = /_Image_\d+\.(png|webp|jpe?g)$/i;
const MAX_FILES = 3000;
export const MAX_PICTURE_BYTES = 25 * 1024 * 1024;

/** The file type from the picture's first bytes (never trust a name or a header for it). */
export function pictureExtension(bytes: Buffer): '.png' | '.jpg' | '.webp' | undefined {
  if (bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return '.png';
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return '.jpg';
  if (bytes.length > 12 && bytes.toString('latin1', 0, 4) === 'RIFF' && bytes.toString('latin1', 8, 12) === 'WEBP') return '.webp';
  return undefined;
}
/** Work-folder images are imported only from reference folders (sheets and views to build from). */
const REFERENCE_DIR = /(^|[\\/])(reference|references|views_isolated)([\\/]|$)/i;

export interface ImportStatus {
  readonly scanning: boolean;
  readonly lastScan?: { at: string; added: number; total: number; roots: number };
  readonly previews: { queued: number; done: number; failed: number };
  readonly error?: string;
}

export class FoundryImporter {
  private scanning = false;
  private lastScan?: ImportStatus['lastScan'];
  private error?: string;
  private readonly previewQueue: { assetId: string; source: string }[] = [];
  private previewsDone = 0;
  private previewsFailed = 0;
  private renderingPreviews = false;
  private readonly previewDir: string;

  constructor(
    private readonly assets: FoundryAssetService,
    private readonly roots: () => readonly ImportRoot[],
    private readonly options: { renderPreviews?: boolean } = {},
  ) {
    this.previewDir = resolve(assets.dataDirectory, 'foundry-assets', 'previews');
  }

  status(): ImportStatus {
    return {
      scanning: this.scanning,
      ...(this.lastScan ? { lastScan: this.lastScan } : {}),
      previews: { queued: this.previewQueue.length, done: this.previewsDone, failed: this.previewsFailed },
      ...(this.error ? { error: this.error } : {}),
    };
  }

  async scan(): Promise<ImportStatus> {
    if (this.scanning) return this.status();
    this.scanning = true;
    this.error = undefined;
    try {
      const roots = this.roots().filter((root) => existsSync(root.path));
      const known = new Set(this.assets.store.list().map((a) => a.assetId));
      const manifests: FoundryAssetManifest[] = [];
      const metas: { assetId: string; displayName: string; source: string }[] = [];
      for (const root of roots) {
        for (const candidate of this.collect(root)) {
          if (known.has(candidate.assetId)) continue;
          known.add(candidate.assetId);
          manifests.push({
            assetId: candidate.assetId,
            type: candidate.type,
            operation: 'import',
            sourceIds: [`import:${root.kind}:${root.label}`],
            sourceLicenseIds: [candidate.license],
            generationProvider: 'imported',
            createdAt: candidate.createdAt,
            contentHash: await hashFile(candidate.file),
            localPath: candidate.file,
            ...(candidate.preview ? { previewPath: candidate.preview } : {}),
            ...(candidate.companions.length ? { companionFiles: candidate.companions } : {}),
          });
          metas.push({ assetId: candidate.assetId, displayName: candidate.displayName, source: candidate.source });
          if (!candidate.preview && candidate.renderable) this.previewQueue.push({ assetId: candidate.assetId, source: candidate.file });
        }
      }
      if (manifests.length) {
        this.assets.store.registerMany(manifests);
        this.assets.setMetaMany(metas.map(({ assetId, displayName, source }) => [assetId, { displayName, source }]));
      }
      // Older imports without a preview get one too.
      for (const asset of this.assets.store.list()) {
        if (asset.generationProvider !== 'imported' || !asset.localPath) continue;
        // a preview that is really a texture Godot extracted counts as no preview
        if (asset.previewPath && !GODOT_EXTRACTED.test(asset.previewPath)) continue;
        if (this.assets.meta(asset.assetId)?.previewPath) continue;
        if (!/\.(glb|gltf|blend)$/i.test(asset.localPath)) continue;
        if (this.previewQueue.some((q) => q.assetId === asset.assetId)) continue;
        this.previewQueue.push({ assetId: asset.assetId, source: asset.localPath });
      }
      this.lastScan = { at: new Date().toISOString(), added: manifests.length, total: this.assets.store.list().length, roots: roots.length };
      if (this.options.renderPreviews !== false) void this.renderPreviews();
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
    } finally {
      this.scanning = false;
    }
    return this.status();
  }

  private *collect(root: ImportRoot) {
    const files: string[] = [];
    const walk = (dir: string, depth: number) => {
      if (depth > 10 || files.length >= MAX_FILES) return;
      let entries;
      try {
        entries = readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!SKIP_DIRS.has(entry.name.toLowerCase())) walk(full, depth + 1);
        } else if (entry.isFile()) {
          files.push(full);
        }
      }
    };
    walk(root.path, 0);

    const byDir = new Map<string, string[]>();
    for (const file of files) {
      const list = byDir.get(dirname(file)) ?? [];
      list.push(file);
      byDir.set(dirname(file), list);
    }

    for (const [dir, list] of byDir) {
      const models = list.filter((f) => MODEL_EXT.has(extname(f).toLowerCase()));
      const blends = list.filter((f) => extname(f).toLowerCase() === '.blend');
      const images = list.filter((f) => IMAGE_EXT.has(extname(f).toLowerCase()) && !GODOT_EXTRACTED.test(f));
      const audio = list.filter((f) => AUDIO_EXT.has(extname(f).toLowerCase()));
      const usedImages = new Set<string>();

      const imagesFor = (base: string) => images
        .filter((img) => stem(img).toLowerCase().startsWith(base.toLowerCase()))
        .sort((a, b) => rankRender(a) - rankRender(b));

      // 3D models; a .blend with the same name is their editable source.
      for (const model of models) {
        const base = stem(model);
        const renders = imagesFor(base);
        const fallback = renders.length ? [] : images.filter((img) => RENDER_HINT.test(basename(img)));
        const previews = renders.length ? renders : models.length === 1 ? fallback : [];
        previews.forEach((p) => usedImages.add(p));
        const blend = blends.find((b) => stem(b) === base);
        yield this.candidate(root, model, 'mesh_3d', previews[0], [...(blend ? [blend] : []), ...previews], true);
      }
      // Blender files with no exported model (kits, work files).
      for (const blend of blends) {
        if (models.some((m) => stem(m) === stem(blend))) continue;
        const renders = imagesFor(stem(blend));
        renders.forEach((p) => usedImages.add(p));
        yield this.candidate(root, blend, 'mesh_3d', renders[0], renders, true);
      }
      // Loose images are game art only in game folders; in work folders they are renders and boards.
      if (root.kind === 'game') {
        for (const image of images) {
          if (usedImages.has(image)) continue;
          const rel = relative(root.path, image).toLowerCase();
          const type = /(^|[\\/])ui([\\/]|$)|logo|icon/.test(rel) ? 'ui_icon'
            : /background|backdrop|sky/.test(rel) ? 'background'
              : /sprite|character/.test(rel) ? 'pixel_sprite' : 'texture';
          yield this.candidate(root, image, type, image, [], false);
        }
        for (const sound of audio) {
          const rel = relative(root.path, sound).toLowerCase();
          yield this.candidate(root, sound, /music|theme|loop|bgm/.test(rel) ? 'audio_music' : 'audio_sfx', undefined, [], false);
        }
      } else if (REFERENCE_DIR.test(relative(root.path, dir))) {
        // Reference art (character sheets, turnaround views) is what image-to-3D builds from.
        for (const image of images) {
          if (!usedImages.has(image)) yield this.candidate(root, image, 'concept_art', image, [], false);
        }
      }
      void dir;
    }
  }

  private candidate(root: ImportRoot, file: string, type: string, preview: string | undefined, companions: readonly string[], renderable: boolean) {
    const rel = relative(root.path, file).split(sep).join('/');
    const digest = createHash('sha1').update(`${root.label}/${rel}`).digest('hex').slice(0, 6);
    const slugged = `${root.label}_${rel}`.toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 90);
    const folder = dirname(rel);
    const source = root.kind === 'game'
      ? `${root.label} game${folder !== '.' ? ` · ${folder}` : ''}`
      : `${humanize(rel.split('/')[0] ?? root.label)}${folder.includes('/') ? ` · ${folder.split('/').slice(1).join('/')}` : ''}`;
    return {
      assetId: `imp_${slugged}_${digest}`,
      type,
      file,
      preview,
      companions: companions.filter((c) => c !== preview || companions.length > 1),
      renderable,
      createdAt: statSync(file).mtime.toISOString(),
      displayName: humanize(stem(file)),
      source,
      license: /kenney/i.test(rel) ? 'CC0-1.0' : 'project-owned',
    };
  }

  /**
   * A picture the owner adds from their computer (a character sheet, a front view): saved in the Matterhorn data
   * folder and added to the library as reference art, so it can be turned into a 3D model.
   */
  addPicture(name: string, bytes: Buffer): FoundryAssetManifest {
    const ext = pictureExtension(bytes);
    if (!ext) throw new Error('Only PNG, JPG and WEBP pictures can be added.');
    if (bytes.length > MAX_PICTURE_BYTES) throw new Error('The picture is larger than 25 MB.');
    const displayName = name.replace(/\.[a-z0-9]+$/i, '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 80) || 'Picture';
    const hash = createHash('sha256').update(bytes).digest('hex');
    const slugged = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'picture';
    const assetId = `pic_${slugged}_${hash.slice(0, 6)}`;
    const existing = this.assets.store.get(assetId);
    if (existing) return existing;
    const dir = resolve(this.assets.dataDirectory, 'foundry-assets', 'pictures');
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `${assetId}${ext}`);
    writeFileSync(file, bytes);
    const manifest: FoundryAssetManifest = {
      assetId,
      type: 'concept_art',
      operation: 'import',
      sourceIds: ['import:upload:owner'],
      sourceLicenseIds: ['project-owned'],
      generationProvider: 'imported',
      createdAt: new Date().toISOString(),
      contentHash: hash,
      localPath: file,
      previewPath: file,
    };
    this.assets.store.registerMany([manifest]);
    this.assets.setMetaMany([[assetId, { displayName, source: 'Added pictures' }]]);
    return manifest;
  }

  /** Renders a preview for imported 3D files that have none, one at a time, in the background. */
  private async renderPreviews(): Promise<void> {
    if (this.renderingPreviews) return;
    const blender = findBlenderExecutable();
    if (!blender) return;
    this.renderingPreviews = true;
    mkdirSync(this.previewDir, { recursive: true });
    const script = join(this.previewDir, 'matterhorn_preview.py');
    writeFileSync(script, PREVIEW_SCRIPT, 'utf8');
    try {
      while (this.previewQueue.length) {
        const job = this.previewQueue.shift()!;
        const out = join(this.previewDir, `${job.assetId}.png`);
        if (!existsSync(out)) {
          const ok = await runBlender(blender, ['--background', '--factory-startup', '--disable-autoexec', '--python-exit-code', '1', '--python', script, '--', job.source, out], 180_000);
          if (!ok || !existsSync(out)) {
            this.previewsFailed += 1;
            continue;
          }
        }
        this.assets.setMeta(job.assetId, { previewPath: out });
        this.previewsDone += 1;
      }
    } finally {
      this.renderingPreviews = false;
    }
  }
}

function stem(file: string): string {
  return basename(file, extname(file));
}

function rankRender(file: string): number {
  const name = basename(file).toLowerCase();
  if (/three[-_]?quarter/.test(name)) return 0;
  if (/preview/.test(name)) return 1;
  if (/front/.test(name)) return 2;
  if (RENDER_HINT.test(name)) return 3;
  return 4;
}

function humanize(text: string): string {
  const words = text.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function hashFile(file: string): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const hash = createHash('sha256');
    createReadStream(file).on('data', (chunk) => hash.update(chunk)).on('error', reject).on('end', () => resolvePromise(hash.digest('hex')));
  });
}

function runBlender(exe: string, args: string[], timeout: number): Promise<boolean> {
  return new Promise((resolvePromise) => {
    const child = spawn(exe, args, { windowsHide: true, stdio: 'ignore' });
    const timer = setTimeout(() => child.kill(), timeout);
    child.on('error', () => { clearTimeout(timer); resolvePromise(false); });
    child.on('close', (code) => { clearTimeout(timer); resolvePromise(code === 0); });
  });
}

const PREVIEW_SCRIPT = String.raw`
import bpy, sys, math
from mathutils import Vector
argv = sys.argv[sys.argv.index("--") + 1:]
src, out = argv[0], argv[1]
if src.lower().endswith(".blend"):
    bpy.ops.wm.open_mainfile(filepath=src, load_ui=False)
else:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)
scene = bpy.context.scene
for obj in list(scene.objects):
    if obj.type in {"CAMERA", "LIGHT"}:
        bpy.data.objects.remove(obj, do_unlink=True)
meshes = [o for o in scene.objects if o.type == "MESH" and o.visible_get()]
if not meshes:
    sys.exit(1)
deps = bpy.context.evaluated_depsgraph_get()
lo = Vector((1e9, 1e9, 1e9)); hi = Vector((-1e9, -1e9, -1e9))
for obj in meshes:
    ev = obj.evaluated_get(deps)
    for c in ev.bound_box:
        w = ev.matrix_world @ Vector(c)
        lo = Vector((min(lo.x, w.x), min(lo.y, w.y), min(lo.z, w.z)))
        hi = Vector((max(hi.x, w.x), max(hi.y, w.y), max(hi.z, w.z)))
center = (lo + hi) / 2
radius = max((hi - lo).length / 2, 0.05)
engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
scene.render.engine = next((e for e in engines if "EEVEE" in e), "BLENDER_WORKBENCH")
scene.render.film_transparent = True
scene.render.resolution_x = 512
scene.render.resolution_y = 512
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
world = bpy.data.worlds.new("PreviewWorld"); world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
if bg:
    bg.inputs[0].default_value = (0.42, 0.45, 0.5, 1.0); bg.inputs[1].default_value = 0.7
scene.world = world
s = radius * 4
for name, energy, offset in (("Key", 900, (-1.2, -1.6, 1.8)), ("Fill", 300, (1.6, -1.0, 0.8)), ("Rim", 500, (0.4, 1.8, 1.4))):
    data = bpy.data.lights.new(name, "AREA"); data.energy = energy * s * s / 16; data.size = s
    light = bpy.data.objects.new(name, data); scene.collection.objects.link(light)
    light.location = center + Vector(offset) * s
    light.rotation_euler = (center - light.location).to_track_quat("-Z", "Y").to_euler()
cam_data = bpy.data.cameras.new("PreviewCam"); cam_data.lens = 50
cam = bpy.data.objects.new("PreviewCam", cam_data); scene.collection.objects.link(cam); scene.camera = cam
az, el = math.radians(35), math.radians(22)
direction = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
dist = radius / math.sin(cam_data.angle / 2) * 1.08
cam_data.clip_start = max(dist - radius * 3, 0.001); cam_data.clip_end = dist + radius * 3
cam.location = center + direction * dist
cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.render.filepath = out
bpy.ops.render.render(write_still=True)
`;
