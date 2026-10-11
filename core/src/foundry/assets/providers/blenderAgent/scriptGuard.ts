/**
 * Static guard for model-authored Blender Python.
 *
 * Model scripts may only build scene content with bpy/bmesh/mathutils and pure
 * math helpers. File, process, network, import-machinery and introspection
 * escapes are rejected before Blender starts. The harness adds a second layer
 * (restricted builtins and import allowlist) at execution time. This is a guard,
 * not a VM: it narrows what a well-meaning model can do by accident and blocks
 * the obvious escape routes; it is not a hostile-code sandbox.
 */

export const BLENDER_AGENT_ALLOWED_MODULES = [
  "bpy",
  "bmesh",
  "mathutils",
  "math",
  "random",
  "colorsys",
] as const;

const MAX_SCRIPT_BYTES = 200_000;

const FORBIDDEN_PATTERNS: readonly (readonly [RegExp, string])[] = [
  [/__(?:class|bases|base|mro|subclasses|globals|builtins|dict|code|func|self|closure|getattribute|getattr|setattr|delattr|import|loader|spec|reduce|reduce_ex|module|qualname|traceback|frame|f_\w+|gi_\w+|cr_\w+)__/, "introspection names are not allowed"],
  [/(?:f_globals|f_locals|f_back|gi_frame|cr_frame|tb_frame|co_code)/, "frame/code introspection is not allowed"],
  [/\b(?:eval|exec|compile|open|input|breakpoint|globals|locals|vars|getattr|setattr|delattr|memoryview)\s*\(/, "builtin escape hatch"],
  [/\bbpy\s*\.\s*ops\s*\.\s*(?:wm|export_scene|import_scene|export_mesh|import_mesh|script|preferences|file|text|render\s*\.\s*render)\b/, "file, script or render operators are reserved for the harness"],
  [/\bbpy\s*\.\s*(?:app\s*\.\s*handlers|utils|context\s*\.\s*preferences)\b/, "handlers, utils and preferences are reserved"],
  [/\bbpy\s*\.\s*data\s*\.\s*(?:texts|libraries)\b/, "text blocks and linked libraries are reserved"],
  [/\.\s*(?:filepath|filepath_raw|directory)\s*=/, "assigning file paths is reserved for the harness"],
  [/\bbpy\s*\.\s*data\s*\.\s*images\s*\.\s*load\b/, "loading external images is not allowed"],
];

export interface BlenderScriptGuardResult {
  readonly ok: boolean;
  readonly problems: readonly string[];
}

export function guardBlenderAgentScript(source: string): BlenderScriptGuardResult {
  const problems: string[] = [];
  if (!source.trim()) problems.push("Script is empty.");
  if (Buffer.byteLength(source, "utf8") > MAX_SCRIPT_BYTES) {
    problems.push(`Script exceeds ${MAX_SCRIPT_BYTES} bytes.`);
  }

  const allowed = new Set<string>(BLENDER_AGENT_ALLOWED_MODULES);
  const lines = source.split(/\r?\n/);
  lines.forEach((line, index) => {
    const code = stripComment(line);
    // Check every ';'-separated statement so "x = 1; import os" cannot slip through.
    for (const statement of code.split(";")) {
      const importMatch = /^\s*import\s+(.+)$/.exec(statement);
      if (importMatch) {
        for (const part of importMatch[1].split(",")) {
          const root = part.trim().split(/\s+as\s+/)[0].split(".")[0].trim();
          if (root && !allowed.has(root)) problems.push(`line ${index + 1}: import of '${root}' is not allowed`);
        }
      }
      const fromMatch = /^\s*from\s+([\w.]+)\s+import\b/.exec(statement);
      if (fromMatch) {
        const root = fromMatch[1].split(".")[0];
        if (!allowed.has(root)) problems.push(`line ${index + 1}: import from '${root}' is not allowed`);
      }
    }
    for (const [pattern, reason] of FORBIDDEN_PATTERNS) {
      if (pattern.test(code)) problems.push(`line ${index + 1}: ${reason}`);
    }
  });

  return { ok: problems.length === 0, problems: problems.slice(0, 20) };
}

/** Extracts the Python body from a model reply that may wrap it in a fenced block. */
export function extractPythonScript(reply: string): string {
  const fenced = /```(?:python|py)?\s*\r?\n([\s\S]*?)```/i.exec(reply);
  return (fenced ? fenced[1] : reply).trim() + "\n";
}

function stripComment(line: string): string {
  // Good enough for guarding: '#' inside string literals only makes the check stricter
  // when the remainder would have matched, never looser.
  let quote: string | undefined;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = undefined;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (ch === "#") {
      return line.slice(0, i);
    }
  }
  return line;
}
