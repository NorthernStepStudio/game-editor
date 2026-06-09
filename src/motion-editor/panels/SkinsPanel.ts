import { ProjectState } from '../../state/projectState';
import { DirtyState } from '../../state/dirtyState';

function genId() { return 'skin-' + Math.random().toString(36).slice(2, 11); }

function createDefaultSkin(name: string): any {
  const proj = ProjectState.project;
  const activeSkin = (proj as any).skins?.find((s: any) => s.id === (proj as any).activeSkinId) || null;
  const slots: Record<string, any> = {};
  proj.parts.forEach((p: any) => {
    const override = activeSkin?.slots?.[p.id];
    const imgId   = override?.imageAssetId ?? p.imageAssetId;
    const color   = override?.color        ?? p.color;
    const srcRect = override?.sourceRect   ?? p.sourceRect;
    const slot: any = {};
    if (imgId)   slot.imageAssetId = imgId;
    if (color)   slot.color = color;
    if (srcRect) slot.sourceRect = { ...srcRect };
    if (Object.keys(slot).length) slots[p.id] = slot;
  });
  return { id: genId(), name, slots };
}

export function renderSkinsPanel(container: HTMLElement, onUpdate: () => void): void {
  const project = ProjectState.project;
  const skins: any[] = (project as any).skins || [];
  const activeSkinId: string | undefined = (project as any).activeSkinId;

  const badge = document.getElementById('skin-count-badge');
  if (badge) badge.textContent = `${skins.length} skin${skins.length !== 1 ? 's' : ''}`;

  const activeSkin = skins.find((s: any) => s.id === activeSkinId) || null;

  container.innerHTML = `
    <div style="display:flex; gap:4px; margin-bottom:6px; flex-wrap:wrap;">
      <button id="btn-skin-new" style="flex:1; font-size:0.7rem; padding:4px 6px;">＋ New Skin</button>
      <button id="btn-skin-dup" style="flex:1; font-size:0.7rem; padding:4px 6px;" ${!activeSkin ? 'disabled' : ''}>⧉ Duplicate</button>
      <button id="btn-skin-del" style="flex:1; font-size:0.7rem; padding:4px 6px; color:var(--danger);" ${(!activeSkin || activeSkin.name === 'Default' || skins.length <= 1) ? 'disabled' : ''}>🗑 Delete</button>
    </div>

    ${skins.length === 0
      ? `<div style="text-align:center; padding:10px; font-size:0.72rem; color:var(--text-muted);">No skins yet. Create one to override part appearances.</div>`
      : `<div style="display:flex; flex-direction:column; gap:3px; margin-bottom:8px;">
          ${skins.map((s: any) => `
            <div class="skin-row ${s.id === activeSkinId ? 'skin-active' : ''}"
                 data-skin-id="${s.id}"
                 style="display:flex; align-items:center; gap:6px; padding:5px 8px; border-radius:var(--r-md); cursor:pointer;
                        background:${s.id === activeSkinId ? 'rgba(76,142,245,0.18)' : 'var(--bg-surface)'};
                        border:1px solid ${s.id === activeSkinId ? 'rgba(76,142,245,0.5)' : 'var(--border)'};
                        transition:background 0.12s;">
              <span style="flex:1; font-size:0.75rem; font-weight:${s.id === activeSkinId ? '600' : '400'}; color:${s.id === activeSkinId ? 'var(--text-bright)' : 'var(--text)'}">${s.name}</span>
              ${s.id === activeSkinId ? '<span style="font-size:0.62rem; color:#4c8ef5; letter-spacing:0.04em;">ACTIVE</span>' : ''}
              <span style="font-size:0.65rem; color:var(--text-muted);">${Object.keys(s.slots || {}).length} slot${Object.keys(s.slots || {}).length !== 1 ? 's' : ''}</span>
            </div>
          `).join('')}
        </div>`
    }

    ${activeSkin ? `
      <div style="border-top:1px solid var(--border); padding-top:6px; margin-top:4px;">
        <div style="font-size:0.68rem; color:var(--text-muted); margin-bottom:6px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase;">Slot Overrides — ${activeSkin.name}</div>
        ${buildSlotOverrideEditor(activeSkin)}
      </div>
    ` : ''}
  `;

  // New skin
  const btnNew = container.querySelector('#btn-skin-new') as HTMLButtonElement;
  if (btnNew) btnNew.onclick = () => {
    const name = prompt('Skin name:', `Skin ${skins.length + 1}`);
    if (!name) return;
    if (!(project as any).skins) (project as any).skins = [];
    const newSkin = createDefaultSkin(name);
    (project as any).skins.push(newSkin);
    (project as any).activeSkinId = newSkin.id;
    DirtyState.markDirty();
    onUpdate();
  };

  // Duplicate skin
  const btnDup = container.querySelector('#btn-skin-dup') as HTMLButtonElement;
  if (btnDup) btnDup.onclick = () => {
    if (!activeSkin) return;
    const name = prompt('Duplicate skin name:', activeSkin.name + ' Copy');
    if (!name) return;
    const copy = JSON.parse(JSON.stringify(activeSkin));
    copy.id = genId();
    copy.name = name;
    (project as any).skins.push(copy);
    (project as any).activeSkinId = copy.id;
    DirtyState.markDirty();
    onUpdate();
  };

  // Delete skin — cannot delete the Default skin or the last skin
  const btnDel = container.querySelector('#btn-skin-del') as HTMLButtonElement;
  if (btnDel) btnDel.onclick = () => {
    if (!activeSkin) return;
    if (activeSkin.name === 'Default') { alert('The Default skin cannot be deleted.'); return; }
    if (skins.length <= 1) { alert('Cannot delete the only skin.'); return; }
    if (!confirm(`Delete skin "${activeSkin.name}"?`)) return;
    (project as any).skins = (project as any).skins.filter((s: any) => s.id !== activeSkin.id);
    const remaining = (project as any).skins;
    ProjectState.setActiveSkin(remaining[0]?.id ?? null);
    DirtyState.markDirty();
    onUpdate();
  };

  // Skin row click → set active (clicking the active skin again deactivates to Default)
  container.querySelectorAll('.skin-row').forEach(el => {
    (el as HTMLElement).onclick = () => {
      const id = el.getAttribute('data-skin-id')!;
      ProjectState.setActiveSkin(id);
      onUpdate();
    };
  });

  // Slot override buttons
  if (activeSkin) {
    bindSlotOverrideEvents(container, activeSkin, onUpdate);
  }
}

function buildSlotOverrideEditor(skin: any): string {
  const project = ProjectState.project;
  const parts = project.parts;
  const assets = project.assets || [];

  if (parts.length === 0) {
    return `<div style="font-size:0.72rem; color:var(--text-muted); text-align:center; padding:8px;">No parts in project.</div>`;
  }

  return `<div style="display:flex; flex-direction:column; gap:3px;">
    ${parts.map((p: any) => {
      const override = skin.slots?.[p.id];
      const effectiveAssetId = override?.imageAssetId ?? p.imageAssetId;
      const effectiveColor   = override?.color ?? p.color;
      const asset = assets.find((a: any) => a.id === effectiveAssetId);
      const hasOverride = !!(override?.imageAssetId || override?.color);

      return `
        <div class="slot-row" data-part-id="${p.id}"
             style="display:flex; align-items:center; gap:6px; padding:4px 6px; border-radius:var(--r-sm);
                    background:${hasOverride ? 'rgba(76,142,245,0.1)' : 'transparent'};
                    border:1px solid ${hasOverride ? 'rgba(76,142,245,0.3)' : 'transparent'};">
          ${asset
            ? `<img src="${asset.dataUrl}" style="width:20px; height:20px; object-fit:contain; border-radius:2px; border:1px solid var(--border);">`
            : `<div style="width:20px; height:20px; border-radius:2px; border:1px solid var(--border); background:${effectiveColor || '#4c8ef5'};"></div>`
          }
          <span style="flex:1; font-size:0.71rem; color:${hasOverride ? 'var(--text-bright)' : 'var(--text-muted)'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${p.name}">${p.name}</span>
          ${hasOverride ? `<button class="btn-slot-clear" data-part-id="${p.id}" title="Remove override" style="font-size:0.62rem; padding:2px 5px; color:var(--text-muted);">✕</button>` : ''}
          <button class="btn-slot-pick" data-part-id="${p.id}" title="Override asset/color" style="font-size:0.62rem; padding:2px 5px;">Pick</button>
        </div>
      `;
    }).join('')}
  </div>`;
}

function bindSlotOverrideEvents(container: HTMLElement, skin: any, onUpdate: () => void): void {
  const project = ProjectState.project;
  const assets = project.assets || [];

  // Clear override
  container.querySelectorAll('.btn-slot-clear').forEach(btn => {
    (btn as HTMLElement).onclick = (e) => {
      e.stopPropagation();
      const partId = btn.getAttribute('data-part-id')!;
      if (skin.slots) delete skin.slots[partId];
      DirtyState.markDirty();
      onUpdate();
    };
  });

  // Pick override — show inline asset picker
  container.querySelectorAll('.btn-slot-pick').forEach(btn => {
    (btn as HTMLElement).onclick = (e) => {
      e.stopPropagation();
      const partId = btn.getAttribute('data-part-id')!;
      showAssetPickerForSlot(container, partId, skin, assets, onUpdate);
    };
  });
}

function showAssetPickerForSlot(
  container: HTMLElement,
  partId: string,
  skin: any,
  assets: any[],
  onUpdate: () => void
): void {
  // Remove any existing picker popover
  document.querySelectorAll('.skin-asset-picker').forEach(el => el.remove());

  const project = ProjectState.project;
  const part = project.parts.find((p: any) => p.id === partId);

  const picker = document.createElement('div');
  picker.className = 'skin-asset-picker';
  picker.style.cssText = `
    position:fixed; z-index:9999; background:var(--bg-surface); border:1px solid var(--border);
    border-radius:var(--r-md); padding:8px; box-shadow:0 8px 24px rgba(0,0,0,0.5);
    max-width:240px; max-height:280px; overflow-y:auto;
  `;

  // Position near the button
  const btn = container.querySelector(`.btn-slot-pick[data-part-id="${partId}"]`) as HTMLElement;
  if (btn) {
    const rect = btn.getBoundingClientRect();
    picker.style.top  = (rect.bottom + 4) + 'px';
    picker.style.left = Math.min(rect.left, window.innerWidth - 250) + 'px';
  }

  picker.innerHTML = `
    <div style="font-size:0.7rem; font-weight:600; color:var(--text-muted); margin-bottom:6px; text-transform:uppercase; letter-spacing:0.05em;">Override "${part?.name || partId}"</div>
    ${assets.length === 0
      ? `<div style="font-size:0.72rem; color:var(--text-muted);">No assets in project.</div>`
      : `<div style="display:grid; grid-template-columns:repeat(3,1fr); gap:4px; margin-bottom:6px;">
          ${assets.map((a: any) => `
            <div class="picker-asset" data-asset-id="${a.id}" title="${a.name}"
                 style="cursor:pointer; border-radius:4px; border:1px solid var(--border); padding:2px;
                        background:var(--bg-elevated); text-align:center; overflow:hidden;">
              <img src="${a.dataUrl}" style="width:100%; height:40px; object-fit:contain; display:block;">
              <div style="font-size:0.58rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding:1px 2px;">${a.name}</div>
            </div>
          `).join('')}
        </div>`
    }
    <div style="display:flex; gap:4px;">
      <button id="picker-clear-btn" style="flex:1; font-size:0.68rem; padding:3px 6px; color:var(--text-muted);">Clear Override</button>
      <button id="picker-close-btn" style="flex:1; font-size:0.68rem; padding:3px 6px;">Cancel</button>
    </div>
  `;

  document.body.appendChild(picker);

  // Close on outside click
  const closeHandler = (e: MouseEvent) => {
    if (!picker.contains(e.target as Node)) {
      picker.remove();
      document.removeEventListener('mousedown', closeHandler);
    }
  };
  setTimeout(() => document.addEventListener('mousedown', closeHandler), 0);

  // Asset pick
  picker.querySelectorAll('.picker-asset').forEach(el => {
    (el as HTMLElement).onclick = () => {
      const assetId = el.getAttribute('data-asset-id')!;
      if (!skin.slots) skin.slots = {};
      if (!skin.slots[partId]) skin.slots[partId] = {};
      skin.slots[partId].imageAssetId = assetId;
      DirtyState.markDirty();
      picker.remove();
      document.removeEventListener('mousedown', closeHandler);
      onUpdate();
    };
  });

  // Clear
  const clearBtn = picker.querySelector('#picker-clear-btn') as HTMLButtonElement;
  if (clearBtn) clearBtn.onclick = () => {
    if (skin.slots) delete skin.slots[partId];
    DirtyState.markDirty();
    picker.remove();
    document.removeEventListener('mousedown', closeHandler);
    onUpdate();
  };

  // Cancel
  const closeBtn = picker.querySelector('#picker-close-btn') as HTMLButtonElement;
  if (closeBtn) closeBtn.onclick = () => {
    picker.remove();
    document.removeEventListener('mousedown', closeHandler);
  };
}
