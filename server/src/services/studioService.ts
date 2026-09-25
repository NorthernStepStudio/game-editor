import { randomUUID } from 'node:crypto';
import { isAbsolute, resolve } from 'node:path';
import { existsSync, lstatSync } from 'node:fs';
import { BlenderAdapter, FlyrailAdapter, StudioAdapterRegistry, StudioRunController, type NssStudioPlan } from '../../../core/out/index.js';
import { StudioHistory } from './studioHistory.js';
import { FoundryAssetService } from './foundryAssetService.js';
import { FoundryGenerationService } from './foundryGenerationService.js';
import { StudioRoutingPreferencesStore } from './studioRoutingPreferences.js';
import { createStudioPlannerPlan, inferDomains, type StudioAssetRequestInput, type StudioPlanningDomain } from './studioPlanner.js';
import { FoundryStudioAdapter } from './foundryStudioAdapter.js';
import { MatterhornQaAdapter } from './matterhornQaAdapter.js';

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

  const dataDirectory = process.env.MATTERHORN_DATA_DIR ?? resolve(__dirname, '../../../.matterhorn');
  const history = new StudioHistory(dataDirectory);
  const foundryAssets = new FoundryAssetService(dataDirectory, projects);
  const routingPreferences = new StudioRoutingPreferencesStore(dataDirectory);
  const foundryGeneration = new FoundryGenerationService(projects, foundryAssets, {
    routingPreferences: () => routingPreferences.get(),
  });
  registry.register(adapter);
  registry.register(new BlenderAdapter({ baseWorkDir: resolve(dataDirectory, 'blender-runs') }));
  registry.register(new FoundryStudioAdapter(foundryGeneration, foundryAssets));
  registry.register(new MatterhornQaAdapter());
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
    const input = body as {
      goal?: unknown;
      projectId?: unknown;
      criteria?: unknown;
      domains?: unknown;
      assets?: unknown;
      blenderTaskSpec?: unknown;
    };
    if (!input || typeof input.goal !== 'string' || input.goal.trim().length < 3 || input.goal.length > 8000) throw new Error('Enter a goal between 3 and 8000 characters.');
    const project = projects.find(candidate => candidate.id === input.projectId);
    if (!project || !existsSync(project.path)) throw new Error('Select a configured, existing project.');
    const projectInfo = lstatSync(project.path);
    if (!projectInfo.isDirectory() || projectInfo.isSymbolicLink()) throw new Error('The configured project path must be a real directory.');
    if (!Array.isArray(input.criteria) || !input.criteria.length || input.criteria.length > 20 || input.criteria.some(criterion => typeof criterion !== 'string' || !criterion.trim() || criterion.length > 1000)) {
      throw new Error('Supply 1–20 nonempty acceptance criteria.');
    }
    let domains: readonly StudioPlanningDomain[] | undefined;
    if (input.domains !== undefined) {
      if (!Array.isArray(input.domains) || input.domains.length > 3 || input.domains.some(domain => !['assets', 'blender', 'godot'].includes(String(domain)))) {
        throw new Error('domains must contain only assets, blender, or godot.');
      }
      domains = input.domains as StudioPlanningDomain[];
    }
    const plannedDomains = domains?.length ? domains : inferDomains(input.goal);
    if (plannedDomains.includes('godot') && !existsSync(resolve(project.path, 'project.godot'))) {
      throw new Error('This plan includes Godot work, so select a configured project with project.godot.');
    }
    if (input.assets !== undefined && (!Array.isArray(input.assets) || input.assets.length < 1 || input.assets.length > 16 || input.assets.some(asset => !asset || typeof asset !== 'object' || Array.isArray(asset)))) {
      throw new Error('assets must contain between 1 and 16 structured Foundry asset requests.');
    }
    return createStudioPlannerPlan({
      id: randomUUID(),
      goal: input.goal,
      project,
      criteria: input.criteria,
      ...(domains ? { domains } : {}),
      ...(input.assets ? { assets: input.assets as StudioAssetRequestInput[] } : {}),
      ...(input.blenderTaskSpec !== undefined ? { blenderTaskSpec: input.blenderTaskSpec } : {}),
    }, routingPreferences.get(), foundryGeneration.providers());
  }

  return {
    projects,
    adapter,
    adapters: registry.list(),
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
