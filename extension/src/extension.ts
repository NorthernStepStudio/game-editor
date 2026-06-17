import * as path from "node:path";
import * as vscode from "vscode";

import { postAskRequest } from "./api/client.js";
import { probeServerHealth } from "./api/health.js";
import { buildAskRequest } from "./api/requestBuilder.js";
import { registerNssCommands } from "./commands/index.js";
import { buildSidebarQuickActions } from "./config/commands.js";
import { registerDebugCommands } from "./dev/registerDebugCommands.js";
import { NSS_MODES } from "./config/modes.js";
import { NSS_PRESETS } from "./config/presets.js";
import { STUDIO_PROJECTS } from "./config/studioProjects.js";
import { getRuntimeConfig } from "./helpers/config.js";
import { getTrimmedSelection, insertTextIntoEditor, requireActiveEditor } from "./helpers/editor.js";
import { buildActiveFileSnapshot, readFileSnapshot } from "./helpers/files.js";
import { openMarkdownPreview } from "./helpers/notifications.js";
import { toWorkspaceRelativePath } from "./helpers/paths.js";
import { pickWorkspaceTaskKind } from "./helpers/prompts.js";
import { extractCodeFence, truncateText } from "./helpers/text.js";
import { formatTimestamp } from "./helpers/time.js";
import {
  getPrimaryWorkspaceFolder,
  getWorkspaceName,
  inferPresetIdFromPath,
  inferStudioProjectIdFromPath,
} from "./helpers/workspace.js";
import type { NssAskIntent, NssAskResponse, NssCodebaseContext, NssServerHealth } from "./models/api.types.js";
import type { NssAgentId } from "./models/agent.types.js";
import type { NssCommandHost, NssResponseKind, NssResponseRecord } from "./models/command.types.js";
import type { NssDebugStateSnapshot } from "./models/debug.types.js";
import type { NssDiagnosticSession } from "./models/diagnostic.types.js";
import type { NssKnowledgeItem } from "./models/knowledge.types.js";
import type { NssModeId } from "./models/mode.types.js";
import type { NssReviewItem } from "./models/review.types.js";
import type { NssSidebarViewModel } from "./models/sidebar.types.js";
import type { NssTaskKind, NssTaskResult } from "./models/task.types.js";
import type { NssWorkflowRun } from "./models/workflow.types.js";
import { searchCodebase } from "./services/codebase/codebaseSearchService.js";
import { findLikelyErrorFilesFromOutput } from "./services/codebase/errorFileService.js";
import { buildProjectStructureSummary } from "./services/codebase/projectTreeService.js";
import { findRelatedFiles } from "./services/codebase/relatedFilesService.js";
import {
  clearWorkspaceSearchIndex,
  searchCodebaseKeywords,
  extractKeywords,
} from "./services/codebase/searchIndexingService.js";
import { discoverProjectSchemas } from "./services/codebase/schemaDiscoveryService.js";
import { discoverProjectDocumentation } from "./services/codebase/documentationDiscoveryService.js";
import { analyzeProjectDependencies } from "./services/codebase/dependencyAnalysisService.js";
import { discoverOperationalConfig } from "./services/codebase/operationalDiscoveryService.js";
import { discoverApiRoutes } from "./services/codebase/apiDiscoveryService.js";
import { compareTaskResults } from "./services/diagnostics/compareTaskResultsService.js";
import {
  addNoteToDiagnosticSession,
  attachTaskToDiagnosticSession,
  closeDiagnosticSession,
  startDiagnosticSessionFromTask,
} from "./services/diagnostics/diagnosticService.js";
import { buildRepairTrail } from "./services/diagnostics/repairTrailService.js";
import { rebuildKnowledgePacks } from "./services/knowledge/knowledgePackService.js";
import { searchKnowledgeItems } from "./services/knowledge/knowledgeSearchService.js";
import { buildWorkspaceBriefing } from "./services/knowledge/workspaceBriefingService.js";
import { createBuildFoundationReport } from "./services/foundation/buildFoundationService.js";
import { createBuildContext } from "./services/foundation/buildContextService.js";
import { createProjectRule, listProjectRulesForProject } from "./services/memory/projectRulesService.js";
import { createRecurringFailure, recallSimilarFailure } from "./services/memory/recurringFailureService.js";
import { createRepairPattern } from "./services/memory/repairPatternService.js";
import { recallRelevantMemories } from "./services/memory/memoryRecallService.js";
import { buildWorkspaceMemoryContext } from "./services/memory/workspaceMemoryService.js";
import { registerMemoryCommands } from "./commands/memoryCommands.js";
import { applyReviewItemToActiveFile, applyReviewItemToSelection } from "./services/review/applyService.js";
import { showReviewDiff } from "./services/review/diffService.js";
import {
  approveReviewItem,
  canApplyReviewItem,
  createReviewItem,
  markReviewItemStale,
  rejectReviewItem,
} from "./services/review/reviewService.js";
import { isReviewItemStale } from "./services/review/staleCheckService.js";
import { buildStudioDashboard } from "./services/studio/dashboardService.js";
import { getModeDetails, getModeTitle } from "./services/studio/modeService.js";
import { suggestNextWork } from "./services/studio/nextWorkService.js";
import { getPresetTitle } from "./services/studio/presetService.js";
import { createRoadmapNote, listRoadmapNotes } from "./services/studio/roadmapService.js";
import { getStudioProjectDescription, getStudioProjectTitle } from "./services/studio/studioProjectService.js";
import { explainTaskResult } from "./services/tasks/taskExplainService.js";
import { suggestFixesForTaskFailure } from "./services/tasks/taskFailureService.js";
import { runWorkspaceTask } from "./services/tasks/taskRunnerService.js";
import { cancelWorkflow, startWorkflow } from "./services/workflow/workflowService.js";
import { WORKFLOW_DEFINITIONS, advanceWorkflowRun, getWorkflowDefinition } from "./services/workflow/workflowDefinitions.js";
import { NssSidebarProvider, type NssSidebarActionMessage, type NssSidebarHost } from "./sidebar/sidebarProvider.js";
import { getActiveDiagnosticSession as selectActiveDiagnosticSession } from "./state/diagnosticState.js";
import { getKnowledgeRequestItems } from "./state/knowledgeState.js";
import { clearWorkspaceMemory as clearWorkspaceMemoryState } from "./state/memoryState.js";
import { resolveModeSelection } from "./state/modeState.js";
import { resolvePresetSelection } from "./state/presetState.js";
import { resolveStudioProjectSelection } from "./state/projectState.js";
import {
  getActiveReview as selectActiveReview,
  getReviewCounts,
  markReviewItemApplied as markReviewItemAppliedState,
} from "./state/reviewState.js";
import { NssStateStore } from "./state/store.js";
import { getLastTask as selectLastTask } from "./state/taskState.js";
import { getServerStatusLabel } from "./state/uiState.js";
import { getActiveWorkflowStep } from "./state/workflowState.js";
import { eventTracker } from "./state/eventTracker.js";
import { generateAppSnapshot } from "./helpers/snapshotHelper.js";

interface BackendCommandResult {
  readonly record: NssResponseRecord;
  readonly response: NssAskResponse;
}

class NssWorkspaceAiController implements NssSidebarHost, NssCommandHost, vscode.Disposable {
  private readonly outputChannel = vscode.window.createOutputChannel("Matterhorn");
  private sidebar?: NssSidebarProvider;

  public constructor(
    private readonly store: NssStateStore,
  ) {}

  public dispose(): void {
    this.outputChannel.dispose();
  }

  public bindSidebar(sidebar: NssSidebarProvider): void {
    this.sidebar = sidebar;
  }

  public async initialize(): Promise<void> {
    const workspacePath = getPrimaryWorkspaceFolder()?.uri.fsPath;
    const config = getRuntimeConfig();

    this.outputChannel.appendLine(`[Matterhorn] Initializing with workspace: ${workspacePath ?? "none"}`);
    this.outputChannel.appendLine(`[Matterhorn] Server URL: ${config.serverUrl} (source: ${config.serverUrlSource})`);

    await this.store.initialize();
    await this.store.update((draft) => {
      draft.mode = resolveModeSelection(draft.mode, config.defaultMode);
      draft.presetId = resolvePresetSelection(draft.presetId, workspacePath, config.autoSuggestPresetForWorkspace);
      draft.studioProjectId = resolveStudioProjectSelection(
        draft.studioProjectId,
        workspacePath,
        config.autoSuggestPresetForWorkspace,
      );
    });

    try {
      this.outputChannel.appendLine("[Matterhorn] Probing backend health...");
      const serverHealth = await probeWorkspaceServerHealth();
      this.outputChannel.appendLine(`[Matterhorn] Backend health: ${serverHealth.status} (${serverHealth.mode} mode)`);
      
      await this.store.update((draft) => {
        draft.serverHealth = serverHealth;
      });

      if (serverHealth.mode === "mock") {
        this.outputChannel.appendLine("[Matterhorn] WARNING: Server is in MOCK mode. Real AI features are disabled.");
      }
    } catch (error) {
      this.outputChannel.appendLine(`[Matterhorn] ERROR: Health probe failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Initialize event tracking
    this.registerEventListeners();
  }

  private registerEventListeners(): void {
    // Track file opens
    vscode.workspace.onDidOpenTextDocument((doc) => {
      eventTracker.track("file_opened", { path: vscode.workspace.asRelativePath(doc.uri) });
    });

    vscode.workspace.onDidSaveTextDocument((doc) => {
      clearWorkspaceSearchIndex();
      eventTracker.track("file_saved", { path: vscode.workspace.asRelativePath(doc.uri) });
    });

    // Track active editor changes
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        eventTracker.track("active_editor_changed", { path: vscode.workspace.asRelativePath(editor.document.uri) });
      }
    });
  }

  public async getSidebarViewModel(): Promise<NssSidebarViewModel> {
    const state = this.store.snapshot();
    const editor = vscode.window.activeTextEditor;
    const selection = editor ? getTrimmedSelection(editor) : "";
    const activeReview = this.getActiveReview(state.reviewItems, state.activeReviewId);
    const lastTask = selectLastTask(state.taskHistory);
    const activeDiagnostic = this.getActiveDiagnosticSession(state.diagnosticSessions, state.activeDiagnosticSessionId);
    const reviewCounts = getReviewCounts(state.reviewItems);

    return {
      title: "Matterhorn",
      workspaceName: getWorkspaceName(),
      serverStatus: getServerStatusLabel(state.serverHealth),
      serverMode: state.serverHealth.mode ?? "unknown",
      serverDetail: state.serverHealth.detail,
      modeTitle: getModeTitle(state.mode),
      presetTitle: getPresetTitle(state.presetId),
      studioProjectTitle: getStudioProjectTitle(state.studioProjectId),
      currentFilePath: editor ? toWorkspaceRelativePath(editor.document.uri) : undefined,
      currentSelectionPreview: selection ? truncateText(selection, 240) : undefined,
      latestResponse: state.latestResponse
        ? {
            title: state.latestResponse.title,
            excerpt: truncateText(state.latestResponse.body, 160),
            createdAt: formatTimestamp(state.latestResponse.createdAt),
            kind: state.latestResponse.kind,
            proposedMemories: state.latestResponse.proposedMemories?.map((m) => ({
              content: m.content,
              tags: m.tags,
            })),
          }
        : undefined,
      activeProposal: activeReview
        ? {
            title: activeReview.title,
            summary: truncateText(activeReview.summary, 240),
            targetPath: activeReview.targetPath,
            canApply: canApplyReviewItem(activeReview),
          }
        : undefined,
      lastTask: lastTask
        ? {
            label: `${lastTask.kind} (${lastTask.status})`,
            status: lastTask.status,
            summary: truncateText(lastTask.summary, 160),
          }
        : undefined,
      activeWorkflow: state.activeWorkflow
        ? {
            title: state.activeWorkflow.title,
            step: getActiveWorkflowStep(state.activeWorkflow) ?? "Complete",
          }
        : undefined,
      activeDiagnostic: activeDiagnostic
        ? {
            title: activeDiagnostic.title,
            status: activeDiagnostic.status,
          }
        : undefined,
      reviewCounts,
      persistentMemories: state.persistentMemories
        .filter((m) => m.projectId === state.studioProjectId)
        .map((m) => ({
          id: m.id,
          content: truncateText(m.content, 120),
          tags: m.tags,
        })),
      quickActions: buildSidebarQuickActions({
        mode: state.mode,
        hasActiveReview: Boolean(activeReview),
        hasFailedTask: lastTask?.status === "failed",
        hasActiveWorkflow: Boolean(state.activeWorkflow),
        hasActiveDiagnostic: Boolean(activeDiagnostic),
      }),
    };
  }

  public getDebugSnapshot(): NssDebugStateSnapshot {
    const state = this.store.snapshot();
    const activeReview = this.getActiveReview(state.reviewItems, state.activeReviewId);

    return {
      serverHealth: state.serverHealth,
      mode: state.mode,
      presetId: state.presetId,
      studioProjectId: state.studioProjectId,
      currentFilePath: vscode.window.activeTextEditor?.document.uri.fsPath,
      latestResponse: state.latestResponse
        ? {
            title: state.latestResponse.title,
            body: state.latestResponse.body,
            kind: state.latestResponse.kind,
            sourceCommand: state.latestResponse.sourceCommand,
          }
        : undefined,
      activeReview: activeReview
        ? {
            title: activeReview.title,
            status: activeReview.status,
            targetPath: activeReview.targetPath,
            hasProposedText: canApplyReviewItem(activeReview),
          }
        : undefined,
      reviewItemCount: state.reviewItems.length,
    };
  }

  public async handleSidebarAction(message: NssSidebarActionMessage): Promise<void> {
    switch (message.command) {
      case "nssWorkspaceAi.askWorkspaceAi":
        await this.askWorkspaceAi(message.prompt, message.agentId);
        break;
      case "nssWorkspaceAi.approveProposedMemory":
        if (message.memory && typeof message.index === "number") {
          await this.approveProposedMemory(message.memory, message.index);
        }
        break;
      case "nssWorkspaceAi.editProposedMemory":
        if (message.memory && typeof message.index === "number") {
          await this.editProposedMemory(message.memory, message.index);
        }
        break;
      case "nssWorkspaceAi.editMemory":
        if (message.memory) {
          await this.editMemory(message.memory);
        }
        break;
      case "nssWorkspaceAi.forgetMemory":
        if (message.memory) {
          await this.forgetMemory(message.memory);
        }
        break;
      case "nssWorkspaceAi.refreshSidebar":
        await this.refreshSidebar();
        break;
      case "nssWorkspaceAi.searchCodebase":
        if (message.prompt) {
          const keywords = extractKeywords(message.prompt);
          const results = await searchCodebaseKeywords(keywords);
          await this.sidebar?.postSearchResults(results);
        }
        break;
      case "vscode.open":
        if (message.path) {
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (workspaceFolder) {
            const uri = vscode.Uri.joinPath(workspaceFolder.uri, message.path);
            await vscode.commands.executeCommand("vscode.open", uri);
          }
        }
        break;
      case "nss.previewActiveProposal":
        await this.previewActiveProposal();
        break;
      default:
        await vscode.commands.executeCommand(message.command, message);
        break;
    }
  }

  public async refreshSidebar(): Promise<void> {
    await this.sidebar?.refresh();
  }

  public async openSidebar(): Promise<void> {
    await this.sidebar?.reveal();
  }

  public async askWorkspaceAi(promptFromSidebar?: string, preferredAgentId?: NssAgentId): Promise<void> {
    const prompt =
      promptFromSidebar ??
      (await vscode.window.showInputBox({
        prompt: "Ask Matterhorn about the current workspace",
        placeHolder: "What do you want Matterhorn to help with?",
      }));

    if (!prompt) {
      return;
    }

    await this.runBackendCommand({
      commandId: "nssWorkspaceAi.askWorkspaceAi",
      intent: "ask",
      prompt,
      responseTitle: "Matterhorn Response",
      responseKind: "answer",
      preferredAgentId,
    });
  }

  public async explainThisFile(): Promise<void> {
    const editor = requireActiveEditor();
    await this.runBackendCommand({
      commandId: "nssWorkspaceAi.explainThisFile",
      intent: "explain-file",
      prompt: "Explain this file clearly, including its role, structure, and anything risky or confusing.",
      responseTitle: `Explain ${path.basename(editor.document.uri.fsPath)}`,
      responseKind: "analysis",
      activeFile: buildActiveFileSnapshot(editor),
    });
  }

  public async generateFromSelection(): Promise<void> {
    const editor = requireActiveEditor();
    const selection = getTrimmedSelection(editor);
    if (!selection) {
      throw new Error("Select some text before running Generate From Selection.");
    }

    const prompt = await vscode.window.showInputBox({
      prompt: "What should Matterhorn generate from the current selection?",
      placeHolder: "Example: rewrite this into a clearer helper function",
    });

    if (!prompt) {
      return;
    }

    await this.runBackendCommand({
      commandId: "nssWorkspaceAi.generateFromSelection",
      intent: "generate-from-selection",
      prompt,
      responseTitle: "Generated From Selection",
      responseKind: "generation",
      activeFile: buildActiveFileSnapshot(editor),
    });
  }

  public async askAboutCurrentFile(): Promise<void> {
    const editor = requireActiveEditor();
    const prompt = await vscode.window.showInputBox({
      prompt: "What do you want Matterhorn to answer about the current file?",
      placeHolder: "Ask a focused question about this file",
    });

    if (!prompt) {
      return;
    }

    await this.runBackendCommand({
      commandId: "nssWorkspaceAi.askAboutCurrentFile",
      intent: "ask-current-file",
      prompt,
      responseTitle: `Ask About ${path.basename(editor.document.uri.fsPath)}`,
      responseKind: "analysis",
      activeFile: buildActiveFileSnapshot(editor),
    });
  }

  public async explainProjectStructure(): Promise<void> {
    const workspaceFolder = getPrimaryWorkspaceFolder();
    if (!workspaceFolder) {
      throw new Error("Open a workspace folder before asking Matterhorn to explain the project structure.");
    }

    const structureSummary = await buildProjectStructureSummary(workspaceFolder);
    await this.runBackendCommand({
      commandId: "nssWorkspaceAi.explainProjectStructure",
      intent: "explain-project-structure",
      prompt: "Explain this project's structure and the likely purpose of the main folders.",
      responseTitle: "Project Structure",
      responseKind: "analysis",
      project: { structureSummary },
    });
  }

  public async proposeEditForCurrentFile(): Promise<void> {
    const editor = requireActiveEditor();
    const prompt = await vscode.window.showInputBox({
      prompt: "What edit should Matterhorn propose for the current file?",
      placeHolder: "Describe the change you want reviewed before applying",
    });

    if (!prompt) {
      return;
    }

    const result = await this.runBackendCommand({
      commandId: "nssWorkspaceAi.proposeEditForCurrentFile",
      intent: "propose-edit",
      prompt,
      responseTitle: `Proposed Edit: ${path.basename(editor.document.uri.fsPath)}`,
      responseKind: "proposal",
      activeFile: buildActiveFileSnapshot(editor),
    });

    if (!result) {
      return;
    }

    const activeFile = buildActiveFileSnapshot(editor);
    await this.queueReviewItems([
      createReviewItem({
        title: `Proposed Edit: ${path.basename(editor.document.uri.fsPath)}`,
        prompt,
        targetPath: toWorkspaceRelativePath(editor.document.uri),
        originalText: activeFile.content,
        responseText: result.record.body,
        proposedText: result.response.proposedText,
        sourceResponseId: result.record.id,
      }),
    ]);
  }

  public async applyProposedEditToActiveFile(): Promise<void> {
    const state = this.store.snapshot();
    const reviewItem = this.getActiveReview(state.reviewItems, state.activeReviewId);

    if (!reviewItem) {
      throw new Error("There is no active proposed edit to apply.");
    }

    if (!canApplyReviewItem(reviewItem)) {
      await openMarkdownPreview(reviewItem.title, reviewItem.previewMarkdown);
      throw new Error("The current proposal is preview-only because the backend did not return a concrete file body.");
    }

    const editor = requireActiveEditor();
    const confirm = await vscode.window.showWarningMessage(
      `Replace the active file with the proposed edit for ${reviewItem.targetPath}?`,
      { modal: true },
      "Apply Proposed Edit",
    );

    if (confirm !== "Apply Proposed Edit") {
      return;
    }

    await applyReviewItemToActiveFile(editor, reviewItem);
    await this.store.update((draft) => {
      draft.reviewItems = draft.reviewItems.map((item) =>
        item.id === reviewItem.id
          ? {
              ...item,
              status: "applied",
              updatedAt: new Date().toISOString(),
            }
          : item,
      );
    });

    await vscode.window.showInformationMessage("Applied the proposed edit to the active file.");
    await this.refreshSidebar();
  }

  public async insertLatestResponseIntoCurrentFile(): Promise<void> {
    const latestResponse = this.store.snapshot().latestResponse;
    if (!latestResponse) {
      throw new Error("There is no latest Matterhorn response to insert.");
    }

    const editor = requireActiveEditor();
    const confirm = await vscode.window.showWarningMessage(
      "Insert the latest Matterhorn response into the active file or current selection?",
      { modal: true },
      "Insert Response",
    );

    if (confirm !== "Insert Response") {
      return;
    }

    await insertTextIntoEditor(editor, this.getWritableResponseText(latestResponse));
  }

  public async createNewFileFromLatestResponse(): Promise<void> {
    const latestResponse = this.store.snapshot().latestResponse;
    if (!latestResponse) {
      throw new Error("There is no latest Matterhorn response to write into a new file.");
    }

    const workspaceFolder = getPrimaryWorkspaceFolder();
    if (!workspaceFolder) {
      throw new Error("Open a workspace folder before creating files from Matterhorn responses.");
    }

    const relativePath = await vscode.window.showInputBox({
      prompt: "Enter the workspace-relative path for the new file",
      placeHolder: "Example: docs/nss-output.md",
    });

    if (!relativePath) {
      return;
    }

    const segments = relativePath.split(/[\\/]+/).filter(Boolean);
    const targetUri = vscode.Uri.joinPath(workspaceFolder.uri, ...segments);
    const parentSegments = segments.slice(0, -1);

    const confirm = await vscode.window.showWarningMessage(
      `Create ${relativePath} from the latest Matterhorn response?`,
      { modal: true },
      "Create File",
    );

    if (confirm !== "Create File") {
      return;
    }

    try {
      await vscode.workspace.fs.stat(targetUri);
      throw new Error(`The file ${relativePath} already exists.`);
    } catch (error) {
      if (!(error instanceof vscode.FileSystemError)) {
        throw error;
      }
    }

    if (parentSegments.length > 0) {
      await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(workspaceFolder.uri, ...parentSegments));
    }

    await vscode.workspace.fs.writeFile(targetUri, Buffer.from(this.getWritableResponseText(latestResponse), "utf8"));

    const document = await vscode.workspace.openTextDocument(targetUri);
    await vscode.window.showTextDocument(document, { preview: false });
  }

  public async searchCodebaseCommand(): Promise<void> {
    const query = await vscode.window.showInputBox({
      prompt: "Search the current workspace codebase",
      placeHolder: "Enter a string to search for",
    });

    if (!query) {
      return;
    }

    const results = await searchCodebase(query);
    const body =
      results.length > 0
        ? results.map((result) => `- ${result.path}\n  ${result.preview}`).join("\n")
        : `No matches found for "${query}".`;

    await this.saveLocalResponse(
      this.createLocalResponseRecord("Codebase Search", body, "analysis", "nssWorkspaceAi.searchCodebase", query),
    );
    await openMarkdownPreview("Codebase Search", body);
  }

  public async findRelatedFilesCommand(): Promise<void> {
    const editor = requireActiveEditor();
    const results = await findRelatedFiles(editor.document.uri);
    const body =
      results.length > 0
        ? results.map((result) => `- ${result.path} (${result.reason})`).join("\n")
        : "No related files were found with the current heuristic.";

    await this.saveLocalResponse(
      this.createLocalResponseRecord("Related Files", body, "analysis", "nssWorkspaceAi.findRelatedFiles"),
    );
    await openMarkdownPreview("Related Files", body);
  }

  public async planChangeCommand(): Promise<void> {
    const prompt = await vscode.window.showInputBox({
      prompt: "Describe the change you want to plan",
      placeHolder: "Example: add a safer approval flow for review items",
    });

    if (!prompt) {
      return;
    }

    const workspaceFolder = getPrimaryWorkspaceFolder();
    if (!workspaceFolder) {
      const activePath = vscode.window.activeTextEditor?.document.uri;
      const relatedFiles = activePath ? await findRelatedFiles(activePath, 6) : [];
      const lines = [
        `Requested change: ${prompt}`,
        "",
        "Suggested plan:",
        "- clarify the desired behavior and acceptance criteria",
        "- inspect the active file and nearby related files",
        "- draft the smallest safe implementation path",
        "- create or review a proposal before applying edits",
      ];

      if (relatedFiles.length > 0) {
        lines.push("", "Likely impacted files:", ...relatedFiles.map((file) => `- ${file.path}`));
      }

      const body = lines.join("\n");
      await this.saveLocalResponse(
        this.createLocalResponseRecord("Change Plan", body, "plan", "nssWorkspaceAi.planChange", prompt),
      );
      await openMarkdownPreview("Change Plan", body);
      return;
    }

    const report = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Matterhorn Change Plan",
        cancellable: false,
      },
      async () => createBuildFoundationReport({ goal: prompt, workspaceFolder }),
    );

    const lines = [
      `Requested change: ${prompt}`,
      "",
      "Suggested build foundation:",
      `- Workspace kind: ${report.capabilityProfile.primaryKind}`,
      `- Scope: ${report.buildSpec.scope}`,
      `- Target: ${report.buildSpec.target}`,
      `- Template: ${report.plan.template.title}`,
      "",
      "Plan:",
      ...report.plan.steps.map((step, index) => `${index + 1}. ${step}`),
      "",
      "Likely impacted files:",
      ...report.relatedFiles.map((file) => `- ${file.path} (score ${file.score})`),
      "",
      "Next actions:",
      "- Review the build foundation report for the full capability profile and rollback notes.",
      "- Use the proposal flows for risky multi-file edits.",
      "- Re-run the change plan after the target scope is confirmed.",
    ];

    const body = lines.join("\n");
    await this.saveLocalResponse(
      this.createLocalResponseRecord("Change Plan", body, "plan", "nssWorkspaceAi.planChange", prompt),
    );
    await openMarkdownPreview("Change Plan", body);
  }

  public async runWorkspaceTaskCommand(): Promise<void> {
    const taskKind = await pickWorkspaceTaskKind();
    if (!taskKind) {
      return;
    }

    await this.runTaskKind(taskKind);
  }

  public async explainLastTaskFailure(): Promise<void> {
    const lastTask = this.getLastTask();
    if (!lastTask) {
      throw new Error("No workspace task has been run yet.");
    }

    const body = explainTaskResult(lastTask);
    await this.saveLocalResponse(
      this.createLocalResponseRecord("Last Task Failure", body, "task", "nssWorkspaceAi.explainLastTaskFailure"),
    );
    await openMarkdownPreview("Last Task Failure", body);
  }

  public async suggestFixForLastTaskFailure(): Promise<void> {
    const lastTask = this.getLastTask();
    if (!lastTask) {
      throw new Error("No workspace task has been run yet.");
    }

    const fixes = suggestFixesForTaskFailure(lastTask);
    const body = fixes.map((fix) => `- ${fix}`).join("\n");
    await this.saveLocalResponse(
      this.createLocalResponseRecord("Suggested Fixes", body, "task", "nssWorkspaceAi.suggestFixForLastTaskFailure"),
    );
    await openMarkdownPreview("Suggested Fixes", body);
  }

  public async rerunLastWorkspaceTask(): Promise<void> {
    const lastTask = this.getLastTask();
    if (!lastTask) {
      throw new Error("No workspace task has been run yet.");
    }

    await this.runTaskKind(lastTask.kind);
  }

  public async findLikelyErrorFiles(): Promise<void> {
    const likelyFiles = await this.resolveLikelyErrorFiles();
    const picked = await vscode.window.showQuickPick(
      likelyFiles.map((file) => ({
        label: file,
      })),
      {
        placeHolder: "Likely error files from the last task",
      },
    );

    if (!picked) {
      return;
    }

    const document = await vscode.workspace.openTextDocument(picked.label);
    await vscode.window.showTextDocument(document, { preview: false });
  }

  public async askAboutErrorFileCommand(): Promise<void> {
    const editor = await this.openLikelyErrorFileEditor();
    if (!editor) {
      return;
    }

    const prompt = await vscode.window.showInputBox({
      prompt: "What should Matterhorn answer about this likely error file?",
      placeHolder: "Explain the failure source and the next safe debugging steps",
      value: "Explain the likely failure source in this file and the next safe debugging steps.",
    });

    if (!prompt) {
      return;
    }

    await this.runBackendCommand({
      commandId: "nssWorkspaceAi.askAboutErrorFile",
      intent: "ask-error-file",
      prompt,
      responseTitle: `Likely Error File: ${path.basename(editor.document.uri.fsPath)}`,
      responseKind: "analysis",
      activeFile: buildActiveFileSnapshot(editor),
      codebase: {
        likelyErrorFiles: this.getLastTask()?.likelyErrorFiles,
      },
    });
  }

  public async proposeFixForErrorFileCommand(): Promise<void> {
    const editor = await this.openLikelyErrorFileEditor();
    if (!editor) {
      return;
    }

    const prompt = await vscode.window.showInputBox({
      prompt: "What safe fix should Matterhorn propose for this likely error file?",
      placeHolder: "Keep the proposal minimal, reviewable, and targeted to the failing code path",
      value: "Propose a minimal, reviewable fix for the failure in this file.",
    });

    if (!prompt) {
      return;
    }

    const result = await this.runBackendCommand({
      commandId: "nssWorkspaceAi.proposeFixForErrorFile",
      intent: "propose-error-file-fix",
      prompt,
      responseTitle: `Proposed Error Fix: ${path.basename(editor.document.uri.fsPath)}`,
      responseKind: "proposal",
      activeFile: buildActiveFileSnapshot(editor),
      codebase: {
        likelyErrorFiles: this.getLastTask()?.likelyErrorFiles,
      },
    });

    if (!result) {
      return;
    }

    await this.queueReviewItems([
      createReviewItem({
        title: `Proposed Error Fix: ${path.basename(editor.document.uri.fsPath)}`,
        prompt,
        targetPath: toWorkspaceRelativePath(editor.document.uri),
        originalText: editor.document.getText(),
        responseText: result.record.body,
        proposedText: result.response.proposedText,
        sourceResponseId: result.record.id,
      }),
    ]);
  }

  public async proposeMultiFileChangeCommand(): Promise<void> {
    const editor = requireActiveEditor();
    const prompt = await vscode.window.showInputBox({
      prompt: "Describe the coordinated multi-file change you want Matterhorn to propose",
      placeHolder: "Example: add a safer task-debug-review flow across the sidebar and review center",
    });

    if (!prompt) {
      return;
    }

    const relatedFiles = await findRelatedFiles(editor.document.uri, 4);
    const fileSnapshots = [
      buildActiveFileSnapshot(editor),
      ...(await Promise.all(relatedFiles.map((file) => readFileSnapshot(vscode.Uri.file(file.path))))),
    ];

    const targetFiles = fileSnapshots.map((snapshot) => toWorkspaceRelativePath(vscode.Uri.file(snapshot.path)));
    const result = await this.runBackendCommand({
      commandId: "nssWorkspaceAi.proposeMultiFileChange",
      intent: "propose-multi-file-change",
      prompt: `${prompt}\n\nTarget files:\n${targetFiles.map((targetFile) => `- ${targetFile}`).join("\n")}`,
      responseTitle: `Multi-File Proposal: ${path.basename(editor.document.uri.fsPath)}`,
      responseKind: "proposal",
      activeFile: buildActiveFileSnapshot(editor),
      codebase: {
        relatedFiles: targetFiles.slice(1),
        searchSummary: relatedFiles.map((file) => `${toWorkspaceRelativePath(vscode.Uri.file(file.path))} (${file.reason})`),
      },
    });

    if (!result) {
      return;
    }

    const reviewItems = fileSnapshots.map((snapshot, index) =>
      createReviewItem({
        title: `Multi-File Proposal: ${path.basename(snapshot.path)}`,
        prompt: `${prompt}\n\nFile focus: ${toWorkspaceRelativePath(vscode.Uri.file(snapshot.path))}`,
        targetPath: toWorkspaceRelativePath(vscode.Uri.file(snapshot.path)),
        originalText: snapshot.content,
        responseText:
          index === 0
            ? result.record.body
            : `${result.record.body}\n\nThis queued review item focuses on ${toWorkspaceRelativePath(vscode.Uri.file(snapshot.path))}.`,
        proposedText: index === 0 ? result.response.proposedText : undefined,
        sourceResponseId: result.record.id,
      }),
    );

    await this.queueReviewItems(reviewItems, "Matterhorn proposed a patch");
  }

  public async startDiagnosticSession(): Promise<void> {
    const lastTask = this.getLastTask();
    if (!lastTask) {
      throw new Error("Run a workspace task before starting a diagnostic session.");
    }

    const session = startDiagnosticSessionFromTask(lastTask);
    await this.store.update((draft) => {
      draft.diagnosticSessions = [session, ...draft.diagnosticSessions];
      draft.activeDiagnosticSessionId = session.id;
    });

    await openMarkdownPreview(session.title, buildRepairTrail(session, [lastTask]));
    await this.refreshSidebar();
  }

  public async viewActiveDiagnosticSession(): Promise<void> {
    const state = this.store.snapshot();
    const session = this.getActiveDiagnosticSession(state.diagnosticSessions, state.activeDiagnosticSessionId);
    if (!session) {
      throw new Error("There is no active diagnostic session.");
    }

    const body = buildRepairTrail(session, state.taskHistory);
    await openMarkdownPreview(session.title, body);
  }

  public async addNoteToSession(): Promise<void> {
    const state = this.store.snapshot();
    const session = this.getActiveDiagnosticSession(state.diagnosticSessions, state.activeDiagnosticSessionId);
    if (!session) {
      throw new Error("There is no active diagnostic session.");
    }

    const note = await vscode.window.showInputBox({
      prompt: "Add a note to the active diagnostic session",
    });

    if (!note) {
      return;
    }

    await this.store.update((draft) => {
      draft.diagnosticSessions = draft.diagnosticSessions.map((item) =>
        item.id === session.id ? addNoteToDiagnosticSession(item, note) : item,
      );
    });

    await this.refreshSidebar();
  }

  public async compareLastTwoResultsCommand(): Promise<void> {
    const state = this.store.snapshot();
    if (state.taskHistory.length < 2) {
      throw new Error("Matterhorn needs at least two task runs to compare results.");
    }

    const body = compareTaskResults(state.taskHistory[1], state.taskHistory[0]);
    await openMarkdownPreview("Compare Last Two Task Results", body);
  }

  public async resolveSession(): Promise<void> {
    await this.closeActiveDiagnosticSession("resolved");
  }

  public async abandonSession(): Promise<void> {
    await this.closeActiveDiagnosticSession("abandoned");
  }

  public async addProjectRuleCommand(): Promise<void> {
    const rule = await vscode.window.showInputBox({
      prompt: "Add a project rule for the active studio project",
      placeHolder: "Example: prefer review approval before file-wide apply",
    });

    if (!rule) {
      return;
    }

    const state = this.store.snapshot();
    const projectRule = createProjectRule(state.studioProjectId, rule);
    await this.store.update((draft) => {
      draft.projectRules = [projectRule, ...draft.projectRules];
    });
  }

  public async saveRepairPatternCommand(): Promise<void> {
    const state = this.store.snapshot();
    const session = this.getActiveDiagnosticSession(state.diagnosticSessions, state.activeDiagnosticSessionId);
    if (!session) {
      throw new Error("There is no active diagnostic session to save as a repair pattern.");
    }

    const pattern = createRepairPattern(state.studioProjectId, session);
    await this.store.update((draft) => {
      draft.repairPatterns = [pattern, ...draft.repairPatterns];
    });
    await vscode.window.showInformationMessage(`Saved repair pattern "${pattern.title}".`);
  }

  public async recallSimilarFailureCommand(): Promise<void> {
    const state = this.store.snapshot();
    const query =
      this.getLastTask()?.summary ??
      (await vscode.window.showInputBox({
        prompt: "Describe the failure or symptom to recall",
      }));

    if (!query) {
      return;
    }

    const recurring = recallSimilarFailure(state.recurringFailures, query);
    const matchingPattern = state.repairPatterns.find((pattern) => pattern.symptom.toLowerCase().includes(query.toLowerCase()));

    const lines = [
      recurring ? `Recurring failure: ${recurring.summary}` : "No recurring failure matched.",
      matchingPattern ? `Repair pattern: ${matchingPattern.title} -> ${matchingPattern.fix}` : "No repair pattern matched.",
    ];

    await openMarkdownPreview("Recall Similar Failure", lines.join("\n\n"));
  }

  public async clearWorkspaceMemoryCommand(): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
      "Clear project rules, repair patterns, recurring failures, and roadmap notes for Matterhorn?",
      { modal: true },
      "Clear Memory",
    );

    if (confirm !== "Clear Memory") {
      return;
    }

    await this.store.update((draft) => {
      clearWorkspaceMemoryState(draft);
    });
    await this.refreshSidebar();
  }

  public async switchModeCommand(): Promise<void> {
    const picked = await vscode.window.showQuickPick(
      NSS_MODES.map((mode) => ({ label: mode.title, id: mode.id })),
      { placeHolder: "Choose a Matterhorn mode" },
    );

    if (!picked) {
      return;
    }

    await this.store.update((draft) => {
      draft.mode = picked.id;
    });
    await this.refreshSidebar();
  }

  public async showModeDetailsCommand(): Promise<void> {
    const state = this.store.snapshot();
    await openMarkdownPreview(getModeTitle(state.mode), getModeDetails(state.mode));
  }

  public async runWorkflowCommand(): Promise<void> {
    const picked = await vscode.window.showQuickPick(
      WORKFLOW_DEFINITIONS.map((workflow) => ({
        label: workflow.title,
        description: workflow.description,
        id: workflow.id,
      })),
      { placeHolder: "Choose a Matterhorn workflow" },
    );

    if (!picked) {
      return;
    }

    const definition = getWorkflowDefinition(picked.id);
    if (!definition) {
      return;
    }

    await this.store.update((draft) => {
      draft.activeWorkflow = startWorkflow(definition);
    });
    await this.refreshSidebar();
  }

  public async nextWorkflowStepCommand(): Promise<void> {
    const state = this.store.snapshot();
    if (!state.activeWorkflow) {
      throw new Error("There is no active workflow.");
    }

    await this.store.update((draft) => {
      if (draft.activeWorkflow) {
        draft.activeWorkflow = advanceWorkflowRun(draft.activeWorkflow);
      }
    });
    await this.refreshSidebar();
  }

  public async cancelWorkflowCommand(): Promise<void> {
    const state = this.store.snapshot();
    if (!state.activeWorkflow) {
      throw new Error("There is no active workflow.");
    }

    await this.store.update((draft) => {
      if (draft.activeWorkflow) {
        draft.activeWorkflow = cancelWorkflow(draft.activeWorkflow);
      }
    });
    await this.refreshSidebar();
  }

  public async showWorkflowsCommand(): Promise<void> {
    const body = WORKFLOW_DEFINITIONS.map((workflow) => `- ${workflow.title}: ${workflow.description}`).join("\n");
    await openMarkdownPreview("Available Workflows", body);
  }

  public async switchPresetCommand(): Promise<void> {
    const picked = await vscode.window.showQuickPick(
      NSS_PRESETS.map((preset) => ({ label: preset.title, id: preset.id })),
      { placeHolder: "Choose a Matterhorn preset" },
    );

    if (!picked) {
      return;
    }

    await this.store.update((draft) => {
      draft.presetId = picked.id;
    });
    await this.refreshSidebar();
  }

  public async showPresetCommand(): Promise<void> {
    const state = this.store.snapshot();
    await openMarkdownPreview("Current Preset", getPresetTitle(state.presetId));
  }

  public async suggestPresetCommand(): Promise<void> {
    const pathHint = vscode.window.activeTextEditor?.document.uri.fsPath ?? getPrimaryWorkspaceFolder()?.uri.fsPath;
    const suggestedPreset = inferPresetIdFromPath(pathHint);
    await this.store.update((draft) => {
      draft.presetId = suggestedPreset;
    });
    await vscode.window.showInformationMessage(`Suggested preset: ${getPresetTitle(suggestedPreset)}.`);
    await this.refreshSidebar();
  }

  public async rebuildKnowledgePacksCommand(): Promise<void> {
    const state = this.store.snapshot();
    const knowledgeItems = await rebuildKnowledgePacks(state.presetId);
    await this.store.update((draft) => {
      draft.knowledgeItems = knowledgeItems;
    });
    await vscode.window.showInformationMessage(`Rebuilt ${knowledgeItems.length} knowledge pack item(s).`);
  }

  public async showBriefingCommand(): Promise<void> {
    const state = this.store.snapshot();
    const body = buildWorkspaceBriefing({
      workspaceName: getWorkspaceName(),
      modeTitle: getModeTitle(state.mode),
      presetTitle: getPresetTitle(state.presetId),
      projectTitle: getStudioProjectTitle(state.studioProjectId),
      projectRules: listProjectRulesForProject(state.projectRules, state.studioProjectId),
      knowledgeItems: state.knowledgeItems,
      roadmapNotes: listRoadmapNotes(state.roadmapNotes, state.studioProjectId),
    });
    await openMarkdownPreview("Workspace Briefing", body);
  }

  public async searchKnowledgeCommand(): Promise<void> {
    const query = await vscode.window.showInputBox({
      prompt: "Search Matterhorn knowledge packs",
    });

    if (!query) {
      return;
    }

    const state = this.store.snapshot();
    const results = searchKnowledgeItems(state.knowledgeItems, query);
    const body =
      results.length > 0
        ? results.map((item) => `- ${item.title}\n  ${item.path}\n  ${item.excerpt}`).join("\n")
        : `No knowledge items matched "${query}".`;
    await openMarkdownPreview("Knowledge Search", body);
  }

  public async openReviewCenterCommand(): Promise<void> {
    const state = this.store.snapshot();
    const body =
      state.reviewItems.length > 0
        ? state.reviewItems
            .map((item) => `- ${item.title} (${item.status}${item.stale ? ", stale" : ""}) -> ${item.targetPath}`)
            .join("\n")
        : "No review items yet.";
    await openMarkdownPreview("Review Center", body);
  }

  public async previewReviewItemCommand(): Promise<void> {
    const reviewItem = this.requireActiveReview();
    await openMarkdownPreview(reviewItem.title, reviewItem.previewMarkdown);
  }

  public async showDiffForReviewItemCommand(): Promise<void> {
    const reviewItem = this.requireActiveReview();
    await showReviewDiff(reviewItem);
  }

  public async approveReviewItemCommand(): Promise<void> {
    const reviewItem = this.requireActiveReview();
    await this.store.update((draft) => {
      draft.reviewItems = draft.reviewItems.map((item) =>
        item.id === reviewItem.id ? approveReviewItem(item) : item,
      );
    });
    await this.refreshSidebar();
  }

  public async rejectReviewItemCommand(): Promise<void> {
    const reviewItem = this.requireActiveReview();
    await this.store.update((draft) => {
      draft.reviewItems = draft.reviewItems.map((item) =>
        item.id === reviewItem.id ? rejectReviewItem(item) : item,
      );
    });
    await this.refreshSidebar();
  }

  public async applyApprovedItemCommand(): Promise<void> {
    await this.applyReviewItemToFileCommand();
  }

  public async applyReviewItemToSelectionCommand(): Promise<void> {
    const reviewItem = this.requireActiveReview();
    await this.ensureReviewReadyForApply(reviewItem);
    const editor = requireActiveEditor();
    await applyReviewItemToSelection(editor, reviewItem);
    await this.markReviewItemApplied(reviewItem.id);
  }

  public async applyReviewItemToFileCommand(): Promise<void> {
    const reviewItem = this.requireActiveReview();
    await this.ensureReviewReadyForApply(reviewItem);
    const editor = requireActiveEditor();
    await applyReviewItemToActiveFile(editor, reviewItem);
    await this.markReviewItemApplied(reviewItem.id);
  }

  public async refreshReviewItemAgainstCurrentFileCommand(): Promise<void> {
    const reviewItem = this.requireActiveReview();
    const editor = requireActiveEditor();
    const result = await this.runBackendCommand({
      commandId: "nss.refreshReviewItemAgainstCurrentFile",
      intent: "review-refresh",
      prompt: reviewItem.prompt,
      responseTitle: reviewItem.title,
      responseKind: "proposal",
      activeFile: buildActiveFileSnapshot(editor),
    });

    if (!result) {
      return;
    }

    const refreshed = createReviewItem({
      title: reviewItem.title,
      prompt: reviewItem.prompt,
      targetPath: reviewItem.targetPath,
      originalText: editor.document.getText(),
      responseText: result.record.body,
      proposedText: result.response.proposedText,
      sourceResponseId: result.record.id,
    });

    await this.store.update((draft) => {
      draft.reviewItems = draft.reviewItems.map((item) => (item.id === reviewItem.id ? refreshed : item));
      draft.activeReviewId = refreshed.id;
    });
    await openMarkdownPreview(refreshed.title, refreshed.previewMarkdown);
  }

  public async switchActiveStudioProjectCommand(): Promise<void> {
    const picked = await vscode.window.showQuickPick(
      STUDIO_PROJECTS.map((project) => ({
        label: project.title,
        description: project.description,
        id: project.id,
      })),
      { placeHolder: "Choose the active studio project" },
    );

    if (!picked) {
      return;
    }

    await this.store.update((draft) => {
      draft.studioProjectId = picked.id;
    });
    await this.refreshSidebar();
  }

  public async showStudioDashboardCommand(): Promise<void> {
    const state = this.store.snapshot();
    const body = buildStudioDashboard({
      workspaceName: getWorkspaceName(),
      modeTitle: getModeTitle(state.mode),
      presetTitle: getPresetTitle(state.presetId),
      projectTitle: getStudioProjectTitle(state.studioProjectId),
      taskHistory: state.taskHistory,
      reviewItems: state.reviewItems,
      diagnosticSessions: state.diagnosticSessions,
      roadmapNotes: listRoadmapNotes(state.roadmapNotes, state.studioProjectId),
    });
    await openMarkdownPreview("Studio Dashboard", body);
  }

  public async addRoadmapNoteCommand(): Promise<void> {
    const note = await vscode.window.showInputBox({
      prompt: "Add a roadmap note for the active studio project",
    });

    if (!note) {
      return;
    }

    const state = this.store.snapshot();
    const roadmapNote = createRoadmapNote(state.studioProjectId, note);
    await this.store.update((draft) => {
      draft.roadmapNotes = [roadmapNote, ...draft.roadmapNotes];
    });
  }

  public async showRoadmapNotesForActiveProjectCommand(): Promise<void> {
    const state = this.store.snapshot();
    const notes = listRoadmapNotes(state.roadmapNotes, state.studioProjectId);
    const body = notes.length > 0 ? notes.map((note) => `- ${note.note} (${note.status})`).join("\n") : "No roadmap notes yet.";
    await openMarkdownPreview("Roadmap Notes", body);
  }

  public async whatShouldIWorkOnNextCommand(): Promise<void> {
    const state = this.store.snapshot();
    const suggestion = suggestNextWork({
      reviewItems: state.reviewItems,
      diagnosticSessions: state.diagnosticSessions,
      taskHistory: state.taskHistory,
      roadmapNotes: listRoadmapNotes(state.roadmapNotes, state.studioProjectId),
    });
    await openMarkdownPreview("What Should I Work On Next?", suggestion);
  }

  public async showCrossProjectSummaryCommand(): Promise<void> {
    const state = this.store.snapshot();
    const body = STUDIO_PROJECTS.map((project) => {
      const roadmapCount = state.roadmapNotes.filter((note) => note.projectId === project.id).length;
      const ruleCount = state.projectRules.filter((rule) => rule.projectId === project.id).length;
      return `- ${project.title}: ${project.description} | roadmap ${roadmapCount} | rules ${ruleCount}`;
    }).join("\n");
    await openMarkdownPreview("Cross-Project Summary", body);
  }

  public async suggestStudioProjectForWorkspaceCommand(): Promise<void> {
    const pathHint = vscode.window.activeTextEditor?.document.uri.fsPath ?? getPrimaryWorkspaceFolder()?.uri.fsPath;
    const suggestedProject = inferStudioProjectIdFromPath(pathHint);
    await this.store.update((draft) => {
      draft.studioProjectId = suggestedProject;
    });
    await vscode.window.showInformationMessage(`Suggested studio project: ${getStudioProjectTitle(suggestedProject)}.`);
    await this.refreshSidebar();
  }

  public async showQuickStartCommand(): Promise<void> {
    const body = [
      "1. Ask Matterhorn from the sidebar or command palette.",
      "2. Explain the current file before editing.",
      "3. Search the codebase or find related files.",
      "4. Run a safe workspace task and inspect likely error files.",
      "5. Start a diagnostic session if a task fails.",
      "6. Rebuild knowledge packs and show the workspace briefing.",
      "7. Propose edits, approve them, and use the review center before applying.",
      "8. Use the studio dashboard and roadmap notes to manage cross-project work.",
    ].join("\n");
    await openMarkdownPreview("Matterhorn Quick Start", body);
  }

  public async showBuildFoundationCommand(): Promise<void> {
    const workspaceFolder = getPrimaryWorkspaceFolder();
    if (!workspaceFolder) {
      throw new Error("Open a workspace folder before using the build foundation report.");
    }

    const goal = await vscode.window.showInputBox({
      prompt: "What do you want Matterhorn to help build or plan?",
      placeHolder: "Example: add a reusable auth flow for the workspace",
      ignoreFocusOut: true,
    });

    if (!goal) {
      return;
    }

    const report = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Matterhorn Build Foundation",
        cancellable: false,
      },
      async () => createBuildFoundationReport({ goal, workspaceFolder }),
    );

    await this.saveLocalResponse(
      this.createLocalResponseRecord("Build Foundation", report.markdown, "plan", "nssWorkspaceAi.showBuildFoundation", goal),
    );
    await openMarkdownPreview("Build Foundation", report.markdown);
  }

  public async previewActiveProposal(): Promise<void> {
    const state = this.store.snapshot();
    const reviewItem = this.getActiveReview(state.reviewItems, state.activeReviewId);
    if (!reviewItem) {
      throw new Error("There is no active proposal to preview.");
    }

    await openMarkdownPreview(reviewItem.title, reviewItem.previewMarkdown);
  }

  private async runBackendCommand(options: {
    readonly commandId: string;
    readonly intent: NssAskIntent;
    readonly prompt: string;
    readonly responseTitle: string;
    readonly responseKind: NssResponseKind;
    readonly preferredAgentId?: NssAgentId;
    readonly activeFile?: ReturnType<typeof buildActiveFileSnapshot>;
    readonly project?: { structureSummary?: string };
    readonly task?: {
      readonly commandLine: string;
      readonly exitCode: number | null;
      readonly stderr: string;
      readonly summary: string;
      readonly likelyErrorFiles?: readonly string[];
    };
    readonly codebase?: NssCodebaseContext;
  }): Promise<BackendCommandResult | undefined> {
    const state = this.store.snapshot();
    const workspaceFolder = getPrimaryWorkspaceFolder();
    const lastTask = selectLastTask(state.taskHistory);
    const isStructuralIntent = [
      "propose-multi-file-change",
      "explain-project-structure",
      "change-plan",
      "propose-edit",
      "propose-error-file-fix",
    ].includes(options.intent);
    const needsBuildFoundation = ["change-plan", "propose-multi-file-change", "explain-project-structure"].includes(
      options.intent,
    );

    eventTracker.track("backend_command_start", {
      commandId: options.commandId,
      intent: options.intent,
    });

    try {
      const { record, response } = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Matterhorn is analyzing your repo",
          cancellable: false,
        },
        async (progress) => {
          progress.report({ message: "Searching codebase..." });
          const keywords = extractKeywords(options.prompt);
          const searchResults = await searchCodebaseKeywords(keywords);

          progress.report({ message: "Analyzing schemas..." });
          const schemas = isStructuralIntent ? await discoverProjectSchemas() : [];

          progress.report({ message: "Reading documentation..." });
          const docs = isStructuralIntent ? await discoverProjectDocumentation() : [];

          progress.report({ message: "Mapping dependencies..." });
          const dependencies = await analyzeProjectDependencies();

          progress.report({ message: "Gathering operational context..." });
          const operations = isStructuralIntent ? await discoverOperationalConfig() : [];

          progress.report({ message: "Mapping API endpoints..." });
          const apiRoutes = await discoverApiRoutes();

          progress.report({ message: "Preparing build foundation..." });
          const buildFoundation = needsBuildFoundation
            ? await createBuildFoundationReport({ goal: options.prompt, workspaceFolder })
            : undefined;

          const request = buildAskRequest({
            prompt: options.prompt,
            intent: options.intent,
            workspaceName: getWorkspaceName(),
            workspacePath: workspaceFolder?.uri.fsPath,
            preferredAgentId: options.preferredAgentId,
            mode: state.mode,
            presetId: state.presetId,
            studioProjectId: state.studioProjectId,
            activeFile: options.activeFile,
            project: options.project,
            memory: buildWorkspaceMemoryContext({
              projectRules: state.projectRules,
              repairPatterns: state.repairPatterns,
              recurringFailures: state.recurringFailures,
              persistentMemories: recallRelevantMemories(options.prompt, state.studioProjectId, state.persistentMemories),
              projectId: state.studioProjectId,
            }),
            knowledge: getKnowledgeRequestItems(state.knowledgeItems).map((item) => ({
              title: item.title,
              path: item.path,
              excerpt: item.excerpt,
            })),
            task:
              options.task ??
              (lastTask
                ? {
                    commandLine: lastTask.commandLine,
                    exitCode: lastTask.exitCode,
                    stderr: lastTask.stderr,
                    summary: lastTask.summary,
                    likelyErrorFiles: lastTask.likelyErrorFiles,
                  }
                : undefined),
            codebase: {
              ...(options.codebase ?? {}),
              dependencies,
              apiRoutes,
              schemas,
              docs,
              operations,
            },
            codebaseSearchResults: searchResults,
            build: buildFoundation ? createBuildContext(buildFoundation) : undefined,
            workflow: state.activeWorkflow
              ? {
                  title: state.activeWorkflow.title,
                  currentStep: state.activeWorkflow.steps[state.activeWorkflow.currentStepIndex] ?? "Complete",
                }
              : undefined,
            events: eventTracker.getEvents(),
            appSnapshot: workspaceFolder ? await generateAppSnapshot(workspaceFolder.uri.fsPath) : undefined,
          });

          progress.report({ message: "Consulting AI..." });
          const response = await postAskRequest(getRuntimeConfig(), request);

          const record = this.createResponseRecord(
            options.responseTitle,
            response,
            options.responseKind,
            options.commandId,
            options.prompt,
          );

          return { record, response };
        },
      );

      await this.store.update((draft) => {
        draft.latestResponse = record;
        draft.responseHistory = [record, ...draft.responseHistory];
        draft.serverHealth = this.createServerHealth("online", "Last backend request succeeded.");
      });

      const proposalCount = record.proposedMemories?.length ?? 0;
      if (proposalCount > 0) {
        void vscode.window.setStatusBarMessage(
          `Matterhorn: ${proposalCount} memory proposal${proposalCount === 1 ? "" : "s"} ready to review.`,
          5000,
        );
      }

      this.outputChannel.appendLine(`[${record.createdAt}] ${record.sourceCommand}`);
      this.outputChannel.appendLine(record.body);
      this.outputChannel.appendLine("");

      await this.openSidebar();
      await this.refreshSidebar();
      return { record, response };
    } catch (error) {
      await this.store.update((draft) => {
        draft.serverHealth = this.createServerHealth(
          "offline",
          error instanceof Error ? error.message : "Backend request failed.",
        );
      });

      await this.refreshSidebar();
      await vscode.window.showErrorMessage(
        error instanceof Error ? error.message : "Matterhorn could not reach the backend.",
      );
      return undefined;
    }
  }

  private createResponseRecord(
    fallbackTitle: string,
    response: NssAskResponse,
    kind: NssResponseKind,
    sourceCommand: string,
    prompt?: string,
  ): NssResponseRecord {
    return {
      id: `response-${Date.now()}`,
      title: response.title?.trim() || fallbackTitle,
      body: response.response,
      kind,
      sourceCommand,
      createdAt: new Date().toISOString(),
      prompt,
      proposedText: response.proposedText,
      preview: response.preview,
      proposedMemories: response.proposedMemories?.map((m) => ({
        content: m.content,
        tags: [...m.tags],
      })),
    };
  }

  private createLocalResponseRecord(
    title: string,
    body: string,
    kind: NssResponseKind,
    sourceCommand: string,
    prompt?: string,
  ): NssResponseRecord {
    return {
      id: `response-${Date.now()}`,
      title,
      body,
      kind,
      sourceCommand,
      createdAt: new Date().toISOString(),
      prompt,
    };
  }

  private async approveProposedMemory(
    memory: { content: string; tags: readonly string[] },
    index: number,
  ): Promise<void> {
    const state = this.store.snapshot();
    await this.store.update((draft) => {
      // Add to persistent memories
      draft.persistentMemories = [
        ...draft.persistentMemories,
        {
          id: `mem-${Date.now()}`,
          projectId: state.studioProjectId,
          content: memory.content,
          tags: [...memory.tags],
          importance: 3, // Default importance
          createdAt: new Date().toISOString(),
        },
      ];

      // Remove from proposed in latest response
      if (draft.latestResponse?.proposedMemories) {
        draft.latestResponse = {
          ...draft.latestResponse,
          proposedMemories: draft.latestResponse.proposedMemories.filter((_, i) => i !== index),
        };
      }
    });

    await this.refreshSidebar();
    void vscode.window.showInformationMessage("Matterhorn: Memory saved to project bank.");
  }

  private async editProposedMemory(
    memory: { content: string; tags: readonly string[] },
    index: number,
  ): Promise<void> {
    const updated = await this.promptForMemoryDetails("Edit suggested memory", memory);
    if (!updated) {
      return;
    }

    await this.approveProposedMemory(updated, index);
  }

  private async editMemory(memory: { id?: string; content: string; tags: readonly string[] }): Promise<void> {
    const updated = await this.promptForMemoryDetails("Edit memory", memory);
    if (!updated) {
      return;
    }

    await this.store.update((draft) => {
      draft.persistentMemories = draft.persistentMemories.map((item) =>
        item.id === memory.id || (!memory.id && item.content === memory.content)
          ? {
              ...item,
              content: updated.content,
              tags: [...updated.tags],
            }
          : item,
      );
    });

    await this.refreshSidebar();
    void vscode.window.showInformationMessage("Matterhorn: Memory updated.");
  }

  private async forgetMemory(memory: { id?: string; content: string }): Promise<void> {
    await this.store.update((draft) => {
      draft.persistentMemories = draft.persistentMemories.filter(
        (m) => m.id !== memory.id && m.content !== memory.content,
      );
    });

    await this.refreshSidebar();
    void vscode.window.showInformationMessage("Matterhorn: Memory removed from project bank.");
  }

  private async promptForMemoryDetails(
    title: string,
    memory: { content: string; tags: readonly string[] },
  ): Promise<{ content: string; tags: readonly string[] } | undefined> {
    const content = await vscode.window.showInputBox({
      prompt: `${title} content`,
      value: memory.content,
      ignoreFocusOut: true,
    });

    if (content === undefined) {
      return undefined;
    }

    const tags = await vscode.window.showInputBox({
      prompt: `${title} tags`,
      placeHolder: "Comma-separated tags",
      value: memory.tags.join(", "),
      ignoreFocusOut: true,
    });

    if (tags === undefined) {
      return undefined;
    }

    return {
      content: content.trim(),
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    };
  }

  private async saveLocalResponse(record: NssResponseRecord): Promise<void> {
    await this.store.update((draft) => {
      draft.latestResponse = record;
      draft.responseHistory = [record, ...draft.responseHistory];
    });
    await this.openSidebar();
    await this.refreshSidebar();
  }

  private async queueReviewItems(reviewItems: readonly NssReviewItem[], message?: string): Promise<void> {
    const [firstReviewItem] = reviewItems;
    if (!firstReviewItem) {
      return;
    }

    await this.store.update((draft) => {
      draft.reviewItems = [...reviewItems, ...draft.reviewItems];
      draft.activeReviewId = firstReviewItem.id;
    });

    await openMarkdownPreview(firstReviewItem.title, firstReviewItem.previewMarkdown);
    if (message) {
      await vscode.window.showInformationMessage(message);
    }
    await this.refreshSidebar();
  }

  private createServerHealth(status: NssServerHealth["status"], detail: string): NssServerHealth {
    return {
      status,
      detail,
      checkedAt: new Date().toISOString(),
    };
  }

  private getActiveReview(reviewItems: readonly NssReviewItem[], activeReviewId: string | undefined): NssReviewItem | undefined {
    return selectActiveReview(reviewItems, activeReviewId);
  }

  private requireActiveReview(): NssReviewItem {
    const state = this.store.snapshot();
    const reviewItem = this.getActiveReview(state.reviewItems, state.activeReviewId);
    if (!reviewItem) {
      throw new Error("There is no active review item.");
    }

    return reviewItem;
  }

  private getActiveDiagnosticSession(
    sessions: readonly NssDiagnosticSession[],
    activeSessionId: string | undefined,
  ): NssDiagnosticSession | undefined {
    return selectActiveDiagnosticSession(sessions, activeSessionId);
  }

  private getLastTask(): NssTaskResult | undefined {
    return selectLastTask(this.store.snapshot().taskHistory);
  }

  private async runTaskKind(kind: NssTaskKind): Promise<void> {
    const task = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Matterhorn is analyzing your repo",
      },
      async () => {
        return runWorkspaceTask(kind);
      },
    );

    await this.store.update((draft) => {
      draft.taskHistory = [task, ...draft.taskHistory];

      const activeDiagnostic = this.getActiveDiagnosticSession(draft.diagnosticSessions, draft.activeDiagnosticSessionId);
      if (activeDiagnostic && activeDiagnostic.status === "active") {
        draft.diagnosticSessions = draft.diagnosticSessions.map((session) =>
          session.id === activeDiagnostic.id ? attachTaskToDiagnosticSession(session, task) : session,
        );
      }

      if (task.status === "failed") {
        draft.recurringFailures = [createRecurringFailure(draft.studioProjectId, task.summary), ...draft.recurringFailures];
      }
    });

    await this.saveLocalResponse(
      this.createLocalResponseRecord(
        `Task: ${kind}`,
        explainTaskResult(task),
        "task",
        "nssWorkspaceAi.runWorkspaceTask",
      ),
    );
  }

  private async closeActiveDiagnosticSession(status: "abandoned" | "resolved"): Promise<void> {
    const state = this.store.snapshot();
    const session = this.getActiveDiagnosticSession(state.diagnosticSessions, state.activeDiagnosticSessionId);
    if (!session) {
      throw new Error("There is no active diagnostic session.");
    }

    await this.store.update((draft) => {
      draft.diagnosticSessions = draft.diagnosticSessions.map((item) =>
        item.id === session.id ? closeDiagnosticSession(item, status) : item,
      );
      draft.activeDiagnosticSessionId = undefined;
    });
    await this.refreshSidebar();
  }

  private async ensureReviewReadyForApply(reviewItem: NssReviewItem): Promise<void> {
    if (!canApplyReviewItem(reviewItem)) {
      throw new Error("This review item does not include concrete text to apply.");
    }

    if (reviewItem.status !== "approved") {
      throw new Error("Approve the review item before applying it.");
    }

    const editor = requireActiveEditor();
    const stale = isReviewItemStale(reviewItem, editor.document.getText());
    if (!stale) {
      return;
    }

    await this.store.update((draft) => {
      draft.reviewItems = draft.reviewItems.map((item) =>
        item.id === reviewItem.id ? markReviewItemStale(item, true) : item,
      );
    });

    const confirm = await vscode.window.showWarningMessage(
      "The target file changed since Matterhorn created this review item. Apply anyway?",
      { modal: true },
      "Apply Anyway",
    );

    if (confirm !== "Apply Anyway") {
      throw new Error("Apply cancelled because the review item is stale.");
    }
  }

  private async markReviewItemApplied(reviewId: string): Promise<void> {
    await this.store.update((draft) => {
      draft.reviewItems = markReviewItemAppliedState(draft.reviewItems, reviewId);
    });
    await this.refreshSidebar();
  }

  private async openLikelyErrorFileEditor(): Promise<vscode.TextEditor | undefined> {
    const likelyFiles = await this.resolveLikelyErrorFiles();
    const picked = await vscode.window.showQuickPick(
      likelyFiles.map((file) => ({ label: file })),
      {
        placeHolder: "Choose a likely error file",
      },
    );

    if (!picked) {
      return undefined;
    }

    const document = await vscode.workspace.openTextDocument(picked.label);
    return vscode.window.showTextDocument(document, { preview: false });
  }

  private async resolveLikelyErrorFiles(): Promise<string[]> {
    const lastTask = this.getLastTask();
    if (!lastTask) {
      throw new Error("No workspace task has been run yet.");
    }

    const likelyFiles =
      lastTask.likelyErrorFiles.length > 0
        ? [...lastTask.likelyErrorFiles]
        : await findLikelyErrorFilesFromOutput(`${lastTask.stderr}\n${lastTask.stdout}`);

    if (likelyFiles.length === 0) {
      throw new Error("Matterhorn could not identify likely error files from the last task output.");
    }

    return likelyFiles;
  }

  private getWritableResponseText(response: NssResponseRecord): string {
    return extractCodeFence(response.body) ?? response.body;
  }
}

async function probeWorkspaceServerHealth(): Promise<NssServerHealth> {
  const deadline = Date.now() + 5_000;
  let lastHealth: NssServerHealth | undefined;

  while (Date.now() < deadline) {
    const config = getRuntimeConfig();
    const health = await probeServerHealth(config.serverUrl);
    lastHealth = health;

    if (health.status === "online" || config.serverUrlSource === "configured") {
      return health;
    }

    await delay(200);
  }

  return (
    lastHealth ?? {
      status: "offline",
      detail: "Backend health probe timed out before the workspace server became available.",
      checkedAt: new Date().toISOString(),
    }
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const store = new NssStateStore(context);
  const controller = new NssWorkspaceAiController(store);
  const sidebarProvider = new NssSidebarProvider(context.extensionUri, controller);
  controller.bindSidebar(sidebarProvider);

  context.subscriptions.push(
    controller,
    vscode.window.registerWebviewViewProvider("nssWorkspaceAi.sidebar", sidebarProvider),
    vscode.window.onDidChangeActiveTextEditor(() => {
      void controller.refreshSidebar();
    }),
    vscode.window.onDidChangeTextEditorSelection(() => {
      void controller.refreshSidebar();
    }),
  );

  await controller.initialize();
  registerNssCommands(context, controller);
  registerMemoryCommands(context, store);
  registerDebugCommands(context, controller);
  await controller.refreshSidebar();
}

export async function deactivate(): Promise<void> {}
