export const MAIN_LAYOUT = `
  <div id="editor-page" class="app-page">
    <header class="header">
      <div class="logo">N<span>Step</span></div>
      <nav class="main-nav">
        <button id="btn-nav-editor" class="nav-btn active">Editor</button>
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
        <div class="right-panel-bottom" id="assets-list-container" style="padding:8px; max-height:180px; overflow-y:auto;"></div>
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
`;
