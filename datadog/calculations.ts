import THRESHOLDS from "./thresholds.json";

// Simplified threshold function
export function getThresholdForOperation(
  operation: string,
  operationType: "core" | "group" | "network",
  members: string = "",
  region: string = "us-east",
): number {
  // Convert operation to lowercase for consistent lookups
  const operationLower = operation.toLowerCase();

  // Extract batch size from operation name if it contains a dash
  const batchSize = operation.includes("-")
    ? parseInt(operation.split("-")[1]) || 1
    : 1;

  // Normalize region name and ensure it exists in the thresholds
  const regionNormalized = region.toLowerCase().trim();

  // Get the region multiplier with proper logging
  const regionMultiplier =
    THRESHOLDS.regionMultipliers[
      regionNormalized as keyof typeof THRESHOLDS.regionMultipliers
    ] || 1.0;

  // Log if region multiplier not found (for debugging)
  if (!(regionNormalized in THRESHOLDS.regionMultipliers)) {
    console.warn(
      `Region multiplier not found for: ${regionNormalized}, using default 1.0`,
    );
  }

  if (operationType === "network") {
    const networkThreshold =
      THRESHOLDS.network[operationLower as keyof typeof THRESHOLDS.network];
    // Default to network threshold based on the operation or fallback value
    const baseThreshold =
      typeof networkThreshold === "number"
        ? networkThreshold
        : THRESHOLDS.network.server_call;

    // Apply region multiplier to network thresholds
    const finalThreshold = Math.round(baseThreshold * regionMultiplier);

    return finalThreshold;
  }

  if (operationType === "group") {
    // Parse the member count from the members string if available
    // Use a more robust parsing approach
    let memberCount = 0;

    if (members && members !== "-") {
      const parsedMember = parseInt(members);
      if (!isNaN(parsedMember)) {
        memberCount = parsedMember;
      }
    }

    console.log(
      `Calculating threshold for ${operation} (${operationType}) with ${memberCount} members`,
    );

    // Get the base value for this operation
    const baseValue =
      THRESHOLDS.core[operationLower as keyof typeof THRESHOLDS.core];

    // Get the multiplier for this operation
    const memberMultiplier =
      THRESHOLDS.memberMultipliers[
        operationLower as keyof typeof THRESHOLDS.memberMultipliers
      ] || 0;

    let calculatedThreshold = baseValue;

    // Calculate based on the actual member count
    if (memberCount > 0) {
      const batches = Math.ceil(memberCount / batchSize);
      calculatedThreshold = baseValue * (1 + memberMultiplier * (batches - 1));

      console.log(
        `Operation: ${operation}, Using memberCount: ${memberCount} (from members: ${members}), batches: ${batches}, threshold: ${calculatedThreshold}`,
      );
    }

    // Apply region multiplier
    const finalThreshold = Math.round(calculatedThreshold * regionMultiplier);

    return finalThreshold;
  }

  // For core operations, ensure we're using lowercase for lookup
  const baseThreshold =
    operationLower in THRESHOLDS.core
      ? THRESHOLDS.core[operationLower as keyof typeof THRESHOLDS.core]
      : null;

  // Check if this is a group operation that needs member multiplier
  const isGroupOperation = operationLower in THRESHOLDS.memberMultipliers;

  if (isGroupOperation && members) {
    // Get the multiplier for this operation
    const memberMultiplier =
      THRESHOLDS.memberMultipliers[
        operationLower as keyof typeof THRESHOLDS.memberMultipliers
      ] || 0;

    let calculatedThreshold = baseThreshold;
    let memberCount = 0;

    if (members && members !== "-") {
      const parsedMember = parseInt(members);
      if (!isNaN(parsedMember)) {
        memberCount = parsedMember;
      }
    }

    // Calculate based on batch size and member count
    if (memberCount > 0) {
      const batches = Math.ceil(memberCount / batchSize);
      calculatedThreshold =
        (baseThreshold ?? 0) * (1 + memberMultiplier * (batches - 1));
    }

    // Apply region multiplier
    const finalThreshold = Math.round(
      (calculatedThreshold ?? 0) * regionMultiplier,
    );
    return finalThreshold;
  }

  // For regular core operations
  const finalThreshold = Math.round((baseThreshold ?? 0) * regionMultiplier);
  return finalThreshold;
}
