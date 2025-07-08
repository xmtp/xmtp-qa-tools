import { verifyMessageStream } from "@helpers/streams";
import { getWorkers } from "@workers/manager";
import { describe, expect, it } from "vitest";
import { DockerContainer } from "../../network-stability-utilities/container";

const testName = "stream-failure";
describe(testName, async () => {
  const allNodes = [
    new DockerContainer("multinode-node1-1"),
    new DockerContainer("multinode-node2-1"),
    new DockerContainer("multinode-node3-1"),
    new DockerContainer("multinode-node4-1"),
  ];

  const userDescriptors: Record<string, string> = {};
  for (let i = 0; i < 8; i++) {
    const user = `user${i + 1}`;
    const port = 5556 + 1000 * Math.floor(Math.random() * 4);
    userDescriptors[user] = `http://localhost:${port}`;
  }

  const workers = await getWorkers(userDescriptors);

  it("should fail stream under high latency", async () => {
    const group = await workers.createGroupBetweenAll("High Latency Test");
    const receivers = workers.getAllButCreator();

    // Verify stream works before chaos
    const beforeResult = await verifyMessageStream(
      group,
      receivers,
      3,
      "before-latency-{i}",
    );
    expect(beforeResult.allReceived).toBe(true);

    // Apply high latency
    for (const node of allNodes) {
      node.addLatency(500); // 500ms latency
    }

    // Verify stream fails under chaos
    const duringResult = await verifyMessageStream(
      group,
      receivers,
      3,
      "during-latency-{i}",
    );
    expect(duringResult.allReceived).toBe(false);

    // Clear chaos
    for (const node of allNodes) {
      node.clearLatency();
    }

    // Verify stream recovers
    const afterResult = await verifyMessageStream(
      group,
      receivers,
      3,
      "after-latency-{i}",
    );
    expect(afterResult.allReceived).toBe(true);
  });

  it("should fail stream under packet loss", async () => {
    const group = await workers.createGroupBetweenAll("Packet Loss Test");
    const receivers = workers.getAllButCreator();

    // Verify stream works before chaos
    const beforeResult = await verifyMessageStream(
      group,
      receivers,
      3,
      "before-loss-{i}",
    );
    expect(beforeResult.allReceived).toBe(true);

    // Apply packet loss
    for (const node of allNodes) {
      node.addLoss(10); // 10% packet loss
    }

    // Verify stream fails under chaos
    const duringResult = await verifyMessageStream(
      group,
      receivers,
      3,
      "during-loss-{i}",
    );
    expect(duringResult.allReceived).toBe(false);

    // Clear chaos
    for (const node of allNodes) {
      node.clearLoss();
    }

    // Verify stream recovers
    const afterResult = await verifyMessageStream(
      group,
      receivers,
      3,
      "after-loss-{i}",
    );
    expect(afterResult.allReceived).toBe(true);
  });

  it("should fail stream under jitter", async () => {
    const group = await workers.createGroupBetweenAll("Jitter Test");
    const receivers = workers.getAllButCreator();

    // Verify stream works before chaos
    const beforeResult = await verifyMessageStream(
      group,
      receivers,
      3,
      "before-jitter-{i}",
    );
    expect(beforeResult.allReceived).toBe(true);

    // Apply jitter
    for (const node of allNodes) {
      node.addJitter(100, 50); // 100ms delay + 50ms jitter
    }

    // Verify stream fails under chaos
    const duringResult = await verifyMessageStream(
      group,
      receivers,
      3,
      "during-jitter-{i}",
    );
    expect(duringResult.allReceived).toBe(false);

    // Clear chaos
    for (const node of allNodes) {
      node.clearLatency();
    }

    // Verify stream recovers
    const afterResult = await verifyMessageStream(
      group,
      receivers,
      3,
      "after-jitter-{i}",
    );
    expect(afterResult.allReceived).toBe(true);
  });

  it("should fail stream under bandwidth limit", async () => {
    const group = await workers.createGroupBetweenAll("Bandwidth Test");
    const receivers = workers.getAllButCreator();

    // Verify stream works before chaos
    const beforeResult = await verifyMessageStream(
      group,
      receivers,
      3,
      "before-bw-{i}",
    );
    expect(beforeResult.allReceived).toBe(true);

    // Apply bandwidth limit
    for (const node of allNodes) {
      node.addBandwidthLimit(1000); // 1Mbps limit
    }

    // Verify stream fails under chaos
    const duringResult = await verifyMessageStream(
      group,
      receivers,
      3,
      "during-bw-{i}",
    );
    expect(duringResult.allReceived).toBe(false);

    // Clear chaos
    for (const node of allNodes) {
      node.clearBandwidthLimit();
    }

    // Verify stream recovers
    const afterResult = await verifyMessageStream(
      group,
      receivers,
      3,
      "after-bw-{i}",
    );
    expect(afterResult.allReceived).toBe(true);
  });

  it("should fail stream under node partition", async () => {
    const group = await workers.createGroupBetweenAll("Partition Test");
    const receivers = workers.getAllButCreator();

    // Verify stream works before chaos
    const beforeResult = await verifyMessageStream(
      group,
      receivers,
      3,
      "before-partition-{i}",
    );
    expect(beforeResult.allReceived).toBe(true);

    // Partition nodes 1 and 2 from 3 and 4
    allNodes[0].addLatency(1000);
    allNodes[1].addLatency(1000);

    // Verify stream fails under chaos
    const duringResult = await verifyMessageStream(
      group,
      receivers,
      3,
      "during-partition-{i}",
    );
    expect(duringResult.allReceived).toBe(false);

    // Clear chaos
    for (const node of allNodes) {
      node.clearLatency();
    }

    // Verify stream recovers
    const afterResult = await verifyMessageStream(
      group,
      receivers,
      3,
      "after-partition-{i}",
    );
    expect(afterResult.allReceived).toBe(true);
  });
});
