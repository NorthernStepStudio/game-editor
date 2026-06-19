(() => {
  const vscode = acquireVsCodeApi();
  const savedState = vscode.getState() ?? {};

  const AGENTS = [
    { id: "general", label: "General", icon: "\u25c7" },
    { id: "stack-expert", label: "Stack Expert", icon: "\u26a1" },
    { id: "architect", label: "Architect", icon: "\u25a1" },
    { id: "workspace-ops", label: "Workspace Ops", icon: "\u2318" },
  ];

  const PROVIDERS = [
    { id: "ollama", label: "Ollama", icon: "\u2299" },
    { id: "lmstudio", label: "LM Studio", icon: "\u229e" },
    { id: "gemini", label: "Gemini", icon: "\u2726" },
    { id: "openai", label: "ChatGPT", icon: "\u2295" },
    { id: "anthropic", label: "Claude", icon: "\u25c6" },
    { id: "off", label: "Off", icon: "-" },
  ];

  let selectedAgentId = savedState.selectedAgentId ?? "general";
  let selectedProvider = savedState.selectedProvider === "mock" ? "ollama" : savedState.selectedProvider ?? "ollama";
  let selectedModel = savedState.selectedModel ?? null;
  let lastServerMode = savedState.lastServerMode === "mock" ? "ollama" : savedState.lastServerMode ?? "ollama";
  let lastRenderedResponseKey = savedState.lastRenderedResponseKey ?? null;
  let isPrompting = false;
  let loadingBubble = null;
  let localOllamaModels = [];
  let localLmStudioModels = [];

  const convo = document.getElementById("convo");
  const emptyState = document.getElementById("empty-state");
  const promptInput = document.getElementById("prompt-input");
  const submitButton = document.getElementById("submit-button");
  const buildFoundationButton = document.getElementById("build-foundation-button");
  const workspaceName = document.getElementById("workspace-name");
  const serverPill = document.getElementById("server-pill");
  const statusDot = document.getElementById("status-dot");
  const serverModeBadge = document.getElementById("server-mode-badge");
  const contextStrip = document.getElementById("context-strip");
  const currentFile = document.getElementById("current-file");
  const selectionPreview = document.getElementById("selection-preview");
  const searchPanel = document.getElementById("search-panel");
  const searchInput = document.getElementById("search-input");
  const searchBtn = document.getElementById("search-btn");
  const searchResultsContainer = document.getElementById("search-results-container");
  const actionGrid = document.getElementById("action-grid");

  const agentSelector = document.getElementById("agent-selector");
  const agentSelectorLabel = document.getElementById("agent-selector-label");
  const agentSelectorIcon = document.getElementById("agent-selector-icon");
  const agentMenu = document.getElementById("agent-menu");
  const agentButtons = Array.from(document.querySelectorAll("#agent-menu [data-agent-id]"));
  const agentSearchButton = document.querySelector("#agent-menu [data-action='search']");

  const modelSelector = document.getElementById("model-selector");
  const modelSelectorLabel = document.getElementById("model-selector-label");
  const modelSelectorIcon = document.getElementById("model-selector-icon");
  const modelMenu = document.getElementById("model-menu");
  let modelButtons = Array.from(document.querySelectorAll("#model-menu [data-model-id]"));

  const toolsSelector = document.getElementById("tools-selector");
  const toolsMenu = document.getElementById("tools-menu");
  const toolButtons = Array.from(document.querySelectorAll("#tools-menu [data-tool-command]"));
  const toolSearchButton = document.querySelector("#tools-menu [data-action='open-search']");

  const sidebarConversationsList = document.getElementById("sidebar-conversations-list");
  const workspaceFolderName = document.getElementById("workspace-folder-name");
  const sidebarToolButtons = Array.from(document.querySelectorAll("#sidebar-tools-list [data-tool-command]"));
  const sidebarToolSearchButton = document.querySelector("#sidebar-tools-list [data-action='open-search']");
  const activeAgentTitle = document.getElementById("active-agent-title");

  setupEventListeners();
  syncAgentSelection();
  syncModelSelection();
  updateSubmitButtonState();
  closeAllMenus();
  vscode.postMessage({ type: "ready" });

  function setupEventListeners() {
    submitButton?.addEventListener("click", submitPrompt);
    promptInput?.addEventListener("input", autoResizePrompt);
    promptInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        submitPrompt();
      }
    });

    buildFoundationButton?.addEventListener("click", () => {
      postCommand("nssWorkspaceAi.showBuildFoundation");
    });

    agentSelector?.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleMenu(agentMenu, agentSelector);
    });

    modelSelector?.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleMenu(modelMenu, modelSelector);
    });

    toolsSelector?.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleMenu(toolsMenu, toolsSelector);
    });

    agentButtons.forEach((button) => {
      button.addEventListener("click", () => {
        selectedAgentId = button.dataset.agentId ?? "general";
        syncAgentSelection();
        persistState();
        closeAllMenus();
        promptInput?.focus();
      });
    });

    agentSearchButton?.addEventListener("click", () => {
      openSearchPanel();
    });



    toolButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const command = button.dataset.toolCommand;
        if (command) {
          postCommand(command);
        }
      });
    });

    toolSearchButton?.addEventListener("click", () => {
      openSearchPanel();
    });

    sidebarToolButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const command = button.dataset.toolCommand;
        if (command) {
          postCommand(command);
        }
      });
    });

    sidebarToolSearchButton?.addEventListener("click", () => {
      openSearchPanel();
    });

    const customModelButtons = Array.from(document.querySelectorAll("#model-menu [data-action='custom-model']"));
    customModelButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const provider = button.dataset.provider;
        closeAllMenus();
        vscode.postMessage({
          type: "action",
          command: "nssWorkspaceAi.selectCustomModel",
          provider,
        });
      });
    });

    searchBtn?.addEventListener("click", runSearch);
    searchInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        runSearch();
      }
    });

    window.addEventListener("message", (event) => {
      const message = event.data;
      if (message.type === "search-results") {
        renderSearchResults(message.payload?.results ?? []);
        return;
      }

      if (message.type === "set-model") {
        selectedProvider = message.payload?.provider ?? "ollama";
        selectedModel = message.payload?.model ?? null;
        syncModelSelection();
        persistState();
        promptInput?.focus();
        return;
      }

      if (message.type === "state") {
        renderState(message.payload);
      }
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeAllMenus();
      }
    });

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      const menus = [agentMenu, modelMenu, toolsMenu].filter(Boolean);
      const selectors = [agentSelector, modelSelector, toolsSelector].filter(Boolean);
      if (menus.some((menu) => menu.contains(target)) || selectors.some((selector) => selector.contains(target))) {
        return;
      }

      closeAllMenus();
    });
  }

  function submitPrompt() {
    if (isPrompting) {
      return;
    }

    const prompt = promptInput?.value.trim() ?? "";
    if (!prompt) {
      promptInput?.focus();
      return;
    }

    isPrompting = true;
    updateSubmitButtonState();
    closeAllMenus();
    appendMessage("user", prompt);
    loadingBubble = appendLoadingBubble();

    vscode.postMessage({
      type: "action",
      command: "nssWorkspaceAi.askWorkspaceAi",
      prompt,
      agentId: selectedAgentId,
      provider: selectedProvider || undefined,
      model: selectedModel || undefined,
    });

    promptInput.value = "";
    autoResizePrompt();
    promptInput.focus();
  }

  function postCommand(command) {
    closeAllMenus();
    vscode.postMessage({
      type: "action",
      command,
      agentId: selectedAgentId,
      provider: selectedProvider || undefined,
      model: selectedModel || undefined,
    });
  }

  function runSearch() {
    const prompt = searchInput?.value.trim() ?? "";
    if (!prompt) {
      searchInput?.focus();
      return;
    }

    searchResultsContainer.replaceChildren(createInfoNode("Searching..."));
    vscode.postMessage({
      type: "action",
      command: "nssWorkspaceAi.searchCodebase",
      prompt,
    });
  }

  function openSearchPanel() {
    closeAllMenus();
    searchPanel.hidden = false;
    searchInput?.focus();
  }

  function renderState(payload) {
    if (!payload) {
      return;
    }

    if (workspaceName) {
      workspaceName.textContent = payload.title ?? payload.workspaceName ?? "Matterhorn";
    }
    if (workspaceFolderName && payload.workspaceName) {
      workspaceFolderName.textContent = payload.workspaceName;
    }

    localOllamaModels = payload.localOllamaModels ?? [];
    localLmStudioModels = payload.localLmStudioModels ?? [];

    let modelChanged = false;
    let providerChanged = false;

    if (selectedProvider === "ollama") {
      if (selectedModel === null || !localOllamaModels.includes(selectedModel)) {
        if (localOllamaModels.length > 0) {
          selectedModel = localOllamaModels[0];
          modelChanged = true;
        } else {
          selectedProvider = "gemini";
          selectedModel = null;
          providerChanged = true;
          modelChanged = true;
        }
      }
    } else if (selectedProvider === "lmstudio") {
      if (selectedModel !== null && !localLmStudioModels.includes(selectedModel)) {
        selectedModel = null;
        modelChanged = true;
      }
    }

    if (modelChanged || providerChanged) {
      persistState();
      vscode.postMessage({
        type: "action",
        command: "nssWorkspaceAi.updateSelectedModel",
        provider: selectedProvider,
        model: selectedModel
      });
    }

    serverPill.textContent = normalizeStatusLabel(payload.serverStatus);
    updateStatusDot(payload.serverHealthStatus ?? payload.serverStatus);
    updateServerMode(payload.serverMode);
    updateContext(payload);
    renderActions(payload.quickActions ?? []);
    renderWorkspaceConversations(payload.responseHistory ?? []);
    renderModelSelectorList(payload);

    // Reconstruct conversation from responseHistory if convo is empty
    const hasMessages = convo.querySelectorAll(".msg").length > 0;
    if (!hasMessages && payload.responseHistory && payload.responseHistory.length > 0) {
      emptyState.hidden = true;
      // Iterate from oldest to newest (history is newest to oldest, so reverse order)
      for (let i = payload.responseHistory.length - 1; i >= 0; i--) {
        const item = payload.responseHistory[i];
        if (item.prompt) {
          appendMessage("user", item.prompt);
        }
        appendMessage("assistant", item.body || item.title || "Done.", {
          id: item.id,
          title: item.title,
          kind: item.kind,
          createdAt: item.createdAt,
          proposedMemoryCount: item.proposedMemories?.length ?? 0,
        });
      }
      convo.scrollTop = convo.scrollHeight;
    }

    renderLatestResponse(payload.latestResponse);

    isPrompting = false;
    updateSubmitButtonState();
    persistState();
  }

  function updateStatusDot(serverStatus) {
    statusDot.className = "status-dot";
    const normalized = String(serverStatus ?? "").toLowerCase();
    if (normalized.includes("online") || normalized.includes("connected")) {
      statusDot.classList.add("is-connected");
      return;
    }
    if (normalized.includes("offline") || normalized.includes("failed")) {
      statusDot.classList.add("is-error");
    }
  }

  function normalizeStatusLabel(label) {
    if (!label) {
      return "Unknown";
    }

    if (String(label).toLowerCase().includes("online")) {
      return "Connected";
    }

    return label;
  }

  function updateServerMode(mode) {
    if (mode && mode !== "unknown" && mode !== "mock") {
      lastServerMode = mode;
      const provider = getProvider(mode);
      serverModeBadge.textContent = provider.label;
      serverModeBadge.hidden = false;
    } else {
      serverModeBadge.hidden = true;
    }

    syncModelSelection();
  }

  function updateContext(payload) {
    const hasFile = Boolean(payload.currentFilePath);
    const hasSelection = Boolean(payload.currentSelectionPreview);
    contextStrip.hidden = !hasFile && !hasSelection;
    currentFile.textContent = payload.currentFilePath ?? "No file";
    selectionPreview.textContent = payload.currentSelectionPreview ?? "No current selection.";
  }

  function renderLatestResponse(latestResponse) {
    if (!latestResponse) {
      removeLoadingBubble();
      return;
    }

    const responseKey = latestResponse.id;
    if (responseKey === lastRenderedResponseKey) {
      removeLoadingBubble();
      return;
    }

    removeLoadingBubble();
    appendMessage("assistant", latestResponse.body || latestResponse.title || "Done.", {
      id: latestResponse.id,
      title: latestResponse.title,
      kind: latestResponse.kind,
      createdAt: latestResponse.createdAt,
      proposedMemoryCount: latestResponse.proposedMemories?.length ?? 0,
    });
    lastRenderedResponseKey = responseKey;
    persistState();
  }

  function renderActions(actions) {
    if (!actionGrid) {
      return;
    }

    actionGrid.replaceChildren();
    actionGrid.hidden = actions.length === 0;

    for (const action of actions) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "agent-menu-item";
      button.dataset.toolCommand = action.command;

      const icon = document.createElement("span");
      icon.className = "agent-menu-icon";
      icon.textContent = "\u22ef";

      const label = document.createElement("span");
      label.className = "agent-menu-name";
      label.textContent = action.label;

      button.append(icon, label);
      button.addEventListener("click", () => {
        postCommand(action.command);
      });
      actionGrid.appendChild(button);
    }
  }

  function renderWorkspaceConversations(history) {
    if (!sidebarConversationsList) return;
    sidebarConversationsList.replaceChildren();

    if (!history || history.length === 0) {
      const empty = document.createElement("div");
      empty.className = "sidebar-empty-msg";
      empty.textContent = "No conversations yet";
      sidebarConversationsList.appendChild(empty);
      return;
    }

    history.forEach((convoItem) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sidebar-item sidebar-item--convo";
      button.title = convoItem.excerpt || convoItem.title;
      button.dataset.responseId = convoItem.id;

      const icon = document.createElement("span");
      icon.className = "sidebar-item-icon";
      icon.innerHTML = "&#128172;"; // speech bubble Unicode emoji 💬

      const label = document.createElement("span");
      label.className = "sidebar-item-label";
      label.textContent = convoItem.prompt || convoItem.title || "Chat session";

      button.append(icon, label);
      button.addEventListener("click", () => {
        const targetMsg = convo.querySelector(`[data-response-id="${convoItem.id}"]`);
        if (targetMsg) {
          targetMsg.scrollIntoView({ behavior: "smooth", block: "center" });
          
          targetMsg.classList.remove("msg--highlight");
          void targetMsg.offsetWidth; // trigger reflow
          targetMsg.classList.add("msg--highlight");
        }
      });

      sidebarConversationsList.appendChild(button);
    });
  }

  function renderModelSelectorList(payload) {
    const container = document.getElementById("model-menu-list");
    if (!container) return;

    container.replaceChildren();

    // 1. Ollama Local Models
    if (payload && Array.isArray(payload.localOllamaModels)) {
      payload.localOllamaModels.forEach((model) => {
        const btn = createModelMenuItem({
          providerId: "ollama",
          modelOverride: model,
          name: `Ollama: ${model}`,
          detail: "local model",
          badge: "Local",
          isBadgeAvailable: lastServerMode === "ollama"
        });
        container.appendChild(btn);
      });
    }

    // 2. LM Studio Default
    const lmstudioDefaultBtn = createModelMenuItem({
      providerId: "lmstudio",
      name: "LM Studio (Default)",
      detail: "loaded model",
      badge: "Local",
      isBadgeAvailable: lastServerMode === "lmstudio"
    });
    container.appendChild(lmstudioDefaultBtn);

    // 3. LM Studio Local Models
    if (payload && Array.isArray(payload.localLmStudioModels)) {
      payload.localLmStudioModels.forEach((model) => {
        const btn = createModelMenuItem({
          providerId: "lmstudio",
          modelOverride: model,
          name: `LM Studio: ${model}`,
          detail: "local model",
          badge: "Local",
          isBadgeAvailable: lastServerMode === "lmstudio"
        });
        container.appendChild(btn);
      });
    }

    // 4. Gemini
    const geminiBtn = createModelMenuItem({
      providerId: "gemini",
      name: "Gemini",
      detail: "gemini-2.5-flash",
      badge: "Cloud"
    });
    container.appendChild(geminiBtn);

    // 5. ChatGPT
    const openaiBtn = createModelMenuItem({
      providerId: "openai",
      name: "ChatGPT",
      detail: "gpt-4o",
      badge: "Cloud"
    });
    container.appendChild(openaiBtn);

    // 6. Claude
    const anthropicBtn = createModelMenuItem({
      providerId: "anthropic",
      name: "Claude",
      detail: "claude-3.5",
      badge: "Cloud"
    });
    container.appendChild(anthropicBtn);

    // Re-query model buttons list
    modelButtons.length = 0;
    modelButtons.push(...Array.from(container.querySelectorAll("[data-model-id]")));
    syncModelSelection();
  }

  function createModelMenuItem({ providerId, modelOverride, name, detail, badge, isBadgeAvailable }) {
    const provider = getProvider(providerId);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "agent-menu-item";
    button.setAttribute("role", "option");
    button.dataset.modelId = providerId;
    if (modelOverride) {
      button.dataset.modelOverride = modelOverride;
    }

    const iconSpan = document.createElement("span");
    iconSpan.className = "agent-menu-icon";
    iconSpan.textContent = provider.icon;

    const nameSpan = document.createElement("span");
    nameSpan.className = "agent-menu-name";
    nameSpan.textContent = name;

    const modelSpan = document.createElement("span");
    modelSpan.className = "model-menu-model";
    modelSpan.textContent = detail;

    button.append(iconSpan, nameSpan, modelSpan);

    if (badge) {
      const badgeSpan = document.createElement("span");
      badgeSpan.className = "model-menu-badge";
      if (isBadgeAvailable) {
        badgeSpan.classList.add("model-menu-badge--available");
      }
      badgeSpan.textContent = badge;
      button.appendChild(badgeSpan);
    }

    button.addEventListener("click", () => {
      selectedProvider = providerId;
      selectedModel = modelOverride || null;
      syncModelSelection();
      persistState();

      // Notify the backend immediately of the selection
      vscode.postMessage({
        type: "action",
        command: "nssWorkspaceAi.updateSelectedModel",
        provider: selectedProvider,
        model: selectedModel
      });

      closeAllMenus();
      promptInput?.focus();
    });

    return button;
  }


  function renderSearchResults(results) {
    searchPanel.hidden = false;
    searchResultsContainer.replaceChildren();

    if (results.length === 0) {
      searchResultsContainer.appendChild(createInfoNode("No matches found."));
      return;
    }

    for (const result of results) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "search-result-item";
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

      const content = document.createElement("span");
      content.className = "search-result-content";
      content.textContent = result.content;

      item.append(path, content);
      searchResultsContainer.appendChild(item);
    }
  }

  function syncAgentSelection() {
    const activeAgent = getAgent(selectedAgentId);
    agentSelectorLabel.textContent = activeAgent.label;
    agentSelectorIcon.textContent = activeAgent.icon;

    if (activeAgentTitle) {
      activeAgentTitle.textContent = activeAgent.label;
    }

    agentButtons.forEach((button) => {
      const isActive = button.dataset.agentId === selectedAgentId;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", String(isActive));
    });
  }

  function syncModelSelection() {
    const activeProviderId = selectedProvider || lastServerMode || "ollama";
    const activeProvider = getProvider(activeProviderId);

    let displayModel = selectedModel;
    if (!displayModel) {
      if (activeProviderId === "ollama" && localOllamaModels.length > 0) {
        displayModel = localOllamaModels[0];
      } else if (activeProviderId === "lmstudio" && localLmStudioModels.length > 0) {
        displayModel = localLmStudioModels[0];
      }
    }

    if (displayModel && (activeProviderId === "ollama" || activeProviderId === "lmstudio")) {
      modelSelectorLabel.textContent = displayModel;
    } else {
      modelSelectorLabel.textContent = activeProvider.label;
    }
    modelSelectorIcon.textContent = activeProvider.icon;

    modelButtons.forEach((button) => {
      const providerId = button.dataset.modelId;
      const modelOverride = button.dataset.modelOverride || null;
      const isActive = (providerId === activeProviderId) && (modelOverride === selectedModel);
      const isCurrentServerMode = providerId === lastServerMode;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", String(isActive));

      const badge = button.querySelector(".model-menu-badge");
      if (badge) {
        if (!badge.dataset.defaultLabel) {
          badge.dataset.defaultLabel = badge.textContent;
          badge.dataset.ready = String(badge.classList.contains("model-menu-badge--available"));
        }

        badge.textContent = isCurrentServerMode ? "Active" : badge.dataset.defaultLabel ?? badge.textContent;
        badge.classList.toggle("model-menu-badge--available", isCurrentServerMode || badge.dataset.ready === "true");
      }
    });
  }

  function toggleMenu(menu, selector) {
    const shouldOpen = menu?.hidden;
    closeAllMenus();
    if (shouldOpen) {
      menu.hidden = false;
      selector?.setAttribute("aria-expanded", "true");
    }
  }

  function closeAllMenus() {
    [agentMenu, modelMenu, toolsMenu].forEach((menu) => {
      if (menu) {
        menu.hidden = true;
      }
    });
    [agentSelector, modelSelector, toolsSelector].forEach((selector) => {
      selector?.setAttribute("aria-expanded", "false");
    });
  }

  function appendMessage(role, text, metadata = {}) {
    emptyState.hidden = true;

    const message = document.createElement("article");
    message.className = `msg msg--${role}`;
    if (metadata.id) {
      message.dataset.responseId = metadata.id;
    }

    const bubble = document.createElement("div");
    bubble.className = "msg-bubble";

    if (metadata.title && role === "assistant") {
      const title = document.createElement("div");
      title.className = "msg-title";
      title.textContent = normalizeAssistantTitle(metadata.title);
      bubble.appendChild(title);
    }

    if (role === "assistant") {
      const normalized = normalizeAssistantText(text);
      renderMessageBody(bubble, normalized);
    } else {
      const content = looksLikeCode(text) ? document.createElement("pre") : document.createElement("span");
      content.textContent = text;
      bubble.appendChild(content);
    }

    if (metadata.proposedMemoryCount > 0) {
      const badge = document.createElement("span");
      badge.className = "msg-badge";
      badge.textContent = `${metadata.proposedMemoryCount} memory proposal${metadata.proposedMemoryCount === 1 ? "" : "s"}`;
      bubble.appendChild(badge);
    }

    const meta = document.createElement("span");
    meta.className = "msg-meta";
    meta.textContent = formatMessageTime(metadata.createdAt);

    message.append(bubble, meta);
    convo.appendChild(message);
    convo.scrollTop = convo.scrollHeight;
    return message;
  }

  function appendLoadingBubble() {
    emptyState.hidden = true;

    const message = document.createElement("article");
    message.className = "msg msg--assistant msg--loading";
    const bubble = document.createElement("div");
    bubble.className = "msg-bubble";

    const pulse = document.createElement("span");
    pulse.className = "dot-pulse";
    pulse.append(document.createElement("span"), document.createElement("span"), document.createElement("span"));

    bubble.appendChild(pulse);
    message.appendChild(bubble);
    convo.appendChild(message);
    convo.scrollTop = convo.scrollHeight;
    return message;
  }

  function removeLoadingBubble() {
    if (loadingBubble) {
      loadingBubble.remove();
      loadingBubble = null;
    }
  }

  function createInfoNode(text) {
    const node = document.createElement("div");
    node.className = "info-msg";
    node.textContent = text;
    return node;
  }

  function autoResizePrompt() {
    if (!promptInput) {
      return;
    }

    promptInput.style.height = "auto";
    promptInput.style.height = `${Math.min(promptInput.scrollHeight, 140)}px`;
  }

  function updateSubmitButtonState() {
    if (!submitButton) {
      return;
    }

    submitButton.disabled = isPrompting;
    submitButton.classList.toggle("is-loading", isPrompting);
  }

  function getAgent(id) {
    return AGENTS.find((agent) => agent.id === id) ?? AGENTS[0];
  }

  function getProvider(id) {
    return PROVIDERS.find((provider) => provider.id === id) ?? PROVIDERS[0];
  }

  function looksLikeCode(text) {
    return text.includes("\n") && (text.includes("  ") || text.includes("\t") || /[{}()[\]]/.test(text));
  }

  function normalizeAssistantTitle(title) {
    if (!title) return "Matterhorn";
    const t = title.trim();
    if (/^(NSS Workspace AI|NSS Master Core|M-CORE|General NSS Studio Agent|Matterhorn Response)$/i.test(t)) {
      return "Matterhorn";
    }
    return t
      .replace(/\bNSS Workspace AI\b/gi, "Matterhorn")
      .replace(/\bNSS Master Core\b/gi, "Matterhorn")
      .replace(/\bM-CORE\b/gi, "Matterhorn")
      .replace(/\bGeneral NSS Studio Agent\b/gi, "Matterhorn");
  }

  function normalizeAssistantText(rawText) {
    if (typeof rawText !== "string") {
      return "";
    }
    let trimmed = rawText.trim();

    // 1. Strip markdown code fences if they wrap the entire text
    let strippedFences = false;
    let textToParse = trimmed;
    if (trimmed.startsWith("```")) {
      const fenceMatch = trimmed.match(/^```([a-zA-Z0-9-]*)\s*([\s\S]*?)\s*```$/);
      if (fenceMatch) {
        const lang = fenceMatch[1].toLowerCase();
        const body = fenceMatch[2].trim();
        if (lang === "json" || body.startsWith("{")) {
          textToParse = body;
          strippedFences = true;
        }
      } else {
        // Maybe it's a truncated fence (missing the ending ```)
        const openFenceMatch = trimmed.match(/^```([a-zA-Z0-9-]*)\s*([\s\S]*)$/);
        if (openFenceMatch) {
          const lang = openFenceMatch[1].toLowerCase();
          const body = openFenceMatch[2].trim();
          if (lang === "json" || body.startsWith("{")) {
            textToParse = body;
            strippedFences = true;
          }
        }
      }
    }

    // Helper to extract keys using regex from a potentially truncated/malformed JSON string
    function extractKeyRegex(jsonStr, key) {
      const pattern = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, "i");
      const match = jsonStr.match(pattern);
      if (match) {
        try {
          return JSON.parse(`"${match[1]}"`);
        } catch {
          return match[1];
        }
      }
      return null;
    }

    let finalText = rawText;

    // 2. Try parsing as JSON
    try {
      const parsed = JSON.parse(textToParse);
      if (parsed && typeof parsed === "object") {
        const keys = ["response", "content", "message", "answer", "title"];
        for (const key of keys) {
          if (parsed[key] !== undefined && parsed[key] !== null) {
            const val = String(parsed[key]).trim();
            if (val.length > 0) {
              finalText = val;
              break;
            }
          }
        }
      }
    } catch (e) {
      // If JSON parsing fails, see if we can extract the fields using regex
      if (textToParse.startsWith("{")) {
        const keys = ["response", "content", "message", "answer", "title"];
        let found = false;
        for (const key of keys) {
          const extracted = extractKeyRegex(textToParse, key);
          if (extracted && extracted.trim().length > 0) {
            finalText = extracted.trim();
            found = true;
            break;
          }
        }
        if (!found && strippedFences) {
          finalText = textToParse;
        }
      } else if (strippedFences) {
        finalText = textToParse;
      }
    }

    // 3. Replace old names with Matterhorn
    return finalText
      .replace(/\bNSS Workspace AI\b/g, "Matterhorn")
      .replace(/\bNSS Master Core\b/g, "Matterhorn")
      .replace(/\bM-CORE\b/g, "Matterhorn")
      .replace(/\bGeneral NSS Studio Agent\b/g, "Matterhorn");
  }

  function renderMessageBody(bubble, text) {
    const parts = text.split(/```/);
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i % 2 === 1) {
        // Inside a code block
        const lines = part.split(/\r?\n/);
        let codeContent = part;
        if (lines.length > 0 && /^[a-zA-Z0-9-+]+$/.test(lines[0].trim())) {
          codeContent = lines.slice(1).join("\n");
        }
        
        const pre = document.createElement("pre");
        pre.className = "code-block";
        const code = document.createElement("code");
        code.textContent = codeContent.trim();
        pre.appendChild(code);
        bubble.appendChild(pre);
      } else {
        // Prose block
        if (part.trim() || parts.length === 1) {
          const span = document.createElement("span");
          span.className = "prose-block";
          span.textContent = part;
          bubble.appendChild(span);
        }
      }
    }
  }

  function formatMessageTime(dateString) {
    const date = dateString ? new Date(dateString) : new Date();
    if (Number.isNaN(date.valueOf())) {
      return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function persistState() {
    vscode.setState({
      selectedAgentId,
      selectedProvider,
      selectedModel,
      lastServerMode,
      lastRenderedResponseKey,
    });
  }
})();
