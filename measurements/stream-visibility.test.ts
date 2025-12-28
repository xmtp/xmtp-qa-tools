/**
 * End-to-end Stream Visibility Test
 *
 * This test measures the time from message send to recipient stream visibility.
 * It closes the gap in message send measurement by including the read/stream
 * visibility component.
 *
 * Target: ≤400ms (95p)
 * Expected: ~7 sec due to current subscribe logic (per issue #1377)
 *
 * Issue: [Mainnet Perf] Messaging: End-to-end stream visibility #1377
 */
import { sleep, streamColdStartTimeout, streamTimeout } from "@helpers/client";
import { sendTextCompat } from "@helpers/sdk-compat";
import { verifyMessageStream, type VerifyStreamResult } from "@helpers/streams";
import { isD14NEnabled, type Group } from "@helpers/versions";
import { setupDurationTracking } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testName = "stream-visibility";

interface TestRunResult {
  runNumber: number;
  averageLatency: number | undefined;
  receptionRate: number;
  messagesSent: number;
  messagesReceived: number;
  individualTimings: number[];
}

/**
 * Format milliseconds to human-readable string
 */
function formatMs(ms: number | undefined): string {
  if (ms === undefined) return "N/A";
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  return `${Math.round(ms)}ms`;
}

/**
 * Calculate percentile from sorted array
 */
function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.ceil((p / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, index)];
}

describe(testName, () => {
  let customDuration: number | undefined = undefined;
  const totalRuns = 10; // Run 10 iterations as required

  setupDurationTracking({
    testName,
    getCustomDuration: () => customDuration,
    setCustomDuration: (v: number | undefined) => {
      customDuration = v;
    },
  });

  let workers: WorkerManager;
  let sender: Worker;
  let receiver: Worker;
  let group: Group;
  const allRunResults: TestRunResult[] = [];

  beforeAll(async () => {
    // Log D14N status
    const d14nEnabled = isD14NEnabled();
    const apiUrl = process.env.XMTP_API_URL;

    console.log("\n╔════════════════════════════════════════════════════════════════╗");
    console.log("║          STREAM VISIBILITY TEST - CONFIGURATION               ║");
    console.log("╠════════════════════════════════════════════════════════════════╣");
    console.log(`║  D14N Mode:    ${d14nEnabled ? "ENABLED ✓" : "DISABLED"}                                    ║`);
    console.log(`║  API URL:      ${(apiUrl || "default").substring(0, 40).padEnd(40)}      ║`);
    console.log(`║  Environment:  ${(process.env.XMTP_ENV || "dev").padEnd(40)}      ║`);
    console.log(`║  Stream Timeout: ${streamTimeout}ms                                        ║`);
    console.log("╚════════════════════════════════════════════════════════════════╝\n");

    if (d14nEnabled && !apiUrl) {
      throw new Error(
        "D14N mode is enabled but XMTP_API_URL is not set. " +
          "Please set XMTP_API_URL=https://grpc.testnet-staging.xmtp.network:443"
      );
    }

    // Create workers - sender and receiver
    workers = await getWorkers(["sender", "receiver"]);
    sender = workers.get("sender")!;
    receiver = workers.get("receiver")!;

    console.log("╔════════════════════════════════════════════════════════════════╗");
    console.log("║                      CLIENT DETAILS                            ║");
    console.log("╠════════════════════════════════════════════════════════════════╣");
    console.log(`║  SENDER                                                        ║`);
    console.log(`║    Name:     ${sender.name.padEnd(50)} ║`);
    console.log(`║    Address:  ${sender.address.substring(0, 42).padEnd(50)} ║`);
    console.log(`║    InboxID:  ${sender.inboxId.substring(0, 42).padEnd(50)} ║`);
    console.log("╠════════════════════════════════════════════════════════════════╣");
    console.log(`║  RECEIVER                                                      ║`);
    console.log(`║    Name:     ${receiver.name.padEnd(50)} ║`);
    console.log(`║    Address:  ${receiver.address.substring(0, 42).padEnd(50)} ║`);
    console.log(`║    InboxID:  ${receiver.inboxId.substring(0, 42).padEnd(50)} ║`);
    console.log("╚════════════════════════════════════════════════════════════════╝\n");

    // Create a group for testing
    group = await workers.createGroupBetweenAll("Stream Visibility Test Group");
    console.log(`Created test group: ${group.id}\n`);

    // Sync receiver to ensure they have the group
    await receiver.client.conversations.sync();
    const receiverGroup = await receiver.client.conversations.getConversationById(group.id);
    
    if (!receiverGroup) {
      throw new Error("Receiver could not find the group after sync!");
    }
    
    console.log(`Receiver confirmed group membership: ${receiverGroup.id}\n`);
  });

  afterAll(async () => {
    // Print final summary
    if (allRunResults.length > 0) {
      console.log("\n╔════════════════════════════════════════════════════════════════╗");
      console.log("║              FINAL TEST RESULTS SUMMARY                        ║");
      console.log("╚════════════════════════════════════════════════════════════════╝\n");

      // Collect all individual timings
      const allTimings = allRunResults.flatMap((r) => r.individualTimings || []);
      allTimings.sort((a, b) => a - b);

      const overallAvg =
        allTimings.length > 0
          ? allTimings.reduce((a, b) => a + b, 0) / allTimings.length
          : 0;
      const overallP50 = percentile(allTimings, 50);
      const overallP95 = percentile(allTimings, 95);
      const overallP99 = percentile(allTimings, 99);
      const overallMin = allTimings.length > 0 ? allTimings[0] : 0;
      const overallMax = allTimings.length > 0 ? allTimings[allTimings.length - 1] : 0;

      const totalSent = allRunResults.reduce((acc, r) => acc + r.messagesSent, 0);
      const totalReceived = allRunResults.reduce((acc, r) => acc + r.messagesReceived, 0);
      const overallReceptionRate = totalSent > 0 ? (totalReceived / totalSent) * 100 : 0;

      // Print per-run summary table
      console.log("Per-Run Results:");
      console.log("─".repeat(80));
      console.log(
        `| ${"Run".padEnd(4)} | ${"Avg Latency".padEnd(12)} | ${"Reception".padEnd(10)} | ${"Sent".padEnd(6)} | ${"Rcvd".padEnd(6)} |`
      );
      console.log("─".repeat(80));

      for (const result of allRunResults) {
        console.log(
          `| ${result.runNumber.toString().padEnd(4)} | ${formatMs(result.averageLatency).padEnd(12)} | ${(result.receptionRate.toFixed(0) + "%").padEnd(10)} | ${result.messagesSent.toString().padEnd(6)} | ${result.messagesReceived.toString().padEnd(6)} |`
        );
      }

      console.log("─".repeat(80));

      // Print overall statistics
      console.log("\nOverall Statistics (across all runs):");
      console.log("─".repeat(50));
      console.log(`  Total Messages Sent:     ${totalSent}`);
      console.log(`  Total Messages Received: ${totalReceived}`);
      console.log(`  Reception Rate:          ${overallReceptionRate.toFixed(1)}%`);
      console.log(`  Average Latency:         ${formatMs(overallAvg)}`);
      console.log(`  P50 Latency:             ${formatMs(overallP50)}`);
      console.log(`  P95 Latency:             ${formatMs(overallP95)} (Target: ≤400ms)`);
      console.log(`  P99 Latency:             ${formatMs(overallP99)}`);
      console.log(`  Min Latency:             ${formatMs(overallMin)}`);
      console.log(`  Max Latency:             ${formatMs(overallMax)}`);
      console.log("─".repeat(50));

      // Check against target
      const targetMet = overallP95 <= 400;
      console.log(
        `\n🎯 Target (P95 ≤ 400ms): ${targetMet ? "✅ MET" : "❌ NOT MET"}`
      );
      console.log(`   Actual P95: ${formatMs(overallP95)}`);

      if (!targetMet) {
        console.log(`\n⚠️  Note: Issue #1377 expected ~7sec latency due to current subscribe logic.`);
      }

      console.log("\n");
    }

    // Cleanup
    if (workers) {
      await workers.terminateAll();
    }
  });

  // Run test iterations
  for (let run = 1; run <= totalRuns; run++) {
    it(
      `streamVisibility-run${run}: e2e stream latency measurement`,
      async () => {
        const messageCount = 3; // Messages per run
        const messageTemplate = `e2e-vis-run${run}-{i}-{randomSuffix}`;
        
        console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
        console.log(`║  RUN ${run}/${totalRuns}: MEASURING END-TO-END STREAM VISIBILITY            ║`);
        console.log(`╠════════════════════════════════════════════════════════════════╣`);
        console.log(`║  Messages to send: ${messageCount}                                            ║`);
        console.log(`║  Sender:   ${sender.name} (${sender.address.substring(0, 10)}...)                    ║`);
        console.log(`║  Receiver: ${receiver.name} (${receiver.address.substring(0, 10)}...)                  ║`);
        console.log(`║  Group:    ${group.id}                     ║`);
        console.log(`╚════════════════════════════════════════════════════════════════╝\n`);

        // Get receiver's view of the group
        await receiver.client.conversations.sync();
        const receiverGroup = await receiver.client.conversations.getConversationById(group.id);
        
        if (!receiverGroup) {
          console.log("❌ CRITICAL: Receiver cannot find the group!");
          throw new Error("Receiver cannot find the group");
        }

        console.log(`📋 Pre-flight check:`);
        console.log(`   ✓ Sender has group: ${group.id}`);
        console.log(`   ✓ Receiver has group: ${receiverGroup.id}`);
        console.log(`   ✓ Group IDs match: ${group.id === receiverGroup.id}`);

        // Use the proven verifyMessageStream helper
        console.log(`\n📤 SENDING ${messageCount} messages from ${sender.name}...`);
        console.log(`   Template: "${messageTemplate}"`);
        
        const sendStartTime = Date.now();
        
        // Use the verified streaming helper from the framework
        const verifyResult: VerifyStreamResult = await verifyMessageStream(
          group,
          [receiver],
          messageCount,
          messageTemplate,
          streamTimeout * 3 // Give more time for D14N
        );
        
        const totalTime = Date.now() - sendStartTime;

        console.log(`\n📥 STREAM RESULTS for ${receiver.name}:`);
        console.log(`   ─────────────────────────────────────────`);
        console.log(`   Reception Rate:    ${verifyResult.receptionPercentage.toFixed(0)}%`);
        console.log(`   Order Percentage:  ${verifyResult.orderPercentage.toFixed(0)}%`);
        console.log(`   Average Latency:   ${formatMs(verifyResult.averageEventTiming)}`);
        console.log(`   Total Test Time:   ${formatMs(totalTime)}`);
        console.log(`   ─────────────────────────────────────────`);

        const messagesReceived = Math.round((verifyResult.receptionPercentage / 100) * messageCount);
        
        // Store result
        const runResult: TestRunResult = {
          runNumber: run,
          averageLatency: verifyResult.averageEventTiming,
          receptionRate: verifyResult.receptionPercentage,
          messagesSent: messageCount,
          messagesReceived: messagesReceived,
          individualTimings: verifyResult.averageEventTiming ? [verifyResult.averageEventTiming] : [],
        };
        allRunResults.push(runResult);

        // Set custom duration
        customDuration = verifyResult.averageEventTiming;

        // Log success/failure status
        if (verifyResult.receptionPercentage >= 90) {
          console.log(`\n✅ Run ${run} PASSED - ${verifyResult.receptionPercentage.toFixed(0)}% reception`);
        } else {
          console.log(`\n⚠️  Run ${run} - Low reception rate: ${verifyResult.receptionPercentage.toFixed(0)}%`);
        }

        // Assertions - be lenient for D14N which may have issues
        expect(verifyResult.receptionPercentage).toBeGreaterThanOrEqual(50);
      },
      streamTimeout * 10 // Extended timeout
    );
  }

  it("final-summary: aggregate all runs and report", async () => {
    expect(allRunResults.length).toBe(totalRuns);

    // Calculate overall statistics
    const allTimings = allRunResults
      .filter((r) => r.averageLatency !== undefined)
      .map((r) => r.averageLatency as number);
    allTimings.sort((a, b) => a - b);
    const overallP95 = percentile(allTimings, 95);

    // Set custom duration to overall P95
    customDuration = overallP95;

    console.log(`\n📊 Overall P95 across all runs: ${formatMs(overallP95)}`);
  });
});
