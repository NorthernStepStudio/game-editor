import type { IncomingMessage, ServerResponse } from 'node:http';
import type { StudioService } from './studioService.js';

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
): void {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

function decodeAssetId(value: string): string | undefined {
  try {
    const decoded = decodeURIComponent(value);
    if (!decoded || decoded.length > 240 || /[\u0000-\u001f]/.test(decoded)) {
      return undefined;
    }
    return decoded;
  } catch {
    return undefined;
  }
}

export async function foundryRoutes(
  request: IncomingMessage,
  response: ServerResponse,
  service: StudioService,
  readBody: () => Promise<unknown>,
): Promise<boolean> {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
  if (!pathname.startsWith('/api/foundry/')) return false;

  if (request.method === 'GET' && pathname === '/api/foundry/providers') {
    sendJson(response, 200, {
      providers: service.foundryGeneration.providers(),
    });
    return true;
  }

  if (request.method === 'GET' && pathname === '/api/foundry/projects') {
    sendJson(response, 200, {
      projects: service.foundryProjects.map((project) => ({ id: project.id, name: project.name })),
    });
    return true;
  }

  if (pathname === '/api/foundry/jobs') {
    if (request.method === 'POST') {
      try {
        sendJson(response, 202, { job: service.foundryGeneration.submitJob(await readBody()) });
      } catch (error) {
        sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
      }
      return true;
    }
    if (request.method === 'GET') {
      sendJson(response, 200, { jobs: service.foundryGeneration.listJobs() });
      return true;
    }
  }

  if (request.method === 'POST' && pathname === '/api/foundry/packs') {
    try {
      sendJson(response, 202, { jobs: service.foundryGeneration.submitPack(await readBody()) });
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }

  const jobMatch = /^\/api\/foundry\/jobs\/([a-f0-9-]{36})$/.exec(pathname);
  if (request.method === 'GET' && jobMatch) {
    const job = service.foundryGeneration.getJob(jobMatch[1]);
    if (!job) sendJson(response, 404, { error: 'Job not found.' });
    else sendJson(response, 200, { job });
    return true;
  }

  const sendMatch = /^\/api\/foundry\/assets\/([^/]+)\/send$/.exec(pathname);
  if (request.method === 'POST' && sendMatch) {
    const assetId = decodeAssetId(sendMatch[1]);
    const body = (await readBody()) as { projectId?: unknown };
    if (!assetId || typeof body?.projectId !== 'string') {
      sendJson(response, 400, { error: 'Provide an asset and a projectId.' });
      return true;
    }
    try {
      sendJson(response, 200, service.foundryAssets.sendToProject(assetId, body.projectId));
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }

  const fileMatch = /^\/api\/foundry\/assets\/([^/]+)\/files\/([^/]+)$/.exec(pathname);
  if (request.method === 'GET' && fileMatch) {
    const assetId = decodeAssetId(fileMatch[1]);
    const name = decodeAssetId(fileMatch[2]);
    const file = assetId && name ? service.foundryAssets.file(assetId, name) : undefined;
    if (!file) {
      sendJson(response, 404, { error: 'File not found for this asset.' });
      return true;
    }
    response.writeHead(200, {
      'Content-Type': file.contentType,
      'Content-Length': String(file.contentLength),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...(file.contentType.startsWith('image/') || file.contentType.startsWith('text/') || file.contentType.startsWith('application/json')
        ? {}
        : { 'Content-Disposition': `attachment; filename="${name!.replace(/[^a-zA-Z0-9_.-]/g, '_')}"` }),
    });
    response.end(file.bytes);
    return true;
  }

  if (request.method === 'POST' && pathname === '/api/foundry/generate') {
    const execution = await service.foundryGeneration.execute(await readBody());
    const assets = execution.manifests.map((manifest) =>
      service.foundryAssets.get(manifest.assetId),
    ).filter((asset) => asset !== undefined);

    sendJson(response, 201, {
      requestId: execution.request.requestId,
      provider: {
        id: execution.provider.id,
        name: execution.provider.name,
      },
      ...(execution.generated.cost
        ? { cost: execution.generated.cost }
        : {}),
      assets,
    });
    return true;
  }

  if (request.method !== 'GET') {
    sendJson(response, 405, { error: 'Foundry route does not support this method.' });
    return true;
  }

  if (pathname === '/api/foundry/assets') {
    const assets = service.foundryAssets.list();
    sendJson(response, 200, {
      assets,
      count: assets.length,
    });
    return true;
  }

  const match = /^\/api\/foundry\/assets\/([^/]+)(?:\/(lineage|preview))?$/.exec(
    pathname,
  );
  if (!match) {
    sendJson(response, 404, { error: 'Foundry route not found.' });
    return true;
  }

  const assetId = decodeAssetId(match[1]);
  if (!assetId) {
    sendJson(response, 400, { error: 'Invalid asset ID.' });
    return true;
  }

  const asset = service.foundryAssets.get(assetId);
  if (!asset) {
    sendJson(response, 404, { error: 'Asset not found.' });
    return true;
  }

  const action = match[2];
  if (action === 'lineage') {
    sendJson(response, 200, {
      assetId,
      lineage: service.foundryAssets.lineage(assetId),
    });
    return true;
  }

  if (action === 'preview') {
    const preview = service.foundryAssets.preview(assetId);
    if (!preview) {
      sendJson(response, 404, {
        error: 'A safe browser preview is not available for this asset.',
      });
      return true;
    }

    response.writeHead(200, {
      'Content-Type': preview.contentType,
      'Content-Length': String(preview.contentLength),
      'Cache-Control': 'no-store',
      ...(preview.contentHash
        ? { ETag: `"${preview.contentHash}"` }
        : {}),
    });
    response.end(preview.bytes);
    return true;
  }

  sendJson(response, 200, {
    asset,
    lineage: service.foundryAssets.lineage(assetId),
  });
  return true;
}
