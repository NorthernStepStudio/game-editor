import { existsSync, readFileSync } from "node:fs";

const required = [
  ["AGENTS.md", [".agents/STARTUP.md", "npm run agent:start", "integration/**"]],
  [".agents/STARTUP.md", ["CI budget rule", "integration/**", "reuse → integrate → customize → build only when needed"]],
  [".agents/rules/00-matterhorn-startup.md", ["trigger: always_on", "npm run agent:start"]],
  [".cursor/rules/00-matterhorn-startup.mdc", ["alwaysApply: true", "npm run agent:start"]],
  ["CLAUDE.md", ["AGENTS.md", ".agents/STARTUP.md", "npm run agent:start"]],
  ["GEMINI.md", ["AGENTS.md", ".agents/STARTUP.md", "npm run agent:start"]],
  [".github/copilot-instructions.md", ["AGENTS.md", ".agents/STARTUP.md", "integration/**"]],
  ["tools/agent-startup.mjs", ["MATTERHORN_INTENTIONAL_CI", "feat/", "integration/**"]],
];

const failures = [];

for (const [path, needles] of required) {
  if (!existsSync(path)) {
    failures.push(`Missing required agent startup file: ${path}`);
    continue;
  }
  const content = readFileSync(path, "utf8");
  for (const needle of needles) {
    if (!content.includes(needle)) {
      failures.push(`${path} is missing required startup contract text: ${needle}`);
    }
  }
}

if (failures.length) {
  console.error("Matterhorn agent startup contract FAILED:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Matterhorn agent startup contract PASS");
