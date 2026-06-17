import * as vscode from "vscode";

import type { NssAgentId } from "../models/agent.types.js";
import type { NssSidebarViewModel } from "../models/sidebar.types.js";
import { renderSidebarTemplate } from "./webview/template.js";

export interface NssSidebarActionMessage {
  readonly command: string;
  readonly prompt?: string;
  readonly agentId?: NssAgentId;
  readonly memory?: {
    readonly id?: string;
    readonly content: string;
    readonly tags: readonly string[];
  };
  readonly index?: number;
  readonly path?: string;
}

export interface NssSidebarHost {
  getSidebarViewModel(): Promise<NssSidebarViewModel>;
  handleSidebarAction(message: NssSidebarActionMessage): Promise<void>;
}

export class NssSidebarProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;

  public constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly host: NssSidebarHost,
  ) {}

  public async resolveWebviewView(webviewView: vscode.WebviewView): Promise<void> {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "src", "sidebar", "webview")],
    };
    webviewView.webview.html = renderSidebarTemplate(webviewView.webview, this.extensionUri);

    webviewView.webview.onDidReceiveMessage(async (message: { type?: string } & NssSidebarActionMessage) => {
      if (message.type === "ready") {
        await this.refresh();
        return;
      }

      if (message.type === "action") {
        await this.host.handleSidebarAction(message);
      }
    });
  }

  public async refresh(): Promise<void> {
    if (!this.view) {
      return;
    }

    await this.view.webview.postMessage({
      type: "state",
      payload: await this.host.getSidebarViewModel(),
    });
  }

  public async postSearchResults(results: readonly { path: string; content: string; score: number }[]): Promise<void> {
    if (!this.view) {
      return;
    }

    await this.view.webview.postMessage({
      type: "search-results",
      payload: { results },
    });
  }

  public async reveal(): Promise<void> {
    await vscode.commands.executeCommand("workbench.view.extension.nssWorkspaceAi");
    if (this.view) {
      this.view.show?.(true);
      await this.refresh();
    }
  }
}
