import { typeOfSync } from "@workers/main";
import { getWorkers } from "@workers/manager";
import { ConsentEntityType, ConsentState, type Dm } from "@xmtp/node-sdk";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "slowsync";
describe(testName, async () => {
  let dm: Dm | undefined;
  let workers = await getWorkers(["randomclient", "edward"]);

  beforeAll(async () => {
    for (const worker of workers.getAll()) {
      worker.worker.startSync(typeOfSync.Both);
      console.log(
        "started sync for",
        worker.name,
        "with",
        (await worker.client.conversations.list()).length,
        "conversations",
      );
    }
  });
  for (const worker of workers.getAll()) {
    const creator = workers.get(
      worker.name === "edward" ? "randomclient" : "edward",
    );
    const receiver = workers.get(
      worker.name === "edward" ? "edward" : "randomclient",
    );

    it("inboxState:measure inboxState", async () => {
      console.log("Creator", creator?.name);
      console.log("Receiver", receiver?.name);
      const inboxState = await creator?.client.preferences.inboxState(true);
      expect(inboxState?.installations.length).toBeGreaterThan(0);
    });
    it("newDm:measure creating a DM", async () => {
      dm = (await creator?.client.conversations.newDm(
        receiver!.client.inboxId,
      )) as Dm;
      console.log("Created dm with id", dm?.id);
      await dm.sync();
      expect(dm).toBeDefined();
      expect(dm.id).toBeDefined();
    });
    it("getConversationById:measure getting a conversation by id", async () => {
      if (worker.name === "randomclient") {
        expect(true).toBe(true);
        return;
      }
      for (let i = 0; i < 500; i++) {
        const start = Date.now();
        const randomConversation = (
          await creator?.client.conversations.list()
        )?.[
          Math.floor(
            Math.random() *
              ((await creator?.client.conversations.list())?.length ?? 0),
          )
        ];
        const conversation =
          await creator?.client.conversations.getConversationById(
            randomConversation?.id ?? "",
          );
        console.log("Found conversation", Date.now() - start);
        const members = await conversation?.members();
        console.log("Members", members?.length);
        await creator?.client.preferences.setConsentStates([
          {
            entity: members?.[0]?.inboxId ?? "",
            entityType: ConsentEntityType.InboxId,
            state: ConsentState.Allowed,
          },
        ]);
        console.log("Set consent", Date.now() - start);
        await creator?.client.preferences.getConsentState(
          ConsentEntityType.GroupId,
          conversation!.id,
        );
        console.log("Got consent", Date.now() - start);
      }
    });
    it("send:measure sending a gm", async () => {
      const dmId = await dm!.send("gm");
      expect(dmId).toBeDefined();
    });
  }
});
