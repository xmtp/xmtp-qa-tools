import THRESHOLDS from "./thresholds.json";

// Define the proper types to avoid TypeScript errors
interface MemberThresholds {
  creategroup: number;
  creategroupbyidentifiers: number;
  syncgroup: number;
  updategroupname: number;
  removemembers: number;
  sendgroupmessage: number;
  receivegroupmessage: number;
  [key: string]: number; // Allow for other properties
}

interface ThresholdsData {
  core: {
    [key: string]: number;
  };
  network: {
    [key: string]: number;
  };
  memberBasedThresholds: {
    [memberCount: string]: MemberThresholds;
  };
  regionMultipliers: {
    [region: string]: number;
  };
  GEO_TO_COUNTRY_CODE: {
    [region: string]: string;
  };
  reliability: number;
}

// Type assertion to enforce our expected structure
const typedThresholds = THRESHOLDS as unknown as ThresholdsData;

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
    typedThresholds.regionMultipliers[regionNormalized] || 1.0;

  let baseThreshold: number = 0;

  if (operationType === "network") {
    const networkThreshold = typedThresholds.network[operationLower];
    baseThreshold =
      typeof networkThreshold === "number"
        ? networkThreshold
        : typedThresholds.network.server_call;
  } else if (operationType === "core") {
    // For core operations, use thresholds directly from the core settings
    baseThreshold = typedThresholds.core[operationLower] || 0;
  } else if (operationType === "group") {
    // For group operations with member count > 0, use memberBasedThresholds
    if (members > 0) {
      // Find the appropriate member bucket for the given member count
      const memberBuckets = Object.keys(typedThresholds.memberBasedThresholds)
        .map(Number)
        .sort((a, b) => a - b);

      // Find the highest bucket that's less than or equal to the member count
      let applicableBucket = "0";
      for (const bucket of memberBuckets) {
        if (members >= bucket) {
          applicableBucket = bucket.toString();
        } else {
          break;
        }
      }

      // Get threshold from the member-based table
      const memberThresholds =
        typedThresholds.memberBasedThresholds[applicableBucket];
      if (memberThresholds && operationLower in memberThresholds) {
        baseThreshold = memberThresholds[operationLower];

        console.warn(
          `Operation: ${operation}, members: ${members}, using bucket: ${applicableBucket}, threshold: ${baseThreshold}`,
        );
      } else {
        // Fallback to core thresholds if member-based threshold not found
        baseThreshold = typedThresholds.core[operationLower] || 0;

        console.warn(
          `Operation: ${operation}, members: ${members}, using core threshold: ${baseThreshold}`,
        );
      }
    } else {
      // For group operations with members = 0, use core thresholds
      baseThreshold = typedThresholds.core[operationLower] || 0;
    }
  }

  // Apply region multiplier and round
  return Math.round(baseThreshold * regionMultiplier);
}

/**
 * Calculate average of numeric values
 */
export function calculateAverage(values: number[]): number {
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Group metrics by operation name and member count
 */
export function groupMetricsByOperation(
  metrics: [
    string,
    { values: number[]; threshold: number; members?: string },
  ][],
): Map<string, { operationName: string; members: string; operationData: any }> {
  const groups = new Map();

  for (const [operation, data] of metrics) {
    // Parse operation name and member count
    const dashMatch = operation.match(/^([a-zA-Z]+)-(\d+)$/);
    const operationName = dashMatch ? dashMatch[1] : operation.split(":")[0];
    const memberCount = dashMatch ? dashMatch[2] : data.members || "-";

    // Create unique key for this operation + member combination
    const groupKey = `${operationName}-${memberCount}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        operationName,
        members: memberCount,
        operationData: null,
      });
    }

    groups.get(groupKey).operationData = data;
  }

  return groups;
}
