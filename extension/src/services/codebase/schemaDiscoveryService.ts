import * as vscode from "vscode";

import { truncateText } from "../../helpers/text.js";

/**
 * Service to discover and summarize database and API schemas.
 * This provides the AI with "eyes" on the project's data layer.
 */
export async function discoverProjectSchemas(): Promise<{ path: string; summary: string }[]> {
  const schemas: { path: string; summary: string }[] = [];

  // Patterns for finding schema files
  const schemaPatterns = [
    "**/prisma/schema.prisma",
    "**/src/db/schema.ts", // Drizzle or similar
    "**/db/*.sql",
    "**/apps/*/wrangler.toml", // Cloudflare D1/KV info
  ];

  for (const pattern of schemaPatterns) {
    try {
      const uris = await vscode.workspace.findFiles(pattern, "**/node_modules/**", 5);
      
      for (const uri of uris) {
        const doc = await vscode.workspace.openTextDocument(uri);
        const text = doc.getText();
        const relPath = vscode.workspace.asRelativePath(uri);

        // Basic summarization: keep the main structure
        // For Prisma, we keep models. For SQL, we keep CREATE TABLE statements.
        let summary = text;
        if (uri.fsPath.endsWith(".prisma")) {
          summary = summarizePrismaSchema(text);
        } else if (uri.fsPath.endsWith(".sql")) {
          summary = summarizeSqlSchema(text);
        }

        schemas.push({
          path: relPath,
          summary: truncateText(summary, 2000),
        });
      }
    } catch (err) {
      console.error(`Matterhorn: Schema discovery failed for ${pattern}`, err);
    }
  }

  return schemas;
}

function summarizePrismaSchema(text: string): string {
  // Keep model, enum, datasource, and specifically RELATIONSHIPS
  const lines = text.split("\n");
  const summarized: string[] = [];
  let inBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("model ") || trimmed.startsWith("enum ") || trimmed.startsWith("datasource ") || trimmed.startsWith("generator ")) {
      inBlock = true;
    }

    if (inBlock) {
      // Keep only lines that define the structure or relationships
      if (trimmed.includes("@id") || trimmed.includes("@unique") || trimmed.includes("@relation") || trimmed.includes("model ") || trimmed.startsWith("}")) {
        summarized.push(line);
      } else if (!trimmed.startsWith("@@") && trimmed.length > 0) {
        // Keep standard fields too but omit most attributes if they aren't crucial for relationships
        summarized.push(line);
      }
    }

    if (trimmed.startsWith("}")) {
      inBlock = false;
      summarized.push(""); 
    }
  }

  return summarized.join("\n").trim() || text;
}

function summarizeSqlSchema(text: string): string {
  // Keep CREATE TABLE and CREATE VIEW statements
  const lines = text.split("\n");
  const summarized: string[] = [];
  let inCreate = false;

  for (const line of lines) {
    const trimmed = line.trim().toUpperCase();
    if (trimmed.startsWith("CREATE TABLE") || trimmed.startsWith("CREATE VIEW") || trimmed.startsWith("ALTER TABLE")) {
      inCreate = true;
    }

    if (inCreate) {
      summarized.push(line);
    }

    if (trimmed.endsWith(";")) {
      inCreate = false;
      summarized.push("");
    }
  }

  return summarized.join("\n").trim() || text;
}
