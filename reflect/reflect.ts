// interface RunSendingGmTestResult {
//   executionId: number;
//   // Add other properties if needed
// }

// interface ExecutionStatus {
//   tests: Array<{
//     status: string;
//   }>;
// }

// export class ReflectTestSuite {
//   /**
//    * Run the "Sending a GM" test with specific local storage settings.
//    * @returns {Promise<Object>} The result of the test execution.
//    */
//   async runSendingGmTest(): Promise<RunSendingGmTestResult> {
//     const testId = 196428;
//     console.log("Running Sending GM Test with ID", testId);

//     const response = await fetch(
//       `https://api.reflect.run/v1/tests/${testId}/executions`,
//       {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//           "X-API-KEY": process.env.REFLECT_API_KEY as string,
//         },
//         body: JSON.stringify({
//           overrides: {
//             localStorage: [
//               {
//                 key: "XMTP_EPHEMERAL_ACCOUNT_KEY",
//                 value: process.env.WALLET_KEY_XMTPChat,
//               },
//             ],
//           },
//         }),
//       },
//     );

//     if (!response.ok) {
//       throw new Error(`Failed to execute test: ${response.statusText}`);
//     }

//     const result = await response.json();
//     console.log("Sending GM Test executed successfully", result);
//     return result as RunSendingGmTestResult;
//   }

//   /**
//    * Get the execution status of a test.
//    * @param {number} executionId - The ID of the execution to check.
//    * @returns {Promise<ExecutionStatus>} The execution status and test results.
//    */
//   async getExecutionStatus(executionId: number): Promise<ExecutionStatus> {
//     console.log("Getting execution status for", executionId);
//     const response = await fetch(
//       `https://api.reflect.run/v1/executions/${executionId}`,
//       {
//         method: "GET",
//         headers: {
//           "Content-Type": "application/json",
//           "X-API-KEY": process.env.REFLECT_API_KEY as string,
//         },
//       },
//     );

//     if (!response.ok) {
//       throw new Error(`Failed to get execution status: ${response.statusText}`);
//     }

//     const result = await response.json();
//     //console.log("Execution status retrieved successfully", result);
//     return result as ExecutionStatus;
//   }

//   /**
//    * Poll execution status until all tests complete.
//    */
//   async pollExecutionStatus(
//     reflectTestSuite: ReflectTestSuite,
//     executionId: number,
//   ) {
//     let allTestsCompleted = false;
//     while (!allTestsCompleted) {
//       const status = await reflectTestSuite.getExecutionStatus(executionId);

//       allTestsCompleted = status.tests.every((test) => {
//         return (
//           typeof test.status === "string" &&
//           (test.status === "succeeded" || test.status === "failed")
//         );
//       });

//       if (!allTestsCompleted) {
//         console.log("Waiting for tests to complete...");
//         await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait for 10 seconds
//       } else {
//         console.log("All tests completed successfully.", status);
//       }
//     }
//   }
// }

// export default ReflectTestSuite;
