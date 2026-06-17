import type { NssTaskResult } from "../../models/task.types.js";

export function suggestFixesForTaskFailure(task: NssTaskResult): string[] {
  const output = `${task.stderr}\n${task.stdout}`;
  const fixes: string[] = [];

  if (/cannot find module|ts2307/i.test(output)) {
    fixes.push("Check the import path casing and whether the target package or file exists.");
  }

  if (/property .* does not exist|ts2339/i.test(output)) {
    fixes.push("Inspect the referenced type or object shape and align the access with the current TypeScript definition.");
  }

  if (/eslint|lint/i.test(output)) {
    fixes.push("Open the reported lint target and fix the first concrete lint error before rerunning.");
  }

  if (/test failed|expect\(/i.test(output)) {
    fixes.push("Re-run the failing test locally with focused logging and compare the expected and actual values.");
  }

  if (fixes.length === 0) {
    fixes.push("Open the first likely error file and inspect the first concrete stack trace or compiler error near that location.");
  }

  return fixes;
}
