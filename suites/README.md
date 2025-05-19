# 🧪 XMTP Test Suites

Different end-to-end test suites for validating the XMTP protocol functionality, performance, and reliability.

## Automated test suites

| Suite         | Purpose                                 | Link to test file         |
| ------------- | --------------------------------------- | ------------------------- |
| **TS_Agents** | Tests the health of the agent ecosystem | [TS_Agents](./TS_Agents/) |
| **TS_Gm**     | Tests the GM browser and bot            | [TS_Gm](./TS_Gm/)         |

## Manual test suites

| Suite                | Purpose                                                    | Link to test file                       |
| -------------------- | ---------------------------------------------------------- | --------------------------------------- |
| **TS_Fork**          | Investigates group conversation forking through membership | [TS_Fork](./TS_Fork/)                   |
| **TS_Notifications** | Validates push notification functionality                  | [TS_Notifications](./TS_Notifications/) |
| **TS_Stress**        | Tests system performance under high load conditions        | [TS_Stress](./TS_Stress/)               |

## Metrics test suites

| Suite           | Purpose                                      | Link to test file                       |
| --------------- | -------------------------------------------- | --------------------------------------- |
| **Delivery**    | Verifies message delivery reliability        | [M_delivery](./metrics/delivery/)       |
| **Performance** | Measures independent operational performance | [M_performance](./metrics/performance/) |
| **Large**       | Tests performance of group operations        | [M_large](./metrics/large/)             |
