(() => {
  const savedState = JSON.parse(localStorage.getItem("matterhornState") || "{}");
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
  initServerStatus();

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

        sendAskRequest(prompt, selectedAgentId);

        promptInput.value = "";
        promptInput.style.height = "";
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
        const prompt = "Give me a comprehensive overview of this workspace: its purpose, key files, architecture, and how I should think about making changes to it.";
        promptInput.value = prompt;
        promptInput.focus();
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
        const query = searchInput.value.trim();
        if (!query) {
          searchInput.focus();
          return;
        }

        searchResultsContainer.innerHTML = '<div class="loading">Searching…</div>';
        sendSearchRequest(query);
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

  async function initServerStatus() {
    try {
      const res = await fetch("/health");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      serverPill.textContent = "Synox runtime connected";

      const modeLabelMap = {
        gemini: "Synox provider: Gemini",
        ollama: "Synox provider: Ollama",
        mock: "Synox provider: Mock",
        off: "Synox provider: Off",
      };
      if (serverModeBadge && data.mode) {
        serverModeBadge.textContent = modeLabelMap[data.mode] ?? "";
        serverModeBadge.hidden = data.mode === "unknown" || !data.mode;
        serverModeBadge.classList.toggle("meta-tag--warning", data.mode === "mock");
      }
    } catch {
      serverPill.textContent = "Server unreachable";
    }
  }

  async function sendAskRequest(prompt, agentId) {
    try {
      const res = await fetch("/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          intent: "ask",
          workspace: { name: workspaceName.textContent || "Matterhorn" },
          preferredAgentId: agentId,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      renderResponse(data);
    } catch (err) {
      renderError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      isPrompting = false;
      updateSubmitButtonState();
    }
  }

  async function sendSearchRequest(query) {
    try {
      const res = await fetch("/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Search the codebase for: ${query}`,
          intent: "ask",
          workspace: { name: workspaceName.textContent || "Matterhorn" },
          preferredAgentId: "workspace-ops",
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      searchResultsContainer.replaceChildren();
      const item = document.createElement("div");
      item.className = "search-result-item fade-in";

      const pathEl = document.createElement("span");
      pathEl.className = "search-result-path";
      pathEl.textContent = "Result";

      const contentEl = document.createElement("div");
      contentEl.className = "search-result-content";
      contentEl.textContent = data.excerpt ?? data.title ?? "No results.";

      item.appendChild(pathEl);
      item.appendChild(contentEl);
      searchResultsContainer.appendChild(item);
    } catch (err) {
      searchResultsContainer.innerHTML = `<div class="empty-state">${err instanceof Error ? err.message : "Search failed."}</div>`;
    }
  }

  function renderResponse(data) {
    responsePreview.textContent = data.excerpt ?? data.title ?? JSON.stringify(data);
    responseTimestamp.textContent = `Updated ${new Date().toLocaleString()}`;
    responseTitle.textContent = data.title ?? "Response";
    if (proposalStatus) proposalStatus.textContent = "No proposal";
    persistState();
  }

  function renderError(message) {
    responsePreview.textContent = `Error: ${message}`;
    responseTimestamp.textContent = `Failed at ${new Date().toLocaleString()}`;
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

      let left = buttonRect.left;
      const maxLeft = window.innerWidth - popoverRect.width - 8;
      left = Math.max(8, Math.min(left, maxLeft));

      const top = buttonRect.top - popoverRect.height - 12;

      popover.style.left = `${left}px`;
      popover.style.top = `${top}px`;
      popover.style.visibility = "visible";
    });
  }

  function updateSubmitButtonState() {
    if (!submitButton) return;
    submitButton.disabled = isPrompting;
    submitButton.classList.toggle("is-loading", isPrompting);
  }

  function persistState() {
    localStorage.setItem("matterhornState", JSON.stringify({ selectedAgentId }));
  }

  syncAgentSelection();
  persistState();
  closeAllPopovers();
  setupEventListeners();
  console.log("[Matterhorn] Web UI initialized");
})();
