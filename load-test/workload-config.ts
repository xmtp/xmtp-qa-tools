/**
 * Workload Mix Configuration
 * 
 * Defines the percentage distribution of different XMTP operations
 * All percentages should add up to 100
 */

export interface WorkloadMix {
  // Messaging operations
  sendMessage: number;
  
  // Group metadata operations
  updateName: number;
  updateDescription: number;
  updateImageUrl: number;
  
  // Member management operations
  addMember: number;
  removeMember: number;
  
  // Admin management operations
  addAdmin: number;
  removeAdmin: number;
  addSuperAdmin: number;
  removeSuperAdmin: number;
  
  // Sync operations
  sync: number;
}

export const WORKLOAD_PRESETS: Record<string, WorkloadMix> = {
  // 100% messages - original behavior
  messagesOnly: {
    sendMessage: 100,
    updateName: 0,
    updateDescription: 0,
    updateImageUrl: 0,
    addMember: 0,
    removeMember: 0,
    addAdmin: 0,
    removeAdmin: 0,
    addSuperAdmin: 0,
    removeSuperAdmin: 0,
    sync: 0,
  },
  
  // Balanced mix across all operation types
  balanced: {
    sendMessage: 40,
    updateName: 10,
    updateDescription: 5,
    updateImageUrl: 5,
    addMember: 10,
    removeMember: 10,
    addAdmin: 5,
    removeAdmin: 5,
    addSuperAdmin: 5,
    removeSuperAdmin: 5,
    sync: 0,
  },
  
  // Heavy metadata changes
  metadata: {
    sendMessage: 30,
    updateName: 20,
    updateDescription: 20,
    updateImageUrl: 20,
    addMember: 5,
    removeMember: 5,
    addAdmin: 0,
    removeAdmin: 0,
    addSuperAdmin: 0,
    removeSuperAdmin: 0,
    sync: 0,
  },
  
  // Heavy member churn
  memberChurn: {
    sendMessage: 20,
    updateName: 5,
    updateDescription: 0,
    updateImageUrl: 0,
    addMember: 35,
    removeMember: 35,
    addAdmin: 2.5,
    removeAdmin: 2.5,
    addSuperAdmin: 0,
    removeSuperAdmin: 0,
    sync: 0,
  },
  
  // Admin operations focus
  adminOps: {
    sendMessage: 30,
    updateName: 5,
    updateDescription: 5,
    updateImageUrl: 0,
    addMember: 10,
    removeMember: 10,
    addAdmin: 15,
    removeAdmin: 10,
    addSuperAdmin: 10,
    removeSuperAdmin: 5,
    sync: 0,
  },
  
  // Realistic production-like mix
  realistic: {
    sendMessage: 70,
    updateName: 5,
    updateDescription: 2,
    updateImageUrl: 1,
    addMember: 8,
    removeMember: 5,
    addAdmin: 3,
    removeAdmin: 2,
    addSuperAdmin: 2,
    removeSuperAdmin: 2,
    sync: 0,
  },
};

/**
 * Validates that workload percentages add up to 100
 */
export function validateWorkloadMix(mix: WorkloadMix): void {
  const total = Object.values(mix).reduce((sum, val) => sum + val, 0);
  if (Math.abs(total - 100) > 0.01) {
    throw new Error(`Workload mix must total 100%, got ${total}%`);
  }
}

/**
 * Selects an operation based on weighted probabilities
 */
export function selectOperation(mix: WorkloadMix): keyof WorkloadMix {
  validateWorkloadMix(mix);
  
  const random = Math.random() * 100;
  let cumulative = 0;
  
  for (const [operation, weight] of Object.entries(mix)) {
    cumulative += weight;
    if (random <= cumulative) {
      return operation as keyof WorkloadMix;
    }
  }
  
  // Fallback (should never reach here)
  return 'sendMessage';
}

/**
 * Get workload mix from preset name or custom definition
 */
export function getWorkloadMix(presetOrCustom: string | WorkloadMix): WorkloadMix {
  if (typeof presetOrCustom === 'string') {
    const preset = WORKLOAD_PRESETS[presetOrCustom];
    if (!preset) {
      throw new Error(`Unknown workload preset: ${presetOrCustom}. Available: ${Object.keys(WORKLOAD_PRESETS).join(', ')}`);
    }
    return preset;
  }
  return presetOrCustom;
}



