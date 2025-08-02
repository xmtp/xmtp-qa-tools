import { sendMetric, type ResponseMetricTags } from "@helpers/datadog";
import { setupTestLifecycle } from "@helpers/vitest";
import { describe, expect, it } from "vitest";
import productionAgents from "./agents.json";
import { type AgentConfig } from "./helper";

const testName = "agents-dms-api";
describe(testName, () => {
  setupTestLifecycle({ testName, sendMetrics: true });
  const env = process.env.XMTP_ENV as string;

  // Get API endpoint from environment or use default
  const API_ENDPOINT =
    process.env.API_ENDPOINT || "http://localhost:3000/api/ping";

  const filteredAgents = (productionAgents as AgentConfig[]).filter((agent) => {
    return agent.networks.includes(env);
  });

  // Handle case where no agents are configured for the current environment
  if (filteredAgents.length === 0) {
    it(`${testName}: No agents configured for this environment`, () => {
      console.log(`No agents found for env: ${env}`);
      expect(true).toBe(true); // Pass the test
    });
    return;
  }

  // Test each agent via API
  for (const agent of filteredAgents) {
    it(`${testName}: ${agent.name} API ping : ${agent.address}`, async () => {
      console.log(`Pinging agent ${agent.name} at ${agent.address} via API`);

      const startTime = Date.now();

      try {
        const response = await fetch(API_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            address: agent.address,
          }),
        });

        const endTime = Date.now();
        const responseTime = endTime - startTime;

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `API request failed: ${response.status} - ${errorText}`,
          );
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const result = (await response.json()) as {
          success: boolean;
          address: string;
          responseTime: string;
          timestamp: string;
        };
        console.log(
          `API Response for ${agent.name}:`,
          JSON.stringify(result, null, 2),
        );

        // Verify the response structure
        expect(result).toHaveProperty("success");
        expect(result.success).toBe(true);
        expect(result).toHaveProperty("address");
        expect(result.address).toBe(agent.address);
        expect(result).toHaveProperty("responseTime");
        expect(result).toHaveProperty("timestamp");

        // Parse response time from the API response
        const apiResponseTime = parseInt(result.responseTime.replace("ms", ""));

        // Use the API response time for metrics
        const metricValue = apiResponseTime;

        sendMetric("response", metricValue, {
          test: testName,
          metric_type: "agent",
          metric_subtype: "api_ping",
          live: agent.live ? "true" : "false",
          status: agent.live ? "live_" + env : "not_live_" + env,
          slackChannel: agent.slackChannel,
          agent: agent.name,
          address: agent.address,
          api_endpoint: API_ENDPOINT,
          sdk: "api", // Add required sdk field
        } as ResponseMetricTags);

        console.log(
          `${agent.name} API ping successful in ${apiResponseTime}ms`,
        );
        expect(true).toBe(true); // Test passed
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(`API ping failed for ${agent.name}:`, errorMessage);

        // Send failure metric
        sendMetric("response", 0, {
          test: testName,
          metric_type: "agent",
          metric_subtype: "api_ping_failed",
          live: agent.live ? "true" : "false",
          status: agent.live ? "live_" + env : "not_live_" + env,
          slackChannel: agent.slackChannel,
          agent: agent.name,
          address: agent.address,
          api_endpoint: API_ENDPOINT,
          error: errorMessage,
          sdk: "api", // Add required sdk field
        } as ResponseMetricTags);

        throw error; // Re-throw to fail the test
      }
    });
  }
});
