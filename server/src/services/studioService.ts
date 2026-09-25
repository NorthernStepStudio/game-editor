import { randomUUID } from 'node:crypto';
import { isAbsolute, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { createStudioPlan, FlyrailAdapter, StudioAdapterRegistry, StudioRunController, type NssStudioPlan } from '../../../core/out/index.js';
import { StudioHistory } from './studioHistory.js';
import { FoundryAssetService } from './foundryAssetService.js';
import { FoundryGenerationService } from './foundryGenerationService.js';
import { StudioRoutingPreferencesStore } from './studioRoutingPreferences.js';

export interface StudioProject { id: string; name: string; path: string }

export function configuredProjects(): StudioProject[] {
  const raw: unknown = JSON.parse(process.env.MATTERHORN_PROJECTS ?? '[]');
  if (!Array.isArray(raw) || raw.length > 50) throw new Error('MATTERHORN_PROJECTS must be an array with at most 50 projects.');
  const ids = new Set<string>();
  return raw.map(project => {
    if (!project || typeof project.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(project.id) || ids.has(project.id) || typeof project.name !== 'string' || typeof project.path !== 'string' || !isAbsolute(project.path)) {
      throw new Error('Invalid configured project.');
    }
    ids.add(project.id);
    return { id: project.id, name: project.name, path: resolve(project.path) };
  });
}

export function createStudioService() {
  const projects = configuredProjects();
  const adapter = new FlyrailAdapter({ requestTimeoutMs: 300000 });
  const registry = new StudioAdapterRegistry();
  registry.register(adapter);

  const dataDirectory = process.env.MATTERHORN_DATA_DIR ?? resolve(__dirname, '../../../.matterhorn');
  const history = new StudioHistory(dataDirectory);
  const foundryAssets = new FoundryAssetService(dataDirectory, projects);
  const routingPreferences = new StudioRoutingPreferencesStore(dataDirectory);
  const foundryGeneration = new FoundryGenerationService(projects, foundryAssets, {
    routingPreferences: () => routingPreferences.get(),
  });
  const controller = new StudioRunController({ registry, initialRuns: history.load() });
  const stopHistory = controller.store.subscribe(({ run }) => history.persist(run));

  let recoveryState: 'running' | 'complete' | 'failed' = 'running';
  let recoveryFailure: Error | undefined;
  const recovery = controller.reconcileRecoveredRuns()
    .then(() => { recoveryState = 'complete'; })
    .catch(error => {
      recoveryState = 'failed';
      recoveryFailure = error instanceof Error ? error : new Error('Studio restart recovery failed.');
    });

  async function ensureRecovered(): Promise<void> {
    await recovery;
    if (recoveryFailure) throw recoveryFailure;
  }

  function plan(body: unknown): NssStudioPlan {
    const input = body as { goal?: unknown; projectId?: unknown; criteria?: unknown };
    if (!input || typeof input.goal !== 'string' || input.goal.trim().length < 3 || input.goal.length > 8000) throw new Error('Enter a goal between 3 and 8000 characters.');
    const project = projects.find(candidate => candidate.id === input.projectId);
    if (!project || !existsSync(resolve(project.path, 'project.godot'))) throw new Error('Select a configured, existing Godot project.');
    if (!Array.isArray(input.criteria) || !input.criteria.length || input.criteria.length > 20 || input.criteria.some(criterion => typeof criterion !== 'string' || !criterion.trim() || criterion.length > 1000)) {
      throw new Error('Supply 1–20 nonempty acceptance criteria.');
    }
    return createStudioPlan({
      id: randomUUID(),
      goal: input.goal,
      tasks: [{
        id: 'godot-work',
        title: 'Implement and validate the requested Godot change',
        goal: input.goal,
        domain: 'godot',
        acceptanceCriteria: input.criteria,
        inputArtifacts: [{ kind: 'godot-project', uri: project.path }],
      }],
      finalAcceptanceCriteria: input.criteria,
    });
  }

  return {
    projects,
    adapter,
    controller,
    plan,
    history,
    foundryAssets,
    foundryGeneration,
    routingPreferences,
    ensureRecovered,
    getRecoveryState: () => recoveryState,
    dispose: () => stopHistory(),
  };
}

export type StudioService = ReturnType<typeof createStudioService>;
