export type NssIdeToolName =
  | "list_files"
  | "read_file"
  | "write_file"
  | "edit_file"
  | "search_files"
  | "run_terminal"
  | "get_diagnostics";

export interface NssIdeToolSpec {
  readonly name: NssIdeToolName;
  readonly description: string;
  readonly parameters: Record<string, string>;
}

export interface NssIdeToolContext {
  readonly protocol: string;
  readonly tools: readonly NssIdeToolSpec[];
}

export interface NssIdeToolCall {
  readonly name: NssIdeToolName;
  readonly args?: Record<string, unknown>;
}

export interface NssIdeToolResult {
  readonly name: NssIdeToolName;
  readonly ok: boolean;
  readonly result?: unknown;
  readonly error?: string;
}
