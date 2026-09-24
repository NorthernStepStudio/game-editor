import type { FoundryAssetCost } from "../provenance/types.js";
import type {
  FoundryAssetProviderDescriptor,
  FoundryAssetRequest,
  FoundryAssetRoutingPolicy,
} from "./types.js";

export interface FoundryAssetRouteCandidate {
  readonly provider: FoundryAssetProviderDescriptor;
  readonly score: number;
  readonly reasons: readonly string[];
}

export interface FoundryAssetRouteResult {
  readonly selected?: FoundryAssetProviderDescriptor;
  readonly candidates: readonly FoundryAssetRouteCandidate[];
  readonly rejected: readonly {
    readonly providerId: string;
    readonly reason: string;
  }[];
}

export function routeFoundryAssetProvider(
  request: FoundryAssetRequest,
  providers: readonly FoundryAssetProviderDescriptor[],
  policy: FoundryAssetRoutingPolicy = {},
): FoundryAssetRouteResult {
  const candidates: FoundryAssetRouteCandidate[] = [];
  const rejected: { providerId: string; reason: string }[] = [];

  for (const provider of providers) {
    const rejection = rejectionReason(request, provider, policy);
    if (rejection) {
      rejected.push({ providerId: provider.id, reason: rejection });
      continue;
    }

    const reasons: string[] = [];
    let score = provider.priority ?? 0;

    if (provider.local) {
      score += 20;
      reasons.push("local provider");
    }
    if (!provider.externalCost) {
      score += 10;
      reasons.push("no external cost");
    }
    if (request.seed !== undefined && provider.supportsSeed) {
      score += 4;
      reasons.push("seed support");
    }
    if (
      (request.referenceAssets?.length ?? 0) > 0 &&
      provider.supportsReferences
    ) {
      score += 4;
      reasons.push("reference support");
    }
    if (provider.outputLicense.reusePolicy === "direct") {
      score += 3;
      reasons.push("direct output reuse policy");
    }

    candidates.push({ provider, score, reasons });
  }

  candidates.sort(
    (a, b) =>
      b.score - a.score ||
      a.provider.id.localeCompare(b.provider.id),
  );

  return {
    ...(candidates[0] ? { selected: candidates[0].provider } : {}),
    candidates,
    rejected,
  };
}

function rejectionReason(
  request: FoundryAssetRequest,
  provider: FoundryAssetProviderDescriptor,
  policy: FoundryAssetRoutingPolicy,
): string | null {
  if (!provider.operations.includes(request.operation)) {
    return `operation ${request.operation} unsupported`;
  }
  if (!provider.kinds.includes(request.kind)) {
    return `asset kind ${request.kind} unsupported`;
  }
  if (
    policy.allowedProviders &&
    !policy.allowedProviders.includes(provider.id)
  ) {
    return "provider not in allowlist";
  }
  if (policy.blockedProviders?.includes(provider.id)) {
    return "provider is blocked";
  }
  if (policy.requireLocal && !provider.local) {
    return "local provider required";
  }
  if (policy.allowNetwork === false && provider.requiresNetwork) {
    return "network access not allowed";
  }
  if (policy.allowExternalCost === false && provider.externalCost) {
    return "external cost not allowed";
  }
  if (policy.requireCommercialUse && !provider.commercialUseAllowed) {
    return "commercial-use outputs required";
  }
  if (
    provider.modelLicense?.reusePolicy === "blocked" ||
    provider.outputLicense.reusePolicy === "blocked"
  ) {
    return "provider license policy is blocked";
  }
  if (
    request.referenceAssets?.length &&
    !provider.supportsReferences
  ) {
    return "reference assets required but provider lacks reference support";
  }
  if (
    request.seed !== undefined &&
    !provider.supportsSeed
  ) {
    return "seeded generation required but provider lacks seed support";
  }
  if (policy.maxEstimatedCost && !provider.externalCost) {
    return null;
  }
  return null;
}

export function assetCostWithinBudget(
  cost: FoundryAssetCost | undefined,
  budget: FoundryAssetCost | undefined,
): boolean {
  if (!budget || !cost) return true;
  if (cost.currency !== budget.currency) return false;
  return cost.amount <= budget.amount;
}
