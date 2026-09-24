import type { FoundryOperationPolicy } from "../safety/types.js";
import { createFoundryAssetManifest } from "./manifest.js";
import { assetCostWithinBudget } from "./router.js";
import { FoundryAssetProviderRegistry } from "./registry.js";
import type {
  FoundryAssetExecution,
  FoundryAssetProviderContext,
  FoundryAssetProviderDescriptor,
  FoundryAssetRequest,
  FoundryAssetRoutingPolicy,
} from "./types.js";
import { validateFoundryAssetRequest } from "./validator.js";

export interface FoundryAssetForgeExecuteOptions {
  readonly routing?: FoundryAssetRoutingPolicy;
  readonly context?: FoundryAssetProviderContext;
  readonly createdAt?: string;
}

export class FoundryAssetForge {
  constructor(private readonly registry: FoundryAssetProviderRegistry) {}

  async execute(
    request: FoundryAssetRequest,
    options: FoundryAssetForgeExecuteOptions = {},
  ): Promise<FoundryAssetExecution> {
    const errors = validateFoundryAssetRequest(request);
    if (errors.length > 0) {
      throw new Error(`Invalid asset request: ${errors.join(" ")}`);
    }

    const routing = options.routing ?? {};
    const provider = this.registry.select(request, routing);

    if (provider.descriptor.externalCost && !routing.maxEstimatedCost) {
      throw new Error(
        `Paid asset provider ${provider.descriptor.id} requires an explicit cost budget.`,
      );
    }

    const generated = await provider.execute(request, {
      ...options.context,
      ...(routing.maxEstimatedCost
        ? { maxCost: routing.maxEstimatedCost }
        : {}),
    });

    if (provider.descriptor.externalCost && !generated.cost) {
      throw new Error(
        `Paid asset provider ${provider.descriptor.id} did not report generation cost.`,
      );
    }
    if (!assetCostWithinBudget(generated.cost, routing.maxEstimatedCost)) {
      throw new Error(
        `Asset generation cost exceeded the configured budget for ${request.assetId}.`,
      );
    }

    const manifest = createFoundryAssetManifest(
      request,
      provider.descriptor,
      generated,
      options.createdAt,
    );

    return {
      request,
      provider: provider.descriptor,
      generated,
      manifest,
    };
  }
}

export function operationPolicyForAssetProvider(
  provider: FoundryAssetProviderDescriptor,
  routing: FoundryAssetRoutingPolicy = {},
): FoundryOperationPolicy {
  const classes: FoundryOperationPolicy["classes"][number][] = ["mutating"];
  if (provider.requiresNetwork) classes.push("network");
  if (provider.externalCost) classes.push("external_cost");

  return {
    classes,
    dryRunSupported: false,
    requiresApproval: provider.externalCost,
    ...(routing.maxEstimatedCost
      ? { costBudget: routing.maxEstimatedCost }
      : {}),
  };
}
