# 🧪 XMTP Test Suites

This directory contains end-to-end test suites for validating the XMTP protocol functionality, performance, and reliability. Each suite focuses on a specific aspect of the protocol, providing comprehensive verification of the system's capabilities.

## Quick reference

| Suite                | Purpose                              | Key Features                                  | Link to test file                                                       |
| -------------------- | ------------------------------------ | --------------------------------------------- | ----------------------------------------------------------------------- |
| **TS_AgentHealth**   | Agent responsiveness monitoring      | Production bot health checks, uptime tracking | [TS_AgentHealth.test.ts](./TS_AgentHealth/TS_AgentHealth.test.ts)       |
| **TS_Delivery**      | Message delivery reliability testing | Delivery verification, group message testing  | [TS_Delivery.test.ts](./TS_Delivery/TS_Delivery.test.ts)                |
| **TS_Fork**          | Fork detection and resolution        | Fork tolerance, conflict resolution           | [TS_Fork.test.ts](./TS_Fork/TS_Fork.test.ts)                            |
| **TS_Gm**            | Basic messaging functionality        | Core protocol verification, simple messages   | [TS_Gm.test.ts](./TS_Gm/TS_Gm.test.ts)                                  |
| **TS_Notifications** | Push notification validation         | Multi-sender scenarios, notification timing   | [TS_Notifications.test.ts](./TS_Notifications/TS_Notifications.test.ts) |
| **TS_Performance**   | Protocol performance measurement     | Operation benchmarking, scalability testing   | [TS_Performance.test.ts](./TS_Performance/TS_Performance.test.ts)       |
| **TS_Stress**        | System load and capacity testing     | Group scaling, high message volume testing    | [TS_Stress.test.ts](./TS_Stress/TS_Stress.test.ts)                      |
| **TS_Groups**        | Group performance measurement        | Group scaling, high message volume testing    | [TS_Groups.test.ts](./TS_Groups/TS_Groups.test.ts)                      |
