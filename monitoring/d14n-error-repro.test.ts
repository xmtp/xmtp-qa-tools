/**
 * D14N Error Reproduction Test
 * 
 * This test reproduces the specific errors occurring on D14N testnet-dev.
 * Run with: XMTP_D14N=true XMTP_API_URL=https://grpc.testnet-dev.xmtp.network:443 yarn test d14n-error-repro
 * 
 * KNOWN ERRORS BEING REPRODUCED:
 * 1. "Association error: Missing identity update" - inboxState() calls fail
 * 2. "mismatched number of results, key packages X != installation_keys Y" - key package lookup fails
 * 3. "Sync failed to wait for intent" - conversation creation times out
 */
import { describe, expect, it } from "vitest";
import { Client, LogLevel } from "@xmtp/node-sdk-5.0.0";
import { createSigner, generateEncryptionKeyHex, getEncryptionKeyFromHex } from "@helpers/client";
import { generatePrivateKey } from "viem/accounts";
import { isD14NEnabled } from "@helpers/versions";

// Track all errors we encounter
const errorsEncountered: string[] = [];

function recordError(testName: string, error: string) {
  const shortError = error.length > 100 ? error.slice(0, 100) + "..." : error;
  errorsEncountered.push(`[${testName}] ${shortError}`);
  console.log(`\n❌ ERROR: ${error}\n`);
}

describe("D14N Error Reproduction", () => {
  const d14nEnabled = isD14NEnabled();
  
  if (!d14nEnabled) {
    it("SKIP: Set XMTP_D14N=true to run this test", () => {
      console.log("This test requires D14N mode. Run with:");
      console.log("XMTP_D14N=true XMTP_API_URL=https://grpc.testnet-dev.xmtp.network:443 yarn test d14n-error-repro");
    });
    return;
  }

  const apiUrl = process.env.XMTP_API_URL || "https://grpc.testnet-dev.xmtp.network:443";
  const gatewayUrl = process.env.XMTP_GATEWAY_URL || apiUrl.replace(/grpc\./, "payer.");

  console.log("\n" + "=".repeat(60));
  console.log("D14N ERROR REPRODUCTION TEST");
  console.log("=".repeat(60));
  console.log(`API URL:     ${apiUrl}`);
  console.log(`Gateway URL: ${gatewayUrl}`);
  console.log("=".repeat(60) + "\n");

  async function createClient(name: string): Promise<Client> {
    const walletKey = generatePrivateKey();
    const encryptionKey = getEncryptionKeyFromHex(generateEncryptionKeyHex());
    const signer = createSigner(walletKey);

    const client = await Client.create(signer as any, {
      dbEncryptionKey: encryptionKey,
      dbPath: null,
      loggingLevel: LogLevel.Warn,
      apiUrl,
      gatewayHost: gatewayUrl,
      disableDeviceSync: true,
    });

    console.log(`✅ [${name}] Client created - inboxId: ${client.inboxId.slice(0, 16)}...`);
    return client;
  }

  it("ERROR 1: inboxState() returns 'Missing identity update'", async () => {
    console.log("\n--- ERROR 1: Testing inboxState() ---");
    const client = await createClient("error1-client");

    try {
      const state = await client.preferences.inboxState();
      console.log("⚠️ UNEXPECTED: inboxState() succeeded:", state);
    } catch (error: any) {
      recordError("inboxState", error.message);
      // Verify this is the expected error
      expect(error.message).toContain("Missing identity update");
    }
  });

  it("ERROR 2: Key package lookup fails when creating DM", async () => {
    console.log("\n--- ERROR 2: Testing DM creation (key package lookup) ---");
    const alice = await createClient("error2-alice");
    const bob = await createClient("error2-bob");

    // Small delay to allow key packages to propagate (they won't, but we try)
    await new Promise((r) => setTimeout(r, 2000));

    try {
      console.log(`Attempting DM from Alice to Bob...`);
      console.log(`  Alice inboxId: ${alice.inboxId}`);
      console.log(`  Bob inboxId: ${bob.inboxId}`);
      
      const dm = await alice.conversations.newDm(bob.inboxId);
      console.log("⚠️ UNEXPECTED: DM created successfully:", dm.id);
    } catch (error: any) {
      recordError("newDm", error.message);
      // Could be key package error OR sync timeout
      expect(error.message).toMatch(/key packages|Sync failed|Missing identity/);
    }
  });

  it("ERROR 3: Key package lookup fails when creating Group", async () => {
    console.log("\n--- ERROR 3: Testing Group creation (key package lookup) ---");
    const alice = await createClient("error3-alice");
    const bob = await createClient("error3-bob");
    const charlie = await createClient("error3-charlie");

    await new Promise((r) => setTimeout(r, 2000));

    try {
      console.log(`Attempting Group with Alice, Bob, Charlie...`);
      const group = await alice.conversations.newGroup(
        [bob.inboxId, charlie.inboxId],
        { groupName: "Test Group" }
      );
      console.log("⚠️ UNEXPECTED: Group created successfully:", group.id);
    } catch (error: any) {
      recordError("newGroup", error.message);
      expect(error.message).toMatch(/key packages|Sync failed|Missing identity/);
    }
  });

  it("ERROR 4: getKeyPackageStatusesForInstallationIds fails", async () => {
    console.log("\n--- ERROR 4: Testing direct key package lookup ---");
    const alice = await createClient("error4-alice");
    const bob = await createClient("error4-bob");

    await new Promise((r) => setTimeout(r, 2000));

    // Try to get Bob's installation IDs first
    try {
      const bobState = await alice.preferences.inboxStateFromInboxIds([bob.inboxId], true);
      if (bobState.length > 0 && bobState[0].installations.length > 0) {
        const bobInstallationId = bobState[0].installations[0].id;
        console.log(`Bob's installation ID: ${bobInstallationId}`);

        // Now try to get key package for that installation
        const keyPackages = await alice.getKeyPackageStatusesForInstallationIds([bobInstallationId]);
        console.log("Key packages result:", Object.keys(keyPackages).length);
      } else {
        console.log("Could not get Bob's installation info");
      }
    } catch (error: any) {
      recordError("getKeyPackageStatuses", error.message);
      expect(error.message).toMatch(/key packages|Missing identity|mismatch/);
    }
  });

  it("SUMMARY: Print all errors encountered", async () => {
    console.log("\n" + "=".repeat(60));
    console.log("SUMMARY OF D14N ERRORS");
    console.log("=".repeat(60));
    
    if (errorsEncountered.length === 0) {
      console.log("No errors encountered (unexpected!)");
    } else {
      console.log(`Found ${errorsEncountered.length} error(s):\n`);
      const uniqueErrors = [...new Set(errorsEncountered.map(e => {
        // Extract just the error message part
        const match = e.match(/\] (.+)/);
        return match ? match[1] : e;
      }))];
      
      uniqueErrors.forEach((err, i) => {
        console.log(`${i + 1}. ${err}`);
      });
    }
    
    console.log("\n" + "=".repeat(60));
    console.log("TO FIX: The D14N gateway needs to properly store and return");
    console.log("key packages when clients register and when other clients");
    console.log("query for them during conversation creation.");
    console.log("=".repeat(60) + "\n");

    // This test always passes - it's for documentation
    expect(true).toBe(true);
  });
});

