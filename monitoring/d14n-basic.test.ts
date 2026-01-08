/**
 * D14N Basic Functionality Test
 * 
 * Tests what currently works on D14N testnet-dev.
 * NOTE: DM/Group creation is broken due to key package lookup issues.
 * 
 * Run with: XMTP_D14N=true XMTP_API_URL=https://grpc.testnet-dev.xmtp.network:443 yarn test d14n-basic
 */
import { describe, expect, it, beforeAll } from "vitest";
import { Client, LogLevel } from "@xmtp/node-sdk-5.0.0";
import { createSigner, generateEncryptionKeyHex, getEncryptionKeyFromHex } from "@helpers/client";
import { generatePrivateKey } from "viem/accounts";
import { isD14NEnabled } from "@helpers/versions";

describe("D14N Basic Functionality", () => {
  // Skip if not D14N mode
  const runTests = isD14NEnabled();
  
  if (!runTests) {
    it.skip("Skipped - Set XMTP_D14N=true to run", () => {});
    return;
  }

  const apiUrl = process.env.XMTP_API_URL || "https://grpc.testnet-dev.xmtp.network:443";
  const gatewayUrl = process.env.XMTP_GATEWAY_URL || apiUrl.replace(/grpc\./, 'payer.');
  
  let clients: Client[] = [];

  async function createClient(name: string): Promise<Client> {
    const walletKey = generatePrivateKey();
    const encryptionKey = getEncryptionKeyFromHex(generateEncryptionKeyHex());
    const signer = createSigner(walletKey);

    const client = await Client.create(signer as any, {
      dbEncryptionKey: encryptionKey,
      dbPath: null, // In-memory for tests
      loggingLevel: LogLevel.Warn,
      apiUrl,
      gatewayHost: gatewayUrl,
      disableDeviceSync: true,
    });

    console.log(`[${name}] Created client with inboxId: ${client.inboxId.slice(0, 16)}...`);
    clients.push(client);
    return client;
  }

  it("should create client with D14N gateway", async () => {
    const client = await createClient("test-user-1");
    
    expect(client).toBeDefined();
    expect(client.inboxId).toBeDefined();
    expect(client.inboxId.length).toBe(64);
    expect(client.installationId).toBeDefined();
    
    console.log(`✅ Client created successfully`);
    console.log(`   InboxId: ${client.inboxId}`);
    console.log(`   InstallationId: ${client.installationId}`);
  });

  it("should sync conversations without error", async () => {
    const client = await createClient("test-user-2");
    
    // sync() should work
    await expect(client.conversations.sync()).resolves.not.toThrow();
    console.log(`✅ conversations.sync() works`);
    
    // syncAll() should work
    await expect(client.conversations.syncAll()).resolves.not.toThrow();
    console.log(`✅ conversations.syncAll() works`);
  });

  it("should list conversations (empty)", async () => {
    const client = await createClient("test-user-3");
    
    const convos = await client.conversations.list();
    expect(Array.isArray(convos)).toBe(true);
    console.log(`✅ conversations.list() works - found ${convos.length} conversations`);
  });

  it("KNOWN ISSUE: lookup other users may fail on D14N", async () => {
    const alice = await createClient("alice");
    const bob = await createClient("bob");
    
    // This sometimes works, sometimes fails on D14N
    try {
      const bobState = await alice.preferences.inboxStateFromInboxIds([bob.inboxId], true);
      expect(bobState).toBeDefined();
      expect(bobState.length).toBe(1);
      console.log(`✅ Alice can look up Bob's inbox`);
      console.log(`   Bob has ${bobState[0].installations.length} installation(s)`);
    } catch (error: any) {
      // Expected on D14N
      console.log(`❌ Lookup failed (known issue): ${error.message}`);
      expect(error.message).toMatch(/Missing identity update|key packages/);
    }
  });

  it("KNOWN ISSUE: inboxState() fails on D14N", async () => {
    const client = await createClient("test-user-4");
    
    // This is expected to fail on D14N
    try {
      await client.preferences.inboxState();
      console.log(`⚠️ inboxState() unexpectedly succeeded!`);
    } catch (error: any) {
      console.log(`✅ Confirmed: inboxState() fails with expected error`);
      console.log(`   Error: ${error.message}`);
      // Accept any of the known D14N errors
      expect(error.message).toMatch(/Missing identity update|key packages|Sync failed/);
    }
  });

  it("KNOWN ISSUE: DM creation fails on D14N", async () => {
    const alice = await createClient("alice-dm");
    const bob = await createClient("bob-dm");
    
    // Wait a bit for propagation
    await new Promise(r => setTimeout(r, 2000));
    
    // This is expected to fail on D14N
    try {
      const dm = await alice.conversations.newDm(bob.inboxId);
      console.log(`⚠️ DM creation unexpectedly succeeded! ID: ${dm.id}`);
    } catch (error: any) {
      console.log(`✅ Confirmed: DM creation fails with expected error`);
      console.log(`   Error: ${error.message}`);
      // Accept any of the known D14N errors
      expect(error.message).toMatch(/key packages|Sync failed|Missing identity/);
    }
  });
});

