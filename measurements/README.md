# Measurements (supported by datadog)

> Last updated: 2025-08-07

Performance metrics and benchmarks for XMTP SDK operations tracked in our monitoring dashboard.

Here are the average measurements that are supported by the [datadog dashboard](https://p.datadoghq.com/sb/a5c739de-7e2c-11ec-bc0b-da7ad0900002-efaf10f4988297b8a8581128f2867a3d).

## Core operations

Core XMTP SDK functionality performance measurements across different operations and group sizes.

### by duration

Individual SDK operation performance metrics including client creation, messaging, and group management.

| Operation           | Description                            | Avg | Target | Performance |
| ------------------- | -------------------------------------- | --- | ------ | ----------- |
| create              | Creating a client                      | 998 | <500   | Concern     |
| newGroup            | Creating a group                       | 502 | <800   | On Target   |
| syncAllCumulative   | Syncing all conversations cumulatively | 391 | <500   | On Target   |
| streamMembership    | Streaming membership changes           | 303 | <400   | On Target   |
| newdmbyAddress      | Creating a dm by address               | 264 | <350   | On Target   |
| syncCumulative      | Cumulative sync operation              | 214 | <300   | On Target   |
| newDm               | Creating a direct message conversation | 198 | <350   | On Target   |
| streamMetadata      | Streaming metadata changes             | 170 | <200   | On Target   |
| syncAll             | Syncing all conversations              | 164 | <500   | On Target   |
| canMessage          | Checking if can message user           | 147 | <200   | On Target   |
| streamMessage       | Streaming message updates              | 125 | <200   | On Target   |
| removeMembers       | Removing members from a group          | 110 | <250   | On Target   |
| send                | Sending a group message                | 95  | <200   | On Target   |
| sync                | Syncing group state                    | 77  | <200   | On Target   |
| updateName          | Updating group metadata                | 76  | <200   | On Target   |
| groupSync           | Group sync operation                   | 66  | <200   | On Target   |
| addMember           | Adding a member to a group             | 32  | <250   | On Target   |
| inboxState          | Checking inbox state                   | 16  | <350   | On Target   |
| setConsentStates    | Managing consent preferences           | 2   | <100   | On Target   |
| getConversationById | Getting conversation by ID             | 1   | <100   | On Target   |

_Note: Baseline is `us-east` region and `production` network._

## Group operations

Performance measurements for group-specific operations broken down by group size and operation type.

### by sender

Operations performed by the message sender including group creation and management.

| Operation     | Description         | 10  | 50   | 100  | 150  | 200  | 250   | Performance |
| ------------- | ------------------- | --- | ---- | ---- | ---- | ---- | ----- | ----------- |
| newGroup      | Creating a group    | 565 | 1930 | 4428 | 5941 | 8400 | 12370 | Concern     |
| send          | Sending a message   | 92  | 105  | 79   | 79   | 92   | 88    | On Target   |
| addMember     | Adding a member     | 35  | 36   | 35   | 46   | 57   | 60    | On Target   |
| groupSync     | Group sync          | 71  | 294  | 81   | 87   | 111  | 114   | On Target   |
| removeMembers | Removing members    | 118 | 196  | 200  | 246  | 292  | 344   | On Target   |
| updateName    | Updating group name | 82  | 137  | 138  | 195  | 230  | 260   | On Target   |

_Note: Measurements taken from the sender's perspective during group operations._

### by receiver

Operations performed by message receivers including streaming and synchronization.

| Operation         | Description          | 10  | 50  | 100  | 150  | 200  | 250  | Performance |
| ----------------- | -------------------- | --- | --- | ---- | ---- | ---- | ---- | ----------- |
| streamMessage     | Streaming messages   | 106 | 116 | 394  | 176  | 235  | 186  | On Target   |
| streamMembership  | Streaming membership | 283 | 429 | 554  | 541  | 586  | 604  | Concern     |
| streamMetadata    | Streaming metadata   | 144 | 265 | 466  | 436  | 548  | 487  | On Target   |
| sync              | Syncing group        | 202 | 480 | 862  | 1188 | 1461 | 1838 | Concern     |
| syncCumulative    | Sync previous        | 194 | 470 | 781  | 1142 | 1460 | 1856 | Concern     |
| syncAll           | Syncing all          | 386 | 719 | 1207 | 1429 | 1706 | 2145 | Concern     |
| syncAllCumulative | Sync all previous    | 384 | 715 | 1077 | 1417 | 1749 | 2168 | Concern     |

_Note: `syncAll` is measured only as the first cold start of the client (fresh inbox). Cumulative sync is measured as the first time all the groups are sync for the first time._

## Node performance

Network-level performance metrics including connection times and regional variations.

### by network

Core network operation timings from DNS lookup through server response processing.

| Performance Metric | Production | Dev | Target | Performance |
| ------------------ | ---------- | --- | ------ | ----------- |
| Server Call        | 157        | 143 | <250   | On Target   |
| Tls Handshake      | 125        | 113 | <150   | On Target   |
| Tcp Connection     | 56         | 46  | <70    | On Target   |
| Processing         | 32         | 30  | <100   | On Target   |
| Dns Lookup         | 23         | 16  | <50    | On Target   |

### By region

Comparative network performance across different global regions relative to us-east baseline.

| Region        | Production | Dev | ~ baseline | Performance |
| ------------- | ---------- | --- | ---------- | ----------- |
| us east-1     | 50         | 46  | -37%       | On Target   |
| us east       | 79         | 70  | Baseline   | On Target   |
| es west       | 116        | 114 | +47%       | On Target   |
| europe        | 203        | 198 | +157%      | On Target   |
| asia          | 425        | 521 | +438%      | Concern     |
| south-america | 734        | 734 | +438%      | Concern     |

_Note: Baseline is `us-east` region and `production` network._

## Message reliability

Message delivery and ordering reliability metrics across different testing scenarios.

| Test Area             | Average         | Target         | Performance |
| --------------------- | --------------- | -------------- | ----------- |
| Average response time | 400ms           | <500ms         | On Target   |
| Stream Delivery Rate  | 100% successful | 99.9% minimum  | On Target   |
| Poll Delivery Rate    | 100% successful | 99.9% minimum  | On Target   |
| Recovery Rate         | 100% successful | 99.9% minimum  | On Target   |
| Stream Order          | 100% in order   | 99.9% in order | On Target   |
| Poll Order            | 100% in order   | 99.9% in order | On Target   |
| Recovery Order        | 100% in order   | 99.9% in order | On Target   |

_Note: Testing regularly in groups of `40` active members listening to one user sending 100 messages_

## Database

Database storage efficiency and performance metrics for different group sizes and inbox configurations.

### By group size

Storage utilization comparison between sender and receiver across varying group member counts.

| Group Size  | Groups | Sender storage | Avg Group Size | Receiver storage | Efficiency Gain |
| ----------- | ------ | -------------- | -------------- | ---------------- | --------------- |
| 2 members   | 261    | 5.1 MB         | 0.020 MB       | 1.617 MB         | baseline        |
| 10 members  | 114    | 5.1 MB         | 0.044 MB       | 3.133 MB         | 2.2× better     |
| 50 members  | 31     | 5.3 MB         | 0.169 MB       | 3.625 MB         | 2.9× better     |
| 100 members | 19     | 5.6 MB         | 0.292 MB       | 5.566 MB         | 3.3× better     |
| 150 members | 12     | 5.6 MB         | 0.465 MB       | 6.797 MB         | 3.2× better     |
| 200 members | 10     | 6.2 MB         | 0.618 MB       | 8.090 MB         | 3.2× better     |

### By inbox size

Storage utilization comparison between sender and receiver across varying inbox sizes.

| Inbox Size | Conversations | Size (mb) |
| ---------- | ------------- | --------- |
| 1000       | 1000          | 240       |
| 2000       | 2000          | 252       |
| 5000       | 5000          | 265       |
| 10000      | 10000         | 282       |
| 20000      | 20000         | 300       |

## Service level objectives (SLOs)

Weekly SLO performance tracking for critical XMTP SDK metrics.

| SLO Name                      | Target | JUL-7    | JUL-14  | JUL-21   | WTD      |
| ----------------------------- | ------ | -------- | ------- | -------- | -------- |
| Network uptime                | 99%    | 100.000% | 99.900% | 100.000% | 100.000% |
| Messages ordered              | 99%    | 100.000% | 99.205% | 100.000% | 100.000% |
| New group under 1.5 seconds   | 99%    | 100.000% | 99.503% | 100.000% | 100.000% |
| Response times under 1 second | 99%    | 100.000% | 99.602% | 100.000% | 100.000% |
| Messages delivered            | 99%    | 96.079%  | 95.086% | 99.106%  | 95.066%  |
