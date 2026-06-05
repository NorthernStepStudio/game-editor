import { CharacterProject } from '../../../../../packages/nstep-motion-core/src/schema/types';

export const imageCache = new Map<string, HTMLImageElement>();

export function evictStaleAssets(project: CharacterProject) {
  const assetIds = new Set((project.assets || []).map(a => a.id));
  for (const cachedId of imageCache.keys()) {
    if (!assetIds.has(cachedId)) {
      imageCache.delete(cachedId);
    }
  }
}

export function preloadAssets(project: CharacterProject) {
  evictStaleAssets(project);
  project.assets?.forEach(a => {
    if (a.type.startsWith('image/')) {
       if (!imageCache.has(a.id)) {
          const img = new Image();
          img.onload = () => {
             console.log(`Successfully cached asset: ${a.name}`);
          };
          img.onerror = () => {
             console.error(`Failed to cache asset: ${a.name}`);
          };
          img.src = a.dataUrl;
          imageCache.set(a.id, img);
       }
    }
  });
}
