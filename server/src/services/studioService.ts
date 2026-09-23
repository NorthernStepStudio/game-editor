import { randomUUID } from 'node:crypto';
import { isAbsolute, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { createStudioPlan, FlyrailAdapter, StudioAdapterRegistry, StudioRunController, type NssStudioPlan } from '../../../core/out/index.js';
export interface StudioProject { id: string; name: string; path: string }
export function configuredProjects(): StudioProject[] {
  const raw: unknown = JSON.parse(process.env.MATTERHORN_PROJECTS ?? '[]');
  if (!Array.isArray(raw) || raw.length > 50) throw new Error('MATTERHORN_PROJECTS must be an array with at most 50 projects.');
  const ids = new Set<string>();
  return raw.map(p => {
    if (!p || typeof p.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(p.id) || ids.has(p.id) || typeof p.name !== 'string' || typeof p.path !== 'string' || !isAbsolute(p.path)) throw new Error('Invalid configured project.');
    ids.add(p.id);
    return { id: p.id, name: p.name, path: resolve(p.path) };
  });
}
export function createStudioService() {
  const projects = configuredProjects();
  const adapter = new FlyrailAdapter({ requestTimeoutMs: 300000 });
  const registry = new StudioAdapterRegistry(); registry.register(adapter);
  const controller = new StudioRunController({ registry });
  function plan(body: unknown): NssStudioPlan {
    const input = body as { goal?: unknown; projectId?: unknown; criteria?: unknown };
    if (!input || typeof input.goal !== 'string' || input.goal.trim().length < 3 || input.goal.length > 8000) throw new Error('Enter a goal between 3 and 8000 characters.');
    const project = projects.find(p => p.id === input.projectId);
    if (!project || !existsSync(resolve(project.path, 'project.godot'))) throw new Error('Select a configured, existing Godot project.');
    if (!Array.isArray(input.criteria) || !input.criteria.length || input.criteria.length > 20 || input.criteria.some(c => typeof c !== 'string' || !c.trim() || c.length > 1000)) throw new Error('Supply 1–20 nonempty acceptance criteria.');
    return createStudioPlan({ id: randomUUID(), goal: input.goal, tasks: [{ id: 'godot-work', title: 'Implement and validate the requested Godot change', goal: input.goal, domain: 'godot', acceptanceCriteria: input.criteria, inputArtifacts: [{ kind: 'godot-project', uri: project.path }] }], finalAcceptanceCriteria: input.criteria });
  }
  return { projects, adapter, controller, plan };
}
export type StudioService = ReturnType<typeof createStudioService>;
