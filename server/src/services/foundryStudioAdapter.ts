import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import type {
  NssStudioArtifactRef,
  NssStudioEvidence,
  NssStudioExecutionResult,
  NssStudioFoundryTaskSpec,
  NssStudioHandoff,
} from '../../../core/out/index.js';
import {
  SpecialistError,
  type SpecialistAdapter,
  type SpecialistCancelResult,
  type SpecialistCapabilitySet,
  type SpecialistHealthResult,
  type SpecialistTaskHandle,
  type SpecialistTaskStatus,
} from '../../../core/out/index.js';
import type { FoundryGenerationService } from './foundryGenerationService.js';
import type { FoundryAssetService } from './foundryAssetService.js';

interface FoundryRun {
  readonly taskId: string;
  phase: 'accepted' | 'running' | 'completed' | 'failed' | 'cancelled';
  detail?: string;
  result?: NssStudioExecutionResult;
}

export function foundryAssetOutputCriterion(assetId: string): string {
  return `Foundry asset ${assetId} is generated, hashed, and registered.`;
}

/** Adapts Studio tasks to the existing Foundry generation and provenance stores. */
export class FoundryStudioAdapter implements SpecialistAdapter {
  readonly specialistId = 'foundry' as const;
  private readonly runs = new Map<string, FoundryRun>();

  constructor(
    private readonly generation: FoundryGenerationService,
    private readonly assets: FoundryAssetService,
  ) {}

  async health(): Promise<SpecialistHealthResult> {
    const providers = this.generation.providers();
    const configured = providers.filter(provider => provider.configured);
    return {
      available: configured.length > 0,
      specialistId: this.specialistId,
      protocolVersion: '1.0.0',
      capabilities: ['foundry.asset.generate', ...configured.map(provider => `foundry.provider.${provider.id}`)],
      detail: configured.length
        ? `Configured providers: ${configured.map(provider => provider.id).join(', ')}.`
        : 'No Foundry asset provider is configured. Configure ComfyUI locally or an approved server-side provider.',
    };
  }

  async getCapabilities(): Promise<SpecialistCapabilitySet> {
    const health = await this.health();
    return {
      specialistId: this.specialistId,
      protocolVersion: '1.0.0',
      capabilities: health.capabilities ?? [],
    };
  }

  async submitTask(handoff: NssStudioHandoff): Promise<SpecialistTaskHandle> {
    const taskId = handoff.taskId || handoff.id;
    if (handoff.to !== this.specialistId) {
      throw new SpecialistError('INVALID_TASK', `Foundry adapter cannot accept task for ${handoff.to}.`);
    }
    if (!taskId || this.runs.has(taskId)) {
      throw new SpecialistError('INVALID_TASK', 'Foundry task ID is missing or already active.');
    }

    const run: FoundryRun = { taskId, phase: 'accepted' };
    this.runs.set(taskId, run);
    queueMicrotask(() => { void this.execute(run, handoff); });
    return { taskId, specialistId: this.specialistId, accepted: true };
  }

  async getTaskStatus(taskId: string): Promise<SpecialistTaskStatus> {
    const run = this.runs.get(taskId);
    if (!run) {
      return { taskId, specialistId: this.specialistId, phase: 'unknown', detail: 'Foundry run state is unavailable; generation will not be resubmitted automatically.' };
    }
    const phase = run.phase === 'failed' ? 'failed' : run.phase;
    return { taskId, specialistId: this.specialistId, phase, detail: run.detail };
  }

  async getResult(taskId: string): Promise<NssStudioExecutionResult> {
    const run = this.runs.get(taskId);
    if (!run?.result) {
      throw new SpecialistError('TRANSPORT_ERROR', `Foundry result is not available for ${taskId}.`, { recoverable: true });
    }
    return structuredClone(run.result);
  }

  async cancelTask(taskId: string): Promise<SpecialistCancelResult> {
    const run = this.runs.get(taskId);
    if (!run) return { taskId, cancelled: false, detail: 'Foundry run state is unavailable.' };
    if (run.phase === 'completed' || run.phase === 'failed' || run.phase === 'cancelled') {
      return { taskId, cancelled: run.phase === 'cancelled', detail: run.detail };
    }
    return { taskId, cancelled: false, detail: 'The configured Foundry provider does not support confirmed cancellation; waiting for generation to settle.' };
  }

  private async execute(run: FoundryRun, handoff: NssStudioHandoff): Promise<void> {
    run.phase = 'running';
    const rawSpec = handoff.taskSpec;
    if (!isFoundrySpec(rawSpec)) {
      this.fail(run, handoff, 'Studio task is missing a valid structured Foundry generation specification.');
      return;
    }

    try {
      const execution = await this.generation.execute({
        projectId: rawSpec.projectId,
        assetId: rawSpec.assetId,
        kind: rawSpec.kind,
        operation: rawSpec.operation,
        prompt: rawSpec.prompt,
        parentAsset: rawSpec.parentAsset,
        referenceAssets: rawSpec.referenceAssets,
        width: rawSpec.width,
        height: rawSpec.height,
        providerId: rawSpec.providerId,
        allowNetwork: rawSpec.allowNetwork,
        approveExternalCost: rawSpec.approveExternalCost,
        maxCost: rawSpec.maxCost,
        requireCommercialUse: rawSpec.requireCommercialUse,
      });

      if (
        execution.request.requestId.length < 1 ||
        execution.request.assetId !== rawSpec.assetId ||
        execution.request.kind !== rawSpec.kind ||
        execution.request.operation !== rawSpec.operation ||
        (rawSpec.providerId !== undefined && execution.provider.id !== rawSpec.providerId) ||
        execution.manifests.length < 1
      ) {
        throw new Error('Foundry returned a mismatched request identity, unapproved provider, or no persisted asset manifests.');
      }

      const artifacts: NssStudioArtifactRef[] = [];
      const evidence: NssStudioEvidence[] = [];
      const observedIds: string[] = [];
      for (const output of execution.manifests) {
        const manifest = this.assets.store.get(output.assetId);
        if (!manifest || !manifest.localPath || !existsSync(manifest.localPath)) {
          throw new Error(`Foundry asset ${output.assetId} has no persisted local file.`);
        }
        const info = lstatSync(manifest.localPath);
        if (!info.isFile() || info.isSymbolicLink() || info.size < 1) {
          throw new Error(`Foundry asset ${output.assetId} is not a nonempty regular file.`);
        }
        const hash = createHash('sha256').update(readFileSync(manifest.localPath)).digest('hex');
        if (!manifest.contentHash || manifest.contentHash !== hash) {
          throw new Error(`Foundry asset ${output.assetId} content hash does not match its manifest.`);
        }

        observedIds.push(output.assetId);
        const evidenceUri = `/api/foundry/assets/${encodeURIComponent(output.assetId)}`;
        artifacts.push({
          kind: 'foundry-asset',
          uri: manifest.localPath,
          label: output.assetId,
          producedBy: this.specialistId,
          assetId: output.assetId,
          provenance: {
            requestId: manifest.requestId,
            providerId: manifest.generationProvider,
            contentHash: manifest.contentHash,
            parentAsset: manifest.parentAsset,
            referenceAssets: manifest.referenceAssets,
          },
        });
        evidence.push({
          kind: 'artifact',
          outcome: 'passed',
          summary: `Foundry persisted ${output.assetId} (${manifest.generationProvider ?? execution.provider.id}); SHA-256 ${hash}.`,
          uri: evidenceUri,
        });
      }

      const criterion = foundryAssetOutputCriterion(rawSpec.assetId);
      const matchedEvidence = evidence[0];
      const supportedCriteria = handoff.acceptanceCriteria.filter(value => value === criterion);
      const criterionResults = matchedEvidence && supportedCriteria.length === 1
        ? [{
            criterionId: `foundry-asset-${rawSpec.assetId}`,
            description: criterion,
            criterion,
            checkType: 'generic' as const,
            expected: rawSpec.assetId,
            actual: observedIds,
            outcome: observedIds.includes(rawSpec.assetId) ? 'passed' as const : 'failed' as const,
            evidenceUri: matchedEvidence.uri,
            executionId: run.taskId,
            timestamp: new Date().toISOString(),
          }]
        : [];
      if (criterionResults.length !== 1 || criterionResults[0]?.outcome !== 'passed') {
        throw new Error('Foundry Studio task acceptance criteria do not match the verifiable asset-output check.');
      }

      run.result = {
        taskId: run.taskId,
        specialistId: this.specialistId,
        status: 'completed',
        summary: `Foundry generated and verified ${observedIds.length} persisted asset output(s).`,
        artifacts,
        evidence,
        criterionResults,
      };
      run.phase = 'completed';
      run.detail = run.result.summary;
    } catch (error) {
      this.fail(run, handoff, error instanceof Error ? error.message : 'Foundry generation failed.');
    }
  }

  private fail(run: FoundryRun, handoff: NssStudioHandoff, detail: string): void {
    run.phase = 'failed';
    run.detail = detail;
    run.result = {
      taskId: run.taskId,
      specialistId: this.specialistId,
      status: 'failed',
      summary: detail,
      evidence: [{ kind: 'report', outcome: 'failed', summary: detail }],
      criterionResults: handoff.acceptanceCriteria.map((criterion, index) => ({
        criterionId: `foundry-${index + 1}`,
        description: criterion,
        criterion,
        checkType: 'generic',
        outcome: 'failed',
        executionId: run.taskId,
      })),
    };
  }
}

function isFoundrySpec(value: unknown): value is NssStudioFoundryTaskSpec {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const spec = value as Partial<NssStudioFoundryTaskSpec>;
  return spec.protocol === 'nss.studio-task-spec.v1' &&
    spec.specialist === 'foundry' &&
    spec.action === 'generate_asset' &&
    typeof spec.projectId === 'string' &&
    typeof spec.assetId === 'string' &&
    typeof spec.kind === 'string' &&
    typeof spec.operation === 'string' &&
    typeof spec.prompt === 'string' &&
    typeof spec.allowNetwork === 'boolean' &&
    typeof spec.approveExternalCost === 'boolean' &&
    typeof spec.requireCommercialUse === 'boolean';
}
