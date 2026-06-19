export function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function extractCodeFence(value: string): string | undefined {
  const match = value.match(/```(?:[\w-]+)?\r?\n([\s\S]*?)```/);
  return match?.[1]?.trim();
}

export function normalizeAssistantText(rawText: string): string {
  if (typeof rawText !== "string") {
    return "";
  }
  let trimmed = rawText.trim();

  // 1. Strip markdown code fences if they wrap the entire text
  let strippedFences = false;
  let textToParse = trimmed;
  if (trimmed.startsWith("```")) {
    const fenceMatch = trimmed.match(/^```([a-zA-Z0-9-]*)\s*([\s\S]*?)\s*```$/);
    if (fenceMatch) {
      const lang = fenceMatch[1].toLowerCase();
      const body = fenceMatch[2].trim();
      if (lang === "json" || body.startsWith("{")) {
        textToParse = body;
        strippedFences = true;
      }
    } else {
      // Maybe it's a truncated fence (missing the ending ```)
      const openFenceMatch = trimmed.match(/^```([a-zA-Z0-9-]*)\s*([\s\S]*)$/);
      if (openFenceMatch) {
        const lang = openFenceMatch[1].toLowerCase();
        const body = openFenceMatch[2].trim();
        if (lang === "json" || body.startsWith("{")) {
          textToParse = body;
          strippedFences = true;
        }
      }
    }
  }

  // Helper to extract keys using regex from a potentially truncated/malformed JSON string
  function extractKeyRegex(jsonStr: string, key: string): string | null {
    const pattern = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, "i");
    const match = jsonStr.match(pattern);
    if (match) {
      try {
        return JSON.parse(`"${match[1]}"`);
      } catch {
        return match[1];
      }
    }
    return null;
  }

  let finalText = rawText;

  // 2. Try parsing as JSON
  try {
    const parsed = JSON.parse(textToParse);
    if (parsed && typeof parsed === "object") {
      const keys = ["response", "content", "message", "answer", "title"];
      for (const key of keys) {
        if (parsed[key] !== undefined && parsed[key] !== null) {
          const val = String(parsed[key]).trim();
          if (val.length > 0) {
            finalText = val;
            break;
          }
        }
      }
    }
  } catch (e) {
    // If JSON parsing fails, see if we can extract the fields using regex
    if (textToParse.startsWith("{")) {
      const keys = ["response", "content", "message", "answer", "title"];
      let found = false;
      for (const key of keys) {
        const extracted = extractKeyRegex(textToParse, key);
        if (extracted && extracted.trim().length > 0) {
          finalText = extracted.trim();
          found = true;
          break;
        }
      }
      if (!found && strippedFences) {
        finalText = textToParse;
      }
    } else if (strippedFences) {
      finalText = textToParse;
    }
  }

  // 3. Replace old names with Matterhorn
  return finalText
    .replace(/\bNSS Workspace AI\b/g, "Matterhorn")
    .replace(/\bNSS Master Core\b/g, "Matterhorn")
    .replace(/\bM-CORE\b/g, "Matterhorn")
    .replace(/\bGeneral NSS Studio Agent\b/g, "Matterhorn");
}
