import type {
  MatterhornModelCapability,
  MatterhornModelDescriptor,
  MatterhornModelProvider,
  MatterhornModelRoute,
  MatterhornModelRouteRequest,
  MatterhornModelRoutingPolicy,
} from "./types.js";

export class MatterhornModelGateway {
  private readonly providers = new Map<string, MatterhornModelProvider>();

  register(provider: MatterhornModelProvider): void {
    if (!provider.id.trim()) {
      throw new Error("Model provider id must be non-empty.");
    }
    if (this.providers.has(provider.id)) {
      throw new Error(`Model provider already registered: ${provider.id}`);
    }
    if (!provider.models.length) {
      throw new Error(
        `Model provider ${provider.id} must advertise at least one model.`,
      );
    }
    for (const model of provider.models) {
      validateDescriptor(provider.id, model);
    }
    this.providers.set(provider.id, provider);
  }

  get(providerId: string): MatterhornModelProvider | undefined {
    return this.providers.get(providerId);
  }

  listModels(): readonly MatterhornModelDescriptor[] {
    return [...this.providers.values()]
      .flatMap((provider) => provider.models)
      .sort((a, b) =>
        a.providerId.localeCompare(b.providerId) ||
        a.modelId.localeCompare(b.modelId),
      );
  }

  route(
    request: MatterhornModelRouteRequest,
    policy: MatterhornModelRoutingPolicy,
  ): MatterhornModelRoute {
    const required = new Set<MatterhornModelCapability>(
      request.requiredCapabilities ?? ["text"],
    );
    const candidates: Array<{
      provider: MatterhornModelProvider;
      model: MatterhornModelDescriptor;
      score: number;
      reasons: string[];
    }> = [];
    const rejected: string[] = [];

    for (const provider of this.providers.values()) {
      for (const model of provider.models) {
        const rejection = rejectionReason(
          provider,
          model,
          request,
          policy,
          required,
        );
        if (rejection) {
          rejected.push(`${provider.id}/${model.modelId}: ${rejection}`);
          continue;
        }

        const reasons: string[] = [];
        let score = 0;
        if (model.roles.includes(request.role)) {
          score += 100;
          reasons.push(`role:${request.role}`);
        }
        if (policy.preferLocal && model.local) {
          score += 30;
          reasons.push("local preferred");
        }
        if (!model.externalCost) {
          score += 10;
          reasons.push("no external cost");
        }
        if (!model.requiresNetwork) {
          score += 5;
          reasons.push("no network required");
        }
        if (request.preferredProviderId === provider.id) {
          score += 1_000;
          reasons.push("preferred provider");
        }
        if (request.preferredModelId === model.modelId) {
          score += 2_000;
          reasons.push("preferred model");
        }

        candidates.push({ provider, model, score, reasons });
      }
    }

    candidates.sort(
      (a, b) =>
        b.score - a.score ||
        a.provider.id.localeCompare(b.provider.id) ||
        a.model.modelId.localeCompare(b.model.modelId),
    );

    const selected = candidates[0];
    if (!selected) {
      throw new Error(
        rejected.length
          ? `No eligible model. ${rejected.join("; ")}`
          : "No model providers are registered.",
      );
    }

    if (
      !policy.allowFallback &&
      request.preferredProviderId &&
      selected.provider.id !== request.preferredProviderId
    ) {
      throw new Error(
        `Preferred provider ${request.preferredProviderId} is not eligible and fallback is disabled.`,
      );
    }
    if (
      !policy.allowFallback &&
      request.preferredModelId &&
      selected.model.modelId !== request.preferredModelId
    ) {
      throw new Error(
        `Preferred model ${request.preferredModelId} is not eligible and fallback is disabled.`,
      );
    }

    return {
      provider: selected.provider,
      model: selected.model,
      reasons: selected.reasons,
    };
  }
}

function rejectionReason(
  provider: MatterhornModelProvider,
  model: MatterhornModelDescriptor,
  request: MatterhornModelRouteRequest,
  policy: MatterhornModelRoutingPolicy,
  required: ReadonlySet<MatterhornModelCapability>,
): string | undefined {
  if (model.providerId !== provider.id) {
    return "descriptor providerId mismatch";
  }
  if (!model.roles.includes(request.role)) {
    return `role ${request.role} unsupported`;
  }
  if (
    [...required].some(
      (capability) => !model.capabilities.includes(capability),
    )
  ) {
    return "required capability unsupported";
  }
  if (
    policy.allowedProviders &&
    !policy.allowedProviders.includes(provider.id)
  ) {
    return "provider not allowlisted";
  }
  if (policy.blockedProviders?.includes(provider.id)) {
    return "provider blocked";
  }
  if (!policy.allowNetwork && model.requiresNetwork) {
    return "network providers disabled";
  }
  if (!policy.allowExternalCost && model.externalCost) {
    return "external-cost providers disabled";
  }
  if (
    request.preferredProviderId &&
    provider.id !== request.preferredProviderId &&
    !policy.allowFallback
  ) {
    return "different from preferred provider";
  }
  if (
    request.preferredModelId &&
    model.modelId !== request.preferredModelId &&
    !policy.allowFallback
  ) {
    return "different from preferred model";
  }
  return undefined;
}

function validateDescriptor(
  providerId: string,
  model: MatterhornModelDescriptor,
): void {
  if (!model.modelId.trim() || !model.label.trim()) {
    throw new Error("Model descriptor id and label must be non-empty.");
  }
  if (model.providerId !== providerId) {
    throw new Error(
      `Model ${model.modelId} providerId does not match provider ${providerId}.`,
    );
  }
  if (!model.roles.length || !model.capabilities.includes("text")) {
    throw new Error(
      `Model ${providerId}/${model.modelId} must declare roles and text capability.`,
    );
  }
  if (model.local && model.requiresNetwork) {
    throw new Error(
      `Model ${providerId}/${model.modelId} cannot be local and require network access.`,
    );
  }
}
