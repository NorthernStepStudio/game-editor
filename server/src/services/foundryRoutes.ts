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
