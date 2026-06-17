import { strict as assert } from "node:assert";
import * as http from "node:http";
import type { AddressInfo } from "node:net";

import { postAskRequest } from "../../api/client.js";
import type { NssAskRequestPayload } from "../../models/api.types.js";

interface MockAskResponse {
  readonly body: string;
  readonly contentType: string;
  readonly statusCode: number;
}

export async function runAskClientSmoke(): Promise<void> {
  const responses: MockAskResponse[] = [
    {
      statusCode: 200,
      contentType: "text/plain; charset=utf-8",
      body: "Plain text reply",
    },
    {
      statusCode: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        title: "Structured",
        response: "Structured reply",
        preview: "Short preview",
      }),
    },
    {
      statusCode: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        title: "Proposal",
        content: "Explain the change before applying it.",
        proposedText: "export const patched = true;\n",
        summary: "Concrete file body is available.",
        proposedMemories: [
          {
            content: "Hono is the backend stack for this workspace.",
            tags: ["hono", "backend"],
          },
        ],
      }),
    },
    {
      statusCode: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        title: "Preview only",
        fileContent: "const nextValue = true;\n",
        summary: "File content came back without a separate response field.",
      }),
    },
    {
      statusCode: 500,
      contentType: "text/plain; charset=utf-8",
      body: "Server exploded.",
    },
  ];
  let requestCount = 0;

  const server = http.createServer((request, response) => {
    const next = responses[requestCount];
    requestCount += 1;

    assert.equal(request.method, "POST");
    assert.equal(request.url, "/ask");

    const chunks: Buffer[] = [];
    request.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    request.on("end", () => {
      const payload = JSON.parse(Buffer.concat(chunks).toString("utf8")) as NssAskRequestPayload;
      assert.equal(payload.prompt, "Smoke test prompt");
      assert.equal(payload.intent, "ask");

      response.statusCode = next.statusCode;
      response.setHeader("Content-Type", next.contentType);
      response.end(next.body);
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  assert(address && typeof address !== "string");

  try {
    const config = {
      serverUrl: `http://127.0.0.1:${(address as AddressInfo).port}`,
    };
    const payload = createPayload();

    const plain = await postAskRequest(config, payload);
    assert.equal(plain.response, "Plain text reply");
    assert.equal(plain.title, undefined);
    assert.equal(plain.proposedText, undefined);

    const structured = await postAskRequest(config, payload);
    assert.equal(structured.title, "Structured");
    assert.equal(structured.response, "Structured reply");
    assert.equal(structured.preview, "Short preview");

    const proposal = await postAskRequest(config, payload);
    assert.equal(proposal.title, "Proposal");
    assert.equal(proposal.response, "Explain the change before applying it.");
    assert.equal(proposal.proposedText, "export const patched = true;\n");
    assert.equal(proposal.preview, "Concrete file body is available.");
    assert.equal(proposal.proposedMemories?.[0]?.content, "Hono is the backend stack for this workspace.");

    const previewOnly = await postAskRequest(config, payload);
    assert.equal(previewOnly.title, "Preview only");
    assert.equal(previewOnly.response, "File content came back without a separate response field.");
    assert.equal(previewOnly.proposedText, "const nextValue = true;\n");

    await assert.rejects(() => postAskRequest(config, payload), /Backend request failed \(500\): Server exploded\./);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  assert.equal(requestCount, responses.length);
}

function createPayload(): NssAskRequestPayload {
  return {
    prompt: "Smoke test prompt",
    intent: "ask",
    workspace: {
      name: "Matterhorn",
      rootPath: "D:\\dev\\Northern Step Studio\\apps\\nstep-workspace-ai",
    },
  };
}
