# 5K messages on production

| Metric               | local      | gm         | bankr      |
| -------------------- | ---------- | ---------- | ---------- |
| ** Environment**     | production | production | production |
| ** Success Rate**    | 100%       | 99.8% ✅   | 58.8%      |
| ** Total Time**      | 366.7s     | 636.0s     | 121.6s     |
| ** Avg Response**    | 16.78s     | 21.60s ⚠️  | 74.38s ❌  |
| ** Median Response** | 1.19s      | 14.32s     | 76.62s     |
| ** 95th Percentile** | 57.44s     | 57.81s     | 113.05s    |
| ** M/s**             | 13.6       | 7.9 ⚠️     | 4.1 ⚠️     |
| ** Status**          | Success ✅ | Success ✅ | Failure ❌ |

# First run comparison

| Metric                        | First Run         | Second Run        |
| ----------------------------- | ----------------- | ----------------- |
| Success Rate                  | 237/500 (47.4%)   | 500/500 (100.0%)  |
| Total Execution Time          | 122.0s            | 5.0s              |
| Average Response Time         | 55.53s            | 1.92s             |
| Median Response Time          | 56.72s            | 2.16s             |
| 95th Percentile Response Time | 107.88s           | 2.65s             |
| Messages per Second           | 4.1               | 100.3             |
| Threshold Status              | ❌ FAILURE (<99%) | ✅ SUCCESS (≥99%) |
