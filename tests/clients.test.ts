import fs from "fs";
import { createAgent, getDataSubFolderCount } from "@agents/factory";
import type { AgentManager } from "@agents/manager";
import { closeEnv, loadEnv } from "@helpers/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testName = "clients";
loadEnv(testName);

describe(testName, () => {
  let agents: AgentManager;

  let folderCount: number = 0;
  beforeAll(() => {
    fs.rmSync(".data", { recursive: true, force: true });
  });

  afterAll(async () => {
    await closeEnv(testName, agents);
  });

  it("create random personas", async () => {
    agents = await createAgent(["random"], testName, "none");
    folderCount++;
    expect(agents.get("random")?.client?.inboxId).toBeDefined();
    expect(getDataSubFolderCount()).toBe(folderCount);
  });

  it("should create a persona", async () => {
    agents = await createAgent(["bob", "random"], testName, "none");
    folderCount++;
    expect(agents.get("bob")?.client?.inboxId).toBeDefined();
    expect(getDataSubFolderCount()).toBe(folderCount);
  });

  it("should create a random persona", async () => {
    agents = await createAgent(["random"], testName, "none");

    expect(agents.get("random")?.client?.inboxId).toBeDefined();
    expect(getDataSubFolderCount()).toBe(folderCount);
  });

  it("should create multiple personas", async () => {
    agents = await createAgent(
      ["bob", "alice", "randompep", "randombob"],
      testName,
      "none",
    );
    folderCount++;
    folderCount++;
    folderCount++;
    expect(agents.get("bob")?.client?.inboxId).toBeDefined();
    expect(agents.get("alice")?.client?.inboxId).toBeDefined();
    expect(agents.get("randompep")?.client?.inboxId).toBeDefined();
    expect(agents.get("randombob")?.client?.inboxId).toBeDefined();
    expect(getDataSubFolderCount()).toBe(folderCount);
  });
});
