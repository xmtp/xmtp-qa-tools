import fs from "fs";
import dotenv from "dotenv";
import { beforeAll, describe, expect, it } from "vitest";
import { ClientManager } from "../helpers/manager";

dotenv.config();

const TIMEOUT = 20000;
const environments = ["dev"];
const versions = ["40", "41", "42"];
const installationIds = ["a", "b"];

describe("Test for all version combinations in DMs using the same installation", () => {
  beforeAll(() => {
    //Delete the data folder before running all tests for creating new installation but keep the installation as it persists
    fs.rmSync(".data", { recursive: true, force: true });
  });

  environments.forEach((env) => {
    installationIds.forEach((bobInstallationId, bobInstallIndex) => {
      installationIds
        .slice(bobInstallIndex + 1)
        .forEach((aliceInstallationId) => {
          versions.forEach((bobVersion) => {
            versions.forEach((aliceVersion) => {
              if (
                bobVersion !== aliceVersion ||
                bobInstallationId !== aliceInstallationId
              ) {
                it(
                  `bob (version: ${bobVersion}, installationId: ${bobInstallationId}) -> alice (version: ${aliceVersion}, installationId: ${aliceInstallationId}) with env: ${env}`,
                  async () => {
                    const bob = new ClientManager({
                      env,
                      version: bobVersion,
                      name: "Bob",
                      installationId: bobInstallationId,
                    });

                    const alice = new ClientManager({
                      env,
                      version: aliceVersion,
                      name: "Alice",
                      installationId: aliceInstallationId,
                    });

                    await bob.initialize();
                    await alice.initialize();

                    const gm =
                      "gm-" + Math.random().toString(36).substring(2, 15);

                    let receivedMessage = false;
                    if (
                      (bobInstallIndex + bobVersion.charCodeAt(0)) % 2 ===
                      0
                    ) {
                      // Bob sends, Alice receives
                      const aliceAddress = alice.client.accountAddress;

                      await Promise.all([
                        alice
                          .waitForReply(gm)
                          .then((result) => (receivedMessage = result)),
                        bob.sendMessage(aliceAddress, gm),
                      ]);
                    } else {
                      // Alice sends, Bob receives
                      const bobAddress = bob.client.accountAddress;

                      await Promise.all([
                        bob
                          .waitForReply(gm)
                          .then((result) => (receivedMessage = result)),
                        alice.sendMessage(bobAddress, gm),
                      ]);
                    }
                    expect(receivedMessage).toBe(true);
                  },
                  TIMEOUT,
                );
              }
            });
          });
        });
    });
  });
});

describe("Test for all version combinations in DMs using a new installation", () => {
  beforeAll(() => {});

  environments.forEach((env) => {
    installationIds.forEach((bobInstallationId, bobInstallIndex) => {
      installationIds
        .slice(bobInstallIndex + 1)
        .forEach((aliceInstallationId) => {
          versions.forEach((bobVersion) => {
            versions.forEach((aliceVersion) => {
              if (
                bobVersion !== aliceVersion ||
                bobInstallationId !== aliceInstallationId
              ) {
                //Delete the data folder before running all tests for creating new installation but keep the installation as it persists
                fs.rmSync(".data", { recursive: true, force: true });
                it(
                  `bob (version: ${bobVersion}, installationId: ${bobInstallationId}) -> alice (version: ${aliceVersion}, installationId: ${aliceInstallationId}) with env: ${env}`,
                  async () => {
                    const bob = new ClientManager({
                      env,
                      version: bobVersion,
                      name: "Bob",
                      installationId: bobInstallationId,
                    });

                    const alice = new ClientManager({
                      env,
                      version: aliceVersion,
                      name: "Alice",
                      installationId: aliceInstallationId,
                    });

                    await bob.initialize();
                    await alice.initialize();

                    const gm =
                      "gm-" + Math.random().toString(36).substring(2, 15);

                    let receivedMessage = false;
                    if (
                      (bobInstallIndex + bobVersion.charCodeAt(0)) % 2 ===
                      0
                    ) {
                      // Bob sends, Alice receives
                      const aliceAddress = alice.client.accountAddress;

                      await Promise.all([
                        alice
                          .waitForReply(gm)
                          .then((result) => (receivedMessage = result)),
                        bob.sendMessage(aliceAddress, gm),
                      ]);
                    } else {
                      // Alice sends, Bob receives
                      const bobAddress = bob.client.accountAddress;

                      await Promise.all([
                        bob
                          .waitForReply(gm)
                          .then((result) => (receivedMessage = result)),
                        alice.sendMessage(bobAddress, gm),
                      ]);
                    }
                    expect(receivedMessage).toBe(true);
                  },
                  TIMEOUT,
                );
              }
            });
          });
        });
    });
  });
});
