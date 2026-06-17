(() => {
  const AGENTS = [
    { id: "general",       label: "General",       icon: "◈" },
    { id: "stack-expert",  label: "Stack Expert",  icon: "⚡" },
    { id: "architect",     label: "Architect",     icon: "◻" },
    { id: "workspace-ops", label: "Workspace Ops", icon: "⌘" },
  ];

  const state = JSON.parse(localStorage.getItem("mtState") || "{}");
  let selectedAgentId = state.selectedAgentId ?? "general";
  let isLoading = false;
  let menuOpen = false;

  // Elements
  const convo          = document.getElementById("convo");
  const emptyState     = document.getElementById("empty-state");
  const promptInput    = document.getElementById("prompt-input");
  const submitBtn      = document.getElementById("submit-button");
  const statusDot      = document.getElementById("status-dot");
  const statusLabel    = document.getElementById("status-label");
  const modePill       = document.getElementById("mode-pill");
  const foundationBtn  = document.getElementById("build-foundation-button");
  const agentMenu      = document.getElementById("agent-menu");
  const agentSelector  = document.getElementById("agent-selector");
  const selectorLabel  = document.getElementById("agent-selector-label");
  const selectorIcon   = document.getElementById("agent-selector-icon");
  const searchPanel    = document.getElementById("search-panel");
  const searchInput    = document.getElementById("search-input");
  const searchBtn      = document.getElementById("search-btn");
  const searchResults  = document.getElementById("search-results");
  const menuItems      = Array.from(document.querySelectorAll(".agent-menu-item[data-agent-id]"));
  const searchMenuItem = document.querySelector(".agent-menu-item[data-action='search']");

  // ── Init ────────────────────────────────────────────────────────────
  syncSelectorDisplay();
  checkHealth();

  // ── Health ──────────────────────────────────────────────────────────
  async function checkHealth() {
    try {
      const res = await fetch("/health");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      statusDot.className = "status-dot is-connected";
      statusLabel.textContent = "Connected";
      if (data.mode && data.mode !== "unknown") {
        const labels = { gemini: "Gemini", mock: "Mock", off: "Off", ollama: "Ollama" };
        modePill.textContent = labels[data.mode] ?? data.mode;
        modePill.hidden = false;
      }
    } catch {
      statusDot.className = "status-dot is-error";
      statusLabel.textContent = "Offline";
    }
  }

  // ── Agent menu ──────────────────────────────────────────────────────
  agentSelector.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMenu(!menuOpen);
  });

  menuItems.forEach(item => {
    item.addEventListener("click", () => {
      selectedAgentId = item.dataset.agentId;
      syncSelectorDisplay();
      syncMenuActive();
      saveState();
      toggleMenu(false);
      promptInput.focus();
    });
  });

  searchMenuItem?.addEventListener("click", () => {
    toggleMenu(false);
    const open = searchPanel.hidden;
    searchPanel.hidden = !open;
    if (open) searchInput.focus();
  });

  // Close menu when clicking outside
  document.addEventListener("click", (e) => {
    if (menuOpen && !agentMenu.contains(e.target) && e.target !== agentSelector) {
      toggleMenu(false);
    }
  });

  // Close menu on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menuOpen) {
      toggleMenu(false);
      promptInput.focus();
    }
  });

  function toggleMenu(open) {
    menuOpen = open;
    agentMenu.hidden = !open;
    agentSelector.setAttribute("aria-expanded", String(open));
  }

  function syncSelectorDisplay() {
    const agent = AGENTS.find(a => a.id === selectedAgentId) ?? AGENTS[0];
    selectorLabel.textContent = agent.label;
    selectorIcon.textContent = agent.icon;
    syncMenuActive();
  }

  function syncMenuActive() {
    menuItems.forEach(item => {
      item.classList.toggle("is-active", item.dataset.agentId === selectedAgentId);
    });
  }

  // ── Search ──────────────────────────────────────────────────────────
  searchBtn.addEventListener("click", doSearch);
  searchInput.addEventListener("keypress", e => { if (e.key === "Enter") doSearch(); });

  async function doSearch() {
    const q = searchInput.value.trim();
    if (!q) return;
    searchResults.innerHTML = '<div class="info-msg">Searching…</div>';
    try {
      const res = await fetch("/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Search the codebase for: ${q}`,
          intent: "ask",
          workspace: { name: "Matterhorn" },
          preferredAgentId: "workspace-ops",
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      searchResults.innerHTML = "";
      const item = document.createElement("div");
      item.className = "search-result-item";
      const pathEl = document.createElement("span");
      pathEl.className = "search-result-path";
      pathEl.textContent = "Result";
      const contentEl = document.createElement("div");
      contentEl.className = "search-result-content";
      contentEl.textContent = data.excerpt ?? data.title ?? "No content.";
      item.appendChild(pathEl);
      item.appendChild(contentEl);
      searchResults.appendChild(item);
    } catch (err) {
      searchResults.innerHTML = `<div class="info-msg">${err instanceof Error ? err.message : "Search failed."}</div>`;
    }
  }

  // ── Foundation ──────────────────────────────────────────────────────
  foundationBtn.addEventListener("click", () => {
    promptInput.value = "Give me a comprehensive overview of this workspace: its purpose, key files, architecture, and how I should think about making changes.";
    autoResize();
    promptInput.focus();
  });

  // ── Composer ────────────────────────────────────────────────────────
  promptInput.addEventListener("input", autoResize);

  promptInput.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  });

  submitBtn.addEventListener("click", submit);

  function autoResize() {
    promptInput.style.height = "auto";
    promptInput.style.height = Math.min(promptInput.scrollHeight, 140) + "px";
  }

  async function submit() {
    if (isLoading) return;
    const prompt = promptInput.value.trim();
    if (!prompt) { promptInput.focus(); return; }

    if (menuOpen) toggleMenu(false);

    isLoading = true;
    setLoadingState(true);
    emptyState.hidden = true;
    appendMessage("user", prompt);
    promptInput.value = "";
    promptInput.style.height = "";

    const loadingEl = appendLoadingBubble();

    try {
      const res = await fetch("/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          intent: "ask",
          workspace: { name: "Matterhorn" },
          preferredAgentId: selectedAgentId,
        }),
      });

      loadingEl.remove();

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        appendMessage("assistant", err.error ?? "Request failed.");
      } else {
        const data = await res.json();
        const text = data.excerpt ?? data.title ?? JSON.stringify(data, null, 2);
        appendMessage("assistant", text);
      }
    } catch (err) {
      loadingEl.remove();
      appendMessage("assistant", err instanceof Error ? err.message : "Request failed.");
    } finally {
      isLoading = false;
      setLoadingState(false);
      promptInput.focus();
    }
  }

  // ── Message rendering ────────────────────────────────────────────────
  function appendMessage(role, text) {
    const msg = document.createElement("div");
    msg.className = `msg msg--${role}`;

    const bubble = document.createElement("div");
    bubble.className = "msg-bubble";

    if (looksLikeCode(text)) {
      const pre = document.createElement("pre");
      pre.textContent = text;
      bubble.appendChild(pre);
    } else {
      bubble.textContent = text;
    }

    const meta = document.createElement("span");
    meta.className = "msg-meta";
    meta.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    msg.appendChild(bubble);
    msg.appendChild(meta);
    convo.appendChild(msg);
    convo.scrollTop = convo.scrollHeight;
    return msg;
  }

  function appendLoadingBubble() {
    const msg = document.createElement("div");
    msg.className = "msg msg--assistant msg--loading";
    msg.innerHTML = `<div class="msg-bubble"><div class="dot-pulse"><span></span><span></span><span></span></div></div>`;
    convo.appendChild(msg);
    convo.scrollTop = convo.scrollHeight;
    return msg;
  }

  function looksLikeCode(text) {
    return text.includes("\n") && (text.includes("  ") || text.includes("\t") || text.match(/[{}()[\]]/));
  }

  function setLoadingState(loading) {
    submitBtn.disabled = loading;
    submitBtn.classList.toggle("is-loading", loading);
  }

  function saveState() {
    localStorage.setItem("mtState", JSON.stringify({ selectedAgentId }));
  }
})();
