import { CutterAppState } from './spriteCutterState';
import { loadCutterImage, getFrameCoord, renderCutter } from './spriteCutterRenderer';
import { extractSelectedPart, sendPartsToEditor, detectFrames, cleanupSelection } from './spriteCutterLogic';

export function setupCutterUI(onNavigate: (page: string) => void) {
  const container = document.getElementById('cutter-page')!;
  
  container.innerHTML = `
    <div class="cutter-layout">
      <header class="cutter-header">
        <div style="display:flex; gap:10px; align-items:center;">
          <button id="btn-cutter-back">← Motion Editor</button>
          <span style="font-weight:600; font-size:1.1rem; color:var(--accent);">Sprite Sheet Cutter</span>
        </div>
        <div class="cutter-toolbar">
          <button id="btn-cutter-upload">Upload Sprite Sheet</button>
          <input type="file" id="cutter-file-input" style="display:none;" accept="image/*" />
          
          <div class="header-group">
            <span class="group-label">Grid</span>
            <input type="number" id="in-fw" placeholder="W" style="width:50px;" value="32">
            <input type="number" id="in-fh" placeholder="H" style="width:50px;" value="32">
            <button id="btn-cutter-detect">Auto Detect</button>
          </div>
          
          <div class="header-group">
             <button id="btn-cutter-send" class="primary">Send to Motion Editor</button>
          </div>
        </div>
      </header>
      
      <div class="cutter-main">
        <div class="cutter-left panel">
          <div class="panel-header">Full Sprite Sheet</div>
          <div class="panel-content" style="position:relative; overflow:auto;">
            ${CutterAppState.source ? '<canvas id="sheet-canvas" width="800" height="800"></canvas>' : '<div class="panel-empty">Upload a sprite sheet to begin</div>'}
          </div>
        </div>
        
        <div class="cutter-center panel">
          <div class="panel-header">
            <span>Selected Frame</span>
            <div style="display:flex; gap:5px;">
              <button id="btn-prev-frame" ${!CutterAppState.source ? 'disabled' : ''}>←</button>
              <span id="frame-idx-label">${CutterAppState.selectedFrameIndex}</span>
              <button id="btn-next-frame" ${!CutterAppState.source ? 'disabled' : ''}>→</button>
            </div>
          </div>
          <div class="panel-content" style="position:relative; overflow:hidden; display:flex; align-items:center; justify-content:center; background:#111;">
            ${CutterAppState.source ? '<canvas id="frame-canvas" width="500" height="500"></canvas>' : '<div class="panel-empty">No frame selected</div>'}
            
            <div class="cutter-tools-overlay" style="${!CutterAppState.source ? 'display:none' : ''}">
               <button id="btn-extract-rect" class="primary" ${!CutterAppState.selection ? 'disabled' : ''}>Extract Selection</button>
               <label title="Remove transparent pixels"><input type="checkbox" id="chk-auto-trim" ${CutterAppState.autoTrim ? 'checked' : ''}> Auto-Trim</label>
               <div style="display:flex; align-items:center; gap:5px; margin-left:10px;">
                 <label>Zoom</label>
                 <input type="range" id="range-zoom" min="1" max="10" step="0.5" value="${CutterAppState.zoom}">
               </div>
            </div>

            <div class="cutter-cleanup-overlay" style="${!CutterAppState.source ? 'display:none' : ''}">
               <div class="tool-label">BACKGROUND CLEANUP</div>
               <div style="display:flex; gap:10px; align-items:center;">
                 <input type="color" id="color-cleanup" value="#000000">
                 <input type="range" id="range-tolerance" min="1" max="200" value="30">
                 <button id="btn-clean-bg" class="secondary">Clean Selection</button>
               </div>
            </div>

            ${CutterAppState.source ? '<div style="position:absolute; bottom:5px; right:10px; font-size:10px; color:var(--text-muted);">Shift+Click inside selection to set pivot</div>' : ''}
          </div>
        </div>
        
        <div class="cutter-right panel">
          <div class="panel-header">
            <span>Extracted Parts</span>
            <button id="btn-clear-extracted" style="font-size:0.7rem; padding:2px 6px;">Clear All</button>
          </div>
          <div class="panel-content" id="extracted-list">
             ${CutterAppState.extractedParts.length === 0 ? '<div class="panel-empty">No parts extracted yet</div>' : ''}
          </div>
        </div>
      </div>
    </div>
  `;

  // Bindings
  document.getElementById('btn-cutter-back')!.onclick = () => onNavigate('editor');
  
  const fileIn = document.getElementById('cutter-file-input') as HTMLInputElement;
  document.getElementById('btn-cutter-upload')!.onclick = () => fileIn.click();
  fileIn.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (re) => {
        const dataUrl = re.target?.result as string;
        CutterAppState.source = {
          id: 'sheet-' + Date.now(),
          name: file.name,
          dataUrl,
          width: 0, height: 0,
          frameWidth: 32, frameHeight: 32,
          columns: 1, rows: 1,
          spacingX: 0, spacingY: 0,
          marginX: 0, marginY: 0
        };
        loadCutterImage(dataUrl);
        renderCutterUI();
      };
      reader.readAsDataURL(file);
    }
  };

  const updateGrid = () => {
    if (!CutterAppState.source) return;
    CutterAppState.source.frameWidth = +(document.getElementById('in-fw') as HTMLInputElement).value;
    CutterAppState.source.frameHeight = +(document.getElementById('in-fh') as HTMLInputElement).value;
    CutterAppState.source.columns = Math.floor(CutterAppState.source.width / CutterAppState.source.frameWidth);
    CutterAppState.source.rows = Math.floor(CutterAppState.source.height / CutterAppState.source.frameHeight);
    renderCutter();
    renderCutterUI();
  };
  
  document.getElementById('in-fw')!.onchange = updateGrid;
  document.getElementById('in-fh')!.onchange = updateGrid;
  
  document.getElementById('btn-cutter-detect')!.onclick = () => {
    detectFrames();
    const s = CutterAppState.source;
    if (s) {
      (document.getElementById('in-fw') as HTMLInputElement).value = s.frameWidth.toString();
      (document.getElementById('in-fh') as HTMLInputElement).value = s.frameHeight.toString();
    }
    renderCutter();
    renderCutterUI();
  };

  document.getElementById('btn-prev-frame')!.onclick = () => {
    if (CutterAppState.selectedFrameIndex > 0) {
      CutterAppState.selectedFrameIndex--;
      renderCutter();
      renderCutterUI();
    }
  };
  document.getElementById('btn-next-frame')!.onclick = () => {
    if (CutterAppState.source) {
      const max = CutterAppState.source.columns * CutterAppState.source.rows - 1;
      if (CutterAppState.selectedFrameIndex < max) {
        CutterAppState.selectedFrameIndex++;
        renderCutter();
        renderCutterUI();
      }
    }
  };

  const rangeZoom = document.getElementById('range-zoom') as HTMLInputElement;
  if (rangeZoom) {
    rangeZoom.oninput = () => {
      CutterAppState.zoom = +rangeZoom.value;
      renderCutter();
    };
  }

  const btnClear = document.getElementById('btn-clear-extracted');
  if (btnClear) {
    btnClear.onclick = () => {
      if (confirm('Clear all extracted parts?')) {
        CutterAppState.extractedParts = [];
        renderCutterUI();
      }
    };
  }

  const fCanvas = document.getElementById('frame-canvas') as HTMLCanvasElement;
  if (fCanvas) {
    fCanvas.onmousedown = (e) => {
      const rect = fCanvas.getBoundingClientRect();
      const coord = getFrameCoord(e.clientX - rect.left, e.clientY - rect.top);
      if (!coord) return;

      if (CutterAppState.selection && 
          coord.x >= CutterAppState.selection.x && coord.x < CutterAppState.selection.x + CutterAppState.selection.w &&
          coord.y >= CutterAppState.selection.y && coord.y < CutterAppState.selection.y + CutterAppState.selection.h) {
        if (e.shiftKey) {
           CutterAppState.pivot = { x: coord.x - CutterAppState.selection.x, y: coord.y - CutterAppState.selection.y };
           renderCutter();
           renderCutterUI();
           return;
        }
      }

      CutterAppState.selection = { x: coord.x, y: coord.y, w: 1, h: 1 };
      CutterAppState.pivot = null;
      CutterAppState.isDraggingSelection = true;
      renderCutterUI(); 
    };
  }

  window.onmousemove = (e) => {
    if (CutterAppState.isDraggingSelection && CutterAppState.selection) {
      const fCanvas = document.getElementById('frame-canvas') as HTMLCanvasElement;
      if (!fCanvas) return;
      const rect = fCanvas.getBoundingClientRect();
      const coord = getFrameCoord(e.clientX - rect.left, e.clientY - rect.top);
      if (coord) {
        CutterAppState.selection.w = Math.max(1, coord.x - CutterAppState.selection.x + 1);
        CutterAppState.selection.h = Math.max(1, coord.y - CutterAppState.selection.y + 1);
        renderCutter();
      }
    }
  };

  window.onmouseup = () => {
    if (CutterAppState.isDraggingSelection) {
      CutterAppState.isDraggingSelection = false;
      renderCutterUI();
    }
  };

  const btnExtract = document.getElementById('btn-extract-rect');
  if (btnExtract) {
    btnExtract.onclick = () => {
      if (!CutterAppState.selection) return;
      const name = prompt('Part name:', 'body');
      if (name) {
        extractSelectedPart(name);
        renderCutterUI();
      }
    };
  }

  const btnSend = document.getElementById('btn-cutter-send');
  if (btnSend) {
    btnSend.onclick = () => {
      sendPartsToEditor();
      onNavigate('editor');
    };
  }
  
  const btnClean = document.getElementById('btn-clean-bg');
  if (btnClean) {
    btnClean.onclick = async () => {
      const color = (document.getElementById('color-cleanup') as HTMLInputElement).value;
      const tolerance = +(document.getElementById('range-tolerance') as HTMLInputElement).value;
      
      // Perform cleanup on the current frame selection
      // This will update the dataUrl of the selection in-memory
      const cleaned = await cleanupSelection(color, tolerance);
      if (cleaned) {
        // Redraw with cleaned version
        renderCutter();
      }
    };
  }
}

export function renderCutterUI() {
  const s = CutterAppState.source;
  const frameIdxLabel = document.getElementById('frame-idx-label');
  if (frameIdxLabel && s) {
    frameIdxLabel.textContent = CutterAppState.selectedFrameIndex.toString();
  }
  
  // Update button states
  const btnExtract = document.getElementById('btn-extract-rect') as HTMLButtonElement;
  if (btnExtract) {
    btnExtract.disabled = !CutterAppState.selection;
  }
  
  const btnSend = document.getElementById('btn-cutter-send') as HTMLButtonElement;
  if (btnSend) {
    btnSend.disabled = CutterAppState.extractedParts.length === 0;
  }

  const list = document.getElementById('extracted-list')!;
  if (CutterAppState.extractedParts.length === 0) {
    list.innerHTML = '<div class="panel-empty">No parts extracted yet</div>';
  } else {
    list.innerHTML = CutterAppState.extractedParts.map(p => `
      <div class="extracted-card">
        <div class="extracted-preview">
          <img src="${p.dataUrl}">
        </div>
        <div class="extracted-info">
          <div class="extracted-name">${p.name}</div>
          <div class="extracted-dim">${p.width}x${p.height}</div>
        </div>
        <button class="btn-del-part" data-id="${p.id}" title="Delete">×</button>
      </div>
    `).join('');
    
    list.querySelectorAll('.btn-del-part').forEach(btn => {
      (btn as HTMLElement).onclick = (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).getAttribute('data-id');
        CutterAppState.extractedParts = CutterAppState.extractedParts.filter(x => x.id !== id);
        renderCutterUI();
      };
    });
  }
}
