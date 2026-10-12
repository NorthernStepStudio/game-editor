import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname } from 'node:path';
import type { StudioService } from './studioService.js';
import { MAX_PICTURE_BYTES } from './foundryImport.js';

/** The request body as bytes, refused once it passes the limit. */
function readRawBody(request: IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('The picture is larger than 25 MB.'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolvePromise(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}

const LIVE_IMAGE_TYPES: Readonly<Record<string, string>> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

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
  const url = new URL(request.url ?? '/', 'http://localhost');
  const pathname = url.pathname;
  if (!pathname.startsWith('/api/foundry/')) return false;

  if (request.method === 'GET' && pathname === '/api/foundry/providers') {
    sendJson(response, 200, {
      providers: service.foundryGeneration.providers(),
    });
    return true;
  }

  if (pathname === '/api/foundry/import' && request.method === 'GET') {
    sendJson(response, 200, service.foundryImporter.status());
    return true;
  }
  if (pathname === '/api/foundry/import/picture' && request.method === 'POST') {
    try {
      const bytes = await readRawBody(request, MAX_PICTURE_BYTES);
      const manifest = service.foundryImporter.addPicture(url.searchParams.get('name') ?? 'Picture', bytes);
      sendJson(response, 200, { assetId: manifest.assetId });
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }
  if (pathname === '/api/foundry/import/scan' && request.method === 'POST') {
    sendJson(response, 200, await service.foundryImporter.scan());
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

  const liveMatch = /^\/api\/foundry\/jobs\/([a-f0-9-]{36})\/live(\/image)?$/.exec(pathname);
  if (request.method === 'GET' && liveMatch) {
    if (liveMatch[2]) {
      const requested = Number.parseInt(url.searchParams.get('i') ?? '', 10);
      const image = service.foundryGeneration.liveImage(liveMatch[1], Number.isInteger(requested) && requested >= 0 ? requested : undefined);
      const type = image ? LIVE_IMAGE_TYPES[extname(image).toLowerCase()] : undefined;
      if (!image || !type) {
        sendJson(response, 404, { error: 'No image yet.' });
      } else {
        const bytes = readFileSync(image);
        response.writeHead(200, { 'Content-Type': type, 'Content-Length': String(bytes.length), 'Cache-Control': 'no-store' });
        response.end(bytes);
      }
      return true;
    }
    const live = service.foundryGeneration.liveView(liveMatch[1]);
    if (!live) sendJson(response, 404, { error: 'Job not found.' });
    else sendJson(response, 200, live);
    return true;
  }

  const jobAction = /^\/api\/foundry\/jobs\/([a-f0-9-]{36})\/(cancel|retry)$/.exec(pathname);
  if (request.method === 'POST' && jobAction) {
    try {
      const body = (await readBody()) as { providerId?: unknown } | undefined;
      const job = jobAction[2] === 'cancel'
        ? service.foundryGeneration.cancelJob(jobAction[1])
        : service.foundryGeneration.retryJob(jobAction[1], { providerId: body?.providerId });
      sendJson(response, jobAction[2] === 'cancel' ? 200 : 202, { job });
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }

  if (pathname === '/api/foundry/styles') {
    if (request.method === 'GET') {
      sendJson(response, 200, { styles: service.foundryStyles.list() });
      return true;
    }
    if (request.method === 'POST') {
      try {
        sendJson(response, 201, { style: service.foundryStyles.create(await readBody()) });
      } catch (error) {
        sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
      }
      return true;
    }
  }
  const styleMatch = /^\/api\/foundry\/styles\/([a-f0-9-]{36})\/delete$/.exec(pathname);
  if (request.method === 'POST' && styleMatch) {
    const removed = service.foundryStyles.delete(styleMatch[1]);
    sendJson(response, removed ? 200 : 404, removed ? { deleted: true } : { error: 'Style not found.' });
    return true;
  }

  const metaMatch = /^\/api\/foundry\/assets\/([^/]+)\/(rename|hide|show|keep)$/.exec(pathname);
  if (request.method === 'POST' && metaMatch) {
    const assetId = decodeAssetId(metaMatch[1]);
    if (!assetId) {
      sendJson(response, 400, { error: 'Invalid asset ID.' });
      return true;
    }
    try {
      const action = metaMatch[2];
      if (action === 'keep') {
        sendJson(response, 200, { assets: service.foundryAssets.keepDraft(assetId) });
      } else if (action === 'rename') {
        const body = (await readBody()) as { displayName?: unknown };
        const name = typeof body?.displayName === 'string' ? body.displayName.trim() : '';
        if (!name || name.length > 80) throw new Error('Names must be 1–80 characters.');
        sendJson(response, 200, { asset: service.foundryAssets.setMeta(assetId, { displayName: name }) });
      } else {
        sendJson(response, 200, { asset: service.foundryAssets.setMeta(assetId, { hidden: action === 'hide' ? true : undefined }) });
      }
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }

  if (request.method === 'POST' && pathname === '/api/foundry/assets/bulk') {
    try {
      const body = (await readBody()) as { action?: unknown; assetIds?: unknown; category?: unknown };
      if (typeof body?.action !== 'string' || !Array.isArray(body.assetIds) || !body.assetIds.every((id) => typeof id === 'string')) {
        throw new Error('Send an action and a list of asset IDs.');
      }
      sendJson(response, 200, service.foundryAssets.bulk(body.action, body.assetIds as string[], typeof body.category === 'string' ? body.category : undefined));
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }

  if (pathname === '/api/foundry/trash' && request.method === 'GET') {
    sendJson(response, 200, { items: service.foundryAssets.trash() });
    return true;
  }
  const trashMatch = /^\/api\/foundry\/trash\/(empty|([a-zA-Z0-9_.-]+)\/restore)$/.exec(pathname);
  if (request.method === 'POST' && trashMatch) {
    try {
      if (trashMatch[1] === 'empty') sendJson(response, 200, { deleted: service.foundryAssets.emptyTrash() });
      else sendJson(response, 200, { asset: service.foundryAssets.restore(trashMatch[2]) });
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }

  const rigMatch = /^\/api\/foundry\/assets\/([^/]+)\/rig-setup$/.exec(pathname);
  if (request.method === 'POST' && rigMatch) {
    const assetId = decodeAssetId(rigMatch[1]);
    if (!assetId) {
      sendJson(response, 400, { error: 'Invalid asset ID.' });
      return true;
    }
    try {
      const setup = await service.foundryGeneration.rigSetup(assetId);
      const image = readFileSync(setup.frontImage);
      sendJson(response, 200, {
        joints: setup.joints,
        frame: setup.frame,
        height: setup.height,
        clips: setup.clips,
        image: `data:image/png;base64,${image.toString('base64')}`,
      });
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
    }
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
