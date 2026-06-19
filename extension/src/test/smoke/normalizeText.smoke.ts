import { strict as assert } from "node:assert";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import { normalizeAssistantText } from "../../helpers/text.js";

export async function runNormalizeTextSmoke(): Promise<void> {
  // a. Raw text response displays as-is.
  assert.equal(
    normalizeAssistantText("Hello, how can I help you today?"),
    "Hello, how can I help you today?"
  );

  // b. ```json fenced object with response field displays only the response value.
  assert.equal(
    normalizeAssistantText("```json\n{\n  \"response\": \"Hello from Ollama!\"\n}\n```"),
    "Hello from Ollama!"
  );

  // c. JSON object with title + response displays only response.
  assert.equal(
    normalizeAssistantText("{\n  \"title\": \"Greeting\",\n  \"response\": \"Welcome!\"\n}"),
    "Welcome!"
  );

  // d. JSON object with content/message/answer displays the best available field.
  assert.equal(
    normalizeAssistantText("{\n  \"content\": \"This is content.\"\n}"),
    "This is content."
  );
  assert.equal(
    normalizeAssistantText("{\n  \"message\": \"This is message.\"\n}"),
    "This is message."
  );
  assert.equal(
    normalizeAssistantText("{\n  \"answer\": \"This is answer.\"\n}"),
    "This is answer."
  );
  assert.equal(
    normalizeAssistantText("{\n  \"title\": \"Title\",\n  \"answer\": \"Answer\",\n  \"message\": \"Message\",\n  \"content\": \"Content\",\n  \"response\": \"Response\"\n}"),
    "Response"
  );
  assert.equal(
    normalizeAssistantText("{\n  \"title\": \"Title\",\n  \"answer\": \"Answer\",\n  \"message\": \"Message\",\n  \"content\": \"Content\"\n}"),
    "Content"
  );
  assert.equal(
    normalizeAssistantText("{\n  \"title\": \"Title\",\n  \"answer\": \"Answer\",\n  \"message\": \"Message\"\n}"),
    "Message"
  );
  assert.equal(
    normalizeAssistantText("{\n  \"title\": \"Title\",\n  \"answer\": \"Answer\"\n}"),
    "Answer"
  );

  // e. Real code blocks still render as code blocks.
  const codeBlockText = "Here is some code:\n```javascript\nconst x = 1;\n```\nHope this helps!";
  assert.equal(
    normalizeAssistantText(codeBlockText),
    codeBlockText
  );

  // Identity replacement checks
  assert.equal(
    normalizeAssistantText("I am NSS Master Core (M-CORE), designed as the General NSS Studio Agent of NSS Workspace AI."),
    "I am Matterhorn (Matterhorn), designed as the Matterhorn of Matterhorn."
  );

  // f. Removed model options no longer appear in the selector.
  // In CommonJS, __dirname is already a global variable.
  
  // Try finding main.js in src or out
  const possiblePaths = [
    path.resolve(__dirname, "../../../src/sidebar/webview/main.js"),
    path.resolve(__dirname, "../../../out/sidebar/webview/main.js"),
    path.resolve(__dirname, "../../sidebar/webview/main.js")
  ];

  let webviewJsContent = "";
  for (const possiblePath of possiblePaths) {
    try {
      webviewJsContent = await fs.readFile(possiblePath, "utf8");
      break;
    } catch {
      // Continue searching
    }
  }

  assert(webviewJsContent, "Should find and load main.js for verification");

  assert(!webviewJsContent.includes("Ollama (Default)"), "Ollama (Default) should be removed from main.js");
  assert(!webviewJsContent.includes("Ollama (Custom...)"), "Ollama (Custom...) should be removed from main.js");
  assert(!webviewJsContent.includes("LM Studio (Custom...)"), "LM Studio (Custom...) should be removed from main.js");
}
