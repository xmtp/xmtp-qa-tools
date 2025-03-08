## Overview

This assessment outlines how XMTP ensures messaging protocol reliability and performance, with focus on Messaging and Agents built using our Node SDK and React Native SDKs.

## 1. Operations performance

### Core SDK Operations Performance

| Operation           | Description                            | Current Avg (ms) | Target | Status       |
| ------------------- | -------------------------------------- | ---------------- | ------ | ------------ |
| createDM            | Creating a direct message conversation | 254-306          | <500ms | ✅ On Target |
| sendGM              | Sending a group message                | 123-132          | <200ms | ✅ On Target |
| receiveGM           | Receiving a group message              | 90-94            | <200ms | ✅ On Target |
| receiveGroupMessage | Processing group message streams       | 119-127          | <200ms | ✅ On Target |
| updateGroupName     | Updating group metadata                | 105-108          | <200ms | ✅ On Target |
| syncGroup           | Syncing group state                    | 78-89            | <200ms | ✅ On Target |
| addMembers          | Adding participants to a group         | 238-280          | <500ms | ✅ On Target |
| removeMembers       | Removing participants from a group     | 147-168          | <300ms | ✅ On Target |
| inboxState          | Checking inbox state                   | 36               | <100ms | ✅ On Target |

_Note: Based on data from 79 measured operations in the US testing environment._

### Group Operations Performance by Size

| Size | Create (ms) | Send (ms) | Sync (ms) | Update (ms) | Remove (ms) | Target (Create) | Status                 |
| ---- | ----------- | --------- | --------- | ----------- | ----------- | --------------- | ---------------------- |
| 50   | 990         | 71        | 61        | 81          | 140         | <2,000ms        | ✅ On Target           |
| 100  | 1,599       | 67        | 66        | 91          | 182         | <2,000ms        | ✅ On Target           |
| 150  | 2,956       | 72        | 85        | 104         | 183         | <4,000ms        | ✅ On Target           |
| 200  | 4,598       | 73        | 103       | 139         | 211         | <5,000ms        | ✅ On Target           |
| 250  | 5,983       | 76        | 120       | 164         | 234         | <7,000ms        | ✅ On Target           |
| 300  | 8,707       | 81        | 321       | 255         | 309         | <9,000ms        | ✅ On Target           |
| 350  | 9,826       | 79        | 132       | 228         | 368         | <11,000ms       | ⚠️ Performance Concern |
| 400  | 11,451      | 84        | 170       | 427         | 501         | <15,000ms       | ⚠️ Performance Concern |
| 450  | -           | -         | -         | -           | -           | -               | ❌ Severe impact       |

_Note: Performance increases significantly beyond 400 members, which represents a hard limit on the protocol. Group creation operations scale with group size, while other operations remain relatively consistent regardless of member count._

### Network performance

| Performance Metric   | Current Performance | Target            | Status       |
| -------------------- | ------------------- | ----------------- | ------------ |
| Server Call Response | 78.4ms avg          | <100ms P95        | ✅ On Target |
| TLS Handshake        | 83.6ms avg          | <100ms P95        | ✅ On Target |
| Message Processing   | 212.5ms avg         | <300ms end-to-end | ✅ On Target |
| Geographic Variance  | 18.3% US-to-Non-US  | <20% difference   | ✅ On Target |

_Note: Performance metrics based on US testing on dev and production network. Geographic variance reflects US vs Non-US comparison._

## 2. Message reliability

### Message delivery testing

| Test Area                             | Current Performance | Target                     | Status       |
| ------------------------------------- | ------------------- | -------------------------- | ------------ |
| Stream Delivery Rate                  | 100% successful     | 99.9% minimum              | ✅ On Target |
| Poll Delivery Rate                    | 100% successful     | 99.9% minimum              | ✅ On Target |
| Message Sequence Integrity in Streams | 100% in order       | 100% in correct order      | ✅ On Target |
| Message Sequence Integrity in Poll    | 100% in order       | 100% in correct order      | ✅ On Target |
| Offline Message Recovery              |                     | 100% recovery on reconnect | ⏳ WIP       |

_Note: Testing regularly in groups of 40 active members listening to one user sending 100 messages_

### Stream vs. Poll reliability

| Retrieval Method | Reliability   | Latency           | Use Case               | Status       |
| ---------------- | ------------- | ----------------- | ---------------------- | ------------ |
| Stream-based     | 100% delivery | Real-time         | Active conversations   | ✅ On Target |
| Poll-based       | 100% delivery | Delayed (30s max) | Backup/recovery        | ✅ On Target |
| Hybrid approach  | 100% delivery | Optimized         | Recommended for Agents | ✅ On Target |

_Note: A hybrid approach using streams with poll-based verification provides the most reliable message delivery guarantee._

## 3. Integration testing

### Cross-SDK Testing

| SDK Combination              | Test Focus                    | Status      |
| ---------------------------- | ----------------------------- | ----------- |
| Node SDK ↔ Node SDK         | Agent-to-Agent communication  | ✅ Verified |
| React Native ↔ React Native | Non- coinbase build           | ⏳ WIP      |
| React Native ↔ Node SDK     | Client-to-Agent communication | ⏳ WIP      |

_Note: Haven't been able to produce reports in cross- testing until we have access to both builds, ios/android_

## 4. Success criteria summary

| Metric                  | Current Performance        | Target                  | Status                |
| ----------------------- | -------------------------- | ----------------------- | --------------------- |
| Core SDK Operations     | All within targets         | Meet defined targets    | ✅ On Target          |
| Group Operations        | ≤400 members within target | <400 members hard limit | ✅ On Target          |
| Network Performance     | All metrics within target  | Meet defined targets    | ✅ On Target          |
| Message Delivery        | 100%                       | 99.9% minimum           | ✅ On Target          |
| Stream Message Loss     | 0.0%                       | 0% (zero tolerance)     | ✅ On Target          |
| Cross-SDK Compatibility | 80%                        | 100% operation success  | ⏳ WIP                |
| Non-us performance      | 40%                        | <20% difference         | ❌ Performance Impact |
