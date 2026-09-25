import type {
  MatterhornToolCall,
  MatterhornToolExecutor,
  MatterhornToolResult,
} from "../../../core/out/index.js";
import type { StudioProject } from "./studioService.js";
import {
  listWorkspaceFiles,
  readWorkspaceFile,
  searchWorkspace,
} from "../workspace/files.js";
import { projectRoot } from "../workspace/paths.js";

export function createIntelligenceWorkspaceTools(
  projects: readonly StudioProject[],
  projectId: string,
): MatterhornToolExecutor {
  const root = projectRoot(projects, projectId);

  return {
    tools: [
      {
        name: "list_files",
        description:
          "List safe source/text files in the selected Matterhorn project.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        risk: "read",
      },
      {
        name: "read_file",
        description:
          "Read one safe UTF-8 source/text file from the selected Matterhorn project.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Project-relative file path.",
            },
          },
          required: ["path"],
          additionalProperties: false,
        },
        risk: "read",
      },
      {
        name: "search_files",
        description:
          "Search safe source/text files in the selected Matterhorn project.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Text to search for.",
            },
          },
          required: ["query"],
          additionalProperties: false,
        },
        risk: "read",
      },
    ],

    async execute(call: MatterhornToolCall): Promise<MatterhornToolResult> {
      try {
        switch (call.name) {
          case "list_files": {
            assertNoUnexpectedArgs(call, []);
            const listing = listWorkspaceFiles(root);
            return success(call, listing);
          }
          case "read_file": {
            const path = stringArg(call, "path", 500);
            assertNoUnexpectedArgs(call, ["path"]);
            const file = readWorkspaceFile(root, path);
            return success(call, file);
          }
          case "search_files": {
            const query = stringArg(call, "query", 200);
            assertNoUnexpectedArgs(call, ["query"]);
            return success(call, searchWorkspace(root, query));
          }
          default:
            return {
              callId: call.id,
              name: call.name,
              ok: false,
              error: "Unknown workspace tool.",
            };
        }
      } catch (error) {
        return {
          callId: call.id,
          name: call.name,
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Workspace tool failed.",
        };
      }
    },
  };
}

function success(
  call: MatterhornToolCall,
  output: unknown,
): MatterhornToolResult {
  return {
    callId: call.id,
    name: call.name,
    ok: true,
    output,
  };
}

function stringArg(
  call: MatterhornToolCall,
  name: string,
  maxLength: number,
): string {
  const value = call.args[name];
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > maxLength
  ) {
    throw new Error(
      `Tool ${call.name} requires a non-empty ${name} string up to ${maxLength} characters.`,
    );
  }
  return value;
}

function assertNoUnexpectedArgs(
  call: MatterhornToolCall,
  allowed: readonly string[],
): void {
  const allowedSet = new Set(allowed);
  const unexpected = Object.keys(call.args).filter(
    (key) => !allowedSet.has(key),
  );
  if (unexpected.length) {
    throw new Error(
      `Tool ${call.name} received unsupported arguments: ${unexpected.join(", ")}.`,
    );
  }
}
