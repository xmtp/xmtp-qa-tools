import { loadEnv } from "@helpers/client";
import { verifyMessageStream } from "@helpers/streams";
import { getWorkers, type Worker } from "@workers/manager";
import type { Conversation } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "installations";
loadEnv(testName);
const names = ["user1", "user2", "user3"];

describe(testName, () => {
  it("should create workers with different installations", async () => {
    const workers = await getWorkers([names[0], names[0] + "-b"], testName);

    const userA = workers.get(names[0]);
    const userB = workers.get(names[0], "b");

    expect(userA?.folder).toBe("a");
    expect(userB?.folder).toBe("b");
    expect(userA?.client.inboxId).toBe(userB?.client.inboxId);
    expect(userA?.client.installationId).not.toBe(userB?.client.installationId);
  });

  it("should handle installation management", async () => {
    const workers = await getWorkers([names[1]], testName);
    const worker = workers.get(names[1]);

    expect(worker).toBeDefined();

    const initialState = await worker!.client.preferences.inboxState();
    expect(initialState.installations.length).toBeGreaterThan(0);

    await worker!.worker.checkAndManageInstallations(1);

    const finalState = await worker!.client.preferences.inboxState();
    expect(finalState.installations.length).toBeGreaterThan(0);
  });

  it("should add new installation", async () => {
    const workers = await getWorkers([names[2], names[1]], testName);
    const originalWorker = workers.get(names[2]);

    expect(originalWorker).toBeDefined();

    const originalInstallationId = originalWorker!.client.installationId;
    const convo = await workers
      .get(names[2])!
      .client.conversations.newDm(workers.get(names[1])!.client.inboxId);
    await convo.send("Hello");
    const verifyResult1 = await verifyMessageStream(convo as Conversation, [
      originalWorker!,
    ]);
    expect(verifyResult1.allReceived).toBe(true);

    const newInstallation = await originalWorker!.worker.addNewInstallation();
    const verifyResult2 = await verifyMessageStream(convo as Conversation, [
      newInstallation as Worker,
    ]);
    expect(verifyResult2.allReceived).toBe(true);
    expect(newInstallation.installationId).toBeDefined();
    expect(newInstallation.installationId).not.toBe(originalInstallationId);
    expect(newInstallation.client.inboxId).toBe(originalWorker!.client.inboxId);
  });

  it("should handle manager operations", async () => {
    const workers = await getWorkers(["testuser"], testName);

    await expect(workers.checkInstallations()).resolves.not.toThrow();

    await expect(
      workers.addNewInstallationToWorker("nonexistent"),
    ).rejects.toThrow();
  });
});
