import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

test('approved seven-page UI preserves real Matterhorn workflows without invented product surfaces', async () => {
  const dom = new JSDOM(
    await readFile(new URL('../web/index.html', import.meta.url), 'utf8'),
    { url: 'http://localhost/#home' },
  );
  const originals = new Map();
  for (const key of ['window', 'document', 'location', 'Option', 'EventSource', 'fetch']) {
    originals.set(key, globalThis[key]);
  }
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    location: dom.window.location,
    Option: dom.window.Option,
  });

  let run = null;
  const chatBodies = [];
  const completedRun = {
    id: 'promotion-run',
    status: 'completed',
    plan: {
      goal: 'Verified fixture',
      tasks: [{ id: 'verified', title: 'Verify', specialistId: 'flyrail' }],
      finalAcceptanceCriteria: ['Godot validation passes'],
    },
    tasks: [{ id: 'verified', status: 'completed' }],
  };
  globalThis.EventSource = class { close() {} };

  globalThis.fetch = async (path, options) => {
    const body = options?.body && JSON.parse(options.body);
    let data;

    if (path === '/health') data = { mode: 'mock' };
    else if (path === '/providers') data = { current: 'mock', providers: [{ id: 'mock', label: 'Mock', available: true }] };
    else if (path === '/api/studio/health') data = { available: false };
    else if (path === '/api/studio/runtime') data = [
      { capability: 'browser-control', title: 'Local browser', state: 'ready' },
      { capability: 'project-memory', title: 'Project memory', state: 'unavailable' },
      { capability: 'sandbox-execution', title: 'Safe execution', state: 'unavailable' },
      { capability: 'telemetry', title: 'Run insights', state: 'unavailable' },
      { capability: 'agent-evaluation', title: 'Agent validation', state: 'unavailable' },
    ];
    else if (path === '/api/studio/routing') data = {
      game: 'auto',
      threeD: 'auto',
      assets: 'auto',
      localFirst: true,
      requireCommercialUse: true,
      allowNetworkProviders: false,
      allowExternalCostProviders: false,
      updatedAt: '1970-01-01T00:00:00.000Z',
    };
    else if (path === '/api/foundry/assets') data = { assets: [] };
    else if (path === '/api/motion/characters') data = {
      characters: [
        {
          assetId: 'yun_urban_adventurer',
          displayName: 'Yun Urban Adventurer (Production Character)',
          type: 'character',
          meshFormat: 'GLB',
          rigStatus: 'Rigged (18 bones)',
          skinWeightStatus: 'Normalized (Clean Hierarchy)',
          animations: ['idle', 'walk', 'run', 'sprint', 'jump', 'turn'],
          godotValidated: true,
          previewUrl: '/previews/yun_urban_adventurer-front.png',
        },
      ],
      tombstones: [
        {
          assetId: 'yun_player_base',
          state: 'rejected',
          reason: 'Legacy bad-form character fixture rejected for Character Studio human review',
          lineage: 'historical-phase3h',
        },
      ],
      providers: [],
    };
    else if (path.startsWith('/api/characters/')) data = {
      character: {
        assetId: 'yun_urban_adventurer',
        displayName: 'Yun Urban Adventurer (Production Character)',
        referenceImages: { front: '/previews/yun_urban_adventurer-front.png' },
      },
    };
    else if (path === '/api/live-sessions') data = {
      sessions: [{
        sessionId: 'live-workbench-default',
        characterId: 'yun_urban_adventurer',
        characterRevision: 'mesh-v12',
        tool: 'blender',
        stage: 'Head / Face',
        activePart: 'head',
        completedParts: [],
        status: 'waiting-for-review',
        previewUri: '/previews/yun_urban_adventurer-front.png',
        checkpointId: 'head-polish-v3',
        toolState: { connected: true, mode: 'live' },
        measurements: [],
        revisions: [],
      }],
    };
    else if (path === '/api/studio/completion') data = {
      productionReadiness: 42,
      capabilityCoverage: 60,
      pillars: [],
      criticalNext: ['Run Gate 0 locally'],
    };
    else if (path === '/api/projects') data = [{ id: 'fixture', name: 'Fixture project' }];
    else if (path === '/api/studio/plan') data = {
      goal: body.goal,
      tasks: [{
        id: 'work',
        title: 'Implement',
        specialistId: 'flyrail',
        dependsOn: [],
        acceptanceCriteria: body.criteria,
      }],
      finalAcceptanceCriteria: body.criteria,
    };
    else if (path === '/api/studio/runs' && body) {
      run = {
        id: 'fixture-run',
        status: 'running',
        plan: {
          goal: body.goal,
          tasks: [{ id: 'work', title: 'Implement', specialistId: 'flyrail' }],
          finalAcceptanceCriteria: body.criteria,
        },
        tasks: [{ id: 'work', status: 'running' }],
      };
      data = run;
    }
    else if (path === '/api/studio/runs') data = run ? [completedRun, run] : [completedRun];
    else if (path === '/api/studio/runs/fixture-run/cancel') {
      run = { ...run, status: 'cancel-requested' };
      data = run;
    }
    else if (path === '/api/studio/runs/fixture-run') data = run;
    else if (path === '/api/studio/runs/promotion-run/promotion') data = {
      state: 'approval-required',
      eligible: true,
      detail: 'Execution is complete, but promotion still requires explicit human approval.',
    };
    else if (path === '/ask') {
      chatBodies.push(body);
      data = { response: 'Simulated chat response' };
    }
    else throw new Error(`Unexpected API ${path}`);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const flush = () => new Promise(resolve => setTimeout(resolve, 20));

  try {
    await import('../web/main.js');
    await flush();

    assert.equal(document.querySelector('#project').options.length, 2);
    assert.equal(document.querySelector('#project').value, 'fixture');
    assert.match(document.querySelector('#connection').textContent, /Connected|System Ready/);
    assert.match(document.querySelector('#runtime-capabilities').textContent, /Local browser/);
    assert.doesNotMatch(
      document.querySelector('#runtime-capabilities').textContent,
      /Graphiti|DeepEval|Langfuse|Browser Harness/,
    );

    const stack = document.querySelector('#studio-stack').textContent;
    assert.match(stack, /AGENT/);
    assert.match(stack, /ASSET GENERATOR/);
    assert.match(stack, /GAME ENGINE/);
    assert.match(stack, /Mock — choose a real model/);

    const primaryNav = [...document.querySelectorAll('.sidebar-nav a')].map(link => link.textContent.trim());
    assert.deepEqual(primaryNav, ['⌂Home', '⚡Create', '▣Runs', '□Projects', '◇Assets', '✓Validation', '⚙Settings']);

    for (const [hash, pageId] of [
      ['home', 'home'],
      ['create', 'create-page'],
      ['runs', 'runs-page'],
      ['projects', 'projects'],
      ['assets', 'assets-page'],
      ['validation', 'validation'],
      ['settings', 'settings'],
      ['studio', 'home'],
      ['pipeline', 'runs-page'],
      ['evidence', 'validation'],
    ]) {
      location.hash = `#${hash}`;
      window.dispatchEvent(new window.Event('hashchange'));
      await flush();
      assert.equal(document.querySelector(`#${pageId}`).hidden, false);
    }

    location.hash = '#characters/yun_urban_adventurer/model3d/refine';
    window.dispatchEvent(new window.Event('hashchange'));
    await flush();
    assert.ok(document.querySelector('#workbench-shell'));
    assert.ok(document.querySelector('.part-pipeline-list'));
    assert.match(document.querySelector('.part-pipeline-item.active').textContent, /Head & Face/);

    document.querySelector('#assistant-toggle').click();
    assert.equal(document.querySelector('#chat-drawer').hidden, false);
    document.querySelector('#assistant-close').click();
    assert.equal(document.querySelector('#chat-drawer').hidden, true);

    location.hash = '#assets';
    window.dispatchEvent(new window.Event('hashchange'));
    document.querySelector('#open-asset-generator').click();
    assert.equal(document.querySelector('#asset-generator').hidden, false);
    location.hash = '#validation';
    window.dispatchEvent(new window.Event('hashchange'));
    assert.equal(document.querySelector('#asset-generator').hidden, true);
    assert.equal(document.querySelector('#asset-inspector').hidden, true);

    location.hash = '#home';
    window.dispatchEvent(new window.Event('hashchange'));
    document.querySelector('#goal').value = 'Verify fixture';
    document.querySelector('#criteria').value = 'Godot validation passes';
    document.querySelector('#notice').hidden = false;
    document.querySelector('#notice').textContent = 'Previous planning error';
    document.querySelector('#run-form').dispatchEvent(new window.Event('submit', { cancelable: true }));
    await flush();
    assert.equal(document.querySelector('#plan-review').hidden, false);
    assert.equal(document.querySelector('#notice').hidden, true);

    document.querySelector('#start').click();
    await flush();
    assert.equal(document.querySelector('#runs-page').hidden, false);
    assert.match(document.querySelector('#active-run').textContent, /running/i);
    assert.match(document.querySelector('#home-runs').textContent, /Verify fixture/);

    [...document.querySelectorAll('#active-run button')]
      .find(button => button.textContent === 'Cancel run')
      .click();
    await flush();
    assert.match(document.querySelector('#active-run').textContent, /cancel-requested/);
    assert.match(document.querySelector('#runs').textContent, /cancel-requested/);
    assert.match(document.querySelector('#step-node-2').textContent, /Stopping|Cancellation requested/);
    assert.equal(
      [...document.querySelectorAll('#home-attention a')]
        .filter(link => link.textContent.includes('Verified fixture')).length,
      1,
    );

    document.querySelector('#assistant-toggle').click();
    for (const text of ['First question', 'Second question']) {
      document.querySelector('#prompt').value = text;
      document.querySelector('#chat-form').dispatchEvent(new window.Event('submit', { cancelable: true }));
      await flush();
    }
    assert.equal(chatBodies[1].history.length, 2);
    assert.equal(chatBodies[1].preferredAgentId, undefined);

    assert.equal(document.querySelector('#notice').hidden, true);
    assert.equal(document.querySelector('#releases'), null);
    assert.equal(document.querySelector('#characters'), null);
    assert.equal(document.querySelector('#specialists'), null);
  } finally {
    dom.window.close();
    for (const [key, value] of originals) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
});
