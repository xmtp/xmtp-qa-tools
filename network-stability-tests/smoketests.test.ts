import { describe, it } from "vitest";
import { DockerContainer } from "../network-stability-utilities/container";

describe("Basic Network Fault Tests", () => {
  const node1 = new DockerContainer("multinode-node1-1");
  const node2 = new DockerContainer("multinode-node2-1");
  const node4 = new DockerContainer("multinode-node4-1");

  it("should add and remove 200ms latency between node1 and node2", () => {
    console.log("[netem] Clearing existing qdisc (ok if already absent)...");
    node1.clearLatency();

    console.log("[netem] Pinging node2 from node1 before latency:");
    node1.ping(node2);

    console.log(
      `[netem] Applying 200ms delay to node1 veth interface: ${node1.veth}`,
    );
    node1.addLatency(200);

    console.log("[netem] Pinging node2 from node1 with latency:");
    node1.ping(node2);

    console.log("[netem] Removing latency...");
    node1.clearLatency();

    console.log("[netem] Pinging node2 from node1 after latency removed:");
    node1.ping(node2);
  });

  it("should block and restore traffic between node1 and node4", () => {
    console.log("[iptables] Pinging node4 from node1 before partition:");
    node1.ping(node4);

    console.log("[iptables] Blocking outbound traffic from node1 to node4...");
    node1.blockOutboundTrafficTo(node4);

    console.log(
      "[iptables] Pinging node4 from node1 during partition (expect failure):",
    );
    node1.ping(node4, 3, true);

    console.log(
      "[iptables] Unblocking outbound traffic from node1 to node4...",
    );
    node1.unblockOutboundTrafficTo(node4);

    console.log("[iptables] Pinging node4 from node1 after restoring:");
    node1.ping(node4);
  });
});
