import fs from "fs";
import { closeEnv, loadEnv } from "@helpers/client";
import { type Installation, type Persona } from "@helpers/types";
import { getWorkers } from "@helpers/workers/factory";
import { afterAll, beforeAll, describe, it } from "vitest";

const testName = "installations";
loadEnv(testName);

describe(testName, () => {
  let personas: Record<string, Persona>;
  let installations: Installation[] = [];
  beforeAll(async () => {
    fs.rmSync(".data", { recursive: true, force: true });
    personas = await getWorkers(
      ["bob-a", "bob-b", "bob-c", "bob-d"],
      testName,
      "none",
    );
  });

  afterAll(async () => {
    await closeEnv(testName, personas);
  });

  it("inboxState", async () => {
    const inboxState = await personas["bob-a"].client?.inboxState(true);
    installations = inboxState?.installations ?? [];
    console.log(installations.length);
  });
});

// if (installations.length > 1) {
//   try {
//     for (const installation of installations) {
//       await personas.bug.client?.revokeInstallations([installation.bytes]);
//     }
//     await personas.bug.client?.revokeAllOtherInstallations();
//   } catch (error) {
//     console.log(error);
//   }
// }
