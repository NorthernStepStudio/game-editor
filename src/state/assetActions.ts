import { ProjectState } from './projectState';
import { DirtyState } from './dirtyState';
import { preloadAssets, imageCache } from '../motion-editor/canvas/imageCache';

export async function addImageAsset(file: File, onUpdate: () => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        if (!ProjectState.project.assets) {
          ProjectState.project.assets = [];
        }
        ProjectState.project.assets.push({
          id: 'ast-' + Date.now(),
          name: file.name,
          type: file.type,
          dataUrl,
          width: img.width,
          height: img.height
        });
        preloadAssets(ProjectState.project);
        DirtyState.markDirty();
        onUpdate();
        resolve();
      };
      img.onerror = (err) => {
        reject(new Error('Image failed to load: ' + err));
      };
      img.src = dataUrl;
    };
    reader.onerror = () => {
      reject(new Error('File read error'));
    };
    reader.readAsDataURL(file);
  });
}

export function deleteAsset(assetId: string, onUpdate: () => void): void {
  // Confirm deletion, especially if attached to parts
  const attachedParts = ProjectState.project.parts.filter(p => p.imageAssetId === assetId);
  if (attachedParts.length > 0) {
    const partNames = attachedParts.map(p => p.name).join(', ');
    if (!confirm(`Warning: This asset is currently used by the following parts: ${partNames}. Detach and delete it?`)) {
      return;
    }
  }

  // Remove from assets array
  ProjectState.project.assets = (ProjectState.project.assets || []).filter(a => a.id !== assetId);

  // Detach from parts
  attachedParts.forEach(p => {
    p.renderMode = 'shape';
    p.imageAssetId = undefined;
  });

  // Evict from cache
  imageCache.delete(assetId);

  DirtyState.markDirty();
  onUpdate();
}

export function attachAssetToPart(assetId: string, partId: string, onUpdate: () => void): void {
  const part = ProjectState.project.parts.find(p => p.id === partId);
  if (!part) return;

  part.renderMode = 'image';
  part.imageAssetId = assetId;

  DirtyState.markDirty();
  onUpdate();
}

export function detachAssetFromPart(partId: string, onUpdate: () => void): void {
  const part = ProjectState.project.parts.find(p => p.id === partId);
  if (!part) return;

  part.renderMode = 'shape';
  part.imageAssetId = undefined;

  DirtyState.markDirty();
  onUpdate();
}
