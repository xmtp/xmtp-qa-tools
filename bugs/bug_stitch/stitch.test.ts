import { closeEnv, loadEnv } from "@helpers/client";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { afterAll, describe, it } from "vitest";

/*STICHED IN CB*/

/*WALLET_KEY_BOB=0xdfc5794cff143b45a3761da068265eef21d1047107a2d071a338d0e08b310757
ENCRYPTION_KEY_BOB=21f49e58d51c4685ebece1b210c8606425558bcd3597aba74cc6d4c84e7bdba5
# public key is 0x45Cff2AC00FEF93e90f365F13E8c35382B20722B

WALLET_KEY_ALICE=0x6f1492016ec6a6265b301ba14ee2da88ea6ab91a5c73a5b24aa1923e0149b7b2
ENCRYPTION_KEY_ALICE=08b3fc095cfb0d49bb0b53402e2b25ab679cfe4c604ad7827714fbd3ca0bae75
# public key is 0xD23bfB28265A1E9DA6A4967F0F5DE99980a1ddA2
*/
const testName = "bug_stitch";
loadEnv(testName);

describe(testName, () => {
  let workers: WorkerManager;
  const cbUser = process.env.CB_USER;
  const convosUser = process.env.CONVOS_USER;
  if (!cbUser || !convosUser) {
    throw new Error("CB_USER or CONVOS_USER is not set");
  }
  afterAll(async () => {
    await closeEnv(testName, workers);
  });

  it("should create duplicate conversations when web client restarts", async () => {
    workers = await getWorkers(["ivy-100", "ivy-104"], testName);
    const ivy100 = workers.get("ivy-100");
    const ivy104 = workers.get("ivy-104");
    console.log("ivy100", ivy100?.version, "ivy104", ivy104?.version);
    await ivy100?.client.conversations.syncAll();
    const newConvo = await ivy100?.client.conversations.newDm(convosUser);
    console.log("newConvo", newConvo?.id);
    const message = "gm from ivy-a100" + (newConvo?.id || "");
    console.log(message);
    await newConvo?.send(message);

    console.warn("Ivy  terminates, deletes local data, and restarts");
    await ivy100?.worker.clearDB();
    await ivy100?.worker.initialize();

    const newConvo2 = await ivy100?.client.conversations.newDm(convosUser);
    const message2 = "gm from ivy-a100 " + (newConvo2?.id || "");
    console.log(message2);
    await newConvo2?.send(message2);

    //104

    const newConvo3 = await ivy104?.client.conversations.newDm(convosUser);
    const message3 = "gm from ivy-a104 " + (newConvo3?.id || "");
    console.log(message3);
    await newConvo3?.send(message3);
  });
});
