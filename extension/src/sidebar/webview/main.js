(() => {
  const vscode = acquireVsCodeApi();
  const savedState = vscode.getState() ?? {};
  let selectedAgentId = savedState.selectedAgentId ?? "general";

  const submitButton = document.getElementById("submit-button");
  const buildFoundationButton = document.getElementById("build-foundation-button");
  const agentButton = document.getElementById("agent-button");
  const agentPopover = document.getElementById("agent-popover");
  const toolsButton = document.getElementById("tools-button");
  const toolsPopover = document.getElementById("tools-popover");
  const agentButtons = Array.from(document.querySelectorAll("[data-agent-choice]"));
  const promptInput = document.getElementById("prompt-input");

  const actionGrid = document.getElementById("action-grid");
  const workspaceName = document.getElementById("workspace-name");
  const serverPill = document.getElementById("server-pill");
  const serverModeBadge = document.getElementById("server-mode-badge");
  const currentFile = document.getElementById("current-file");
  const selectionPreview = document.getElementById("selection-preview");
  const responseKind = document.getElementById("response-kind");
  const memoryProposalBadge = document.getElementById("memory-proposal-badge");
  const responseTitle = document.getElementById("response-title");
  const responseTimestamp = document.getElementById("response-timestamp");
  const responsePreview = document.getElementById("response-preview");
  const proposalStatus = document.getElementById("proposal-status");
  const searchInput = document.getElementById("search-input");
  const searchBtn = document.getElementById("search-btn");
  const searchResultsContainer = document.getElementById("search-results-container");

  let isPrompting = false;

  syncAgentSelection();
  persistState();
  closeAllPopovers();

  function setupEventListeners() {
    if (submitButton && promptInput) {
      submitButton.addEventListener("click", () => {
        if (isPrompting) return;

        const prompt = promptInput.value.trim();
        if (!prompt) {
          promptInput.focus();
          return;
        }

        isPrompting = true;
        updateSubmitButtonState();
        closeAllPopovers();

        vscode.postMessage({
          type: "action",
          command: "nssWorkspaceAi.askWorkspaceAi",
          prompt,
          agentId: selectedAgentId,
        });

        promptInput.value = "";
        promptInput.style.height = ""; // Reset height if it was expanded
        promptInput.focus();
      });

      promptInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          submitButton.click();
        }
      });
    }

    if (buildFoundationButton) {
      buildFoundationButton.addEventListener("click", () => {
        vscode.postMessage({
          type: "action",
          command: "nssWorkspaceAi.showBuildFoundation",
        });
      });
    }

    if (agentButton && agentPopover) {
      agentButton.addEventListener("click", () => {
        togglePopover(agentPopover, agentButton, 240);
      });
    }

    if (toolsButton && toolsPopover) {
      toolsButton.addEventListener("click", () => {
        togglePopover(toolsPopover, toolsButton, 280);
      });
    }

    agentButtons.forEach((button) => {
      button.addEventListener("click", () => {
        selectedAgentId = button.dataset.agentId ?? "general";
        syncAgentSelection();
        persistState();
        if (agentPopover && agentButton) {
          setPopoverOpen(agentPopover, agentButton, false);
        }
      });
    });

    if (searchBtn && searchInput && searchResultsContainer) {
      searchBtn.addEventListener("click", () => {
        const prompt = searchInput.value.trim();
        if (!prompt) {
          searchInput.focus();
          return;
        }

        vscode.postMessage({
          type: "action",
          command: "nssWorkspaceAi.searchCodebase",
          prompt,
        });
        searchResultsContainer.innerHTML = '<div class="loading">Searching...</div>';
      });

      searchInput.addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
          searchBtn.click();
        }
      });
    }

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeAllPopovers();
      }
    });

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      const popovers = [];
      if (agentPopover && agentButton) popovers.push([agentPopover, agentButton]);
      if (toolsPopover && toolsButton) popovers.push([toolsPopover, toolsButton]);

      if (popovers.some(([popover, button]) => popover.contains(target) || button.contains(target))) {
        return;
      }

      closeAllPopovers();
    });
  }

  // Initial Sync & Setup
  syncAgentSelection();
  persistState();
  closeAllPopovers();
  setupEventListeners();
  console.log("[Matterhorn] Webview initialized");

  window.addEventListener("message", (event) => {
    const message = event.data;
    const payload = message.payload;

    if (message.type === "search-results") {
      renderSearchResults(payload.results ?? []);
      return;
    }

    if (message.type !== "state") {
      return;
    }

    renderState(payload);
  });

  function renderState(payload) {
    serverPill.textContent = payload.serverStatus;
    
    if (serverModeBadge) {
      const modeLabelMap = {
        gemini: "Synox provider: Gemini",
        ollama: "Synox provider: Ollama",
        mock: "Synox provider: Mock",
        off: "Synox provider: Off",
      };
      serverModeBadge.textContent = modeLabelMap[payload.serverMode] ?? "";
      serverModeBadge.hidden = payload.serverMode === "unknown" || !payload.serverMode;
      serverModeBadge.classList.toggle("meta-tag--warning", payload.serverMode === "mock");
    }

    workspaceName.textContent = payload.title ?? payload.workspaceName;
    currentFile.textContent = payload.currentFilePath ?? "None";
    selectionPreview.textContent = payload.currentSelectionPreview ?? "No current selection.";
    renderLatestResponse(payload.latestResponse);
    proposalStatus.textContent = "No proposal";

    isPrompting = false;
    updateSubmitButtonState();

    persistState();
    renderActions(payload.quickActions ?? []);
  }

  function syncAgentSelection() {
    agentButtons.forEach((button) => {
      const isActive = button.dataset.agentId === selectedAgentId;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  function togglePopover(popover, button, width) {
    setPopoverOpen(popover, button, popover.hidden, width);
  }

  function setPopoverOpen(popover, button, open, width = 300) {
    const isOpen = Boolean(open);
    [agentPopover, toolsPopover].forEach((panel) => {
      if (panel !== popover) {
        panel.hidden = true;
        panel.style.visibility = "";
      }
    });
    [agentButton, toolsButton].forEach((toggleButton) => {
      if (toggleButton !== button) {
        toggleButton.setAttribute("aria-expanded", "false");
      }
    });

    popover.hidden = !isOpen;
    button.setAttribute("aria-expanded", String(isOpen));

    if (isOpen) {
      positionPopover(popover, button, width);
    } else {
      popover.style.left = "";
      popover.style.top = "";
      popover.style.width = "";
      popover.style.visibility = "";
    }
  }

  function closeAllPopovers() {
    setPopoverOpen(agentPopover, agentButton, false);
    setPopoverOpen(toolsPopover, toolsButton, false);
  }

  function positionPopover(popover, button, width) {
    popover.style.visibility = "hidden";
    popover.style.width = `${Math.min(width, window.innerWidth - 16)}px`;
    popover.style.left = "0px";
    popover.style.top = "0px";

    requestAnimationFrame(() => {
      if (popover.hidden) {
        return;
      }

      const buttonRect = button.getBoundingClientRect();
      const popoverRect = popover.getBoundingClientRect();
      
      // Align left edge with button's left edge, but clamp to viewport
      let left = buttonRect.left;
      const maxLeft = window.innerWidth - popoverRect.width - 8;
      left = Math.max(8, Math.min(left, maxLeft));
      
      // Position above button with a 12px margin
      const top = buttonRect.top - popoverRect.height - 12;

      popover.style.left = `${left}px`;
      popover.style.top = `${top}px`;
      popover.style.visibility = "visible";
    });
  }

  function renderLatestResponse(latestResponse) {
    const proposalCount = latestResponse?.proposedMemories?.length ?? 0;
    responseTimestamp.textContent = latestResponse
      ? `Updated ${new Date(latestResponse.createdAt).toLocaleString()}`
      : "Ready for your first prompt.";

    if (proposalCount > 0) {
      memoryProposalBadge.hidden = false;
      memoryProposalBadge.textContent = `${proposalCount} memory proposal${proposalCount === 1 ? "" : "s"}`;
    } else {
      memoryProposalBadge.hidden = true;
      memoryProposalBadge.textContent = "";
    }

    if (latestResponse) {
      responseKind.textContent = latestResponse.kind;
      responseTitle.textContent = latestResponse.title;
      responsePreview.textContent = latestResponse.excerpt;
      return;
    }

    responseKind.textContent = "None";
    responseTitle.textContent = "No response yet.";
    responsePreview.textContent = "Matterhorn ready";
  }

  function updateSubmitButtonState() {
    if (!submitButton) return;
    submitButton.disabled = isPrompting;
    submitButton.classList.toggle("is-loading", isPrompting);
    
    const svgPath = submitButton.querySelector("path");
    if (svgPath) {
      // Switch icon path if needed or just use CSS for loading animation
    }
  }

  function renderActions(actions) {
    actionGrid.replaceChildren();

    for (const action of actions) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "secondary-button";
      button.textContent = action.label;
      button.addEventListener("click", () => {
        vscode.postMessage({
          type: "action",
          command: action.command,
        });
      });
      actionGrid.appendChild(button);
    }
  }

  function renderSearchResults(results) {
    searchResultsContainer.replaceChildren();

    if (results.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "No matches found.";
      searchResultsContainer.appendChild(empty);
      return;
    }

    results.forEach((result) => {
      const item = document.createElement("div");
      item.className = "search-result-item fade-in";
      item.addEventListener("click", () => {
        vscode.postMessage({
          type: "action",
          command: "vscode.open",
          path: result.path,
        });
      });

      const path = document.createElement("span");
      path.className = "search-result-path";
      path.textContent = result.path;

      const content = document.createElement("div");
      content.className = "search-result-content";
      content.textContent = result.content;

      item.appendChild(path);
      item.appendChild(content);
      searchResultsContainer.appendChild(item);
    });
  }

  function createIconButton(options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "icon-button";
    button.title = options.title;
    button.innerHTML = `
      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" width="12" height="12">
        <path fill="currentColor" d="${options.iconPath}"></path>
      </svg>
      <span>${options.label}</span>
    `;
    button.addEventListener("click", options.onClick);
    return button;
  }

  function persistState() {
    vscode.setState({ ...savedState, selectedAgentId });
  }

  vscode.postMessage({ type: "ready" });
})();
