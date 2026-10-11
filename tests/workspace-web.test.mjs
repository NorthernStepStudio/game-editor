import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
const { startNssWorkspaceAiServer } = require('../server/out/server.js');

test('My Game works against the real local server: files, explain, safe proposals, add a game, honest play errors', async () => {
  const root = await mkdtemp(join(tmpdir(), 'matterhorn ui '));
  const project = join(root, 'project');
  const second = join(root, 'second game');
  await mkdir(project);
  await mkdir(second);
  await writeFile(join(project, 'project.godot'), 'config_version=5\n');
  await writeFile(join(project, 'player.gd'), 'extends Node\nvar speed = 1\n');
  await writeFile(join(second, 'project.godot'), 'config_version=5\n');

  const saved = Object.fromEntries(['MATTERHORN_PROJECTS', 'MATTERHORN_DATA_DIR', 'MATTERHORN_ASSET_LIBRARY', 'FLYRAIL_DAEMON_URL', 'FLYRAIL_DAEMON_TOKEN']
    .map((key) => [key, process.env[key]]));
  process.env.MATTERHORN_PROJECTS = JSON.stringify([{ id: 'fixture', name: 'Fixture', path: project }]);
  process.env.MATTERHORN_DATA_DIR = join(root, 'data');
  process.env.MATTERHORN_ASSET_LIBRARY = join(root, 'library');
  process.env.FLYRAIL_DAEMON_URL = 'ws://127.0.0.1:9';
  process.env.FLYRAIL_DAEMON_TOKEN = 'test-isolated';

  const server = await startNssWorkspaceAiServer({ port: 0, mCore: { providerMode: 'mock', requestTimeoutMs: 1000 } }, { portStateFilePath: false });
  const base = `http://127.0.0.1:${server.port}`;
  const dom = new JSDOM(await readFile(new URL('../web/index.html', import.meta.url), 'utf8'), { url: `${base}/#game/files`, pretendToBeVisual: true });
  const { window } = dom;
  const nativeFetch = globalThis.fetch;
  Object.assign(globalThis, {
    window, document: window.document, location: window.location, localStorage: window.localStorage,
    Node: window.Node, HTMLElement: window.HTMLElement,
    fetch: (path, options) => nativeFetch(new URL(path, window.location.href), options),
  });
  const until = async (predicate, what) => {
    const deadline = Date.now() + 8000;
    while (!predicate()) {
      if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}. Toast: ${document.querySelector('#toast')?.textContent}`);
      await new Promise((r) => setTimeout(r, 20));
    }
  };
  const button = (text, scope = document) => [...scope.querySelectorAll('button')].find((b) => b.textContent.trim() === text);

  try {
    // jsdom resolves module imports from the file system; the server only answers API calls.
    await import('../web/app.js');
    await until(() => document.querySelector('.file'), 'the file list');
    assert.deepEqual([...document.querySelectorAll('.file')].map((b) => b.textContent).sort(), ['player.gd', 'project.godot']);

    [...document.querySelectorAll('.file')].find((b) => b.textContent === 'player.gd').click();
    await until(() => document.querySelector('.file-view pre.code')?.textContent.includes('speed = 1'), 'file contents');

    button('Explain').click();
    await until(() => !document.querySelector('.file-view .explain').hidden && !/Reading/.test(document.querySelector('.file-view .explain').textContent), 'an explanation');

    document.querySelector('#edit-request').value = 'make the player faster';
    button('Propose the edit').click();
    await until(() => /Nothing was changed|Proposed edit/.test(document.querySelector('.file-view .explain').textContent), 'a proposal result');
    assert.equal(await readFile(join(project, 'player.gd'), 'utf8'), 'extends Node\nvar speed = 1\n', 'a proposal never edits the file by itself');

    // Play reports the real reason when Godot/Flyrail is not reachable.
    button('▶ Play in Godot').click();
    await until(() => document.querySelector('#toast').className.includes('error'), 'an honest play error');

    // Add a game from the UI: takes effect immediately.
    const picker = document.querySelector('#game-pick');
    picker.value = '__add';
    picker.dispatchEvent(new window.Event('change'));
    await until(() => document.querySelector('#game-name'), 'the add-game form');
    document.querySelector('#game-name').value = 'Second Game';
    document.querySelector('#game-path').value = second;
    button('Add game').click();
    await until(() => [...document.querySelectorAll('#game-pick option')].some((o) => o.textContent === 'Second Game'), 'the new game in the picker');
    const games = await (await nativeFetch(`${base}/api/projects`)).json();
    assert.ok(games.some((g) => g.name === 'Second Game'));

    const rejected = await nativeFetch(`${base}/api/projects`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Nope', path: root }) });
    assert.equal(rejected.status, 400, 'a folder without project.godot is refused');
  } finally {
    Object.assign(globalThis, { fetch: nativeFetch });
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});
