import type {
  FoundryAssetProviderDescriptor,
  FoundryAssetRequest,
} from "./types.js";

export function validateFoundryAssetRequest(
  request: FoundryAssetRequest,
): readonly string[] {
  const errors: string[] = [];
  if (!request.requestId.trim()) errors.push("Asset requestId must be non-empty.");
  if (!request.assetId.trim()) errors.push("Asset assetId must be non-empty.");
  if (
    request.dimensions &&
    (!Number.isInteger(request.dimensions.width) ||
      !Number.isInteger(request.dimensions.height) ||
      request.dimensions.width <= 0 ||
      request.dimensions.height <= 0)
  ) {
    errors.push("Asset dimensions must be positive integers.");
  }
  if (
    request.intendedWorldWidth !== undefined &&
    request.intendedWorldWidth <= 0
  ) {
    errors.push("Asset intendedWorldWidth must be greater than zero.");
  }
  if (
    request.intendedWorldHeight !== undefined &&
    request.intendedWorldHeight <= 0
  ) {
    errors.push("Asset intendedWorldHeight must be greater than zero.");
  }
  const references = request.referenceAssets ?? [];
  if (new Set(references).size !== references.length) {
    errors.push("Asset referenceAssets cannot contain duplicates.");
  }
  return errors;
}

export function validateFoundryAssetProviderDescriptor(
  descriptor: FoundryAssetProviderDescriptor,
): readonly string[] {
  const errors: string[] = [];
  if (!descriptor.id.trim()) errors.push("Provider id must be non-empty.");
  if (!descriptor.name.trim()) errors.push("Provider name must be non-empty.");
  if (descriptor.operations.length === 0) {
    errors.push("Provider must declare at least one operation.");
  }
  if (descriptor.kinds.length === 0) {
    errors.push("Provider must declare at least one asset kind.");
  }
  if (new Set(descriptor.operations).size !== descriptor.operations.length) {
    errors.push("Provider operations cannot contain duplicates.");
  }
  if (new Set(descriptor.kinds).size !== descriptor.kinds.length) {
    errors.push("Provider asset kinds cannot contain duplicates.");
  }
  if (descriptor.local && descriptor.requiresNetwork) {
    errors.push("A local provider cannot require network access.");
  }
  if (
    descriptor.commercialUseAllowed &&
    descriptor.outputLicense.reusePolicy === "blocked"
  ) {
    errors.push(
      "Commercial-use provider cannot advertise a blocked output license.",
    );
  }
  return errors;
}
