# 🧪 XMTP Test Suites

Different end-to-end test suites for validating the XMTP protocol functionality, performance, and reliability.

## Automated test suites

| Suite         | Purpose                                 | Link to test file                |
| ------------- | --------------------------------------- | -------------------------------- |
| **at_agents** | Tests the health of the agent ecosystem | [at_agents](./automated/agents/) |
| **at_gm**     | Tests the GM browser and bot            | [at_gm](./automated/gm/)         |

## Manual test suites

| Suite                | Purpose                                                    | Link to test file                           |
| -------------------- | ---------------------------------------------------------- | ------------------------------------------- |
| **ts_stressgroup**   | Investigates group conversation forking through membership | [ts_stressgroup](./manual/fork/)            |
| **ts_notifications** | Validates push notification functionality                  | [ts_notifications](./manual/notifications/) |
| **ts_stress**        | Tests system performance under high load conditions        | [ts_stress](./manual/stress/)               |

## Metrics test suites

| Suite             | Purpose                                      | Link to test file                       |
| ----------------- | -------------------------------------------- | --------------------------------------- |
| **m_delivery**    | Verifies message delivery reliability        | [m_delivery](./metrics/delivery/)       |
| **m_performance** | Measures independent operational performance | [m_performance](./metrics/performance/) |
| **m_large**       | Tests performance of group operations        | [m_large](./metrics/large/)             |
