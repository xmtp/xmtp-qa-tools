import { type DockerContainer } from "network-stability/container";
import { type ChaosPreset } from "./config";

const applyPresetToNode = (node: DockerContainer, preset: ChaosPreset) => {
  const delay = Math.floor(
    preset.delayMin + Math.random() * (preset.delayMax - preset.delayMin),
  );
  const jitter = Math.floor(
    preset.jitterMin + Math.random() * (preset.jitterMax - preset.jitterMin),
  );
  const loss =
    preset.lossMin + Math.random() * (preset.lossMax - preset.lossMin);

  try {
    node.addJitter(delay, jitter);
    node.addLoss(loss);
  } catch (err) {
    console.warn(`[chaos] Error applying netem on ${node.name}:`, err);
  }
};

const validateContainers = (allNodes: DockerContainer[]) => {
  for (const node of allNodes) {
    try {
      // Test if container exists by trying to get its IP
      if (!node.ip || !node.veth) {
        throw new Error(`Container ${node.name} has no IP address`);
      }
    } catch {
      throw new Error(
        `Docker container ${node.name} is not running. Network chaos requires local multinode setup (./dev/up).`,
      );
    }
  }
};

export const startChaos = (
  allNodes: DockerContainer[],
  preset: ChaosPreset,
): NodeJS.Timeout => {
  validateContainers(allNodes);
  console.log(`[chaos] Initialized ${allNodes.length} Docker containers`);
  // Function to apply chaos to all nodes
  const applyChaos = () => {
    console.log(
      "[chaos] Applying jitter, delay, and drop rules to all nodes...",
    );
    for (const node of allNodes) {
      applyPresetToNode(node, preset);
    }
  };

  // Apply chaos immediately
  applyChaos();

  return setInterval(applyChaos, preset.interval);
};

export const clearChaos = (allNodes: DockerContainer[]) => {
  // Clear network rules
  for (const node of allNodes) {
    try {
      node.clearLatency();
    } catch (err) {
      console.warn(`[chaos] Error clearing latency on ${node.name}:`, err);
    }
  }
};
