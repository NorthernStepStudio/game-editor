import type {
  FoundryLicenseClassification,
  FoundryLicenseRecord,
  FoundryReusePolicy,
} from "./types.js";

const DEFAULT_POLICY: Record<FoundryLicenseClassification, FoundryReusePolicy> = {
  permissive: "direct",
  "public-domain": "direct",
  "weak-copyleft": "adapter-only",
  copyleft: "adapter-only",
  "source-available": "reference-only",
  proprietary: "review-required",
  unlicensed: "reference-only",
  unknown: "review-required",
};

export function recommendedReusePolicy(
  classification: FoundryLicenseClassification,
): FoundryReusePolicy {
  return DEFAULT_POLICY[classification];
}

export function validateLicenseRecord(record: FoundryLicenseRecord): readonly string[] {
  const errors: string[] = [];
  if (!record.name.trim()) errors.push("License name must be non-empty.");

  const recommended = recommendedReusePolicy(record.classification);
  if (
    (record.classification === "unlicensed" || record.classification === "source-available") &&
    record.reusePolicy === "direct"
  ) {
    errors.push(`${record.classification} sources cannot use direct reuse without explicit legal review.`);
  }

  if (record.reusePolicy === "direct" && recommended !== "direct" && record.classification !== "proprietary") {
    errors.push(`Direct reuse conflicts with the default ${record.classification} policy.`);
  }
  return errors;
}
