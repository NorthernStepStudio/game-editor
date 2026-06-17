import * as vscode from "vscode";

import {
  DEFAULT_BACKEND_URL,
  DEFAULT_MAX_DIAGNOSTIC_SESSION_HISTORY,
  DEFAULT_MAX_REVIEW_HISTORY,
  DEFAULT_MODE,
} from "../config/defaults.js";
import type { NssModeId } from "../models/mode.types.js";
import { getPrimaryWorkspaceFolder } from "./workspace.js";
import { resolveServerUrl, type ServerUrlSource } from "./serverUrl.js";

export interface NssRuntimeConfig {
  readonly serverUrl: string;
  readonly serverUrlSource: ServerUrlSource;
  readonly defaultMode: NssModeId;
  readonly autoSuggestPresetForWorkspace: boolean;
  readonly maxReviewHistory: number;
  readonly maxDiagnosticSessionHistory: number;
}

export function getRuntimeConfig(): NssRuntimeConfig {
  const config = vscode.workspace.getConfiguration("nssWorkspaceAi");
  const resolvedServerUrl = resolveServerUrl({
    configuredServerUrl: config.get<string>("serverUrl", DEFAULT_BACKEND_URL),
    workspaceRoot: getPrimaryWorkspaceFolder()?.uri.fsPath,
    defaultServerUrl: DEFAULT_BACKEND_URL,
  });

  return {
    serverUrl: resolvedServerUrl.serverUrl,
    serverUrlSource: resolvedServerUrl.source,
    defaultMode: config.get<NssModeId>("defaultMode", DEFAULT_MODE),
    autoSuggestPresetForWorkspace: config.get<boolean>("autoSuggestPresetForWorkspace", true),
    maxReviewHistory: config.get<number>("maxReviewHistory", DEFAULT_MAX_REVIEW_HISTORY),
    maxDiagnosticSessionHistory: config.get<number>(
      "maxDiagnosticSessionHistory",
      DEFAULT_MAX_DIAGNOSTIC_SESSION_HISTORY,
    ),
  };
}
