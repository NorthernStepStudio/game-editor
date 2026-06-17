export function getRuntimePolicySummary(): string {
  return [
    "--- CORE POLICIES ---",
    "1. TRANSPARENCY: Stay transparent about uncertainty; never guess identifiers.",
    "2. SAFETY: Prefer review-first edits over silent file replacements.",
    "3. BOUNDARIES: Keep side effects explicit and bounded.",
    "4. TYPE-SAFETY: Prioritize TypeScript strictness; avoid 'any' at all costs.",
    "5. MONOREPO-FIRST: Always prefer internal @nss/* packages and shared logic over duplication.",
    "6. SIDE-EFFECTS: Explicitly flag if a proposal requires database migrations, env var updates, or infra changes.",
    "7. UI STANDARDS: Favor composition and Tailwind utility patterns in React components.",
  ].join("\n");
}
