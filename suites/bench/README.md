# Performance benchmarking suite

This test suite measures XMTP protocol performance across different group sizes and installation counts, providing detailed metrics for scalability analysis.

## What it does (units)

- Creates groups with varying member counts (10-200 members)
- Tests different installation counts per member (2-25 installations)
- Measures member addition timing and sync performance
- Tracks total installation counts and performance scaling
- Generates comprehensive performance reports

## Key metrics:

- **Add Members Time**: Time to add new members to existing groups
- **SyncAll Time**: Time for new clients to sync all conversations
- **Time per Installation**: Performance efficiency metric (ms per installation)
- **Installation Count Accuracy**: Verification of expected vs actual installation counts

## Environment setup

Set `XMTP_ENV` to `dev` or `production` to test performance on the corresponding network.

## How to run

### Run performance benchmarks

```bash
yarn test bench
```

### Configuration Parameters

The test suite uses these configurable parameters:

- `CHECK_INSTALLATIONS`: Installation counts to test per member ([2, 5, 10, 15, 20, 25])
- `MIN_MAX_INSTALLATIONS`: Installation count boundaries ([1000, 2000])

## Test results

Performance results are automatically saved to:

- `logs/bench_[timestamp].log` - Formatted table output
- `logs/bench_[timestamp].csv` - Raw data for analysis

### Sample Performance Data

| Group Size | Inst/Member | Actual Inst | Add Members (ms) | SyncAll (ms) | Time per Install (ms) |
| ---------- | ----------- | ----------- | ---------------- | ------------ | --------------------- |
| 20         | 2           | 40          | 78.00            | 46.05        | 1.95                  |
| 40         | 2           | 80          | 95.00            | 80.04        | 1.19                  |
| 100        | 5           | 491         | 181.00           | 272.49       | 0.37                  |
| 200        | 10          | 1976        | 342.00           | 1260.17      | 0.17                  |

## Performance insights

### Scalability Patterns

- **Time per installation decreases** as group size increases (better efficiency at scale)
- **SyncAll time grows** roughly linearly with total installation count
- **Installation count variations** due to key rotation and multi-device scenarios

### Known Limitations

- Groups with >3200 installations may hit message size limits (4MB)
- Network connectivity issues may occur during large-scale testing
- Performance varies significantly between `dev` and `production` environments

## Key files

- **[bench.test.ts](./bench.test.ts)** - Main performance testing implementation
- **[all.csv](./all.csv)** - Historical performance data
- **[README.md](./README.md)** - This documentation

## Large groups performance results

| Group Size | Inst/Member | Actual Inst | Diff | Est. Inst | B receives member (ms) | Z gets added (ms) | Time per Install (ms) |
| ---------- | ----------- | ----------- | ---- | --------- | ---------------------- | ----------------- | --------------------- |
| 20         | 2           | 40          | 0    | 40        | 78.00                  | 46.05             | 1.95                  |
| 40         | 2           | 80          | 0    | 80        | 95.00                  | 80.04             | 1.19                  |
| 20         | 5           | 91          | -9   | 100       | 111.00                 | 66.97             | 1.22                  |
| 60         | 2           | 120         | 0    | 120       | 91.00                  | 115.67            | 0.76                  |
| 80         | 2           | 160         | 0    | 160       | 98.00                  | 162.11            | 0.61                  |
| 20         | 10          | 176         | -24  | 200       | 122.00                 | 116.78            | 0.69                  |
| 40         | 5           | 191         | -9   | 200       | 114.00                 | 136.71            | 0.60                  |
| 100        | 2           | 200         | 0    | 200       | 188.00                 | 179.92            | 0.94                  |
| 120        | 2           | 240         | 0    | 240       | 165.00                 | 229.05            | 0.69                  |
| 140        | 2           | 280         | 0    | 280       | 142.00                 | 225.16            | 0.51                  |
| 60         | 5           | 291         | -9   | 300       | 136.00                 | 205.74            | 0.47                  |
| 160        | 2           | 320         | 0    | 320       | 143.00                 | 305.85            | 0.45                  |
| 20         | 20          | 346         | -54  | 400       | 195.00                 | 155.74            | 0.56                  |
| 180        | 2           | 360         | 0    | 360       | 156.00                 | 300.52            | 0.43                  |
| 40         | 10          | 376         | -24  | 400       | 113.00                 | 240.48            | 0.30                  |
| 80         | 5           | 391         | -9   | 400       | 158.00                 | 229.69            | 0.40                  |
| 200        | 2           | 400         | 0    | 400       | 154.00                 | 396.50            | 0.39                  |
| 220        | 2           | 440         | 0    | 440       | 148.00                 | 376.20            | 0.34                  |
| 100        | 5           | 491         | -9   | 500       | 181.00                 | 272.49            | 0.37                  |
| 60         | 10          | 576         | -24  | 600       | 227.00                 | 305.65            | 0.39                  |
| 120        | 5           | 591         | -9   | 600       | 252.00                 | 335.77            | 0.43                  |
| 140        | 5           | 691         | -9   | 700       | 264.00                 | 491.98            | 0.38                  |
| 40         | 20          | 746         | -54  | 800       | 272.00                 | 350.02            | 0.36                  |
| 80         | 10          | 776         | -24  | 800       | 219.00                 | 496.39            | 0.28                  |
| 160        | 5           | 791         | -9   | 800       | 275.00                 | 459.82            | 0.35                  |
| 180        | 5           | 891         | -9   | 900       | 254.00                 | 505.14            | 0.29                  |
| 100        | 10          | 976         | -24  | 1000      | 231.00                 | 480.41            | 0.24                  |
| 200        | 5           | 991         | -9   | 1000      | 234.00                 | 579.40            | 0.24                  |
| 220        | 5           | 1091        | -9   | 1100      | 264.00                 | 621.13            | 0.24                  |
| 60         | 20          | 1146        | -54  | 1200      | 345.00                 | 517.23            | 0.30                  |
| 120        | 10          | 1176        | -24  | 1200      | 275.00                 | 752.88            | 0.23                  |
| 140        | 10          | 1376        | -24  | 1400      | 337.00                 | 705.45            | 0.24                  |
| 80         | 20          | 1546        | -54  | 1600      | 388.00                 | 707.25            | 0.25                  |
| 160        | 10          | 1576        | -24  | 1600      | 355.00                 | 823.63            | 0.23                  |
| 180        | 10          | 1776        | -24  | 1800      | 359.00                 | 1145.47           | 0.20                  |
| 100        | 20          | 1946        | -54  | 2000      | 338.00                 | 1077.45           | 0.17                  |
| 200        | 10          | 1976        | -24  | 2000      | 342.00                 | 1260.17           | 0.17                  |
| 220        | 10          | 2176        | -24  | 2200      | 548.00                 | 1158.71           | 0.25                  |
| 120        | 20          | 2346        | -54  | 2400      | 499.00                 | 1072.72           | 0.21                  |
| 140        | 20          | 2746        | -54  | 2800      | 536.00                 | 1244.64           | 0.20                  |
| 160        | 20          | 3146        | -54  | 3200      | 541.00                 | 1449.46           | 0.17                  |

## ~2000 large groups performance results

| Group Size | Inst/Member | Actual Inst | Diff | Est. Inst | Add Members (ms) | SyncAll (ms) | Time per Install (ms) |
| ---------- | ----------- | ----------- | ---- | --------- | ---------------- | ------------ | --------------------- |
| 90         | 20          | 1743        | -57  | 1800      | 447.00           | 1001.52      | 0.26                  |
| 120        | 15          | 1758        | -42  | 1800      | 332.00           | 775.86       | 0.19                  |
| 180        | 10          | 1773        | -27  | 1800      | 393.00           | 851.00       | 0.22                  |
| 190        | 10          | 1873        | -27  | 1900      | 316.00           | 944.03       | 0.17                  |
| 130        | 15          | 1908        | -42  | 1950      | 404.00           | 1094.99      | 0.21                  |
| 80         | 25          | 1928        | -72  | 2000      | 441.00           | 1099.99      | 0.23                  |
| 100        | 20          | 1943        | -57  | 2000      | 510.00           | 861.25       | 0.26                  |
| 200        | 10          | 1973        | -27  | 2000      | 364.00           | 994.03       | 0.18                  |
| 140        | 15          | 2058        | -42  | 2100      | 429.00           | 1241.45      | 0.21                  |
| 110        | 20          | 2144        | -56  | 2200      | 444.00           | 1270.69      | 0.21                  |

## Large groups performance results

| Group Size | Inst/Member | Actual Inst | Diff | Est. Inst | Add Members (ms) | SyncAll (ms) | Time per Install (ms) |
| ---------- | ----------- | ----------- | ---- | --------- | ---------------- | ------------ | --------------------- |
| 60         | 30          | 1713        | -87  | 1800      | 422.00           | 997.53       | 0.25                  |
| 90         | 20          | 1743        | -57  | 1800      | 372.00           | 747.72       | 0.21                  |
| 120        | 15          | 1758        | -42  | 1800      | 401.00           | 1007.16      | 0.23                  |
| 180        | 10          | 1774        | -26  | 1800      | 443.00           | 1138.13      | 0.25                  |
| 190        | 10          | 1873        | -27  | 1900      | 441.00           | 1209.25      | 0.24                  |
| 130        | 15          | 1908        | -42  | 1950      | 403.00           | 1122.18      | 0.21                  |
| 80         | 25          | 1928        | -72  | 2000      | 543.00           | 1076.16      | 0.28                  |
| 100        | 20          | 1944        | -56  | 2000      | 351.00           | 1141.92      | 0.18                  |
| 200        | 10          | 1974        | -26  | 2000      | 449.00           | 1209.01      | 0.23                  |
| 70         | 30          | 2013        | -87  | 2100      | 431.00           | 1123.54      | 0.21                  |
| 140        | 15          | 2058        | -42  | 2100      | 435.00           | 1009.45      | 0.21                  |
| 110        | 20          | 2143        | -57  | 2200      | 416.00           | 1257.02      | 0.19                  |

## Insights

A 3200 installations group gives:

```
Error, decoded message length too large: found 4800716 bytes, the limit is: 4194304 bytes
```

Measuments in `local` network

Networks breaks after this test with:

```
❌ Error updating inbox 0x41c4d0e3736667e9993e384c7c85e0b90771d7c1:
[2025-06-09T18:09:29.827Z] [error] ERROR api client error api client at endpoint "get_inbox_ids" has error status: Unknown, message: "failed to connect to `host=mlsdb user=postgres database=postgres`: hostname resolving error (lookup mlsdb on 127.0.0.11:53: no such host)", details: [], metadata: MetadataMap { headers: {"content-type": "application/grpc"} }
```
