import { ProjectState } from '../../state/projectState';
import { SelectionState } from '../../state/selectionState';
import { addImageAsset, deleteAsset, attachAssetToPart } from '../../state/assetActions';

export function renderAssetsPanel(container: HTMLElement, onUpdate: () => void): void {
  const assets = ProjectState.project.assets || [];
  
  if (assets.length === 0) {
    container.innerHTML = `
      <div class="asset-empty-state" style="text-align: center; padding: 20px 10px; color: var(--text-muted); font-size: 0.85rem;">
        No assets yet. Click below to add images.
      </div>
      <button id="btn-panel-add-asset" style="width:100%; font-size: 0.8rem; padding: 6px;">+ Add Image</button>
      <input type="file" id="file-panel-asset" style="display:none" accept="image/*">
    `;
  } else {
    container.innerHTML = `
      <div class="assets-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(50px, 1fr)); gap: 8px; margin-bottom: 12px; max-height: 120px; overflow-y: auto; padding: 2px;">
        ${assets.map((a: any) => {
          const isSelected = SelectionState.activePartId && 
            ProjectState.project.parts.find(p => p.id === SelectionState.activePartId)?.imageAssetId === a.id;
          
          return `
            <div class="asset-item ${isSelected ? 'selected' : ''}" data-id="${a.id}" title="${a.name}" style="position: relative; width: 44px; height: 44px; border: 2px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}; border-radius: 4px; overflow: hidden; cursor: pointer; background: var(--bg-surface); display: flex; align-items: center; justify-content: center; transition: all 0.2s ease;">
              <img src="${a.dataUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain;">
              <div class="asset-actions" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); display: none; align-items: center; justify-content: center; gap: 4px;">
                <button class="btn-attach" data-id="${a.id}" title="Attach to selected part" style="background: none; border: none; font-size: 0.8rem; cursor: pointer; padding: 2px; color: white;">📌</button>
                <button class="btn-delete" data-id="${a.id}" title="Delete asset" style="background: none; border: none; font-size: 0.8rem; cursor: pointer; padding: 2px; color: var(--danger);">🗑</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
      <button id="btn-panel-add-asset" style="width:100%; font-size: 0.8rem; padding: 6px;">+ Add Image</button>
      <input type="file" id="file-panel-asset" style="display:none" accept="image/*">
    `;
  }

  // Bind actions
  const btnAdd = container.querySelector('#btn-panel-add-asset') as HTMLButtonElement;
  const fileInput = container.querySelector('#file-panel-asset') as HTMLInputElement;
  
  if (btnAdd && fileInput) {
    btnAdd.onclick = () => fileInput.click();
    fileInput.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          await addImageAsset(file, onUpdate);
        } catch (err) {
          console.error(err);
          alert('Failed to add image asset');
        }
      }
    };
  }

  // Handle clicking on asset thumbnail or overlays
  container.querySelectorAll('.asset-item').forEach(el => {
    const assetId = el.getAttribute('data-id')!;
    
    // Toggle actions overlay on hover
    el.addEventListener('mouseenter', () => {
      const actions = el.querySelector('.asset-actions') as HTMLElement;
      if (actions) actions.style.display = 'flex';
    });
    el.addEventListener('mouseleave', () => {
      const actions = el.querySelector('.asset-actions') as HTMLElement;
      if (actions) actions.style.display = 'none';
    });

    // Attach button click
    const btnAttach = el.querySelector('.btn-attach') as HTMLElement;
    if (btnAttach) {
      btnAttach.onclick = (e) => {
        e.stopPropagation();
        if (SelectionState.activePartId) {
          attachAssetToPart(assetId, SelectionState.activePartId, onUpdate);
        } else {
          alert('Please select a part in the tree to attach this asset to.');
        }
      };
    }

    // Delete button click
    const btnDelete = el.querySelector('.btn-delete') as HTMLElement;
    if (btnDelete) {
      btnDelete.onclick = (e) => {
        e.stopPropagation();
        deleteAsset(assetId, onUpdate);
      };
    }
    
    // Main thumbnail click: select/highlight
    (el as HTMLElement).onclick = () => {
      // If a part is selected, attach it
      if (SelectionState.activePartId) {
        attachAssetToPart(assetId, SelectionState.activePartId, onUpdate);
      }
    };
  });
}
