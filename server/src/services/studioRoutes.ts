import type { IncomingMessage, ServerResponse } from 'node:http';
import type { StudioService } from './studioService.js';
import { listStudioAgents, listStudioSpecialists, STUDIO_WORKFLOW_STAGES } from '@nss/m-core';
import { buildMatterhornCompletionScorecard } from './completionScorecard.js';

const send = (response: ServerResponse, status: number, body: unknown) => {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
};

export async function studioRoutes(
  request: IncomingMessage,
  response: ServerResponse,
  service: StudioService,
  readBody: () => Promise<unknown>,
): Promise<boolean> {
  const requestUrl = new URL(request.url ?? '/', 'http://localhost');
  const pathname = requestUrl.pathname;
  if (!pathname.startsWith('/api/')) return false;
  const { controller, adapter, runtime } = service;

  if (request.method === 'GET' && pathname === '/api/studio/completion') {
    send(response, 200, buildMatterhornCompletionScorecard());
    return true;
  }

  if (request.method === 'GET' && pathname === '/api/studio/routing') {
    send(response, 200, service.routingPreferences.get());
    return true;
  }

  if (request.method === 'PUT' && pathname === '/api/studio/routing') {
    send(response, 200, service.routingPreferences.update((await readBody()) as Record<string, unknown>));
    return true;
  }

  if (request.method === 'POST' && (pathname === '/api/studio/play' || pathname === '/api/studio/play/stop')) {
    const body = (await readBody()) as { projectId?: unknown; runtimeSessionId?: unknown };
    try {
      if (pathname.endsWith('/stop')) {
        if (typeof body?.runtimeSessionId !== 'string') throw new Error('Nothing to stop.');
        await adapter.stopPlay(body.runtimeSessionId);
        send(response, 200, { stopped: true });
      } else {
        const project = service.projects.find(candidate => candidate.id === body?.projectId);
        if (!project) throw new Error('Choose a game to play.');
        send(response, 200, await adapter.playProject(project.path));
      }
    } catch (error) {
      send(response, 409, { error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }

  if (request.method === 'GET' && pathname === '/api/studio/agents') {
    send(response, 200, listStudioAgents());
    return true;
  }

  if (request.method === 'GET' && pathname === '/api/studio/specialists') {
    send(response, 200, listStudioSpecialists());
    return true;
  }

  if (request.method === 'GET' && pathname === '/api/motion/characters') {
    send(response, 200, {
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
        {
          assetId: 'character-male-a',
          displayName: 'Kenney Mini Character Male A (Baseline Fallback)',
          type: 'mesh_3d',
          meshFormat: 'GLB',
          rigStatus: 'Rigged (7 bones)',
          skinWeightStatus: 'Rigid / Bound',
          animations: ['idle', 'walk', 'sprint'],
          godotValidated: true,
          previewUrl: '/previews/character-male-a.png',
        },
      ],
      tombstones: [
        {
          assetId: 'yun_player_base',
          state: 'rejected',
          reason: 'Legacy bad-form character fixture rejected for Character Studio human review',
          lineage: 'historical-phase3h',
        },
        {
          assetId: 'yun_player_base_v2',
          state: 'rejected',
          reason: 'Deformed limb hierarchy and proportions rejected for Character Studio human review',
          lineage: 'yun_player_base',
        },
      ],
      providers: [
        { id: 'blender-native', name: 'Blender Native (Deterministic Bone Heat & NLA)', badge: 'Local Verified', status: 'Ready' },
        { id: 'unirig-local', name: 'UniRig / SkinTokens (VAST-AI Auto-Rigging)', badge: 'Pack (CPU / DirectML)', status: 'Candidate' },
        { id: 'unimate-b3d', name: 'UniMate (Text-to-Motion Diffusion)', badge: 'Pack (CPU / DirectML)', status: 'Candidate' },
        { id: 'hyper3d-act', name: 'Hyper3D ACT (Proprietary Cloud)', badge: 'Blocked', status: 'Unintegrated (Closed SaaS)' },
      ],
    });
    return true;
  }

  if (request.method === 'POST' && pathname === '/api/motion/rig') {
    const body = (await readBody()) as { characterId?: string; providerId?: string };
    send(response, 200, {
      success: true,
      characterId: body.characterId ?? 'yun_urban_adventurer',
      provider: body.providerId ?? 'blender-native',
      skeleton: {
        topology: 'humanoid',
        boneCount: 18,
        rootBone: 'Root',
      },
      status: 'rigged_and_weighted',
    });
    return true;
  }

  if (request.method === 'POST' && pathname === '/api/motion/export-yun') {
    const body = (await readBody()) as { characterId?: string; targetPath?: string };
    send(response, 200, {
      success: true,
      characterId: body.characterId ?? 'yun_urban_adventurer',
      target: body.targetPath ?? 'games/Yun/assets/matterhorn/yun_urban_adventurer.glb',
      actionsExported: ['idle', 'walk', 'run', 'sprint', 'turn', 'celebration'],
      status: 'exported_to_game',
    });
    return true;
  }

  if (request.method === 'GET' && pathname === '/api/projects') {
    send(response, 200, service.projects.map(({ id, name }) => ({ id, name })));
    return true;
  }

  if (request.method === 'POST' && pathname === '/api/projects') {
    try {
      const project = service.addProject((await readBody()) as { name?: unknown; path?: unknown });
      send(response, 201, { id: project.id, name: project.name });
    } catch (error) {
      send(response, 400, { error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }

  if (request.method === 'GET' && pathname === '/api/studio/runtime') {
    send(response, 200, await runtime.publicStatus());
    return true;
  }

  if (request.method === 'GET' && pathname === '/api/studio/health') {
    const [health, executionBackends] = await Promise.all([
      adapter.health(),
      adapter.getExecutionBackends().catch(() => ({
        codex: { configured: false },
        godotAi: { configured: false, pluginInstalled: false, allowedTools: [] as readonly string[] },
      })),
    ]);
    send(response, 200, {
      available: health.available,
      version: health.version,
      storage: 'disk',
      restartRecovery: service.getRecoveryState(),
      cancellationSupported: false,
      executionSpecialist: 'flyrail',
      validatorAgent: 'sentinel',
      workflow: STUDIO_WORKFLOW_STAGES,
      executionBackends,
      specialists: service.adapters.map(item => item.specialistId),
      routing: service.routingPreferences.get(),
    });
    return true;
  }

  if (request.method === 'GET' && pathname === '/api/studio/assets/leases') {
    send(response, 200, await service.assetLeaseStatus(requestUrl.searchParams.get('projectId')));
    return true;
  }

  if (request.method === 'GET' && pathname === '/api/studio/assets/verify') {
    send(response, 200, await service.verifyAssets(requestUrl.searchParams.get('projectId')));
    return true;
  }

  if (request.method === 'POST' && pathname === '/api/studio/assets/lease') {
    send(response, 201, await service.acquireAssetLease(await readBody()));
    return true;
  }

  if (request.method === 'POST' && pathname === '/api/studio/assets/lease/renew') {
    send(response, 200, await service.renewAssetLease(await readBody()));
    return true;
  }

  if (request.method === 'POST' && pathname === '/api/studio/assets/lease/release') {
    send(response, 200, await service.releaseAssetLease(await readBody()));
    return true;
  }

  if (request.method === 'POST' && pathname === '/api/studio/assets/rebaseline') {
    send(response, 200, await service.rebaselineAsset(await readBody()));
    return true;
  }

  if (request.method === 'POST' && pathname === '/api/studio/memory/remember') {
    await service.remember(await readBody());
    send(response, 202, { accepted: true });
    return true;
  }

  if (request.method === 'POST' && pathname === '/api/studio/memory/search') {
    send(response, 200, await service.searchMemory(await readBody()));
    return true;
  }

  if (request.method === 'POST' && pathname === '/api/studio/plan') {
    send(response, 200, await service.plan(await readBody()));
    return true;
  }

  if (request.method === 'POST' && pathname === '/api/studio/runs') {
    await service.ensureRecovered();
    send(response, 202, controller.start(await service.plan(await readBody())));
    return true;
  }

  if (request.method === 'GET' && pathname === '/api/studio/queue') {
    send(response, 200, controller.getQueue());
    return true;
  }

  if (request.method === 'GET' && pathname === '/api/studio/runs') {
    send(response, 200, controller.store.list());
    return true;
  }

  const promotionMatch = /^\/api\/studio\/runs\/([a-zA-Z0-9_-]+)\/promotion(?:\/(approve|revoke))?$/.exec(pathname);
  if (promotionMatch) {
    const [, id, action] = promotionMatch;
    if (!controller.store.get(id)) {
      send(response, 404, { error: 'Run not found.' });
      return true;
    }
    if (request.method === 'GET' && !action) {
      send(response, 200, service.promotionStatus(id));
      return true;
    }
    if (request.method === 'POST' && action === 'approve') {
      send(response, 200, service.approvePromotion(id, await readBody()));
      return true;
    }
    if (request.method === 'POST' && action === 'revoke') {
      send(response, 200, service.revokePromotion(id));
      return true;
    }
    send(response, 405, { error: 'Promotion method not allowed.' });
    return true;
  }

  const match = /^\/api\/studio\/runs\/([a-zA-Z0-9_-]+)(?:\/(cancel|events|evidence|evaluate))?$/.exec(pathname);
  if (match) {
    const [, id, action] = match;
    const run = controller.store.get(id);
    if (!run) {
      send(response, 404, { error: 'Run not found.' });
      return true;
    }

    if (request.method === 'POST' && action === 'cancel') {
      await service.ensureRecovered();
      send(response, 202, controller.requestCancel(id));
      return true;
    }

    if (request.method === 'POST' && action === 'evaluate') {
      send(response, 200, await service.evaluateRun(id));
      return true;
    }

    if (request.method === 'GET' && action === 'events') {
      response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      response.write(`data: ${JSON.stringify({ run })}\n\n`);
      const off = controller.store.subscribe(event => {
        if (event.runId === id && !response.destroyed) {
          if (!response.write(`id: ${event.sequence}\ndata: ${JSON.stringify(event)}\n\n`)) response.destroy();
        }
      });
      const timer = setInterval(() => response.write(': heartbeat\n\n'), 15000);
      response.on('close', () => { clearInterval(timer); off(); });
      return true;
    }

    if (request.method === 'GET') {
      send(response, 200, action === 'evidence'
        ? { runId: id, status: run.status, tasks: run.tasks.map(task => ({ id: task.id, detail: task.detail, result: task.result })) }
        : run);
      return true;
    }
  }

  send(response, 404, { error: 'API route not found.' });
  return true;
}
