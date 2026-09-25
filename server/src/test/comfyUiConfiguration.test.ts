import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  configureComfyUiProvider,
  createStandardComfyUiWorkflow,
} from '../services/comfyUiConfiguration.js';

describe('ComfyUI server configuration', () => {
  it('stays unavailable until a checkpoint is configured', () => {
    const config = configureComfyUiProvider({});
    assert.equal(config.configured, false);
    assert.equal(config.provider, undefined);
    assert.match(config.note, /checkpoint/i);
  });

  it('builds a deterministic built-in text-to-image workflow', () => {
    const workflow = createStandardComfyUiWorkflow(
      {
        requestId: 'request-1',
        assetId: 'forest',
        kind: 'concept_art',
        operation: 'generate',
        prompt: 'Moonlit forest clearing',
        dimensions: { width: 640, height: 384 },
        seed: 42,
      },
      {
        checkpoint: 'local-model.safetensors',
        negativePrompt: 'watermark',
        steps: 24,
        cfg: 6.5,
      },
    ) as Record<string, { class_type: string; inputs: Record<string, unknown> }>;

    assert.equal(workflow['1'].class_type, 'CheckpointLoaderSimple');
    assert.equal(workflow['1'].inputs.ckpt_name, 'local-model.safetensors');
    assert.equal(workflow['2'].inputs.text, 'Moonlit forest clearing');
    assert.equal(workflow['3'].inputs.text, 'watermark');
    assert.equal(workflow['4'].inputs.width, 640);
    assert.equal(workflow['4'].inputs.height, 384);
    assert.equal(workflow['5'].inputs.seed, 42);
    assert.equal(workflow['5'].inputs.steps, 24);
    assert.equal(workflow['5'].inputs.cfg, 6.5);
    assert.equal(workflow['7'].class_type, 'SaveImage');
  });

  it('derives a stable seed when the request does not supply one', () => {
    const request = {
      requestId: 'stable-request',
      assetId: 'forest',
      kind: 'concept_art' as const,
      operation: 'generate' as const,
    };
    const first = createStandardComfyUiWorkflow(request, {
      checkpoint: 'model.safetensors',
    }) as Record<string, { inputs: Record<string, unknown> }>;
    const second = createStandardComfyUiWorkflow(request, {
      checkpoint: 'model.safetensors',
    }) as Record<string, { inputs: Record<string, unknown> }>;
    assert.equal(first['5'].inputs.seed, second['5'].inputs.seed);
  });

  it('rejects dimensions that ComfyUI latent images cannot represent cleanly', () => {
    assert.throws(
      () =>
        createStandardComfyUiWorkflow(
          {
            requestId: 'request-1',
            assetId: 'bad-size',
            kind: 'concept_art',
            operation: 'generate',
            dimensions: { width: 513, height: 512 },
          },
          { checkpoint: 'model.safetensors' },
        ),
      /divisible by 8/i,
    );
  });

  it('registers a local provider but keeps commercial use fail-closed by default', () => {
    const config = configureComfyUiProvider({
      MATTERHORN_COMFYUI_CHECKPOINT: 'model.safetensors',
    });
    assert.equal(config.configured, true);
    assert.equal(config.provider?.descriptor.id, 'comfyui-local');
    assert.equal(config.provider?.descriptor.local, true);
    assert.equal(config.provider?.descriptor.requiresNetwork, false);
    assert.equal(config.provider?.descriptor.externalCost, false);
    assert.equal(config.provider?.descriptor.commercialUseAllowed, false);
    assert.deepEqual(config.provider?.descriptor.operations, ['generate']);
    assert.deepEqual(config.provider?.descriptor.kinds, [
      'concept_art',
      'background',
      'texture',
    ]);
    assert.match(config.note, /license/i);
  });

  it('requires explicit license metadata before commercial use can be approved', () => {
    assert.throws(
      () =>
        configureComfyUiProvider({
          MATTERHORN_COMFYUI_CHECKPOINT: 'model.safetensors',
          MATTERHORN_COMFYUI_COMMERCIAL_USE_ALLOWED: 'true',
        }),
      /explicit license name/i,
    );

    const config = configureComfyUiProvider({
      MATTERHORN_COMFYUI_CHECKPOINT: 'model.safetensors',
      MATTERHORN_COMFYUI_COMMERCIAL_USE_ALLOWED: 'true',
      MATTERHORN_COMFYUI_OUTPUT_LICENSE_NAME: 'Model output license',
      MATTERHORN_COMFYUI_OUTPUT_LICENSE_CLASSIFICATION: 'permissive',
      MATTERHORN_COMFYUI_OUTPUT_REUSE_POLICY: 'direct',
      MATTERHORN_COMFYUI_OUTPUT_LICENSE_SPDX: 'MIT',
      MATTERHORN_COMFYUI_KINDS: 'concept_art,pixel_sprite',
    });
    assert.equal(config.provider?.descriptor.commercialUseAllowed, true);
    assert.equal(config.provider?.descriptor.outputLicense.name, 'Model output license');
    assert.equal(config.provider?.descriptor.outputLicense.spdxId, 'MIT');
    assert.deepEqual(config.provider?.descriptor.kinds, [
      'concept_art',
      'pixel_sprite',
    ]);
  });

  it('rejects non-loopback ComfyUI endpoints', () => {
    assert.throws(
      () =>
        configureComfyUiProvider({
          MATTERHORN_COMFYUI_CHECKPOINT: 'model.safetensors',
          MATTERHORN_COMFYUI_BASE_URL: 'https://example.com',
        }),
      /loopback/i,
    );
  });
});
