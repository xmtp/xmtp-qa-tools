import { XMTP } from "@xmtp/agent-starter";
import { describe, expect, test } from "vitest";

describe("Deeplink Tests", () => {
  test("If no dm created, create one", async () => {
    const xmtp = new XMTP();
    await xmtp.init();

    if (!xmtp.address) {
      expect(xmtp.address).toBeUndefined();
      return;
    }
    const inboxId = await xmtp.client?.getInboxIdByAddress(xmtp.address);
    if (!inboxId) {
      expect(inboxId).toBeUndefined();
      return;
    }

    let dm = xmtp.client?.conversations.getDmByInboxId(inboxId);
    console.log("dm", dm);
    if (!dm) {
      const dmGroup = await xmtp.client?.conversations.newDm(xmtp.address);
      dm = dmGroup;
    }
    console.log("dm", dm?.id);
    expect(dm?.id).toBeDefined();
  }, 25000);
});
