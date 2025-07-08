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
    expect(
      (await verifyMessageStream(group, receivers, 3, "before-latency-{i}"))
        .allReceived,
    ).toBe(true);

    // Apply high latency
    for (const node of allNodes) {
      node.addLatency(500); // 500ms latency
    }

    // Verify stream fails under chaos
    expect(
      (await verifyMessageStream(group, receivers, 3, "during-latency-{i}"))
        .allReceived,
    ).toBe(false);

    // Clear chaos
    for (const node of allNodes) {
      node.clearLatency();
    }

    // Verify stream recovers
    expect(
      (await verifyMessageStream(group, receivers, 3, "after-latency-{i}"))
        .allReceived,
    ).toBe(true);
  });

  it("should fail stream under packet loss", async () => {
    const group = await workers.createGroupBetweenAll("Packet Loss Test");
    const receivers = workers.getAllButCreator();

    // Verify stream works before chaos
    expect(
      (await verifyMessageStream(group, receivers, 3, "before-loss-{i}"))
        .allReceived,
    ).toBe(true);

    // Apply packet loss
    for (const node of allNodes) {
      node.addLoss(10); // 10% packet loss
    }

    // Verify stream fails under chaos
    expect(
      (await verifyMessageStream(group, receivers, 3, "during-loss-{i}"))
        .allReceived,
    ).toBe(false);

    // Clear chaos
    for (const node of allNodes) {
      node.clearLatency();
    }

    // Verify stream recovers
    expect(
      (await verifyMessageStream(group, receivers, 3, "after-loss-{i}"))
        .allReceived,
    ).toBe(true);
  });

  it("should fail stream under jitter", async () => {
    const group = await workers.createGroupBetweenAll("Jitter Test");
    const receivers = workers.getAllButCreator();

    // Verify stream works before chaos
    expect(
      (await verifyMessageStream(group, receivers, 3, "before-jitter-{i}"))
        .allReceived,
    ).toBe(true);

    // Apply jitter
    for (const node of allNodes) {
      node.addJitter(100, 50); // 100ms delay + 50ms jitter
    }

    // Verify stream fails under chaos
    expect(
      (await verifyMessageStream(group, receivers, 3, "during-jitter-{i}"))
        .allReceived,
    ).toBe(false);

    // Clear chaos
    for (const node of allNodes) {
      node.clearLatency();
    }

    // Verify stream recovers
    expect(
      (await verifyMessageStream(group, receivers, 3, "after-jitter-{i}"))
        .allReceived,
    ).toBe(true);
  });

  it("should fail stream under network partition", async () => {
    const group = await workers.createGroupBetweenAll("Partition Test");
    const receivers = workers.getAllButCreator();

    // Verify stream works before chaos
    expect(
      (await verifyMessageStream(group, receivers, 3, "before-partition-{i}"))
        .allReceived,
    ).toBe(true);

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
    expect(
      (await verifyMessageStream(group, receivers, 3, "after-partition-{i}"))
        .allReceived,
    ).toBe(true);
  });

  it("should fail stream under blackhole", async () => {
    const group = await workers.createGroupBetweenAll("Blackhole Test");
    const receivers = workers.getAllButCreator();

    // Verify stream works before chaos
    expect(
      (await verifyMessageStream(group, receivers, 3, "before-blackhole-{i}"))
        .allReceived,
    ).toBe(true);

    // Create blackhole between nodes
    allNodes[0].simulateBlackhole([allNodes[1], allNodes[2], allNodes[3]]);

    // Verify stream fails under chaos
    expect(
      (await verifyMessageStream(group, receivers, 3, "during-blackhole-{i}"))
        .allReceived,
    ).toBe(false);

    // Clear chaos
    allNodes[0].clearBlackhole([allNodes[1], allNodes[2], allNodes[3]]);

    // Verify stream recovers
    expect(
      (await verifyMessageStream(group, receivers, 3, "after-blackhole-{i}"))
        .allReceived,
    ).toBe(true);
  });
});
