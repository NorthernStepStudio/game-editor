import { ProjectState } from '../../state/projectState';
import { SelectionState } from '../../state/selectionState';
import { addImageAsset, deleteAsset, attachAssetToPart } from '../../state/assetActions';

export function renderAssetsPanel(container: HTMLElement, onUpdate: () => void): void {
  const assets = ProjectState.project.assets || [];

  const badge = document.getElementById('asset-count-badge');
  if (badge) badge.textContent = `${assets.length} assets`;

  if (assets.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:12px 8px; color:var(--text-muted); font-size:0.75rem;">
        No assets yet
      </div>
      <button class="add-asset-btn" id="btn-add-asset">＋ Add Image</button>
      <input type="file" id="file-asset-input" style="display:none" accept="image/*" multiple>
    `;
  } else {
    const activePart = ProjectState.project.parts.find(p => p.id === SelectionState.activePartId);
    container.innerHTML = `
      <div class="assets-grid">
        ${assets.map((a: any) => {
          const isAttached = activePart?.imageAssetId === a.id;
          return `
            <div class="asset-thumb ${isAttached ? 'selected' : ''}" data-id="${a.id}" title="${a.name}&#10;${a.width}×${a.height}">
              <img src="${a.dataUrl}" alt="${a.name}">
              <div class="asset-thumb-overlay">
                <button class="btn-attach-asset" data-id="${a.id}" title="Attach to selected part">📌</button>
                <button class="btn-del-asset"    data-id="${a.id}" title="Delete asset">🗑</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
      <button class="add-asset-btn" id="btn-add-asset">＋ Add Image</button>
      <input type="file" id="file-asset-input" style="display:none" accept="image/*" multiple>
    `;
  }

  const btn  = container.querySelector('#btn-add-asset') as HTMLButtonElement;
  const inp  = container.querySelector('#file-asset-input') as HTMLInputElement;
  if (btn && inp) {
    btn.onclick = () => inp.click();
    inp.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files) return;
      for (const file of Array.from(files)) {
        try { await addImageAsset(file, onUpdate); } catch {}
      }
    };
  }

  container.querySelectorAll('.asset-thumb').forEach(el => {
    const id = el.getAttribute('data-id')!;

    (el as HTMLElement).onclick = () => {
      if (SelectionState.activePartId) attachAssetToPart(id, SelectionState.activePartId, onUpdate);
    };

    const attBtn = el.querySelector('.btn-attach-asset') as HTMLElement;
    if (attBtn) attBtn.onclick = (e) => {
      e.stopPropagation();
      if (SelectionState.activePartId) attachAssetToPart(id, SelectionState.activePartId, onUpdate);
      else alert('Select a part first, then click an asset to attach it.');
    };

    const delBtn = el.querySelector('.btn-del-asset') as HTMLElement;
    if (delBtn) delBtn.onclick = (e) => { e.stopPropagation(); deleteAsset(id, onUpdate); };
  });
}
