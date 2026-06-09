export const PROFESSIONAL_VIEW = `
  <section class="professional-view-shell">
    <div class="professional-hero">
      <div class="hero-copy">
        <p class="eyebrow">Northern Step Studio · 2D Animation Tooling</p>
        <h1>Build, rig, preview, and export game-ready 2D character motion.</h1>
        <p class="hero-lede">
          NStep Game Editor is a focused browser-based editor for preparing 2D characters,
          organizing sprite assets, testing motion cycles, and exporting data for game runtimes.
        </p>
        <div class="hero-actions">
          <button id="btn-overview-open-editor" class="primary">Open Editor</button>
          <button id="btn-overview-open-rigging">Start Rigging</button>
        </div>
      </div>
      <div class="product-card" aria-label="Product interface preview">
        <div class="product-topbar">
          <span></span><span></span><span></span>
          <strong>NStep Game Editor</strong>
        </div>
        <div class="product-grid">
          <div class="mini-panel">
            <b>Rig Hierarchy</b>
            <span>torso</span><span>head</span><span>arm_l</span><span>arm_r</span><span>leg_l</span>
          </div>
          <div class="mini-canvas">
            <div class="avatar-preview">
              <i class="head"></i><i class="body"></i><i class="arm left"></i><i class="arm right"></i><i class="leg left"></i><i class="leg right"></i>
            </div>
            <div class="canvas-pills"><span>Grid</span><span>Bones</span><span>Onion</span></div>
          </div>
          <div class="mini-panel right">
            <b>Properties</b>
            <span>Position</span><span>Rotation</span><span>Scale</span>
            <b>Assets</b>
            <span>body.png</span><span>sword.png</span>
          </div>
        </div>
        <div class="mini-timeline">
          <span></span><span></span><span></span><span></span><span></span>
        </div>
      </div>
    </div>

    <div class="overview-stats">
      <article><strong>3</strong><span>Core workspaces: Editor, Rigging, Cutter</span></article>
      <article><strong>JSON</strong><span>Project save/load and export workflow</span></article>
      <article><strong>2D</strong><span>Designed for game character animation</span></article>
    </div>

    <div class="overview-section two-column">
      <div>
        <p class="eyebrow">What it is for</p>
        <h2>A lightweight production tool for indie 2D game assets.</h2>
        <p>
          The editor gives a small studio a dedicated place to import sprite pieces, arrange a rig,
          preview animation behavior, save reusable projects, and export runtime-friendly motion data.
        </p>
      </div>
      <div class="feature-list">
        <article><strong>Motion Editor</strong><span>Work with parts, animation controllers, keyframes, canvas view tools, and movement previews.</span></article>
        <article><strong>Rigging Workspace</strong><span>Prepare character structure and bone-style relationships before animation work.</span></article>
        <article><strong>Sprite Cutter</strong><span>Break sprite sheets or source art into usable pieces for the asset library.</span></article>
        <article><strong>Export Pipeline</strong><span>Export project JSON, Godot-oriented output, and Canvas2D runtime data.</span></article>
      </div>
    </div>

    <div class="overview-section workflow-section">
      <p class="eyebrow">How it works</p>
      <h2>From sprite pieces to game-ready motion.</h2>
      <div class="workflow-grid">
        <article><span>01</span><strong>Create or load a project</strong><p>Start fresh, load saved JSON, or continue from autosaved browser storage.</p></article>
        <article><span>02</span><strong>Cut and organize assets</strong><p>Prepare character pieces and keep them available in the asset library.</p></article>
        <article><span>03</span><strong>Rig the character</strong><p>Arrange the parts into a usable hierarchy for animation.</p></article>
        <article><span>04</span><strong>Preview and export</strong><p>Use the canvas, timeline, and movement pad to test motion before exporting.</p></article>
      </div>
    </div>
  </section>
`;
