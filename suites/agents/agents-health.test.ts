import { sendMetric, type ResponseMetricTags } from "@helpers/datadog";
import { setupTestLifecycle } from "@helpers/vitest";
import { describe, expect, it } from "vitest";
import productionAgents from "./agents.json";
import { type AgentConfig } from "./helper";

const testName = "agents-health";
describe(testName, () => {
  setupTestLifecycle({ testName, initDataDog: true });
  const env = process.env.XMTP_ENV as string;

  const API_ENDPOINT =
    process.env.API_ENDPOINT ||
    "https://agents-synthetic-production.up.railway.app/api/ping";

  const filteredAgents = (productionAgents as AgentConfig[]).filter((agent) => {
    return agent.networks.includes(env);
  });

  if (filteredAgents.length === 0) {
    it(`${testName}: No agents configured for this environment`, () => {
      expect(true).toBe(true);
    });
    return;
  }

  for (const agent of filteredAgents) {
    it(`${testName}: ${agent.name} API ping : ${agent.address}`, async () => {
      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address: agent.address,
          network: env,
          message: agent.sendMessage,
        }),
      });

      const result = (await response.json()) as {
        success: boolean;
        address: string;
        responseTime: number;
        timestamp: string;
        message: string;
      };
      console.log(JSON.stringify(result, null, 2));
      sendMetric("response", Number(result.responseTime), {
        test: testName,
        metric_type: "agent",
        metric_subtype: "api_ping",
        live: agent.live ? "true" : "false",
        status: agent.live ? "live_" + env : "not_live_" + env,
        slackChannel: agent.slackChannel,
        agent: agent.name,
        address: agent.address,
        api_endpoint: API_ENDPOINT,
        sdk: "api",
      } as ResponseMetricTags);
      expect(result.success).toBe(true);
    });
  }
});
