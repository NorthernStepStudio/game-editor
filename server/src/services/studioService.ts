import { randomUUID } from 'node:crypto';
import { isAbsolute, resolve } from 'node:path';
import { existsSync, lstatSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { BlenderAdapter, FlyrailAdapter, MatterhornAssetLeaseStore, MatterhornLocalAgentEvaluationAdapter, MatterhornLocalBrowserAdapter, MatterhornOciSafeExecutionAdapter, MatterhornOtlpRunInsightsAdapter, MatterhornProjectMemoryGraphAdapter, MatterhornPromotionApprovalStore, MatterhornRuntimeCapabilityRegistry, requireProjectGitMutationSafety, StudioAdapterRegistry, StudioRunController, type MatterhornAgentEvaluationAdapter, type MatterhornProjectMemoryAdapter, type MatterhornSafeExecutionProfile, type NssStudioPlan } from '../../../core/out/index.js';
import { StudioHistory } from './studioHistory.js';
import { FoundryAssetService } from './foundryAssetService.js';
import { FoundryGenerationService } from './foundryGenerationService.js';
import { FoundryStyleStore } from './foundryStyles.js';
import { AiReadiness } from './aiReadiness.js';
import { FoundryImporter, type ImportRoot } from './foundryImport.js';

/** Work folders scanned for existing assets (JSON array in MATTERHORN_ASSET_SCAN_DIRS; default: the repo's artifacts folder). */
function workspaceScanRoots(): string[] {
  const raw = process.env.MATTERHORN_ASSET_SCAN_DIRS?.trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed.filter((p): p is string => typeof p === 'string' && isAbsolute(p)).map((p) => resolve(p));
    } catch {
      // Fall through to the default.
    }
  }
  const artifacts = resolve(__dirname, '../../../artifacts');
  return existsSync(artifacts) ? [artifacts] : [];
}
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

export const ASSET_LIBRARY_PROJECT_ID = 'library';

/** Built-in Foundry workspace so assets can be created without any game project. */
export function assetLibraryProject(): StudioProject {
  const path = resolve(process.env.MATTERHORN_ASSET_LIBRARY?.trim() || resolve(__dirname, '../../../asset-library'));
  mkdirSync(path, { recursive: true });
  return { id: ASSET_LIBRARY_PROJECT_ID, name: 'Asset Library', path };
}

/** Games added from the UI, kept beside the server data (MATTERHORN_PROJECTS entries still win). */
function savedProjects(file: string, taken: Set<string>): StudioProject[] {
  if (!existsSync(file)) return [];
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8')) as { projects?: unknown };
    if (!Array.isArray(raw.projects)) return [];
    return raw.projects.flatMap((entry) => {
      const project = entry as Partial<StudioProject>;
      if (typeof project?.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(project.id) || taken.has(project.id)) return [];
      if (typeof project.name !== 'string' || typeof project.path !== 'string' || !isAbsolute(project.path)) return [];
      taken.add(project.id);
      return [{ id: project.id, name: project.name, path: resolve(project.path) }];
    });
  } catch {
    return [];
  }
}

export function createStudioService() {
  const dataDirectoryEarly = process.env.MATTERHORN_DATA_DIR ?? resolve(__dirname, '../../../.matterhorn');
  const savedProjectsFile = resolve(dataDirectoryEarly, 'projects.json');
  const envProjects = configuredProjects();
  const projects = [...envProjects, ...savedProjects(savedProjectsFile, new Set([...envProjects.map(p => p.id), ASSET_LIBRARY_PROJECT_ID]))];
  if (projects.some(project => project.id === ASSET_LIBRARY_PROJECT_ID)) {
    throw new Error(`Project id "${ASSET_LIBRARY_PROJECT_ID}" is reserved for the built-in Asset Library.`);
  }
  const assetProjects = [assetLibraryProject(), ...projects];
  const adapter = new FlyrailAdapter({ requestTimeoutMs: 300000 });
  const registry = new StudioAdapterRegistry();

  const dataDirectory = dataDirectoryEarly;
  const assetLeaseStores = new Map(projects.map(project => [
    project.id,
    new MatterhornAssetLeaseStore({
      projectRoot: project.path,
      stateFile: resolve(dataDirectory, 'asset-leases', `${project.id}.json`),
    }),
  ]));
  const history = new StudioHistory(dataDirectory);
  const promotionApprovals = new MatterhornPromotionApprovalStore(dataDirectory);
  const scanRoots = workspaceScanRoots();
  const foundryAssets = new FoundryAssetService(dataDirectory, assetProjects, scanRoots);
  const foundryImporter = new FoundryImporter(foundryAssets, (): ImportRoot[] => [
    ...projects.map((project) => {
      const assetsDir = resolve(project.path, 'assets');
      return { label: project.name, path: existsSync(assetsDir) ? assetsDir : project.path, kind: 'game' as const };
    }),
    ...scanRoots.map((path) => ({ label: path.split(/[\/]/).pop() ?? 'work', path, kind: 'workspace' as const })),
  ]);
  const routingPreferences = new StudioRoutingPreferencesStore(dataDirectory);
  const foundryStyles = new FoundryStyleStore(dataDirectory);
  const ai = new AiReadiness(dataDirectory);
  let assetModelCache: string | undefined;
  const refreshAssetModel = () => { void ai.assetModel().then((model) => { assetModelCache = model; }); };
  refreshAssetModel();
  setInterval(refreshAssetModel, 15_000).unref();
  const foundryGeneration = new FoundryGenerationService(assetProjects, foundryAssets, {
    routingPreferences: () => routingPreferences.get(),
    styles: foundryStyles,
    assetModel: () => ai.assetModelSync(assetModelCache),
  });

  registry.register(adapter);
  registry.register(new BlenderAdapter({ baseWorkDir: resolve(dataDirectory, 'blender-runs') }));
  registry.register(new FoundryStudioAdapter(foundryGeneration, foundryAssets));
  registry.register(new MatterhornQaAdapter());

  const runtime = new MatterhornRuntimeCapabilityRegistry();
  runtime.register(new MatterhornLocalBrowserAdapter(
    process.env.MATTERHORN_BROWSER_BRIDGE_URL
      ? { baseUrl: process.env.MATTERHORN_BROWSER_BRIDGE_URL }
      : {},
  ));
  runtime.register(new MatterhornProjectMemoryGraphAdapter(
    process.env.MATTERHORN_PROJECT_MEMORY_URL
      ? { baseUrl: process.env.MATTERHORN_PROJECT_MEMORY_URL }
      : {},
  ));
  if (process.env.MATTERHORN_SANDBOX_PROFILES) {
    const parsedProfiles: unknown = JSON.parse(process.env.MATTERHORN_SANDBOX_PROFILES);
    if (!Array.isArray(parsedProfiles)) throw new Error('MATTERHORN_SANDBOX_PROFILES must be a JSON array.');
    runtime.register(new MatterhornOciSafeExecutionAdapter({
      enginePath: process.env.MATTERHORN_SANDBOX_ENGINE || 'docker',
      profiles: parsedProfiles as MatterhornSafeExecutionProfile[],
    }));
  }
  if (process.env.MATTERHORN_OTLP_TRACES_URL) {
    runtime.register(new MatterhornOtlpRunInsightsAdapter({
      endpoint: process.env.MATTERHORN_OTLP_TRACES_URL,
      ...(process.env.MATTERHORN_OTLP_AUTHORIZATION ? { authorization: process.env.MATTERHORN_OTLP_AUTHORIZATION } : {}),
      serviceVersion: '0.1.0',
    }));
  }
  if (process.env.MATTERHORN_AGENT_EVAL_RUNNER) {
    runtime.register(new MatterhornLocalAgentEvaluationAdapter({
      runnerPath: resolve(process.env.MATTERHORN_AGENT_EVAL_RUNNER),
      ...(process.env.MATTERHORN_AGENT_EVAL_NODE ? { nodePath: process.env.MATTERHORN_AGENT_EVAL_NODE } : {}),
    }));
  }

  const controller = new StudioRunController({ registry, runtime, initialRuns: history.load() });
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

  function requireProject(projectId: unknown): StudioProject {
    if (typeof projectId !== 'string') throw new Error('Select a configured project.');
    const project = projects.find(candidate => candidate.id === projectId);
    if (!project) throw new Error('Select a configured project.');
    return project;
  }

  function assetLeaseStore(projectId: unknown): MatterhornAssetLeaseStore {
    const project = requireProject(projectId);
    const store = assetLeaseStores.get(project.id);
    if (!store) throw new Error('Asset lease store is not configured.');
    return store;
  }

  function leaseInput(body: unknown) {
    const input = body as {
      projectId?: unknown;
      path?: unknown;
      agentId?: unknown;
      runId?: unknown;
      taskId?: unknown;
      leaseMs?: unknown;
    };
    if (typeof input.path !== 'string') throw new Error('Asset path is required.');
    if (typeof input.agentId !== 'string' || typeof input.runId !== 'string' || typeof input.taskId !== 'string') {
      throw new Error('Asset lease holder identity is required.');
    }
    return {
      projectId: input.projectId,
      path: input.path,
      holder: { agentId: input.agentId, runId: input.runId, taskId: input.taskId },
      leaseMs: input.leaseMs,
    };
  }

  async function acquireAssetLease(body: unknown) {
    const input = leaseInput(body);
    if (typeof input.leaseMs !== 'number' || !Number.isInteger(input.leaseMs)) throw new Error('Asset lease duration is required.');
    return assetLeaseStore(input.projectId).acquire(input.path, input.holder, input.leaseMs);
  }

  async function renewAssetLease(body: unknown) {
    const input = leaseInput(body);
    if (typeof input.leaseMs !== 'number' || !Number.isInteger(input.leaseMs)) throw new Error('Asset lease duration is required.');
    return assetLeaseStore(input.projectId).renew(input.path, input.holder, input.leaseMs);
  }

  async function releaseAssetLease(body: unknown) {
    const input = leaseInput(body);
    return assetLeaseStore(input.projectId).release(input.path, input.holder);
  }

  async function rebaselineAsset(body: unknown) {
    const input = body as { projectId?: unknown; path?: unknown };
    if (typeof input.path !== 'string') throw new Error('Asset path is required.');
    return assetLeaseStore(input.projectId).rebaseline(input.path);
  }

  async function assetLeaseStatus(projectId: unknown) {
    return assetLeaseStore(projectId).status();
  }

  async function verifyAssets(projectId: unknown) {
    return assetLeaseStore(projectId).verify();
  }

  function projectMemory(): MatterhornProjectMemoryAdapter {
    const memory = runtime.get<MatterhornProjectMemoryAdapter>('project-memory');
    if (!memory) throw new Error('Matterhorn Project Memory is not configured.');
    return memory;
  }

  async function remember(body: unknown): Promise<void> {
    const input = body as { projectId?: unknown; content?: unknown; source?: unknown; timestamp?: unknown };
    const project = requireProject(input?.projectId);
    if (typeof input.content !== 'string' || !input.content.trim() || input.content.length > 50000) {
      throw new Error('Memory content must be between 1 and 50000 characters.');
    }
    if (input.source != null && (typeof input.source !== 'string' || !input.source.trim() || input.source.length > 500)) {
      throw new Error('Memory source must be a nonempty string up to 500 characters.');
    }
    if (input.timestamp != null && typeof input.timestamp !== 'string') throw new Error('Memory timestamp must be a string.');
    await projectMemory().remember({
      projectId: project.id,
      content: input.content,
      source: typeof input.source === 'string' ? input.source : 'matterhorn',
      ...(typeof input.timestamp === 'string' ? { timestamp: input.timestamp } : {}),
    });
  }

  async function searchMemory(body: unknown) {
    const input = body as { projectId?: unknown; query?: unknown; maxFacts?: unknown };
    const project = requireProject(input?.projectId);
    if (typeof input.query !== 'string' || !input.query.trim() || input.query.length > 8000) {
      throw new Error('Memory query must be between 1 and 8000 characters.');
    }
    if (input.maxFacts != null && (typeof input.maxFacts !== 'number' || !Number.isInteger(input.maxFacts) || input.maxFacts < 1 || input.maxFacts > 50)) {
      throw new Error('Memory maxFacts must be an integer from 1 to 50.');
    }
    return projectMemory().search({
      projectId: project.id,
      query: input.query,
      ...(typeof input.maxFacts === 'number' ? { maxFacts: input.maxFacts } : {}),
    });
  }

  function promotionStatus(runId: string) {
    const run = controller.store.get(runId);
    if (!run) throw new Error('Run not found.');
    return promotionApprovals.status(run);
  }

  function approvePromotion(runId: string, body: unknown) {
    const run = controller.store.get(runId);
    if (!run) throw new Error('Run not found.');
    const input = body as { confirmation?: unknown; note?: unknown };
    if (typeof input.confirmation !== 'string') throw new Error('Promotion confirmation is required.');
    if (input.note != null && typeof input.note !== 'string') throw new Error('Promotion note must be a string.');
    return promotionApprovals.approve(run, input.confirmation, typeof input.note === 'string' ? input.note : undefined);
  }

  function revokePromotion(runId: string) {
    const run = controller.store.get(runId);
    if (!run) throw new Error('Run not found.');
    promotionApprovals.revoke(run.id);
    return promotionApprovals.status(run);
  }

  function requirePromotionApproval(runId: string) {
    const run = controller.store.get(runId);
    if (!run) throw new Error('Run not found.');
    return promotionApprovals.requireApproved(run);
  }

  function agentEvaluation(): MatterhornAgentEvaluationAdapter {
    const evaluator = runtime.get<MatterhornAgentEvaluationAdapter>('agent-evaluation');
    if (!evaluator) throw new Error('Matterhorn Agent Validation is not configured.');
    return evaluator;
  }

  async function evaluateRun(runId: string) {
    const run = controller.store.get(runId);
    if (!run) throw new Error('Run not found.');
    const outcome = run.tasks.map(task => {
      const planTask = run.plan.tasks.find(candidate => candidate.id === task.id);
      const result = task.result;
      return [
        `Task: ${planTask?.title ?? task.id}`,
        `Status: ${task.status}`,
        task.detail ? `Detail: ${task.detail}` : '',
        result?.summary ? `Result: ${result.summary}` : '',
        ...(result?.criterionResults ?? []).map(criterion =>
          `Criterion: ${criterion.criterion ?? criterion.description ?? '<unnamed>'} => ${criterion.outcome}`
        ),
      ].filter(Boolean).join('\n');
    }).join('\n\n');

    return agentEvaluation().evaluate({
      goal: run.plan.goal,
      outcome: outcome || `Run status: ${run.status}`,
      criteria: run.plan.finalAcceptanceCriteria,
      threshold: 0.7,
    });
  }

  async function plan(body: unknown): Promise<NssStudioPlan> {
    const input = body as {
      goal?: unknown;
      projectId?: unknown;
      criteria?: unknown;
      domains?: unknown;
      assets?: unknown;
      blenderTaskSpec?: unknown;
      allowDirty?: unknown;
    };
    if (!input || typeof input.goal !== 'string' || input.goal.trim().length < 3 || input.goal.length > 8000) {
      throw new Error('Enter a goal between 3 and 8000 characters.');
    }

    const project = projects.find(candidate => candidate.id === input.projectId);
    if (!project || !existsSync(project.path)) throw new Error('Select a configured, existing project.');
    const projectInfo = lstatSync(project.path);
    if (!projectInfo.isDirectory() || projectInfo.isSymbolicLink()) throw new Error('The configured project path must be a real directory.');
    if (input.allowDirty != null && typeof input.allowDirty !== 'boolean') throw new Error('allowDirty must be a boolean.');
    await requireProjectGitMutationSafety(project.path, input.allowDirty === true);

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

    const rawCriteria = input.criteria == null ? [] : input.criteria;
    if (!Array.isArray(rawCriteria) || rawCriteria.length > 20 || rawCriteria.some(criterion => typeof criterion !== 'string' || !criterion.trim() || criterion.length > 1000)) {
      throw new Error('Supply at most 20 nonempty acceptance criteria.');
    }
    const requestedCriteria = rawCriteria.map(criterion => String(criterion).trim());
    const automaticCriteria: string[] = [];
    if (plannedDomains.includes('godot')) {
      automaticCriteria.push('Godot validation passes', 'Scenario checks pass', 'QA checks pass');
      const gameplayGoal = /player|gameplay|movement|move|jump|dash|combat|enemy|defender|attacker|collision|physics|camera|score|level|boss|control|input|ability|skill|timer|match|round|ai\b/i.test(input.goal);
      if (gameplayGoal && existsSync(resolve(project.path, 'playtest.manifest.json'))) automaticCriteria.push('Playtest passes');
    }
    const criteria = [...new Set([...requestedCriteria, ...automaticCriteria])];

    if (input.assets !== undefined && (!Array.isArray(input.assets) || input.assets.length < 1 || input.assets.length > 16 || input.assets.some(asset => !asset || typeof asset !== 'object' || Array.isArray(asset)))) {
      throw new Error('assets must contain between 1 and 16 structured Foundry asset requests.');
    }

    return createStudioPlannerPlan({
      id: randomUUID(),
      goal: input.goal,
      project,
      criteria,
      ...(domains ? { domains } : {}),
      ...(input.assets ? { assets: input.assets as StudioAssetRequestInput[] } : {}),
      ...(input.blenderTaskSpec !== undefined ? { blenderTaskSpec: input.blenderTaskSpec } : {}),
    }, routingPreferences.get(), foundryGeneration.providers());
  }

  return {
    projects,
    /** Registers a Godot project from the UI. Takes effect immediately and survives restarts. */
    addProject(input: { name?: unknown; path?: unknown }): StudioProject {
      const name = typeof input?.name === 'string' ? input.name.trim() : '';
      const rawPath = typeof input?.path === 'string' ? input.path.trim().replace(/^"|"$/g, '') : '';
      if (!name || name.length > 60) throw new Error('Give the game a name (up to 60 characters).');
      if (!rawPath || !isAbsolute(rawPath)) throw new Error('Paste the full folder path, e.g. D:\dev\MyGame.');
      const path = resolve(rawPath);
      if (!existsSync(path) || !lstatSync(path).isDirectory()) throw new Error('That folder does not exist.');
      if (!existsSync(resolve(path, 'project.godot'))) throw new Error('That folder has no project.godot — choose the Godot project folder.');
      if (projects.some(project => resolve(project.path) === path)) throw new Error('That game is already added.');
      const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'game';
      let id = base;
      for (let n = 2; id === ASSET_LIBRARY_PROJECT_ID || projects.some(project => project.id === id); n++) id = `${base}-${n}`;
      const project: StudioProject = { id, name, path };
      projects.push(project);
      assetProjects.push(project);
      assetLeaseStores.set(id, new MatterhornAssetLeaseStore({
        projectRoot: path,
        stateFile: resolve(dataDirectory, 'asset-leases', `${id}.json`),
      }));
      const envIds = new Set(envProjects.map(p => p.id));
      mkdirSync(dataDirectory, { recursive: true });
      const temp = `${savedProjectsFile}.tmp`;
      writeFileSync(temp, JSON.stringify({ version: 1, projects: projects.filter(p => !envIds.has(p.id)) }, null, 2), 'utf8');
      renameSync(temp, savedProjectsFile);
      return project;
    },
    adapter,
    adapters: registry.list(),
    runtime,
    controller,
    plan,
    acquireAssetLease,
    renewAssetLease,
    releaseAssetLease,
    rebaselineAsset,
    assetLeaseStatus,
    verifyAssets,
    remember,
    searchMemory,
    evaluateRun,
    promotionStatus,
    approvePromotion,
    revokePromotion,
    requirePromotionApproval,
    history,
    foundryAssets,
    foundryGeneration,
    foundryProjects: assetProjects,
    foundryStyles,
    foundryImporter,
    ai,
    refreshAssetModel,
    routingPreferences,
    ensureRecovered,
    getRecoveryState: () => recoveryState,
    dispose: () => stopHistory(),
  };
}

export type StudioService = ReturnType<typeof createStudioService>;
