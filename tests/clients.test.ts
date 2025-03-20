import fs from "fs";
import { loadEnv } from "@helpers/client";
import { IdentifierKind } from "@helpers/types";
import { getWorkers } from "@workers/manager";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "clients";
loadEnv(testName);

describe(testName, () => {
  beforeAll(() => {
    fs.rmSync(".data", { recursive: true, force: true });
  });

  it("canMessage: should measure canMessage", async () => {
    const workers = await getWorkers(["henry"], testName, "none");
    const address = "0x83e894b586d183380e1fb6602cd8349520c03dfa";
    const canMessage = await workers.get("henry")!.client.canMessage([
      {
        identifier: address,
        identifierKind: IdentifierKind.Ethereum,
      },
    ]);
    console.log(canMessage.get(address));
    expect(canMessage.get(address)).toBe(true);
  });

  it("create random workers", async () => {
    const workers = await getWorkers(["random"], testName, "none");
    expect(workers.get("random")?.client?.inboxId).toBeDefined();
  });

  it("should create a worker", async () => {
    const workers = await getWorkers(["bob", "random"], testName, "none");
    expect(workers.get("bob")?.client?.inboxId).toBeDefined();
  });

  it("should create a random worker", async () => {
    const workers = await getWorkers(["random"], testName, "none");

    expect(workers.get("random")?.client?.inboxId).toBeDefined();
  });

  it("should create multiple workers", async () => {
    const workers = await getWorkers(
      ["bob", "alice", "randompep", "randombob"],
      testName,
      "none",
    );
    expect(workers.get("bob")?.client?.inboxId).toBeDefined();
    expect(workers.get("alice")?.client?.inboxId).toBeDefined();
    expect(workers.get("randompep")?.client?.inboxId).toBeDefined();
    expect(workers.get("randombob")?.client?.inboxId).toBeDefined();
  });
});
