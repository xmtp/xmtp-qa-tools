# Measurements (supported by datadog)

Performance metrics and benchmarks for XMTP SDK operations tracked in our monitoring dashboard.

Here are the average measurements that are supported by the [datadog dashboard](https://p.datadoghq.com/sb/a5c739de-7e2c-11ec-bc0b-da7ad0900002-efaf10f4988297b8a8581128f2867a3d).

## Operations

Core XMTP SDK functionality performance measurements across different operations and group sizes.

### by duration

Individual SDK operation performance metrics including client creation, messaging, and group management.

| Operation           | Description                            | Avg | Target | Performance |
| ------------------- | -------------------------------------- | --- | ------ | ----------- |
| create              | Creating a client                      | 998 | <350   | Concern     |
| newgroup            | Creating a group                       | 502 | <350   | Concern     |
| syncallcumulative   | Syncing all conversations cumulatively | 391 | <500   | On Target   |
| newgroupbyaddress   | Creating a group by address            | 343 | <350   | On Target   |
| streammembership    | Streaming membership changes           | 303 | <400   | On Target   |
| newdmbyaddress      | Creating a dm by address               | 264 | <350   | On Target   |
| synccumulative      | Cumulative sync operation              | 214 | <300   | On Target   |
| newdm               | Creating a direct message conversation | 198 | <350   | On Target   |
| streammetadata      | Streaming metadata changes             | 170 | <200   | On Target   |
| syncall             | Syncing all conversations              | 164 | <500   | On Target   |
| canmessage          | Checking if can message user           | 147 | <100   | Concern     |
| streammessage       | Streaming message updates              | 125 | <200   | On Target   |
| removemembers       | Removing members from a group          | 110 | <250   | On Target   |
| send                | Sending a group message                | 95  | <200   | On Target   |
| sync                | Syncing group state                    | 77  | <200   | On Target   |
| updatename          | Updating group metadata                | 76  | <200   | On Target   |
| stream              | Receiving a group message              | 69  | <200   | On Target   |
| groupsync           | Group sync operation                   | 66  | <200   | On Target   |
| addmember           | Adding a member to a group             | 32  | <250   | On Target   |
| populate            | Populating conversation data           | 28  | <200   | On Target   |
| inboxstate          | Checking inbox state                   | 16  | <350   | On Target   |
| consent             | Managing consent preferences           | 2   | <100   | On Target   |
| getconversationbyid | Getting conversation by ID             | 1   | <100   | On Target   |

_Note: Baseline is `us-east` region and `production` network._

### by group size

Performance measurements for group-specific operations broken down by group size and operation type.

#### by sender

Operations performed by the message sender including group creation and management.

| Operation         | Description               | 10  | 50   | 100  | 150  | 200  | 250   | Performance |
| ----------------- | ------------------------- | --- | ---- | ---- | ---- | ---- | ----- | ----------- |
| newgroup          | Creating a group          | 565 | 1930 | 4428 | 5941 | 8400 | 12370 | Concern     |
| newgroupbyaddress | Creating group by address | 441 | 1586 | 2813 | 4764 | 6691 | -     | Concern     |
| send              | Sending a message         | 92  | 105  | 79   | 79   | 92   | 88    | On Target   |
| addmember         | Adding a member           | 35  | 36   | 35   | 46   | 57   | 60    | On Target   |
| groupsync         | Group sync                | 71  | 294  | 81   | 87   | 111  | 114   | On Target   |
| removemembers     | Removing members          | 118 | 196  | 200  | 246  | 292  | 344   | On Target   |
| updatename        | Updating group name       | 82  | 137  | 138  | 195  | 230  | 260   | On Target   |

_Note: Measurements taken from the sender's perspective during group operations._

#### by receiver

Operations performed by message receivers including streaming and synchronization.

| Operation         | Description          | 10  | 50  | 100  | 150  | 200  | 250  | Performance |
| ----------------- | -------------------- | --- | --- | ---- | ---- | ---- | ---- | ----------- |
| streammessage     | Streaming messages   | 106 | 116 | 394  | 176  | 235  | 186  | On Target   |
| streammembership  | Streaming membership | 283 | 429 | 554  | 541  | 586  | 604  | Concern     |
| streammetadata    | Streaming metadata   | 144 | 265 | 466  | 436  | 548  | 487  | On Target   |
| sync              | Syncing group        | 202 | 480 | 862  | 1188 | 1461 | 1838 | Concern     |
| synccumulative    | Cumulative sync      | 194 | 470 | 781  | 1142 | 1460 | 1856 | Concern     |
| syncall           | Syncing all          | 386 | 719 | 1207 | 1429 | 1706 | 2145 | Concern     |
| syncallcumulative | Sync all cumulative  | 384 | 715 | 1077 | 1417 | 1749 | 2168 | Concern     |

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

### by region

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
| Average Response Time | 400ms           | <500ms         | On Target   |
| Stream Delivery Rate  | 100% successful | 99.9% minimum  | On Target   |
| Poll Delivery Rate    | 100% successful | 99.9% minimum  | On Target   |
| Recovery Rate         | 100% successful | 99.9% minimum  | On Target   |
| Stream Order          | 100% in order   | 99.9% in order | On Target   |
| Poll Order            | 100% in order   | 99.9% in order | On Target   |
| Recovery Order        | 100% in order   | 99.9% in order | On Target   |

_Note: Testing regularly in groups of `40` active members listening to one user sending 100 messages_

## Operation by inbox size

| Operation            | Base | 1000 | 2000 | 5000 | 10000 | Min | Max  | Orders |
| -------------------- | ---- | ---- | ---- | ---- | ----- | --- | ---- | ------ |
| create               | 114  | 142  | 120  | 109  | 118   | 109 | 142  | 1x     |
| sync                 | 3    | 3    | 2    | 2    | 4     | 2   | 4    | 1x     |
| syncAll              | 64   | 83   | 604  | 324  | 293   | 64  | 604  | 1x     |
| inboxState           | 1    | 0    | 14   | 1    | 1     | 0   | 14   | 10x    |
| canMessage           | 7    | 5    | 8    | 6    | 6     | 5   | 8    | 1x     |
| newDm                | 1    | 0    | 0    | 1    | 0     | 0   | 1    | 1x     |
| newDmByAddress       | 40   | 40   | 336  | 97   | 54    | 40  | 336  | 1x     |
| getConversationById  | 1    | 0    | 1    | 1    | 1     | 0   | 1    | 1x     |
| send                 | 18   | 17   | 62   | 31   | 17    | 17  | 62   | 1x     |
| consent              | 1    | -    | -    | -    | -     | 0   | 1    | 1x     |
| stream               | 28   | 108  | 20   | 139  | 43    | 20  | 139  | 1x     |
| newGroup-10          | 163  | 79   | 107  | 727  | 115   | 79  | 727  | 1x     |
| newGroupByAddress-10 | 65   | 72   | 163  | 556  | 356   | 65  | 556  | 1x     |
| groupsync-10         | 7    | 6    | 13   | 32   | 10    | 6   | 32   | 1x     |
| updateName-10        | 15   | 13   | 24   | 29   | 21    | 13  | 29   | 1x     |
| send-10              | 12   | 10   | 13   | 30   | 32    | 10  | 32   | 1x     |
| addMember-10         | 2    | 4    | 7    | 111  | 48    | 2   | 111  | 10x    |
| removeMembers-10     | 19   | 24   | 61   | 54   | 151   | 19  | 151  | 1x     |
| streamMembership-10  | 43   | 69   | 46   | 497  | 174   | 43  | 497  | 10x    |
| streamMessage-10     | 31   | 78   | 29   | 41   | 616   | 29  | 616  | 10x    |
| streamMetadata-10    | 35   | 77   | 68   | 283  | 79    | 35  | 283  | 1x     |
| sync-10              | 48   | 49   | 82   | 140  | 132   | 48  | 140  | 1x     |
| syncAll-10           | 99   | 85   | 152  | 274  | 240   | 85  | 274  | 1x     |
| syncCumulative-10    | 50   | 44   | 68   | 108  | 215   | 44  | 215  | 1x     |
| syncAllCumulative-10 | 76   | 70   | 201  | 171  | 1769  | 70  | 1769 | 10x    |

## Storage performance

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

| Inbox Size | Conversations | Size   |
| ---------- | ------------- | ------ |
| 1000       | 1000          | 240 mb |
| 2000       | 2000          | 252 mb |
| 5000       | 5000          | 265 mb |
| 10000      | 10000         | 282 mb |
| 20000      | 20000         | 300 mb |
