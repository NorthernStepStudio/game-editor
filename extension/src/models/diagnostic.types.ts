export type NssDiagnosticStatus = "abandoned" | "active" | "resolved";

export interface NssDiagnosticSession {
  readonly id: string;
  readonly title: string;
  readonly status: NssDiagnosticStatus;
  readonly summary: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly taskIds: readonly string[];
  readonly notes: readonly string[];
}
