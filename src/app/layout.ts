export const MAIN_LAYOUT = `
  <div id="editor-page" class="app-page">
    <header class="header">
      <div class="header-left">
        <div class="logo">NStep <span>Motion</span></div>
        <nav class="main-nav">
          <button id="btn-nav-editor" class="nav-btn active">Editor</button>
          <button id="btn-nav-cutter" class="nav-btn">Cutter</button>
        </nav>
      </div>
      
      <div class="header-actions">
        <div class="header-group">
          <span class="group-label">Project</span>
          <button id="btn-proj-new">New</button>
          <button id="btn-load-json">Load</button>
          <button id="btn-proj-save" class="primary">Save</button>
          <span id="project-name" contenteditable="true" title="Click to rename project">New Project</span>
          <span id="autosave-status"></span>
        </div>
        <div class="header-group">
          <span class="group-label">Samples</span>
          <select id="hero-select">
            <option value="">-- Heroes --</option>
            <option value="warrior">Warrior</option>
            <option value="mage">Mage</option>
            <option value="rogue">Rogue</option>
            <option value="paladin">Paladin</option>
          </select>
          <select id="sample-select">
            <option value="">-- Enemies --</option>
            <option value="rotRat">Rot Rat</option>
            <option value="boneWalker">Bone Walker</option>
          </select>
        </div>
        <div class="header-group">
          <span class="group-label">Build</span>
          <button id="btn-export-json">JSON</button>
          <button id="btn-export-gd">Godot</button>
          <button id="btn-export-canvas">Runtime</button>
        </div>
      </div>
    </header>

    <aside class="panel left-panel">
      <div class="panel-header">Rig Hierarchy</div>
      <div class="panel-content" id="parts-list-container"></div>
    </aside>

    <main class="preview-panel">
      <div class="canvas-container">
        <canvas id="main-canvas" width="800" height="600"></canvas>
      </div>
    </main>

    <aside class="panel right-panel">
      <div class="panel-header">Properties</div>
      <div class="panel-content" id="inspector-container"></div>
      <div class="panel-header" style="border-top:1px solid var(--border)">Asset Library</div>
      <div class="panel-content" id="assets-list-container" style="max-height: 200px; overflow-y: auto; padding: 10px;">
      </div>
    </aside>

    <footer class="panel bottom-panel">
      <div class="panel-header">
        <span>Motion Timeline</span>
        <div id="time-display" class="time-badge">0.00s / 1.00s</div>
      </div>
      <div class="panel-content" id="controller-list-container"></div>
    </footer>
  </div>

  <div id="cutter-page" class="app-page" style="display:none;"></div>
  
  <dialog id="dlg-load" class="modal">
    <div class="modal-content">
      <h3>Load Project</h3>
      <div id="load-list" style="margin: 20px 0; max-height: 400px; overflow-y: auto;"></div>
      <div style="text-align:right;">
        <button id="btn-close-load">Close</button>
      </div>
    </div>
  </dialog>
`;
