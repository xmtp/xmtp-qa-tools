import { execSync } from "child_process";
import { describe, expect, it } from "vitest";
import { DockerContainer } from "./container";

/**
 * Execute a ping and return the average RTT in milliseconds.
 */
function pingWithTiming(
  source: DockerContainer,
  target: DockerContainer,
  count = 3,
): number {
  const output = execSync(
    `docker exec ${source.name} ping -c ${count} ${target.ip}`,
    { stdio: "pipe" },
  ).toString();
  const rttLine = output
    .split("\n")
    .find((line) => line.includes("rtt") || line.includes("round-trip"));
  if (!rttLine) {
    throw new Error(`Could not parse RTT from ping output:\n${output}`);
  }
  // Format: rtt min/avg/max/mdev = 0.123/0.456/0.789/0.012 ms
  const match = rttLine.match(
    /=\s*[\d.]+\/([\d.]+)\/[\d.]+\/[\d.]+\s*ms/,
  );
  if (!match) {
    throw new Error(`Could not extract avg RTT from: ${rttLine}`);
  }
  return parseFloat(match[1]);
}

describe("Basic Network Fault Tests", () => {
  const node1 = new DockerContainer("multinode-node1-1");
  const node2 = new DockerContainer("multinode-node2-1");
  const node4 = new DockerContainer("multinode-node4-1");

  it("add and remove 200ms latency between node1 and node2", () => {
    console.log("[netem] Clearing existing qdisc (ok if already absent)...");
    node1.clearLatency();

    console.log("[netem] Pinging node2 from node1 before latency:");
    const baselineRtt = pingWithTiming(node1, node2);
    console.log(`[netem] Baseline avg RTT: ${baselineRtt}ms`);

    console.log(
      `[netem] Applying 200ms delay to node1 veth interface: ${node1.veth}`,
    );
    expect(() => node1.addLatency(200)).not.toThrow();

    console.log("[netem] Pinging node2 from node1 with latency:");
    const latencyRtt = pingWithTiming(node1, node2);
    console.log(`[netem] Latency avg RTT: ${latencyRtt}ms`);

    // Verify that latency was actually applied: RTT with 200ms added should
    // be at least 150ms higher than baseline (allowing some tolerance).
    expect(
      latencyRtt,
      `Expected RTT with 200ms latency (${latencyRtt}ms) to be significantly higher than baseline (${baselineRtt}ms)`,
    ).toBeGreaterThan(baselineRtt + 150);

    console.log("[netem] Removing latency...");
    expect(() => node1.clearLatency()).not.toThrow();

    console.log("[netem] Pinging node2 from node1 after latency removed:");
    const restoredRtt = pingWithTiming(node1, node2);
    console.log(`[netem] Restored avg RTT: ${restoredRtt}ms`);

    // Verify latency was actually removed: RTT should drop back near baseline
    expect(
      restoredRtt,
      `Expected RTT after removing latency (${restoredRtt}ms) to be below 150ms`,
    ).toBeLessThan(150);
  });

  it("block and restore traffic between node1 and node4", () => {
    console.log("[iptables] Pinging node4 from node1 before partition:");
    expect(() => node1.ping(node4)).not.toThrow();

    console.log("[iptables] Blocking outbound traffic from node1 to node4...");
    expect(() => node1.blockOutboundTrafficTo(node4)).not.toThrow();

    console.log(
      "[iptables] Pinging node4 from node1 during partition (expect failure):",
    );
    // Verify that ping actually fails during the partition
    expect(
      () => pingWithTiming(node1, node4, 3),
      "Ping should fail while traffic is blocked",
    ).toThrow();

    console.log(
      "[iptables] Unblocking outbound traffic from node1 to node4...",
    );
    expect(() => node1.unblockOutboundTrafficTo(node4)).not.toThrow();

    console.log("[iptables] Pinging node4 from node1 after restoring:");
    expect(() => node1.ping(node4)).not.toThrow();
  });
});
