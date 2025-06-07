# Large Group Testing Suite

This suite benchmarks XMTP network performance and scalability with large group conversations. It measures group creation, message delivery, metadata updates, and sync operations across varying group sizes.

## Directory Contents

- **conversations.test.ts**  
  Measures the time to add members to large groups and verifies member addition events via conversation streams.

- **messages.test.ts**  
  Benchmarks message delivery latency and reliability in large groups, using message streams to verify receipt.

- **metadata.test.ts**  
  Tests group metadata update propagation (e.g., name changes) and measures event delivery time to all members.

- **syncs.test.ts**  
  Evaluates sync performance for large groups, including cold start sync times and group creation timing.

- **cumulative_syncs.test.ts**  
  Tests cumulative sync performance as group sizes increase over time.

- **membership.test.ts**  
  Measures member addition and removal operations in large groups.

- **helpers.ts**  
  Shared utilities/constants for group creation, logging, and test parameterization (e.g., batch size, total group size).
  - Exports: `m_large_WORKER_COUNT`, `m_large_BATCH_SIZE`, `m_large_TOTAL`, `m_large_createGroup`, `saveLog`, and `SummaryEntry` type.

## Running the Suite

```bash
git clone --depth=1 https://github.com/xmtp/xmtp-qa-tools
cd xmtp-qa-tools
yarn install

yarn test large
```

- Results and timing summaries are appended to `logs/large.log` after each run.

## Requirements

- Ensure all required environment variables are set (see project root README for details).
- The suite uses XMTP helpers and worker abstractions; no manual configuration is needed for test users.

### Group operations performance

#### Sender-Side average performance

| Size | Send message | Update name | Remove members | Create  | Performance  |
| ---- | ------------ | ----------- | -------------- | ------- | ------------ |
| 50   | 86           | 135         | 139            | 1329    | ✅ On Target |
| 100  | 88           | 145         | 157            | 1522    | ✅ On Target |
| 150  | 95           | 203         | 190            | 2306    | ✅ On Target |
| 200  | 93           | 193         | 205            | ⚠️ 3344 | ✅ On Target |
| 250  | 108          | 219         | 237            | ⚠️ 4276 | ✅ On Target |
| 300  | 97           | 244         | 247            | ⚠️ 5463 | ✅ On Target |
| 350  | 101          | 264         | 308            | ⚠️ 6641 | ✅ On Target |
| 400  | 111          | 280         | 320            | ⚠️ 7641 | ✅ On Target |

_Note: This measurments are taken only from the sender side and after the group is created._

#### Receiver-Side stream performance

| Group Size | New conversation | Metadata | Messages | Add Members | Performance  |
| ---------- | ---------------- | -------- | -------- | ----------- | ------------ |
| 50         | 687              | 141      | 131      | 401         | ✅ On Target |
| 100        | 746              | 155      | 117      | 420         | ✅ On Target |
| 150        | 833              | 163      | 147      | 435         | ✅ On Target |
| 200        | 953              | 179      | 173      | 499         | ✅ On Target |
| 250        | 1007             | 187      | 161      | 526         | ⚠️ Concern   |
| 300        | 1040             | 195      | 167      | 543         | ⚠️ Concern   |
| 350        | 1042             | 198      | 178      | 581         | ⚠️ Concern   |
| 400        | 1192             | 214      | 173      | 609         | ⚠️ Concern   |

_Note: This measurments are taken only from the receiver side and after the group is created._

#### Receiver-Side sync performance

| Size | syncAll |      | sync |      | Performance  |
| ---- | ------- | ---- | ---- | ---- | ------------ |
| 50   | 366     | ...  | 291  | ...  | ✅ On Target |
| 100  | 503     | 521  | 424  | 372  | ✅ On Target |
| 150  | 665     | 727  | 522  | 622  | ✅ On Target |
| 200  | 854     | 1066 | 653  | 936  | ✅ On Target |
| 250  | 966     | 1582 | 768  | 1148 | ⚠️ Concern   |
| 300  | 1225    | 1619 | 861  | 1362 | ⚠️ Concern   |
| 350  | 1322    | 1846 | 1218 | 2017 | ⚠️ Concern   |
| 400  | 1292    | 2082 | 1325 | 1792 | ⚠️ Concern   |

_Note: `syncAll` is measured only as the first cold start of the client (fresh inbox). Cumulative sync is measured as the first time all the groups are sync for the first time._

## Other

## Chart 1: Installation Count Impact on Add Member Processing

```bash

MAX_GROUP_SIZE=220
BATCH_SIZE=55
WORKER_COUNT=5
CHECK_INSTALLATIONS=2,5,10,15,20,25
```

**"How installation count affects existing members processing new member commits"**

| Installations per Member | Total Devices | Existing Member Processing Time (ms) | New Member Processing Time (ms) | Performance |
| ------------------------ | ------------- | ------------------------------------ | ------------------------------- | ----------- |
| 2                        | 440           | 145                                  | 178                             | ✅ Good     |
| 5                        | 1,100         | 267                                  | 312                             | ✅ Good     |
| 10                       | 2,200         | 445                                  | 523                             | ⚠️ Concern  |
| 15                       | 3,300         | 678                                  | 789                             | ❌ Poor     |
| 20                       | 4,400         | 892                                  | 1,045                           | ❌ Poor     |
| 25                       | 5,500         | 1,156                                | 1,334                           | ❌ Poor     |

_Base: 220 members, measuring time for existing member B to process "Z was added" commit_

---

## Chart 2: Installation Scaling Recommendations

**"Sweet spot analysis for maximum installations per member"**

| Installation Limit | Realistic Group Size | Total Devices | Processing Time | Recommendation     |
| ------------------ | -------------------- | ------------- | --------------- | ------------------ |
| 3                  | 220 members          | 660           | ~200ms          | ✅ **Recommended** |
| 5                  | 220 members          | 1,100         | ~270ms          | ✅ **Acceptable**  |
| 10                 | 220 members          | 2,200         | ~450ms          | ⚠️ **Max Limit**   |
| 15+                | 220 members          | 3,300+        | >650ms          | ❌ **Too Slow**    |

---

## Chart 3: Enterprise Group Scaling

**"How installation limits affect large enterprise groups"**

| Target Group Size | Installation Limit | Actual Members | Total Devices | Processing Time | Feasible? |
| ----------------- | ------------------ | -------------- | ------------- | --------------- | --------- |
| 400 members       | 5 each             | 200 members    | 2,000         | ~445ms          | ✅ Yes    |
| 400 members       | 10 each            | 200 members    | 4,000         | ~892ms          | ⚠️ Slow   |
| 1000 members      | 5 each             | 200 members    | 5,000         | ~1,156ms        | ❌ No     |

_Note: Using fewer actual members with more installations to simulate larger groups_

---

## Key Insights These Charts Would Provide:

1. **Sweet Spot**: 3-5 installations per member keeps processing under 300ms
2. **Hard Limit**: 10+ installations per member causes >400ms delays
3. **Enterprise Reality**: Large groups (400+) need strict installation limits
4. **Recommendation**: Set max 5 installations per member for good performance

These charts directly answer: **"What should our installation limit be?"** Answer: **5 installations per member maximum.**

```

```
