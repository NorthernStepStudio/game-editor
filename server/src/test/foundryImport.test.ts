import { strict as assert } from 'node:assert';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { FoundryAssetService } from '../services/foundryAssetService.js';
import { FoundryImporter } from '../services/foundryImport.js';

test('existing game and work files are imported once, with sources, previews and kinds', async () => {
  const root = await mkdtemp(join(tmpdir(), 'matterhorn-import-'));
  const game = join(root, 'Yun', 'assets');
  const work = join(root, 'artifacts');
  try {
    await mkdir(join(game, 'characters'), { recursive: true });
    await mkdir(join(game, 'sfx'), { recursive: true });
    await mkdir(join(game, 'music'), { recursive: true });
    await mkdir(join(game, 'ui'), { recursive: true });
    await mkdir(join(game, 'kenney', 'cars', 'Textures'), { recursive: true });
    await mkdir(join(work, 'yun-character-candidate', 'hero'), { recursive: true });
    await mkdir(join(work, 'environment', 'kit'), { recursive: true });
    await mkdir(join(work, 'backups', 'old'), { recursive: true });
    await writeFile(join(game, 'characters', 'hero.glb'), 'glb');
    await writeFile(join(game, 'sfx', 'jump.ogg'), 'ogg');
    await writeFile(join(game, 'music', 'theme.ogg'), 'ogg');
    await writeFile(join(game, 'ui', 'logo.png'), 'png');
    await writeFile(join(game, 'kenney', 'cars', 'sedan.glb'), 'glb');
    await writeFile(join(game, 'kenney', 'cars', 'Textures', 'colormap.png'), 'png');
    await writeFile(join(work, 'yun-character-candidate', 'hero', 'hero_v2.glb'), 'glb');
    await writeFile(join(work, 'yun-character-candidate', 'hero', 'hero_v2.blend'), 'blend');
    await writeFile(join(work, 'yun-character-candidate', 'hero', 'hero_v2-three-quarter.png'), 'png');
    await writeFile(join(work, 'yun-character-candidate', 'hero', 'hero_v2-front.png'), 'png');
    await writeFile(join(work, 'environment', 'kit', 'bench.blend'), 'blend');
    await writeFile(join(work, 'backups', 'old', 'stale.glb'), 'glb');

    const assets = new FoundryAssetService(join(root, 'data'), [{ id: 'yun', name: 'Yun', path: join(root, 'Yun') }], [work]);
    const importer = new FoundryImporter(assets, () => [
      { label: 'Yun', path: game, kind: 'game' },
      { label: 'artifacts', path: work, kind: 'workspace' },
    ], { renderPreviews: false });

    const first = await importer.scan();
    const all = assets.list();
    const by = (name: string) => all.find((a) => a.displayName === name);
    assert.equal(first.lastScan?.added, 7);
    assert.equal(by('Hero')?.type, 'mesh_3d');
    assert.equal(by('Hero')?.source, 'Yun game · characters');
    assert.equal(by('Jump')?.type, 'audio_sfx');
    assert.equal(by('Theme')?.type, 'audio_music');
    assert.equal(by('Logo')?.type, 'ui_icon');
    assert.equal(by('Sedan')?.sourceLicenseIds?.[0], 'CC0-1.0');
    assert.ok(!all.some((a) => a.displayName === 'Colormap'), 'texture folders are skipped');
    assert.ok(!all.some((a) => a.displayName === 'Stale'), 'backups are skipped');
    const candidate = by('Hero v2');
    assert.equal(candidate?.source, 'Yun character candidate · hero');
    assert.match(candidate?.previewUrl ?? '', /\/preview$/, 'existing render is the preview');
    assert.ok(candidate?.files?.some((f) => f.name === 'hero_v2.blend' && f.role === 'source'));
    assert.equal(assets.preview(candidate!.assetId)?.contentType, 'image/png');
    assert.equal(by('Bench')?.type, 'mesh_3d', 'Blender files without an export are imported');
    assert.ok(importer.status().previews.queued >= 3, 'models without a render are queued for a preview');

    const second = await importer.scan();
    assert.equal(second.lastScan?.added, 0, 'a rescan adds nothing new');
    assert.equal(assets.list().length, 7);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('a picture added from the computer joins the library as reference art, checked by its bytes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'matterhorn-picture-'));
  try {
    const assets = new FoundryAssetService(join(root, 'data'), [], []);
    const importer = new FoundryImporter(assets, () => [], { renderPreviews: false });
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('rest of a png')]);
    const added = importer.addPicture('Yun sheet.png', png);
    assert.match(added.assetId, /^pic_yun_sheet_[0-9a-f]{6}$/);
    assert.equal(added.type, 'concept_art');
    assert.ok(added.localPath?.startsWith(join(root, 'data', 'foundry-assets', 'pictures')));
    assert.equal(assets.meta(added.assetId)?.displayName, 'Yun sheet');
    // The same picture again is the same asset, not a copy.
    assert.equal(importer.addPicture('Yun sheet.png', png).assetId, added.assetId);
    assert.throws(() => importer.addPicture('notes.png', Buffer.from('<script>alert(1)</script>')), /Only PNG, JPG and WEBP/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
