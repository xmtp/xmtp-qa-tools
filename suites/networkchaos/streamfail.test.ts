import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";
import { DockerContainer } from "../../network-stability-utilities/container";

const testName = "group-node-blackhole";
describe(testName, async () => {
  setupTestLifecycle({ testName });
  const workers = await getWorkers({
    user1: "http://localhost:5556",
    user2: "http://localhost:5556",
    user3: "http://localhost:6556",
    user4: "http://localhost:6556",
  });
  // Start message and response streams for the chaos testing
  workers.startStream(typeofStream.MessageandResponse);

  const node1 = new DockerContainer("multinode-node1-1");
  const node2 = new DockerContainer("multinode-node2-1");
  const node3 = new DockerContainer("multinode-node3-1");
  const node4 = new DockerContainer("multinode-node4-1");

  let group: Group;
  const expectedMessages = ["gm-bh-1", "gm-bh-2", "gm-bh-3"];

  it("should simulate a node blackhole in a group chat and recover cleanly", async () => {
    console.log("[test] Creating group conversation");
    group = await workers.createGroupBetweenAll("Black hole stream fail test");
    await group.sync();

    console.log("[test] Verifying initial message delivery to all");
    const preCheck = await verifyMessageStream(
      group,
      workers.getAllButCreator(),
    );
    expect(preCheck.allReceived).toBe(true);

    console.log("[test] Applying blackhole");
    node2.simulateBlackhole([node1, node3, node4]);

    console.log("[test] Mid-test before-recovery stream check - stream should timeout");
    const brokenCheck = await verifyMessageStream(
      group,
      workers.getAllButCreator(),
    );

    expect(brokenCheck.allReceived).toBe(true);
    expect(brokenCheck.orderPercentage).toBe(100);
  });
});
