import { readFile } from "node:fs/promises";

const DEEPEVAL_VERSION = "0.9.21";

async function loadDeepEval() {
  const [{ GEval }, { LLMTestCase, SingleTurnParams }] = await Promise.all([
    import("deepeval/metrics"),
    import("deepeval/test-case"),
  ]);
  return { GEval, LLMTestCase, SingleTurnParams };
}

if (process.argv.includes("--health")) {
  try {
    await loadDeepEval();
    process.stdout.write(JSON.stringify({
      ok: true,
      engine: "Matterhorn Agent Validation",
      version: DEEPEVAL_VERSION,
    }));
  } catch (error) {
    process.stderr.write(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
} else {
  try {
    const inputText = await readFile(0, "utf8");
    const input = JSON.parse(inputText);
    const threshold = typeof input.threshold === "number" ? input.threshold : 0.7;
    const extraCriteria = Array.isArray(input.criteria) && input.criteria.length
      ? "\nAdditional acceptance criteria:\n- " + input.criteria.join("\n- ")
      : "";

    const { GEval, LLMTestCase, SingleTurnParams } = await loadDeepEval();
    const options = {
      name: "Matterhorn Agent Validation",
      criteria:
        "Judge whether the actual outcome meaningfully accomplishes the requested goal. " +
        "Be strict about unsupported claims. This score is advisory and must never override " +
        "Matterhorn deterministic evidence, runtime, physics, safety, or Sentinel gates." +
        extraCriteria,
      evaluationParams: [SingleTurnParams.INPUT, SingleTurnParams.ACTUAL_OUTPUT],
      threshold,
      showIndicator: false,
    };
    if (process.env.MATTERHORN_EVAL_MODEL) options.model = process.env.MATTERHORN_EVAL_MODEL;

    const metric = new GEval(options);
    const testCase = new LLMTestCase({
      input: input.goal,
      actualOutput: input.outcome,
    });
    const score = await metric.measure(testCase);

    process.stdout.write(JSON.stringify({
      passed: typeof metric.success === "boolean" ? metric.success : score >= threshold,
      score,
      reason: metric.reason ?? undefined,
      metric: "Matterhorn Agent Validation",
    }));
  } catch (error) {
    process.stderr.write(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  }
}
