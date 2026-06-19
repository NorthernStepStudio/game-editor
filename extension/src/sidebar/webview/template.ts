import * as vscode from "vscode";

function createNonce(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export function renderSidebarTemplate(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "src", "sidebar", "webview", "main.js"));
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "src", "sidebar", "webview", "styles.css"));
  const nonce = createNonce();

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src ${webview.cspSource}; script-src ${webview.cspSource} 'nonce-${nonce}';"
    />
    <title>Matterhorn</title>
    <link rel="stylesheet" href="${styleUri}" />
  </head>
  <body>
    <main class="app">
      <!-- Left Navigation Column -->
      <aside class="sidebar-nav">
        <!-- Brand / Header -->
        <div class="brand-header">
          <div class="brand-title">
            <svg class="brand-icon" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M3 16 10 3l7 13H3Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
              <path d="M10 8v5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
            <span class="brand-name">Matterhorn</span>
          </div>
          <div class="brand-sub">Northern Step Studio</div>
        </div>

        <!-- Workspace Section -->
        <div class="sidebar-section">
          <div class="sidebar-section-heading">
            <div class="sidebar-section-title">Workspace</div>
            <button class="sidebar-icon-button" id="new-conversation-button" type="button" title="New chat" aria-label="New chat">+</button>
          </div>
          <div class="sidebar-list">
            <div class="sidebar-folder-item" id="sidebar-workspace-folder">
              <span class="sidebar-folder-chevron">&#9662;</span>
              <span class="sidebar-folder-icon">&#128193;</span>
              <span class="sidebar-folder-name" id="workspace-folder-name">Matterhorn</span>
            </div>
            <div class="sidebar-sub-list" id="sidebar-conversations-list">
              <!-- Dynamically populated in main.js -->
            </div>
          </div>
        </div>

        <!-- Tools Section -->
        <div class="sidebar-section">
          <div class="sidebar-section-title">Tools</div>
          <div class="sidebar-list" id="sidebar-tools-list">
            <button class="sidebar-item" data-tool-command="nssWorkspaceAi.showBuildFoundation" type="button">
              <span class="sidebar-item-icon">&#10022;</span>
              <span class="sidebar-item-label">Build Foundation</span>
            </button>
            <button class="sidebar-item" data-tool-command="nssWorkspaceAi.explainProjectStructure" type="button">
              <span class="sidebar-item-icon">&#9635;</span>
              <span class="sidebar-item-label">Project Structure</span>
            </button>
            <button class="sidebar-item" data-tool-command="nssWorkspaceAi.planChange" type="button">
              <span class="sidebar-item-icon">&#9737;</span>
              <span class="sidebar-item-label">Plan Change</span>
            </button>
            <button class="sidebar-item" data-action="open-search" type="button">
              <span class="sidebar-item-icon">&#8981;</span>
              <span class="sidebar-item-label">Search Codebase</span>
            </button>
          </div>
        </div>

        <div class="sidebar-spacer"></div>

        <!-- Status Footer in Left Sidebar -->
        <div class="sidebar-status" title="Backend status">
          <span class="status-dot" id="status-dot"></span>
          <span class="status-label" id="server-pill">Connecting</span>
          <span class="mode-pill" id="server-mode-badge" hidden></span>
        </div>
      </aside>

      <!-- Right Chat Panel -->
      <section class="chat-panel">
        <header class="chat-header">
          <div class="chat-title">
            <span id="active-agent-title">General</span>
            <span class="chat-title-dot">&middot;</span>
            <span class="chat-title-sub">Chat</span>
          </div>
        </header>

        <section class="context-strip" id="context-strip" hidden>
          <span id="current-file">None</span>
          <span class="context-dot">&middot;</span>
          <span id="selection-preview">No current selection.</span>
        </section>

        <section class="search-panel" id="search-panel" hidden>
          <div class="search-inner">
            <input type="text" id="search-input" class="search-field" placeholder="Search codebase..." autocomplete="off" />
            <button id="search-btn" class="search-submit" type="button">Search</button>
          </div>
          <div id="search-results-container" class="search-results"></div>
        </section>

        <section class="convo" id="convo" aria-live="polite">
          <div class="empty-state" id="empty-state">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="32" height="32" aria-hidden="true">
              <path d="M4 19 12 4l8 15H4Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
              <path d="M12 10v5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            </svg>
            <p>Ask Matterhorn anything about your workspace, code, or changes.</p>
          </div>
        </section>

        <section class="composer">
          <!-- Agent selector popup (renders above composer when open) -->
          <div class="agent-menu" id="agent-menu" hidden role="listbox" aria-label="Select agent">
            <div class="agent-menu-label">Switch agent</div>
            <button class="agent-menu-item is-active" role="option" data-agent-id="general" type="button">
              <span class="agent-menu-icon">&#9671;</span>
              <span class="agent-menu-name">General</span>
              <span class="agent-menu-desc">General-purpose assist</span>
            </button>
            <button class="agent-menu-item" role="option" data-agent-id="stack-expert" type="button">
              <span class="agent-menu-icon">&#9889;</span>
              <span class="agent-menu-name">Stack Expert</span>
              <span class="agent-menu-desc">Deep repo context</span>
            </button>
            <button class="agent-menu-item" role="option" data-agent-id="architect" type="button">
              <span class="agent-menu-icon">&#9633;</span>
              <span class="agent-menu-name">Architect</span>
              <span class="agent-menu-desc">System design</span>
            </button>
            <button class="agent-menu-item" role="option" data-agent-id="workspace-ops" type="button">
              <span class="agent-menu-icon">&#8984;</span>
              <span class="agent-menu-name">Workspace Ops</span>
              <span class="agent-menu-desc">File search</span>
            </button>
          </div>

          <!-- Model selector popup (renders above composer when open) -->
          <div class="agent-menu model-menu" id="model-menu" hidden role="listbox" aria-label="Select model">
            <div class="agent-menu-label">Select model</div>
            <div id="model-menu-list">
              <button class="agent-menu-item" role="option" data-model-id="ollama" data-model-name="Ollama" data-model-detail="Auto local model" type="button">
                <span class="agent-menu-icon">&#8857;</span>
                <span class="agent-menu-name">Ollama (Default)</span>
                <span class="model-menu-model">auto local</span>
                <span class="model-menu-badge model-menu-badge--available">Local</span>
              </button>
              <button class="agent-menu-item custom-model-btn" role="option" data-action="custom-model" data-provider="ollama" type="button">
                <span class="agent-menu-icon">&#9998;</span>
                <span class="agent-menu-name">Ollama (Custom...)</span>
                <span class="model-menu-model">Enter model name</span>
              </button>
              <button class="agent-menu-item" role="option" data-model-id="lmstudio" data-model-name="LM Studio" data-model-detail="Loaded model" type="button">
                <span class="agent-menu-icon">&#8862;</span>
                <span class="agent-menu-name">LM Studio (Default)</span>
                <span class="model-menu-model">loaded model</span>
                <span class="model-menu-badge model-menu-badge--available">Local</span>
              </button>
              <button class="agent-menu-item custom-model-btn" role="option" data-action="custom-model" data-provider="lmstudio" type="button">
                <span class="agent-menu-icon">&#9998;</span>
                <span class="agent-menu-name">LM Studio (Custom...)</span>
                <span class="model-menu-model">Enter model name</span>
              </button>
              <button class="agent-menu-item" role="option" data-model-id="gemini" data-model-name="Gemini" data-model-detail="GEMINI_API_KEY" type="button">
                <span class="agent-menu-icon">&#10022;</span>
                <span class="agent-menu-name">Gemini</span>
                <span class="model-menu-model">gemini-2.5-flash</span>
                <span class="model-menu-badge">Cloud</span>
              </button>
              <button class="agent-menu-item" role="option" data-model-id="openai" data-model-name="ChatGPT" data-model-detail="OPENAI_API_KEY" type="button">
                <span class="agent-menu-icon">&#8853;</span>
                <span class="agent-menu-name">ChatGPT</span>
                <span class="model-menu-model">gpt-4o</span>
                <span class="model-menu-badge">Cloud</span>
              </button>
              <button class="agent-menu-item" role="option" data-model-id="anthropic" data-model-name="Claude" data-model-detail="ANTHROPIC_API_KEY" type="button">
                <span class="agent-menu-icon">&#9670;</span>
                <span class="agent-menu-name">Claude</span>
                <span class="model-menu-model">claude-3.5</span>
                <span class="model-menu-badge">Cloud</span>
              </button>
            </div>
          </div>

          <div class="composer-inner">
            <textarea
              id="prompt-input"
              class="composer-input"
              rows="1"
              aria-label="Prompt"
              placeholder="Ask Matterhorn..."
            ></textarea>

            <button class="composer-send" id="submit-button" type="button" title="Send (Enter)" aria-label="Send">
              <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width="14" height="14" aria-hidden="true">
                <path d="M2 8 14 2l-4 12-2-5-6-1Zm7 1 1 3 2-7-7 2 3 1 1 1Z" fill="currentColor"/>
              </svg>
            </button>
          </div>

          <div class="composer-controls" aria-label="Chat options">
            <button class="agent-selector" id="agent-selector" type="button" aria-haspopup="listbox" aria-expanded="false" title="Switch agent">
              <span class="agent-selector-icon" id="agent-selector-icon">&#9671;</span>
              <span class="agent-selector-label" id="agent-selector-label">General</span>
              <svg class="agent-selector-caret" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg" width="8" height="8" aria-hidden="true">
                <path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>

            <button class="agent-selector model-selector" id="model-selector" type="button" aria-haspopup="listbox" aria-expanded="false" title="Select model">
              <span class="agent-selector-icon" id="model-selector-icon">&#9675;</span>
              <span class="agent-selector-label" id="model-selector-label">Ollama</span>
              <svg class="agent-selector-caret" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg" width="8" height="8" aria-hidden="true">
                <path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>

          <div class="composer-footer">
            <span class="composer-hint">Enter to send &middot; Shift+Enter for newline</span>
          </div>
        </section>
      </section>
    </main>

    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
}
