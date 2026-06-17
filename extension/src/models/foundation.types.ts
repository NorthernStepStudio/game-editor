export type NssWorkspaceKind = "api" | "fullstack" | "package" | "web" | "worker" | "unknown";
export type NssBuildScope = "feature" | "migration" | "package" | "workspace" | "app";

export interface NssWorkspacePackageCapability {
  readonly path: string;
  readonly name: string;
  readonly kind: NssWorkspaceKind;
  readonly frameworks: readonly string[];
  readonly runtimes: readonly string[];
  readonly testTools: readonly string[];
  readonly databases: readonly string[];
  readonly buildScripts: readonly string[];
}

export interface NssWorkspaceCapabilityProfile {
  readonly workspaceName: string;
  readonly workspacePath?: string;
  readonly packageCount: number;
  readonly primaryKind: NssWorkspaceKind;
  readonly detectedKinds: readonly NssWorkspaceKind[];
  readonly frameworks: readonly string[];
  readonly runtimes: readonly string[];
  readonly databases: readonly string[];
  readonly testTools: readonly string[];
  readonly packageCapabilities: readonly NssWorkspacePackageCapability[];
  readonly dependencyGraph: readonly {
    readonly app: string;
    readonly dependencies: readonly string[];
    readonly internalLinks: readonly string[];
  }[];
  readonly summary: string;
}

export interface NssBuildSpec {
  readonly goal: string;
  readonly scope: NssBuildScope;
  readonly target: string;
  readonly focusAreas: readonly string[];
  readonly acceptanceCriteria: readonly string[];
  readonly constraints: readonly string[];
}

export interface NssTemplateSuggestion {
  readonly id: "api-service" | "fullstack-app" | "shared-package" | "web-app" | "worker" | "custom";
  readonly title: string;
  readonly description: string;
  readonly rationale: string;
}

export interface NssBuildPlan {
  readonly title: string;
  readonly summary: string;
  readonly template: NssTemplateSuggestion;
  readonly steps: readonly string[];
  readonly validation: readonly string[];
  readonly rollback: readonly string[];
  readonly memoryCandidates: readonly string[];
  readonly impactedPackages: readonly string[];
}

export interface NssBuildFoundationReport {
  readonly goal: string;
  readonly capabilityProfile: NssWorkspaceCapabilityProfile;
  readonly buildSpec: NssBuildSpec;
  readonly plan: NssBuildPlan;
  readonly relatedFiles: readonly {
    readonly path: string;
    readonly content: string;
    readonly score: number;
  }[];
  readonly markdown: string;
}
