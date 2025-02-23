// import dotenv from "dotenv";
// import { describe, expect, it } from "vitest";
// import { getXmtpClient } from "../helpers/client";
// import ReflectTestSuite from "../helpers/reflect";
// import { streamMessages } from "../helpers/xmtp";

// dotenv.config();

// const timeout = 200000; // 20 seconds
// describe(
//   "Basic test",
//   () => {
//     it("should return true", async () => {
//       const reflectTestSuite = new ReflectTestSuite();

//       const bobClient = await getXmtpClient("bob", "dev");

//       console.log(
//         `Agent initialized on ${bobClient.accountAddress}\nSend a message on http://xmtp.chat/dm/${bobClient.accountAddress}`,
//       );

//       // Start the message listener in the background.
//       streamMessages(bobClient).catch(console.error);

//       // Run the GM test and wait for its execution ID.
//       const { executionId } = await reflectTestSuite.runSendingGmTest();

//       if (executionId) {
//         await reflectTestSuite.pollExecutionStatus(
//           reflectTestSuite,
//           executionId,
//         );
//       }

//       // You can add further assertions here if needed
//       expect(true).toBeTruthy();
//     });
//   },
//   timeout,
// );
