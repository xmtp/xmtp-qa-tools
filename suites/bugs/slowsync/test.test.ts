import { streamTimeout } from "@helpers/client";
import { sendMetric, type ResponseMetricTags } from "@helpers/datadog";
import { verifyMembershipStream, verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getAddresses, getInboxIds, getRandomAddress } from "@inboxes/utils";
import { getWorkers, type Worker } from "@workers/manager";
import {
  Client,
  ConsentEntityType,
  ConsentState,
  IdentifierKind,
  type Dm,
} from "@xmtp/node-sdk";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "performance";
describe(testName, async () => {
  let dm: Dm | undefined;
  let workers = await getWorkers(10, {
    randomNames: false,
  });

  const creator = workers.get("edward");
  const receiver = workers.get("bob");
  const creatorClient = creator!.client;
  let customDuration: number | undefined = undefined;
  const setCustomDuration = (duration: number | undefined) => {
    customDuration = duration;
  };

  beforeAll(async () => {
    for (const worker of workers.getAll()) {
      await worker.client.conversations.syncAll();
      console.log(
        worker.name,
        "has",
        (await worker.client.conversations.list()).length,
        "conversations",
      );
    }
  });
  setupTestLifecycle({
    testName,
    getCustomDuration: () => customDuration,
    setCustomDuration: (v) => {
      customDuration = v;
    },
    sendMetrics: true,
    sendDurationMetrics: true,
    networkStats: true,
  });

  let randomWorker: Worker;
  it("create: measure creating a client", async () => {
    let workers = await getWorkers(["randomclient"]);
    randomWorker = workers.get("randomclient")!;
    expect(randomWorker.inboxId).toBeDefined();
  });
  it("canMessage:measure canMessage", async () => {
    const randomAddress = randomWorker.address;
    if (!randomAddress) {
      throw new Error("Random client not found");
    }
    const start = Date.now();
    const canMessage = await Client.canMessage(
      [
        {
          identifier: randomAddress,
          identifierKind: IdentifierKind.Ethereum,
        },
      ],
      randomWorker.env,
    );
    setCustomDuration(Date.now() - start);
    expect(canMessage.get(randomAddress.toLowerCase())).toBe(true);
  });
  it("inboxState:measure inboxState", async () => {
    const inboxState = await creatorClient.preferences.inboxState(true);
    expect(inboxState.installations.length).toBeGreaterThan(0);
  });
  it("newDm:measure creating a DM", async () => {
    dm = (await creatorClient.conversations.newDm(
      receiver!.client.inboxId,
    )) as Dm;
    expect(dm).toBeDefined();
    expect(dm.id).toBeDefined();
  });
  it("newDmByAddress:measure creating a DM", async () => {
    const dm2 = await receiver!.client.conversations.newDmWithIdentifier({
      identifier: getRandomAddress(),
      identifierKind: IdentifierKind.Ethereum,
    });

    expect(dm2).toBeDefined();
    expect(dm2.id).toBeDefined();
  });
  it("getConersationById:measure getting a conversation by id", async () => {
    const conversation = await creatorClient.conversations.getConversationById(
      dm!.id,
    );
    expect(conversation!.id).toBe(dm!.id);
  });
  it("send:measure sending a gm", async () => {
    const dmId = await dm!.send("gm");
    expect(dmId).toBeDefined();
  });

  it(`consent:verify group consent`, async () => {
    await creatorClient.preferences.setConsentStates([
      {
        entity: receiver!.client.inboxId,
        entityType: ConsentEntityType.InboxId,
        state: ConsentState.Allowed,
      },
    ]);
    const consentState = await creatorClient.preferences.getConsentState(
      ConsentEntityType.InboxId,
      receiver!.client.inboxId,
    );
    console.log("consentState", consentState);
    expect(consentState).toBe(ConsentState.Allowed);
  });
  it("stream:measure receiving a gm", async () => {
    const verifyResult = await verifyMessageStream(dm!, [receiver!]);

    sendMetric("response", verifyResult.averageEventTiming, {
      test: testName,
      metric_type: "stream",
      metric_subtype: "message",
      sdk: receiver!.sdk,
    } as ResponseMetricTags);

    setCustomDuration(verifyResult.averageEventTiming ?? streamTimeout);
    expect(verifyResult.allReceived).toBe(true);
  });
});
