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
  FoundryGeneratedAsset,
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

    if (generated.outputs.length === 0) {
      throw new Error(
        `Asset provider ${provider.descriptor.id} returned no usable outputs.`,
      );
    }
    validateOutputBatch(request, provider.descriptor, generated.outputs);

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

    const manifests = generated.outputs
      .slice()
      .sort((a, b) => a.outputIndex - b.outputIndex)
      .map((output) =>
        createFoundryAssetManifest(request, provider.descriptor, output, {
          assetId: outputAssetId(
            request.assetId,
            output.outputIndex,
            generated.outputs.length,
          ),
          createdAt: options.createdAt,
          providerRequestId: generated.providerRequestId,
        }),
      );

    return {
      request,
      provider: provider.descriptor,
      generated,
      manifests,
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
      ? {
          costBudget: {
            currency: routing.maxEstimatedCost.currency,
            maxAmount: routing.maxEstimatedCost.amount,
          },
        }
      : {}),
  };
}

function validateOutputBatch(
  request: FoundryAssetRequest,
  provider: FoundryAssetProviderDescriptor,
  outputs: readonly FoundryGeneratedAsset[],
): void {
  const indexes = new Set<number>();
  for (const output of outputs) {
    if (output.providerId !== provider.id) {
      throw new Error("Generated asset providerId does not match selected provider.");
    }
    if (output.requestId !== request.requestId) {
      throw new Error("Generated asset requestId does not match request.");
    }
    if (!Number.isInteger(output.outputIndex) || output.outputIndex < 0) {
      throw new Error("Generated asset outputIndex must be a non-negative integer.");
    }
    if (indexes.has(output.outputIndex)) {
      throw new Error(
        `Generated asset batch contains duplicate outputIndex ${output.outputIndex}.`,
      );
    }
    indexes.add(output.outputIndex);
  }
}

function outputAssetId(
  baseAssetId: string,
  outputIndex: number,
  outputCount: number,
): string {
  if (outputCount === 1) return baseAssetId;
  return `${baseAssetId}-${String(outputIndex + 1).padStart(2, "0")}`;
}
