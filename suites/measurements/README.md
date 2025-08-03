# Measurements (supported by datadog)

Performance metrics and benchmarks for XMTP SDK operations tracked in our monitoring dashboard.

Here are the average measurements that are supported by the [datadog dashboard](https://p.datadoghq.com/sb/a5c739de-7e2c-11ec-bc0b-da7ad0900002-efaf10f4988297b8a8581128f2867a3d).

## Operations

Core XMTP SDK functionality performance measurements across different operations and group sizes.

### Core SDK operations

Individual SDK operation performance metrics including client creation, messaging, and group management.

| Operation         | Description                            | Avg | Target | Performance |
| ----------------- | -------------------------------------- | --- | ------ | ----------- |
| create            | Creating a client                      | 588 | <350   | Concern     |
| inboxState        | Checking inbox state                   | 41  | <350   | On Target   |
| newDm             | Creating a direct message conversation | 258 | <350   | On Target   |
| newDmByAddress    | Creating a dm by address               | 294 | <350   | On Target   |
| send              | Sending a group message                | 126 | <200   | On Target   |
| stream            | Receiving a group message              | 87  | <200   | On Target   |
| newGroup          | Creating a group                       | 315 | <350   | On Target   |
| newGroupByAddress | Creating a group by address            | 313 | <350   | On Target   |
| sync              | Syncing group state                    | 76  | <200   | On Target   |
| updateName        | Updating group metadata                | 129 | <200   | On Target   |
| removeMembers     | Removing members from a group          | 127 | <250   | On Target   |

### Group operations

Performance measurements for group-specific operations broken down by group size and operation type.

#### Sender-side average

Average performance metrics measured from the message sender's perspective after group creation.

| Size | Send message | Update name | Remove members | Create | Performance |
| ---- | ------------ | ----------- | -------------- | ------ | ----------- |
| 50   | 86           | 135         | 139            | 1329   | On Target   |
| 100  | 88           | 145         | 157            | 1522   | On Target   |
| 150  | 95           | 203         | 190            | 2306   | On Target   |
| 200  | 93           | 193         | 205            | 3344   | On Target   |
| 250  | 108          | 219         | 237            | 4276   | On Target   |
| 300  | 97           | 244         | 247            | 5463   | On Target   |
| 350  | 101          | 264         | 308            | 6641   | On Target   |
| 400  | 111          | 280         | 320            | 7641   | On Target   |

_Note: This measurments are taken only from the sender side and after the group is created._

#### Receiver-side stream

Stream performance metrics measured from message receivers when processing real-time updates.

| Group Size | New conversation | Metadata | Messages | Add Members | Performance |
| ---------- | ---------------- | -------- | -------- | ----------- | ----------- |
| 50         | 687              | 141      | 131      | 401         | On Target   |
| 100        | 746              | 155      | 117      | 420         | On Target   |
| 150        | 833              | 163      | 147      | 435         | On Target   |
| 200        | 953              | 179      | 173      | 499         | On Target   |
| 250        | 1007             | 187      | 161      | 526         | Concern     |
| 300        | 1040             | 195      | 167      | 543         | Concern     |
| 350        | 1042             | 198      | 178      | 581         | Concern     |
| 400        | 1192             | 214      | 173      | 609         | Concern     |

_Note: This measurments are taken only from the receiver side and after the group is created._

#### Receiver-side sync

Sync operation performance for receivers during cold starts and cumulative syncs.

| Size | syncAll |      | sync |      | Performance |
| ---- | ------- | ---- | ---- | ---- | ----------- |
| 50   | 366     | ...  | 291  | ...  | On Target   |
| 100  | 503     | 521  | 424  | 372  | On Target   |
| 150  | 665     | 727  | 522  | 622  | On Target   |
| 200  | 854     | 1066 | 653  | 936  | On Target   |
| 250  | 966     | 1582 | 768  | 1148 | Concern     |
| 300  | 1225    | 1619 | 861  | 1362 | Concern     |
| 350  | 1322    | 1846 | 1218 | 2017 | Concern     |
| 400  | 1292    | 2082 | 1325 | 1792 | Concern     |

_Note: `syncAll` is measured only as the first cold start of the client (fresh inbox). Cumulative sync is measured as the first time all the groups are sync for the first time._

### Operations by size

| Test                | Base | 1000 | 2000 | 5000 | 10000 | unknown | Min | Max | Avg |
| ------------------- | ---- | ---- | ---- | ---- | ----- | ------- | --- | --- | --- |
| addMember           | 5    | 7    | 10   | 11   | 10    | -       | 5   | 11  | 9   |
| canMessage          | 8    | 21   | 16   | 7    | 12    | -       | 7   | 21  | 13  |
| consent             | -    | -    | -    | -    | -     | 1       | 1   | 2   | 2   |
| create              | 96   | 82   | 84   | 90   | 106   | -       | 82  | 106 | 92  |
| getConversationById | 1    | 3    | 1    | 2    | 1     | -       | 1   | 3   | 1   |
| groupsync           | 13   | 17   | 13   | 21   | 18    | -       | 13  | 21  | 16  |
| inboxState          | 1    | 1    | 0    | 1    | 1     | -       | 0   | 1   | 1   |
| newDm               | 1    | 1    | 1    | 1    | 2     | -       | 1   | 2   | 1   |
| newDmByAddress      | 51   | 61   | 131  | 76   | 90    | -       | 51  | 131 | 82  |
| newGroup            | 121  | 121  | 135  | 132  | 149   | -       | 121 | 149 | 131 |
| newGroupByAddress   | 75   | 84   | 79   | 101  | 114   | -       | 75  | 114 | 91  |
| send                | 17   | 28   | 34   | 36   | 36    | -       | 17  | 36  | 30  |
| stream              | 35   | 42   | 82   | 41   | 111   | -       | 35  | 111 | 62  |
| streamMembership    | 67   | 76   | 116  | 125  | 120   | -       | 67  | 125 | 101 |
| streamMessage       | 36   | 92   | 52   | 95   | 54    | -       | 36  | 95  | 66  |
| streamMetadata      | 61   | 95   | 135  | 90   | 101   | -       | 61  | 135 | 96  |
| sync                | 45   | 58   | 64   | 53   | 93    | -       | 45  | 93  | 62  |
| sync                | 8    | 6    | 7    | 6    | 6     | -       | 6   | 8   | 7   |
| syncAll             | 60   | 88   | 87   | 97   | 159   | -       | 60  | 159 | 98  |
| syncAll             | 40   | 41   | 51   | 64   | 57    | -       | 40  | 64  | 51  |

> Measurments made in `local` network only.

## Networks

Network-level performance metrics including connection times and regional variations.

### Network performance

Core network operation timings from DNS lookup through server response processing.

| Performance Metric | Average | Target | Performance |
| ------------------ | ------- | ------ | ----------- |
| DNS Lookup         | 13      | <50    | On Target   |
| TCP Connection     | 48      | <70    | On Target   |
| TLS Handshake      | 124     | <150   | On Target   |
| Processing         | 35      | <100   | On Target   |
| Server Call        | 159     | <250   | On Target   |

### Regional network performance

Comparative network performance across different global regions relative to US East baseline.

| Region        | Server Call | TLS | ~ us-east | Performance |
| ------------- | ----------- | --- | --------- | ----------- |
| us-east       | 140         | 123 | Baseline  | On Target   |
| us-west       | 151         | 118 | <20% ~    | On Target   |
| europe        | 230         | 180 | <40% ~    | On Target   |
| asia          | 450         | 350 | >100% ~   | Concern     |
| south-america | 734         | 573 | >200% ~   | Concern     |

_Note: Baseline is `us-east` region and `production` network._

_Note: `Production` network consistently shows better network performance across all regions, with improvements ranging from 5.5% to 9.1%._

## Message reliability

Message delivery and ordering reliability metrics across different testing scenarios.

### Message delivery testing

Comprehensive delivery rate and message ordering accuracy across stream, poll, and recovery methods.

| Test Area            | Average         | Target         | Performance |
| -------------------- | --------------- | -------------- | ----------- |
| Stream Delivery Rate | 100% successful | 99.9% minimum  | On Target   |
| Poll Delivery Rate   | 100% successful | 99.9% minimum  | On Target   |
| Recovery Rate        | 100% successful | 99.9% minimum  | On Target   |
| Stream Order         | 100% in order   | 99.9% in order | On Target   |
| Poll Order           | 100% in order   | 99.9% in order | On Target   |
| Recovery Order       | 100% in order   | 99.9% in order | On Target   |

_Note: Testing regularly in groups of `40` active members listening to one user sending 100 messages_

## Storage

Database storage efficiency and performance metrics for different group sizes and inbox configurations.

### Storage by group size

Storage utilization comparison between sender and receiver across varying group member counts.

| Group Size  | Groups | Sender storage | Avg Group Size | Receiver storage | Efficiency Gain |
| ----------- | ------ | -------------- | -------------- | ---------------- | --------------- |
| 2 members   | 261    | 5.1 MB         | 0.020 MB       | 1.617 MB         | baseline        |
| 10 members  | 114    | 5.1 MB         | 0.044 MB       | 3.133 MB         | 2.2× better     |
| 50 members  | 31     | 5.3 MB         | 0.169 MB       | 3.625 MB         | 2.9× better     |
| 100 members | 19     | 5.6 MB         | 0.292 MB       | 5.566 MB         | 3.3× better     |
| 150 members | 12     | 5.6 MB         | 0.465 MB       | 6.797 MB         | 3.2× better     |
| 200 members | 10     | 6.2 MB         | 0.618 MB       | 8.090 MB         | 3.2× better     |

### Large inbox syncs

Sync performance and storage requirements for inboxes with varying numbers of existing groups.

| Inbox Size | Sync Time (ms) | DB Size (MB) | Existing Groups | queryGroupMessages |
| ---------- | -------------- | ------------ | --------------- | ------------------ |
| Small      | 335            | 20           | 5               | 17                 |
| Medium     | 364            | 107          | 17              | 53                 |
| Large      | 365            | 208          | 31              | 95                 |
| XL         | 376            | 410          | 59              | 179                |

> For large groups measurments see [bench](./suites/bench/README.md)
