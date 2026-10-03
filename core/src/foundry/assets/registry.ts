import type {
  FoundryAssetProvider,
  FoundryAssetProviderDescriptor,
  FoundryAssetRequest,
  FoundryAssetRoutingPolicy,
} from "./types.js";
import { routeFoundryAssetProvider } from "./router.js";
import { validateFoundryAssetProviderDescriptor } from "./validator.js";

export class FoundryAssetProviderRegistry {
  private readonly providers = new Map<string, FoundryAssetProvider>();

  register(provider: FoundryAssetProvider): void {
    const errors = validateFoundryAssetProviderDescriptor(provider.descriptor);
    if (errors.length > 0) {
      throw new Error(
        `Invalid asset provider ${provider.descriptor.id}: ${errors.join(" ")}`,
      );
    }
    if (this.providers.has(provider.descriptor.id)) {
      throw new Error(
        `Asset provider already registered: ${provider.descriptor.id}`,
      );
    }
    this.providers.set(provider.descriptor.id, provider);
  }

  unregister(providerId: string): boolean {
    return this.providers.delete(providerId);
  }

  get(providerId: string): FoundryAssetProvider | undefined {
    return this.providers.get(providerId);
  }

  list(): readonly FoundryAssetProviderDescriptor[] {
    return [...this.providers.values()]
      .map((provider) => provider.descriptor)
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  select(
    request: FoundryAssetRequest,
    policy: FoundryAssetRoutingPolicy = {},
  ): FoundryAssetProvider {
    const route = routeFoundryAssetProvider(request, this.list(), policy);
    if (!route.selected) {
      const detail = route.rejected
        .map((item) => `${item.providerId}: ${item.reason}`)
        .join("; ");
      throw new Error(
        detail
          ? `No compatible asset provider. ${detail}`
          : "No asset providers are registered.",
      );
    }
    return this.providers.get(route.selected.id)!;
  }
}
