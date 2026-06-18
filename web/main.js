(() => {
  const AGENTS = [
    { id: "general",       label: "General",       icon: "◈" },
    { id: "stack-expert",  label: "Stack Expert",  icon: "⚡" },
    { id: "architect",     label: "Architect",     icon: "◻" },
    { id: "workspace-ops", label: "Workspace Ops", icon: "⌘" },
  ];

  const PROVIDER_LABELS = {
    gemini: "Gemini", openai: "ChatGPT", anthropic: "Claude",
    ollama: "Ollama", lmstudio: "LM Studio", mock: "Mock", off: "Off",
  };

  const MODEL_ICONS = {
    mock: "◌", gemini: "✦", openai: "⊕", anthropic: "◇",
    ollama: "⊙", lmstudio: "⊞", off: "−",
  };

  const state = JSON.parse(localStorage.getItem("mtState") || "{}");
  let selectedAgentId = state.selectedAgentId ?? "general";
  let selectedProvider = state.selectedProvider ?? null;
  let isLoading = false;
  let menuOpen = false;
  let modelMenuOpen = false;
  let providerList = [];

  /** Conversation history for multi-turn context. Each entry: {role, content}. */
  let conversationHistory = [];

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
  const modelMenu      = document.getElementById("model-menu");
  const modelSelector  = document.getElementById("model-selector");
  const modelSelectorLabel = document.getElementById("model-selector-label");
  const modelMenuList  = document.getElementById("model-menu-list");

  // ── Init ────────────────────────────────────────────────────────────
  syncSelectorDisplay();
  syncModelSelectorDisplay();
  checkHealth();
  fetchProviders();

  // ── Health ──────────────────────────────────────────────────────────
  async function checkHealth() {
    try {
      const res = await fetch("/health");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      statusDot.className = "status-dot is-connected";
      statusLabel.textContent = "Connected";
      if (data.mode && data.mode !== "unknown") {
        modePill.textContent = PROVIDER_LABELS[data.mode] ?? data.mode;
        modePill.hidden = false;
      }
    } catch {
      statusDot.className = "status-dot is-error";
      statusLabel.textContent = "Offline";
    }
  }

  // ── Providers ────────────────────────────────────────────────────────
  async function fetchProviders() {
    try {
      const res = await fetch("/providers");
      if (!res.ok) return;
      const data = await res.json();
      providerList = data.providers ?? [];
      if (!selectedProvider && data.current) {
        selectedProvider = data.current;
      }
      renderModelMenu();
      syncModelSelectorDisplay();
    } catch {}
  }

  function syncModelSelectorDisplay() {
    const provider = providerList.find(p => p.id === selectedProvider);
    const label = provider ? provider.label : (PROVIDER_LABELS[selectedProvider] ?? selectedProvider ?? "Model");
    if (modelSelectorLabel) modelSelectorLabel.textContent = label;
  }

  function renderModelMenu() {
    if (!modelMenuList) return;
    modelMenuList.replaceChildren();
    for (const provider of providerList) {
      const btn = document.createElement("button");
      const isActive = provider.id === selectedProvider;
      btn.className = ["agent-menu-item",
        !provider.available ? "model-menu-item--unavailable" : "",
        isActive ? "model-menu-item--active" : "",
      ].filter(Boolean).join(" ");
      btn.type = "button";
      btn.setAttribute("role", "option");
      btn.dataset.modelId = provider.id;

      const iconEl = document.createElement("span");
      iconEl.className = "agent-menu-icon";
      iconEl.textContent = MODEL_ICONS[provider.id] ?? "◎";

      const nameEl = document.createElement("span");
      nameEl.className = "agent-menu-name";
      nameEl.textContent = provider.label;

      btn.appendChild(iconEl);
      btn.appendChild(nameEl);

      if (provider.model) {
        const modelEl = document.createElement("span");
        modelEl.className = "model-menu-model";
        modelEl.textContent = provider.model;
        btn.appendChild(modelEl);
      }

      const badge = document.createElement("span");
      badge.className = "model-menu-badge " +
        (provider.available ? "model-menu-badge--available" : "model-menu-badge--unavailable");
      badge.textContent = provider.available ? "Ready" : "Setup";
      btn.appendChild(badge);

      btn.addEventListener("click", () => {
        selectedProvider = provider.id;
        renderModelMenu();
        syncModelSelectorDisplay();
        saveState();
        toggleModelMenu(false);
        promptInput.focus();
      });

      modelMenuList.appendChild(btn);
    }
  }

  // ── Model menu ───────────────────────────────────────────────────────
  modelSelector?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleModelMenu(!modelMenuOpen);
  });

  function toggleModelMenu(open) {
    if (open) toggleMenu(false);
    modelMenuOpen = open;
    if (modelMenu) modelMenu.hidden = !open;
    modelSelector?.setAttribute("aria-expanded", String(open));
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

  // Close menus when clicking outside
  document.addEventListener("click", (e) => {
    if (menuOpen && !agentMenu.contains(e.target) && e.target !== agentSelector) {
      toggleMenu(false);
    }
    if (modelMenuOpen && modelMenu && !modelMenu.contains(e.target) && e.target !== modelSelector) {
      toggleModelMenu(false);
    }
  });

  // Close menus on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (menuOpen) { toggleMenu(false); promptInput.focus(); }
      if (modelMenuOpen) { toggleModelMenu(false); promptInput.focus(); }
    }
  });

  function toggleMenu(open) {
    if (open) toggleModelMenu(false);
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
      contentEl.textContent = data.response ?? data.preview ?? data.title ?? "No content.";
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

    // Snapshot history BEFORE this turn (will be sent as context)
    const historySnapshot = conversationHistory.slice(-20); // keep last 20 turns

    const loadingEl = appendLoadingBubble();

    try {
      const res = await fetch("/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "text/event-stream",
        },
        body: JSON.stringify({
          prompt,
          intent: "ask",
          workspace: { name: "Matterhorn" },
          preferredAgentId: selectedAgentId,
          history: historySnapshot,
          ...(selectedProvider ? { _provider: selectedProvider } : {}),
        }),
      });

      loadingEl.remove();

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        const errText = err.error ?? "Request failed.";
        appendMessage("assistant", errText);
        conversationHistory.push({ role: "user", content: prompt });
        conversationHistory.push({ role: "assistant", content: errText });
        return;
      }

      // ── Streaming response ──────────────────────────────────────────
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("text/event-stream")) {
        const assistantText = await consumeStream(res.body, prompt);
        conversationHistory.push({ role: "user", content: prompt });
        conversationHistory.push({ role: "assistant", content: assistantText });
      } else {
        // Fallback: server returned JSON (provider doesn't support streaming)
        const data = await res.json();
        const text = data.response ?? data.preview ?? data.title ?? JSON.stringify(data, null, 2);
        appendMessage("assistant", text);
        conversationHistory.push({ role: "user", content: prompt });
        conversationHistory.push({ role: "assistant", content: text });
      }
    } catch (err) {
      loadingEl.remove();
      const errText = err instanceof Error ? err.message : "Request failed.";
      appendMessage("assistant", errText);
    } finally {
      isLoading = false;
      setLoadingState(false);
      promptInput.focus();
    }
  }

  /**
   * Consume a server-sent-events stream, rendering tokens into a live bubble
   * as they arrive. Returns the fully assembled text when done.
   */
  async function consumeStream(body, userPrompt) {
    const streamBubble = appendStreamingBubble();
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let assembled = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const dataStr = line.slice(5).trim();
          if (!dataStr) continue;

          try {
            const event = JSON.parse(dataStr);
            if (event.error) {
              streamBubble.textContent = event.error;
              return event.error;
            }
            if (event.token) {
              assembled += event.token;
              streamBubble.textContent = assembled;
              convo.scrollTop = convo.scrollHeight;
            }
            if (event.done) {
              return assembled;
            }
          } catch {}
        }
      }
    } finally {
      // Finalise the bubble — remove the streaming cursor class
      streamBubble.closest(".msg")?.classList.remove("msg--streaming");
    }

    return assembled;
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

  /**
   * Create a live streaming bubble. Returns the inner text node container.
   * The caller updates textContent directly as tokens arrive.
   */
  function appendStreamingBubble() {
    const msg = document.createElement("div");
    msg.className = "msg msg--assistant msg--streaming";

    const bubble = document.createElement("div");
    bubble.className = "msg-bubble";

    const meta = document.createElement("span");
    meta.className = "msg-meta";
    meta.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    msg.appendChild(bubble);
    msg.appendChild(meta);
    convo.appendChild(msg);
    convo.scrollTop = convo.scrollHeight;
    return bubble;
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
    localStorage.setItem("mtState", JSON.stringify({ selectedAgentId, selectedProvider }));
  }
})();
