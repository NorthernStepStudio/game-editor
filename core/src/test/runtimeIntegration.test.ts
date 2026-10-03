import { test } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MatterhornLocalAgentEvaluationAdapter } from "../integrations/localAgentEvaluationAdapter.js";
import { MatterhornLocalBrowserAdapter } from "../integrations/localBrowserAdapter.js";
import { MatterhornProjectMemoryGraphAdapter } from "../integrations/projectMemoryGraphAdapter.js";
import { MatterhornOciSafeExecutionAdapter } from "../integrations/ociSafeExecutionAdapter.js";
import { MatterhornOtlpRunInsightsAdapter } from "../integrations/otlpRunInsightsAdapter.js";
import {
  MatterhornRuntimeCapabilityRegistry,
  type MatterhornBrowserAdapter,
} from "../integrations/runtimeCapabilities.js";

test("public runtime status keeps upstream engine identity out of Matterhorn UI data", async () => {
  const registry = new MatterhornRuntimeCapabilityRegistry();
  const adapter: MatterhornBrowserAdapter = {
    id: "matterhorn.test-browser",
    capability: "browser-control",
    attribution: {
      sourceProject: "Browser Harness JS",
      sourceUrl: "https://github.com/browser-use/browser-harness-js",
      license: "MIT",
    },
    health: async () => ({ state: "ready", diagnosticDetail: "Browser Harness JS is healthy." }),
    connect: async () => undefined,
    listTabs: async () => [],
    useTab: async () => undefined,
    navigate: async () => undefined,
    getTitle: async () => "",
    captureScreenshot: async () => "",
  };
  registry.register(adapter);

  const publicStatus = await registry.publicStatus();
  assert.equal(publicStatus.find(item => item.capability === "browser-control")?.title, "Local browser");
  assert.equal(publicStatus.find(item => item.capability === "browser-control")?.state, "ready");
  assert(!JSON.stringify(publicStatus).includes("Browser Harness"));

  const diagnostics = await registry.diagnostics();
  assert.equal(diagnostics[0].attribution?.sourceProject, "Browser Harness JS");
});

test("local browser adapter refuses non-loopback bridges", () => {
  assert.throws(
    () => new MatterhornLocalBrowserAdapter({ baseUrl: "http://192.168.1.20:9876/" }),
    /loopback/i,
  );
  assert.throws(
    () => new MatterhornLocalBrowserAdapter({ baseUrl: "https://127.0.0.1:9876/" }),
    /HTTP on loopback/i,
  );
});

test("local browser adapter maps the upstream bridge into Matterhorn browser operations", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; method: string; body: string }> = [];
  const responses = [
    JSON.stringify({ ok: true, connected: true }),
    "true",
    JSON.stringify([{ targetId: "tab-1", title: "Matterhorn", url: "https://example.com", type: "page" }]),
    "true",
    "true",
    "Matterhorn",
    "aGVsbG8=",
  ];

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({
      url: String(input),
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? init.body : "",
    });
    const body = responses.shift();
    if (body === undefined) throw new Error("Unexpected fetch.");
    return new Response(body, { status: 200 });
  }) as typeof fetch;

  try {
    const adapter = new MatterhornLocalBrowserAdapter({ requestTimeoutMs: 1000 });
    assert.equal((await adapter.health()).state, "ready");
    await adapter.connect();
    const tabs = await adapter.listTabs();
    assert.equal(tabs[0].targetId, "tab-1");
    await adapter.useTab("tab-1");
    await adapter.navigate("https://example.com/path");
    assert.equal(await adapter.getTitle(), "Matterhorn");
    assert.equal(await adapter.captureScreenshot(), "aGVsbG8=");

    assert.equal(requests[0].url, "http://127.0.0.1:9876/health");
    assert(requests.some(request => request.body.includes("session.connect")));
    assert(requests.some(request => request.body.includes("Page.navigate")));
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("project-memory adapter keeps project scope and temporal fact fields behind Matterhorn types", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; method: string; body: string }> = [];

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? init.body : "";
    requests.push({ url, method, body });

    if (url.endsWith("/healthcheck")) return new Response(JSON.stringify({ status: "healthy" }), { status: 200 });
    if (url.endsWith("/messages")) return new Response(JSON.stringify({ success: true }), { status: 202 });
    if (url.endsWith("/search")) {
      return new Response(JSON.stringify({
        facts: [{
          uuid: "fact-1",
          name: "branch",
          fact: "Current branch is integration/oss-acceleration-20261003",
          valid_at: "2026-10-03T15:00:00.000Z",
          invalid_at: null,
          created_at: "2026-10-03T15:01:00.000Z",
          expired_at: null,
          source_node_uuid: "source",
          target_node_uuid: "target",
          episodes: ["episode-1"],
        }],
      }), { status: 200 });
    }
    if (url.includes("/group/")) return new Response(JSON.stringify({ success: true }), { status: 200 });
    throw new Error(`Unexpected request: ${method} ${url}`);
  }) as typeof fetch;

  try {
    const adapter = new MatterhornProjectMemoryGraphAdapter({ requestTimeoutMs: 1000 });
    assert.equal((await adapter.health()).state, "ready");

    await adapter.remember({
      projectId: "matterhorn",
      content: "Use integration branches for iterative work.",
      source: "agent-startup",
      timestamp: "2026-10-03T15:00:00Z",
    });
    const messageBody = JSON.parse(requests.find(request => request.url.endsWith("/messages"))!.body);
    assert.equal(messageBody.group_id, "matterhorn-project-matterhorn");
    assert.equal(messageBody.messages[0].source_description, "agent-startup");

    const facts = await adapter.search({ projectId: "matterhorn", query: "current branch", maxFacts: 5 });
    assert.equal(facts.length, 1);
    assert.equal(facts[0].id, "fact-1");
    assert.equal(facts[0].validAt, "2026-10-03T15:00:00.000Z");

    const searchBody = JSON.parse(requests.find(request => request.url.endsWith("/search"))!.body);
    assert.deepEqual(searchBody.group_ids, ["matterhorn-project-matterhorn"]);

    await adapter.forgetProject("matterhorn");
    assert(requests.some(request => request.url.endsWith("/group/matterhorn-project-matterhorn")));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("project-memory adapter refuses remote endpoints by default", () => {
  assert.throws(
    () => new MatterhornProjectMemoryGraphAdapter({ baseUrl: "https://memory.example.com/" }),
    /loopback/i,
  );
});

test("agent-evaluation adapter validates a local sidecar result without owning completion", async () => {
  const root = await mkdtemp(join(tmpdir(), "matterhorn-eval-"));
  const runner = join(root, "runner.mjs");
  const runnerSource = [
    'if (process.argv.includes("--health")) {',
    '  process.stdout.write(JSON.stringify({ ok: true, engine: "Matterhorn Agent Validation", version: "test" }));',
    '} else {',
    '  let raw = "";',
    '  for await (const chunk of process.stdin) raw += chunk;',
    '  const input = JSON.parse(raw);',
    '  process.stdout.write(JSON.stringify({',
    '    passed: input.goal.includes("ship"),',
    '    score: 0.82,',
    '    reason: "Advisory only.",',
    '    metric: "Matterhorn Agent Validation"',
    '  }));',
    '}',
  ].join("\n");
  await writeFile(runner, runnerSource, "utf8");

  try {
    const adapter = new MatterhornLocalAgentEvaluationAdapter({
      runnerPath: runner,
      timeoutMs: 1000,
    });
    assert.equal((await adapter.health()).state, "ready");
    const result = await adapter.evaluate({
      goal: "ship the feature",
      outcome: "implemented with evidence",
      criteria: ["deterministic checks remain authoritative"],
    });
    assert.equal(result.passed, true);
    assert.equal(result.score, 0.82);
    assert.equal(result.metric, "Matterhorn Agent Validation");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});


test("Run Insights exports Matterhorn events as standard OTLP without leaking backend identity", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; headers: Headers; body: any }> = [];

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({
      url: String(input),
      headers: new Headers(init?.headers),
      body: JSON.parse(typeof init?.body === "string" ? init.body : "{}"),
    });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  try {
    const adapter = new MatterhornOtlpRunInsightsAdapter({
      endpoint: "https://telemetry.example.com/api/public/otel/v1/traces",
      authorization: "Basic test-token",
      requestTimeoutMs: 1000,
      serviceVersion: "0.1.0-test",
    });

    assert.equal((await adapter.health()).state, "ready");
    await adapter.recordStudioEvent({
      kind: "studio.task.completed",
      runId: "run-123",
      taskId: "task-1",
      timestamp: "2026-10-03T16:00:00.000Z",
      detail: "Deterministic evidence accepted.",
    });

    assert.equal(requests.length, 1);
    assert.equal(requests[0].headers.get("content-type"), "application/json");
    assert.equal(requests[0].headers.get("authorization"), "Basic test-token");
    assert.equal(requests[0].headers.get("x-langfuse-ingestion-version"), "4");

    const span = requests[0].body.resourceSpans[0].scopeSpans[0].spans[0];
    assert.equal(span.name, "studio.task.completed");
    assert.match(span.traceId, /^[0-9a-f]{32}$/);
    assert.match(span.spanId, /^[0-9a-f]{16}$/);
    assert.equal(span.kind, 1);

    const resourceAttrs = requests[0].body.resourceSpans[0].resource.attributes;
    assert.equal(resourceAttrs.find((entry: any) => entry.key === "service.name").value.stringValue, "matterhorn");

    const eventAttrs = span.attributes;
    assert.equal(eventAttrs.find((entry: any) => entry.key === "matterhorn.run.id").value.stringValue, "run-123");
    assert.equal(eventAttrs.find((entry: any) => entry.key === "matterhorn.task.id").value.stringValue, "task-1");
    assert(!JSON.stringify(requests[0].body).includes("Langfuse"));

    assert.equal((await adapter.health()).state, "ready");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Run Insights rejects insecure remote HTTP endpoints", () => {
  assert.throws(
    () => new MatterhornOtlpRunInsightsAdapter({ endpoint: "http://telemetry.example.com/v1/traces" }),
    /HTTPS/i,
  );
});


test("Safe Execution emits a locked-down OCI command from server-approved profiles", async () => {
  const root = await mkdtemp(join(tmpdir(), "matterhorn-sandbox-"));
  const runner = join(root, "fake-engine.mjs");
  const runnerSource = [
    'const args = process.argv.slice(2);',
    'if (args[0] === "version") {',
    '  process.stdout.write("fake-engine-1");',
    '} else {',
    '  process.stdout.write(JSON.stringify(args));',
    '}',
  ].join("\n");
  await writeFile(runner, runnerSource, "utf8");

  try {
    const adapter = new MatterhornOciSafeExecutionAdapter({
      enginePath: process.execPath,
      engineArgs: [runner],
      defaultTimeoutMs: 1000,
      profiles: [{
        id: "node-check",
        image: "node:22-bookworm-slim",
        workspacePath: root,
        containerPath: "/workspace",
        workingDirectory: "/workspace",
        memory: "512m",
        cpus: 0.5,
        pidsLimit: 64,
        tmpfsSizeMb: 64,
      }],
    });

    assert.equal((await adapter.health()).state, "ready");
    const result = await adapter.execute({
      profileId: "node-check",
      argv: ["node", "--version"],
      env: { NODE_ENV: "test" },
      timeoutMs: 1000,
    });
    assert.equal(result.exitCode, 0);
    assert.equal(result.timedOut, false);

    const args = JSON.parse(result.stdout) as string[];
    const pair = (flag: string, expected: string) => {
      const index = args.indexOf(flag);
      assert.notEqual(index, -1, `Missing ${flag}`);
      assert.equal(args[index + 1], expected);
    };

    pair("--network", "none");
    assert(args.includes("--read-only"));
    pair("--cap-drop", "ALL");
    pair("--security-opt", "no-new-privileges");
    pair("--pids-limit", "64");
    pair("--memory", "512m");
    pair("--cpus", "0.5");
    pair("--workdir", "/workspace");
    assert(args.includes("--tmpfs"));
    assert(args.some(arg => arg.startsWith("type=bind,src=") && arg.includes(",dst=/workspace,readonly")));
    assert(args.includes("node:22-bookworm-slim"));
    assert(args.includes("node"));
    assert(args.includes("--version"));
    assert(!args.includes("--privileged"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
