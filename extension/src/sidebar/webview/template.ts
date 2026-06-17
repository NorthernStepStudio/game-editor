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
    <main class="shell">
      <section class="panel panel--compact-header">
        <div class="compact-title-row">
          <div class="compact-title-copy">
            <p class="eyebrow">Northern Step Studio</p>
            <h1 id="workspace-name">Matterhorn</h1>
          </div>
          <span class="status-chip">
            <span>Powered by Synox</span><strong id="server-pill">Synox runtime connected</strong>
            <span class="meta-tag" id="server-mode-badge" style="margin-left: 4px;" hidden></span>
          </span>
        </div>
        <p class="compact-meta compact-meta--faint">
          <span id="current-file">None</span>
          <span class="compact-dot">&middot;</span>
          <span id="selection-preview">No current selection.</span>
        </p>
      </section>

      <section class="panel panel--chat">
        <div class="chat-scroll">
          <div class="panel-heading panel-heading--compact">
            <div>
              <h2>Chat</h2>
            </div>
            <span class="panel-badges">
              <span class="meta-tag" id="memory-proposal-badge" hidden></span>
              <span class="meta-tag" id="response-kind">None</span>
            </span>
          </div>

          <div class="response-block response-block--compact">
            <div class="response-head">
              <h2>Latest response</h2>
              <span class="meta-tag" id="proposal-status">No proposal</span>
            </div>
            <p class="response-title" id="response-title">No response yet.</p>
            <p class="response-meta" id="response-timestamp">Ready for your first prompt.</p>
            <pre class="response-body" id="response-preview">Matterhorn ready</pre>
          </div>
        </div>

        <div class="composer-dock">
          <div class="composer-toolbar">
            <div class="composer-actions composer-actions--left">
              <button
                class="icon-button icon-button--compact"
                id="build-foundation-button"
                type="button"
                title="Build Foundation"
                aria-label="Build Foundation"
              >
                <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" width="12" height="12">
                  <path
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.22"
                    stroke-linejoin="round"
                    d="M8 1.6 9.1 6.9 14.4 8 9.1 9.1 8 14.4 6.9 9.1 1.6 8l5.3-1.1L8 1.6Z"
                  ></path>
                </svg>
              </button>
              <button
                class="icon-button icon-button--compact"
                id="agent-button"
                type="button"
                aria-expanded="false"
                title="Agent"
                aria-label="Agent"
              >
                <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" width="12" height="12">
                  <path
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M8 1.9a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4Zm-4 8.6A4 4 0 0 1 12 10.5v1.1H4v-1.1Zm1 2.5h6a1 1 0 0 1 1 1v1H4v-1a1 1 0 0 1 1-1Z"
                  ></path>
                </svg>
              </button>
              <button
                class="icon-button icon-button--compact"
                id="tools-button"
                type="button"
                aria-expanded="false"
                title="Tools"
                aria-label="Tools"
              >
                <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" width="12" height="12">
                  <path
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.22"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M10.7 1.9a3.9 3.9 0 0 0-4.2 5.7L2.1 12a1.3 1.3 0 0 0 1.9 1.9l4.4-4.4a3.9 3.9 0 0 0 5.7-4.2l-2.1.9-1.2-1.2.9-2.1Z"
                  ></path>
                </svg>
              </button>
            </div>
            <button class="icon-button icon-button--compact icon-button--send" id="submit-button" type="button" title="Ask" aria-label="Ask">
              <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" width="12" height="12">
                <path
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.22"
                  stroke-linejoin="round"
                  d="M1.8 8 14.2 1.8 10 14.2 8.1 9.1 1.8 8Zm6.9 1.1 1.1 3.1 2.2-7.3-7.3 2.2 3.1 1.1 1 0.9Z"
                ></path>
              </svg>
            </button>
          </div>

          <textarea
            id="prompt-input"
            rows="3"
            aria-label="Prompt"
            placeholder="Ask Matterhorn about this workspace, file, or change..."
          </textarea>

          </div>
      </section>
    </main>

    <div class="popover-panel popover-panel--agents" id="agent-popover" hidden>
      <div class="popover-header">
        <div>
          <h3>Agent</h3>
          <p class="panel-description">Pick a thinking style for this request.</p>
        </div>
      </div>
      <div class="agent-choice-grid" role="radiogroup" aria-label="Agent selection">
        <button class="agent-choice is-active" type="button" data-agent-choice data-agent-id="general" aria-label="General">
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <circle cx="8" cy="8" r="5.2" fill="none" stroke="currentColor" stroke-width="1.08"></circle>
            <circle cx="8" cy="8" r="1.18" fill="currentColor"></circle>
          </svg>
          <span class="agent-choice-label">
            <strong>General</strong>
          </span>
        </button>
        <button class="agent-choice" type="button" data-agent-choice data-agent-id="stack-expert" aria-label="Stack Expert">
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path
              fill="none"
              stroke="currentColor"
              stroke-width="1.08"
              stroke-linejoin="round"
              d="M3.2 5.1 8 2.6l4.8 2.5L8 7.6 3.2 5.1Zm0 3.7L8 11.3l4.8-2.5"
            ></path>
          </svg>
          <span class="agent-choice-label">
            <strong>Stack Expert</strong>
          </span>
        </button>
        <button class="agent-choice" type="button" data-agent-choice data-agent-id="architect" aria-label="Architect">
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path fill="none" stroke="currentColor" stroke-width="1.08" stroke-linejoin="round" d="M3 12.8 8 2.8l5 10H3Z"></path>
            <path fill="none" stroke="currentColor" stroke-width="1.08" stroke-linecap="round" d="M8 6.1v4.5"></path>
          </svg>
          <span class="agent-choice-label">
            <strong>Architect</strong>
          </span>
        </button>
        <button class="agent-choice" type="button" data-agent-choice data-agent-id="workspace-ops" aria-label="Workspace Ops">
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path
              fill="none"
              stroke="currentColor"
              stroke-width="1.06"
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M10.3 1.9 10.7 3.6c.3.1.7.3 1 .5l1.5-.8 1.1 1.9-1.5 1c.1.3.2.7.2 1.1l1.7.4-.4 2.2-1.7-.4c-.2.3-.3.7-.5 1l.9 1.5-1.9 1.1-1-1.5c-.3.1-.7.2-1.1.2l-.4 1.7-2.2-.4.4-1.7c-.3-.2-.7-.3-1-.5l-1.5.9-1.1-1.9 1.5-1c-.1-.3-.2-.7-.2-1.1l-1.7-.4.4-2.2 1.7.4c.2-.3.3-.7.5-1l-.9-1.5 1.9-1.1 1 1.5c.3-.1.7-.2 1.1-.2l.4-1.7 2.2.4ZM8 5.3a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 0 0 0-5.4Z"
            ></path>
          </svg>
          <span class="agent-choice-label">
            <strong>Workspace Ops</strong>
          </span>
        </button>
      </div>
    </div>

    <div class="popover-panel popover-panel--tools" id="tools-popover" hidden>
      <div class="popover-header">
        <div>
          <h3>Tools</h3>
          <p class="panel-description">Quick actions for this chat.</p>
        </div>
      </div>
      <div class="tool-stack">
        <div class="action-grid" id="action-grid"></div>
        <details class="drawer drawer--compact drawer--tools">
          <summary>Search codebase</summary>
          <div class="drawer-body">
            <div class="input-group">
              <input type="text" id="search-input" placeholder="Search codebase..." class="prompt-input prompt-input--compact" />
              <button id="search-btn" class="send-button send-button--compact" type="button">Search</button>
            </div>
            <div id="search-results-container" class="search-results-container"></div>
          </div>
        </details>
      </div>
    </div>

    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
}
