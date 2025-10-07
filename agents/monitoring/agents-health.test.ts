// import { streamTimeout } from "@helpers/client";
// import { sendMetric, type ResponseMetricTags } from "@helpers/datadog";
// import { setupDurationTracking } from "@helpers/vitest";
// import { getActiveVersion } from "versions/client-versions";
// import { describe, expect, it } from "vitest";
// import productionAgents from "./agents.json";
// import { type AgentConfig } from "./helper";

// const testName = "agents-health";
// describe(testName, () => {
//   setupDurationTracking({ testName, initDataDog: true });
//   const env = process.env.XMTP_ENV as string;

//   const API_ENDPOINT =
//     process.env.API_ENDPOINT ||
//     "https://agents-synthetic-production.up.railway.app/api/ping";

//   const filteredAgents = (productionAgents as AgentConfig[]).filter((agent) => {
//     return agent.networks.includes(env);
//   });

//   if (filteredAgents.length === 0) {
//     it(`${testName}: No agents configured for this environment`, () => {
//       expect(true).toBe(true);
//     });
//     return;
//   }

//   for (const agent of filteredAgents) {
//     it(`${testName}: ${agent.name} API ping : ${agent.address}`, async () => {
//       const response = await fetch(API_ENDPOINT, {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({
//           address: agent.address,
//           network: env,
//           message: agent.sendMessage,
//         }),
//       });
//       console.log(response);

//       const result = (await response.json()) as {
//         success: boolean;
//         address: string;
//         responseTime: number;
//         timestamp: string;
//         message: string;
//       };

//       const responseTime = Math.abs(result?.responseTime ?? streamTimeout);

//       console.log("streamTimeout", streamTimeout);
//       console.log("responseTime", responseTime);

//       sendMetric("response", responseTime, {
//         test: testName,
//         metric_type: "agent",
//         metric_subtype: "dm",
//         live: agent.live ? "true" : "false",
//         slackChannel: agent.slackChannel,
//         agent: agent.name,
//         address: agent.address,
//         sdk: getActiveVersion().nodeBindings,
//       } as ResponseMetricTags);
//       expect(result.success).toBe(true);
//     });
//   }
// });
