import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { getFixedNames } from "@helpers/tests";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { IdentifierKind, type Group } from "@xmtp/node-sdk";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "bug_welcome";
loadEnv(testName);

describe(testName, () => {
  let workers: WorkerManager;
  let group: Group;

  beforeAll(async () => {
    const names = getFixedNames(10);
    workers = await getWorkers(names, testName, typeofStream.Message);
    await getWorkers(names, testName, typeofStream.Conversation);
  });

  setupTestLifecycle({
    expect,
  });

  it("stream: send the stream", async () => {
    group = await workers.createGroup();
    console.log("Group created", group.id);
    expect(group.id).toBeDefined();
  });

  it("should send message to specific address", async () => {
    try {
      const targetAddress = "0x6461bf53ddb33b525c84bf60d6bb31fa10828474";

      const conversation = await workers
        .getCreator()
        .client.conversations.newDmWithIdentifier({
          identifier: targetAddress,
          identifierKind: IdentifierKind.Ethereum,
        });

      expect(conversation).toBeDefined();
      expect(conversation.id).toBeDefined();

      const message = "Test message from hpkey test";
      await conversation.send(message);

      console.log(`Message sent to ${targetAddress}: ${message}`);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
  it("stream: send the stream", async () => {
    group = await workers.createGroup();
    console.log("Group created", group.id);
    expect(group.id).toBeDefined();
  });
});
