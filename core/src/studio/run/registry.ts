/**
 * Specialist Adapter Registry.
 *
 * Decouples Matterhorn Studio Run Controller from specific specialist
 * implementations. Matterhorn core registers and resolves adapters by ID.
 */

import type { SpecialistAdapter } from "../adapters/types.js";

export class SpecialistAdapterRegistry {
  private readonly adapters = new Map<string, SpecialistAdapter>();

  register(adapter: SpecialistAdapter): void {
    if (!adapter || !adapter.specialistId) {
      throw new Error("Invalid specialist adapter: specialistId is required.");
    }
    this.adapters.set(adapter.specialistId, adapter);
  }

  get(specialistId: string): SpecialistAdapter | undefined {
    return this.adapters.get(specialistId);
  }

  has(specialistId: string): boolean {
    return this.adapters.has(specialistId);
  }

  list(): SpecialistAdapter[] {
    return Array.from(this.adapters.values());
  }

  unregister(specialistId: string): boolean {
    return this.adapters.delete(specialistId);
  }

  clear(): void {
    this.adapters.clear();
  }
}
