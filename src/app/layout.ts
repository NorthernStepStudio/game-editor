import { PROFESSIONAL_VIEW } from './professionalView';

export const MAIN_LAYOUT = `
  <div id="overview-page" class="app-page" style="display:block;">
    ${PROFESSIONAL_VIEW}
  </div>

  <div id="editor-page" class="app-page" style="display:none;">
    <header class="header">
      <div class="logo">N<span>Step</span></div>
      <nav class="main-nav">
        <button id="btn-nav-overview" class="nav-btn active">Overview</button>
        <button id="btn-nav-editor" class="nav-btn">Editor</button>
        <button id="btn-nav-rigging" class="nav-btn">Rigging</button>
        <button id="btn-nav-cutter" class="nav-btn">Cutter</button>
      </nav>

      <div class="header-sep"></div>

      <div class="header-group">
        <span class="group-label">Project</span>
        <button id="btn-proj-new">New</button>
        <button id="btn-load-json">Load</button>
        <button id="btn-proj-save" class="primary">Save</button>
        <span id="project-name" contenteditable="true" title="Click to rename">New Project</span>
        <span id="autosave-status"></span>
      </div>

      <div class="header-sep"></div>

      <div class="header-group">
        <span class="group-label">Samples</span>
        <select id="hero-select">
          <option value="">Heroes…</option>
          <option value="warrior">Warrior</option>
          <option value="mage">Mage</option>
          <option value="rogue">Rogue</option>
          <option value="paladin">Paladin</option>
        </select>
        <select id="sample-select">
          <option value="">Enemies…</option>
          <option value="rotRat">Rot Rat</option>
          <option value="boneWalker">Bone Walker</option>
        </select>
      </div>

      <div class="header-spacer"></div>

      <div class="header-group">
        <span class="group-label">Export</span>
        <button id="btn-export-json" title="Export project as JSON">JSON</button>
        <button id="btn-export-gd" title="Export as Godot GDScript">Godot</button>
        <button id="btn-export-canvas" title="Export Canvas2D runtime">Runtime</button>
        <button id="btn-export-panel" class="primary" title="Image sequence, GIF, Unity C#">Export…</button>
      </div>
    </header>

    <!-- Left: Rig Hierarchy -->
    <aside class="panel left-panel">
      <div class="panel-header">
        Rig Hierarchy
        <span id="parts-count-badge">0 parts</span>
      </div>
      <div class="panel-content" style="padding:6px;" id="parts-list-container"></div>
    </aside>

    <!-- Center: Canvas -->
    <main class="preview-panel">
      <div class="canvas-container">
        <canvas id="main-canvas" width="800" height="600"></canvas>
        <div class="canvas-toolbar" id="canvas-toolbar">
          <button id="btn-toggle-grid"     class="active" title="Toggle grid (G)">Grid</button>
          <button id="btn-toggle-skeleton" title="Toggle bone skeleton">Bones</button>
          <button id="btn-toggle-names"    title="Toggle part name labels">Names</button>
          <button id="btn-toggle-onion"    title="Toggle onion skinning">Onion</button>
          <button id="btn-reset-view"      title="Reset zoom &amp; pan (press 0)">Reset</button>
          <button id="btn-fit-all"         title="Fit all parts in view (press F)">Fit</button>
          <span style="width:1px;background:var(--border);align-self:stretch;margin:0 3px;display:inline-block;"></span>
          <button id="btn-gizmo-move"   class="active" title="Move tool (W)" style="min-width:34px;">↕</button>
          <button id="btn-gizmo-rotate" title="Rotate tool (E)" style="min-width:34px;">↻</button>
          <button id="btn-gizmo-scale"  title="Scale tool (R)" style="min-width:34px;">⊡</button>
        </div>
        <div class="canvas-zoom-controls">
          <button id="btn-zoom-out" class="zoom-step-btn" title="Zoom out (−)">−</button>
          <div class="canvas-zoom-badge" id="zoom-badge">100%</div>
          <button id="btn-zoom-in"  class="zoom-step-btn" title="Zoom in (+)">+</button>
        </div>

        <!-- Locomotion d-pad -->
        <div class="loco-pad" id="loco-pad">
          <div class="loco-pad-title">Move Preview</div>
          <div class="loco-dpad">
            <div></div>
            <button id="loco-up"    class="loco-btn" title="Move up">▲</button>
            <div></div>
            <button id="loco-left"  class="loco-btn" title="Move left (flips character)">◀</button>
            <button id="loco-stop"  class="loco-btn loco-stop active" title="Stop">■</button>
            <button id="loco-right" class="loco-btn" title="Move right">▶</button>
            <div></div>
            <button id="loco-down"  class="loco-btn" title="Move down">▼</button>
            <div></div>
          </div>
          <div class="loco-speed-row">
            <button id="loco-walk" class="loco-speed-btn active" title="Walk speed">Walk</button>
            <button id="loco-run"  class="loco-speed-btn"       title="Run speed">Run</button>
          </div>
        </div>
      </div>
    </main>

    <!-- Right: Inspector + Assets -->
    <aside class="panel right-panel">
      <div class="right-panel-inner">
        <div class="panel-header">Properties</div>
        <div class="right-panel-top panel-content" id="inspector-container">
          <div class="panel-empty"><span class="panel-empty-icon">🎯</span>Select a part to inspect</div>
        </div>
        <div class="right-panel-divider"></div>
        <div class="panel-header">
          Asset Library
          <span id="asset-count-badge">0 assets</span>
        </div>
        <div class="right-panel-bottom" id="assets-list-container" style="padding:8px; max-height:140px; overflow-y:auto;"></div>
        <div class="right-panel-divider"></div>
        <div class="panel-header">
          Skins
          <span id="skin-count-badge">0 skins</span>
        </div>
        <div id="skins-list-container" style="padding:8px; max-height:160px; overflow-y:auto;"></div>
      </div>
    </aside>

    <!-- Bottom: Timeline -->
    <footer class="panel bottom-panel" style="border-right:none;">
      <div class="panel-header" style="padding:7px 10px;">Motion Timeline</div>
      <div class="panel-content" id="controller-list-container"></div>
    </footer>
  </div>

  <div id="cutter-page" class="app-page" style="display:none;"></div>

  <div id="rigging-page" class="app-page" style="display:none;"></div>

  <dialog id="dlg-load">
    <h3>Load Project</h3>
    <p style="font-size:0.75rem; color:var(--text-muted); margin-top:4px; margin-bottom:16px;">Select a saved project or import a JSON file.</p>
    <div id="load-list" style="max-height:380px; overflow-y:auto; display:flex; flex-direction:column; gap:6px;"></div>
    <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px; padding-top:12px; border-top:1px solid var(--border);">
      <button id="btn-close-load">Close</button>
    </div>
  </dialog>

  <dialog id="dlg-export" style="min-width:420px; max-width:500px;">
    <h3 style="margin:0 0 4px;">Export</h3>
    <p style="font-size:0.75rem; color:var(--text-muted); margin:0 0 16px;">Render frames as image sequence or GIF, or generate a Unity C# runtime.</p>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px;">
      <label style="display:flex; flex-direction:column; gap:4px; font-size:0.78rem; font-weight:600; color:var(--text-muted);">
        Animation
        <select id="exp-anim" style="font-size:0.82rem;"></select>
      </label>
      <label style="display:flex; flex-direction:column; gap:4px; font-size:0.78rem; font-weight:600; color:var(--text-muted);">
        FPS
        <select id="exp-fps" style="font-size:0.82rem;">
          <option value="12">12 fps</option>
          <option value="24" selected>24 fps</option>
          <option value="30">30 fps</option>
          <option value="60">60 fps</option>
        </select>
      </label>
      <label style="display:flex; flex-direction:column; gap:4px; font-size:0.78rem; font-weight:600; color:var(--text-muted);">
        Width (px)
        <input id="exp-width" type="number" value="512" min="64" max="2048" step="64" style="font-size:0.82rem; padding:5px 8px; background:var(--bg-surface); border:1px solid var(--border); border-radius:var(--r-sm); color:var(--text-bright);">
      </label>
      <label style="display:flex; flex-direction:column; gap:4px; font-size:0.78rem; font-weight:600; color:var(--text-muted);">
        Height (px)
        <input id="exp-height" type="number" value="512" min="64" max="2048" step="64" style="font-size:0.82rem; padding:5px 8px; background:var(--bg-surface); border:1px solid var(--border); border-radius:var(--r-sm); color:var(--text-bright);">
      </label>
      <label style="display:flex; flex-direction:column; gap:4px; font-size:0.78rem; font-weight:600; color:var(--text-muted);">
        Background
        <select id="exp-bg" style="font-size:0.82rem;">
          <option value="transparent">Transparent</option>
          <option value="#ffffff">White</option>
          <option value="#000000">Black</option>
          <option value="#1a1a2e">Dark</option>
        </select>
      </label>
      <label style="display:flex; flex-direction:column; gap:4px; font-size:0.78rem; font-weight:600; color:var(--text-muted);">
        Scale
        <select id="exp-scale" style="font-size:0.82rem;">
          <option value="0.5">0.5× (256 px base)</option>
          <option value="1" selected>1× (512 px base)</option>
          <option value="2">2× (1024 px base)</option>
          <option value="custom">Custom</option>
        </select>
      </label>
    </div>

    <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:14px;">
      <button id="btn-exp-imgseq" class="primary" style="text-align:left; padding:10px 14px;">
        📦 Image Sequence (.zip) — one PNG per frame
      </button>
      <button id="btn-exp-gif" class="primary" style="text-align:left; padding:10px 14px;">
        🎞️ Animated GIF — single animated file
      </button>
      <button id="btn-exp-unity" style="text-align:left; padding:10px 14px;">
        🎮 Copy Unity C# — NStepAnimator MonoBehaviour
      </button>
      <button id="btn-exp-demo-html" style="text-align:left; padding:10px 14px;">
        🌐 Demo HTML — standalone browser preview
      </button>
    </div>

    <div id="exp-progress" style="display:none; margin-bottom:12px;">
      <div id="exp-progress-label" style="font-size:0.75rem; color:var(--text-muted); margin-bottom:4px;">Rendering…</div>
      <progress id="exp-progress-bar" style="width:100%; height:6px;" max="100" value="0"></progress>
    </div>

    <div style="display:flex; justify-content:flex-end; padding-top:12px; border-top:1px solid var(--border);">
      <button id="btn-close-export">Close</button>
    </div>
  </dialog>
`;
