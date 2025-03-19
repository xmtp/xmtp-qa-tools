import THRESHOLDS from "./thresholds.json";

let batches = new Set<number>();
export function getThresholdForOperation(
  operation: string,
  operationType: "core" | "group" | "network",
  members: number = 0,
  region: string = "us-east",
): number {
  // Normalize inputs
  const operationLower = operation.toLowerCase();
  const regionNormalized = region.toLowerCase().trim();

  // Get region multiplier
  const regionMultiplier =
    THRESHOLDS.regionMultipliers[
      regionNormalized as keyof typeof THRESHOLDS.regionMultipliers
    ] || 1.0;

  let baseThreshold: number = 1;

  if (operationType === "network") {
    const networkThreshold =
      THRESHOLDS.network[operationLower as keyof typeof THRESHOLDS.network];
    baseThreshold =
      typeof networkThreshold === "number"
        ? networkThreshold
        : THRESHOLDS.network.server_call;
  } else if (operationType === "group" || operationType === "core") {
    // For both "core" and "group" types, get the base value
    baseThreshold =
      THRESHOLDS.core[operationLower as keyof typeof THRESHOLDS.core] || 0;

    // Apply member multiplier if applicable
    const operationMultiplier =
      THRESHOLDS.memberMultipliers[
        operationLower as keyof typeof THRESHOLDS.memberMultipliers
      ] || 1;

    batches.add(members);
    const batchSize = batches.size - 1;
    // Apply the multiplier based on batch number
    // Batch 1 gets multiplier x1, Batch 2 gets x2, etc.
    const multiplier = batchSize * operationMultiplier;
    baseThreshold = baseThreshold * multiplier;

    console.warn(
      `Operation: ${operation}, batch: ${batchSize}, multiplier: ${multiplier}x, adjusted threshold: ${baseThreshold}`,
    );
  }

  // Apply region multiplier and round
  return Math.round(baseThreshold * regionMultiplier);
}
