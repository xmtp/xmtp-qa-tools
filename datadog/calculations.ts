import THRESHOLDS from "./thresholds.json";

export function getThresholdForOperation(
  operation: string,
  operationType: "core" | "group" | "network",
  members: string = "",
  region: string = "us-east",
): number {
  // Normalize inputs
  const operationLower = operation.toLowerCase();
  const regionNormalized = region.toLowerCase().trim();
  const batchSize = operation.includes("-")
    ? parseInt(operation.split("-")[1]) || 1
    : 1;

  // Get region multiplier
  const regionMultiplier =
    THRESHOLDS.regionMultipliers[
      regionNormalized as keyof typeof THRESHOLDS.regionMultipliers
    ] || 1.0;

  // Parse member count
  const memberCount = members && members !== "-" ? parseInt(members) || 0 : 0;

  // Calculate base threshold based on operation type
  let baseThreshold: number;

  if (operationType === "network") {
    const networkThreshold =
      THRESHOLDS.network[operationLower as keyof typeof THRESHOLDS.network];
    baseThreshold =
      typeof networkThreshold === "number"
        ? networkThreshold
        : THRESHOLDS.network.server_call;
  } else {
    // For both "core" and "group" types, get the base value
    baseThreshold =
      THRESHOLDS.core[operationLower as keyof typeof THRESHOLDS.core] || 0;

    // Apply member multiplier if applicable
    const memberMultiplier =
      THRESHOLDS.memberMultipliers[
        operationLower as keyof typeof THRESHOLDS.memberMultipliers
      ] || 0;

    if (memberMultiplier > 0 && memberCount > 0) {
      const batches = Math.ceil(memberCount / batchSize);
      baseThreshold = baseThreshold * (1 + memberMultiplier * (batches - 1));
      console.warn(
        `Operation: ${operation}, member count: ${memberCount}, batches: ${batches}, multiplier: ${memberMultiplier}, adjusted threshold: ${baseThreshold}`,
      );
    }
  }

  // Apply region multiplier and round
  return Math.round(baseThreshold * regionMultiplier);
}
