import type { CharacterProject } from './types.js';
import { CURRENT_PROJECT_SCHEMA_VERSION, getProjectSchemaVersion } from './version.js';

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  id: string;
  severity: ValidationSeverity;
  area: 'project' | 'asset' | 'part' | 'animation' | 'skin' | 'blend' | 'export';
  message: string;
  targetId?: string;
  fixHint?: string;
}

export interface ValidationReport {
  ok: boolean;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  issues: ValidationIssue[];
}

function issue(
  issues: ValidationIssue[],
  severity: ValidationSeverity,
  area: ValidationIssue['area'],
  message: string,
  targetId?: string,
  fixHint?: string,
) {
  issues.push({
    id: `${area}-${severity}-${issues.length + 1}`,
    severity,
    area,
    message,
    targetId,
    fixHint,
  });
}

function countRefs<T extends { id: string }>(items: T[]) {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.id, (counts.get(item.id) ?? 0) + 1);
  return counts;
}

function hasParentCycle(partId: string, parentById: Map<string, string | null>) {
  const seen = new Set<string>();
  let current: string | null | undefined = partId;
  while (current) {
    if (seen.has(current)) return true;
    seen.add(current);
    current = parentById.get(current);
  }
  return false;
}

export function validateProject(project: CharacterProject): ValidationReport {
  const issues: ValidationIssue[] = [];
  const version = getProjectSchemaVersion(project as any);

  if (version === 0) {
    issue(issues, 'warning', 'project', 'Project has no schemaVersion.', project.id, 'Run project migration/normalization before saving.');
  } else if (version > CURRENT_PROJECT_SCHEMA_VERSION) {
    issue(issues, 'error', 'project', `Project schemaVersion ${version} is newer than this editor supports.`, project.id, 'Update the editor before opening this project.');
  }

  if (!project.id) issue(issues, 'error', 'project', 'Project is missing an id.');
  if (!project.name?.trim()) issue(issues, 'warning', 'project', 'Project is missing a readable name.', project.id, 'Rename the project before exporting.');

  const assetCounts = countRefs(project.assets || []);
  const partCounts = countRefs(project.parts || []);
  const animCounts = countRefs(project.animations || []);
  const assetIds = new Set((project.assets || []).map(asset => asset.id));
  const partIds = new Set((project.parts || []).map(part => part.id));
  const animIds = new Set((project.animations || []).map(anim => anim.id));

  for (const [id, count] of assetCounts) {
    if (!id) issue(issues, 'error', 'asset', 'Asset has an empty id.');
    if (count > 1) issue(issues, 'error', 'asset', `Duplicate asset id: ${id}`, id, 'Regenerate one of the duplicate IDs.');
  }

  for (const asset of project.assets || []) {
    if (!asset.name?.trim()) issue(issues, 'warning', 'asset', 'Asset is missing a name.', asset.id);
    if (!asset.dataUrl) issue(issues, 'error', 'asset', `Asset "${asset.name || asset.id}" is missing image data.`, asset.id);
    if (!Number.isFinite(asset.width) || asset.width <= 0 || !Number.isFinite(asset.height) || asset.height <= 0) {
      issue(issues, 'error', 'asset', `Asset "${asset.name || asset.id}" has invalid dimensions.`, asset.id);
    }
  }

  for (const [id, count] of partCounts) {
    if (!id) issue(issues, 'error', 'part', 'Part has an empty id.');
    if (count > 1) issue(issues, 'error', 'part', `Duplicate part id: ${id}`, id, 'Regenerate one of the duplicate IDs.');
  }

  const parentById = new Map<string, string | null>();
  for (const part of project.parts || []) parentById.set(part.id, part.parentId ?? null);

  for (const part of project.parts || []) {
    if (!part.name?.trim()) issue(issues, 'warning', 'part', 'Part is missing a name.', part.id);
    if (part.parentId && !partIds.has(part.parentId)) {
      issue(issues, 'error', 'part', `Part "${part.name}" points to a missing parent.`, part.id, 'Set parent to none or choose an existing part.');
    }
    if (hasParentCycle(part.id, parentById)) {
      issue(issues, 'error', 'part', `Part "${part.name}" is inside a parent cycle.`, part.id, 'Break the cycle by changing one parent assignment.');
    }
    if (part.renderMode === 'image' && part.imageAssetId && !assetIds.has(part.imageAssetId)) {
      issue(issues, 'error', 'part', `Part "${part.name}" references a missing image asset.`, part.id, 'Choose an existing asset or import the missing image.');
    }
    if (!Number.isFinite(part.baseX) || !Number.isFinite(part.baseY)) {
      issue(issues, 'error', 'part', `Part "${part.name}" has invalid position values.`, part.id);
    }
    if (part.mesh) {
      if (part.mesh.vertices.length !== part.mesh.boneWeights.length) {
        issue(issues, 'error', 'part', `Mesh on "${part.name}" has mismatched vertices and bone weights.`, part.id, 'Rebuild or normalize the mesh weights.');
      }
      part.mesh.boneWeights.forEach((weights, idx) => {
        for (const boneId of Object.keys(weights || {})) {
          if (!partIds.has(boneId)) issue(issues, 'error', 'part', `Mesh vertex ${idx} on "${part.name}" references missing bone ${boneId}.`, part.id);
        }
      });
    }
    if (part.ikChain?.targetPartId && !partIds.has(part.ikChain.targetPartId)) {
      issue(issues, 'error', 'part', `IK chain on "${part.name}" references a missing target.`, part.id);
    }
    if (part.constraint?.targetPartId && !partIds.has(part.constraint.targetPartId)) {
      issue(issues, 'error', 'part', `Constraint on "${part.name}" references a missing target.`, part.id);
    }
  }

  for (const [id, count] of animCounts) {
    if (!id) issue(issues, 'error', 'animation', 'Animation has an empty id.');
    if (count > 1) issue(issues, 'error', 'animation', `Duplicate animation id: ${id}`, id);
  }

  for (const anim of project.animations || []) {
    if (!anim.name?.trim()) issue(issues, 'warning', 'animation', 'Animation is missing a name.', anim.id);
    if (!Number.isFinite(anim.duration) || anim.duration <= 0) {
      issue(issues, 'error', 'animation', `Animation "${anim.name}" has invalid duration.`, anim.id);
    }
    for (const controller of anim.controllers || []) {
      if (!partIds.has(controller.targetPartId)) {
        issue(issues, 'error', 'animation', `Controller in "${anim.name}" targets a missing part.`, controller.id);
      }
      for (const keyframe of controller.keyframes || []) {
        if (keyframe.time < 0 || keyframe.time > anim.duration) {
          issue(issues, 'warning', 'animation', `Keyframe in "${anim.name}" is outside the animation duration.`, keyframe.id, 'Move the keyframe or increase animation duration.');
        }
      }
    }
  }

  for (const blend of project.blendConfigs || []) {
    if (!animIds.has(blend.animAId) || !animIds.has(blend.animBId)) {
      issue(issues, 'error', 'blend', `Blend config "${blend.name || blend.id}" references a missing animation.`, blend.id);
    }
    if (blend.weight < 0 || blend.weight > 1) {
      issue(issues, 'warning', 'blend', `Blend config "${blend.name || blend.id}" weight is outside 0..1.`, blend.id);
    }
  }

  for (const skin of project.skins || []) {
    for (const partId of Object.keys(skin.slots || {})) {
      if (!partIds.has(partId)) issue(issues, 'warning', 'skin', `Skin "${skin.name}" has an override for a missing part.`, skin.id);
      const override = skin.slots[partId];
      if (override.imageAssetId && !assetIds.has(override.imageAssetId)) {
        issue(issues, 'error', 'skin', `Skin "${skin.name}" references a missing image asset.`, skin.id);
      }
    }
  }

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;

  return {
    ok: errorCount === 0,
    errorCount,
    warningCount,
    infoCount,
    issues,
  };
}
