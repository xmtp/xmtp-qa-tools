import type { ChaosProvider } from "@chaos/provider";
import type { DockerContainer } from "network-stability/container";

export type NetworkChaosConfig = {
  delayMin: number; // Minimum delay in ms
  delayMax: number; // Maximum delay in ms
  jitterMin: number; // Minimum jitter in ms
  jitterMax: number; // Maximum jitter in ms
  lossMin: number; // Minimum packet loss percentage (0-100)
  lossMax: number; // Maximum packet loss percentage (0-100)
  interval: number; // How often to apply chaos in ms
};

// import type { Worker } from "@workers/manager";

export class NetworkChaos implements ChaosProvider {
  config: NetworkChaosConfig;
  interval?: NodeJS.Timeout;
  nodes: DockerContainer[];

  constructor(config: NetworkChaosConfig, nodes: DockerContainer[]) {
    this.config = config;
    this.nodes = nodes;
  }

  start(): Promise<void> {
    console.log(`Starting network chaos:
      Nodes: ${this.nodes.map((node) => node.name).join(", ")}
      Delay: ${this.config.delayMin}ms - ${this.config.delayMax}ms
      Jitter: ${this.config.jitterMin}ms - ${this.config.jitterMax}ms
      Loss: ${this.config.lossMin}% - ${this.config.lossMax}%
      Interval: ${this.config.interval}ms`);

    validateContainers(this.nodes);
    this.clearAll();

    this.interval = setInterval(() => {
      for (const node of this.nodes) {
        this.applyToNode(node);
      }
    }, this.config.interval);

    return Promise.resolve();
  }

  private applyToNode(node: DockerContainer) {
    const { delayMin, delayMax, jitterMin, jitterMax, lossMin, lossMax } =
      this.config;
    const delay = Math.floor(delayMin + Math.random() * (delayMax - delayMin));
    const jitter = Math.floor(
      jitterMin + Math.random() * (jitterMax - jitterMin),
    );
    const loss = lossMin + Math.random() * (lossMax - lossMin);

    try {
      node.addJitter(delay, jitter);
      node.addLoss(loss);
    } catch (err) {
      console.warn(`[chaos] Error applying netem on ${node.name}:`, err);
    }
  }

  clearAll() {
    for (const node of this.nodes) {
      try {
        node.clearLatency();
      } catch (err) {
        console.warn(`[chaos] Error clearing latency on ${node.name}:`, err);
      }
    }
  }

  stop(): Promise<void> {
    if (this.interval) {
      clearInterval(this.interval);
    }

    this.clearAll();

    return Promise.resolve();
  }
}

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
