export interface NssSidebarQuickAction {
  readonly command: string;
  readonly label: string;
}

export interface NssSidebarViewModel {
  readonly title: string;
  readonly workspaceName: string;
  readonly serverStatus: string;
  readonly serverMode: string;
  readonly serverDetail: string;
  readonly modeTitle: string;
  readonly presetTitle: string;
  readonly studioProjectTitle: string;
  readonly workspaceFiles?: readonly string[];
  readonly responseHistory?: readonly {
    readonly id: string;
    readonly title: string;
    readonly body: string;
    readonly createdAt: string;
    readonly prompt?: string;
    readonly kind: string;
    readonly proposedMemories?: readonly {
      readonly content: string;
      readonly tags: readonly string[];
    }[];
  }[];
  readonly activeConversationId?: string;
  readonly conversations?: readonly {
    readonly id: string;
    readonly title: string;
    readonly updatedAt: string;
    readonly messageCount: number;
    readonly excerpt?: string;
  }[];
  readonly activeConversation?: {
    readonly id: string;
    readonly title: string;
    readonly updatedAt: string;
    readonly messages: readonly {
      readonly id: string;
      readonly role: "user" | "assistant" | "tool";
      readonly content: string;
      readonly createdAt: string;
      readonly responseId?: string;
    }[];
  };
  readonly localOllamaModels?: readonly string[];
  readonly localLmStudioModels?: readonly string[];
  readonly currentFilePath?: string;
  readonly currentSelectionPreview?: string;
  readonly latestResponse?: {
    readonly id: string;
    readonly title: string;
    readonly body: string;
    readonly excerpt: string;
    readonly createdAt: string;
    readonly kind: string;
    readonly proposedMemories?: readonly {
      readonly content: string;
      readonly tags: readonly string[];
    }[];
  };
  readonly activeProposal?: {
    readonly title: string;
    readonly summary: string;
    readonly targetPath: string;
    readonly canApply: boolean;
  };
  readonly lastTask?: {
    readonly label: string;
    readonly status: string;
    readonly summary: string;
  };
  readonly activeWorkflow?: {
    readonly title: string;
    readonly step: string;
  };
  readonly activeDiagnostic?: {
    readonly title: string;
    readonly status: string;
  };
  readonly reviewCounts: {
    readonly pending: number;
    readonly approved: number;
  };
  readonly persistentMemories: readonly {
    readonly id: string;
    readonly content: string;
    readonly tags: readonly string[];
  }[];
  readonly quickActions: readonly NssSidebarQuickAction[];
}
