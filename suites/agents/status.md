# LOCAL LOCAL

| Agent | Strategy | Environment | Success Rate | Total Time | Avg Response | Median Response | 95th Percentile | M/s  | Status  |
| ----- | -------- | ----------- | ------------ | ---------- | ------------ | --------------- | --------------- | ---- | ------- |
| local | normal   | production  | 100%         | 366.7s     | 16.78s       | 1.19s           | 57.44s          | 13.6 | Success |
| local | queue    | production  | 100%         | 365.2s     | 16.93s       | 1.27s           | 57.13s          | 13.7 | Success |
| gm    | normal   | production  | 99.8%        | 636.0s     | 21.60s       | 14.32s          | 57.81s          | 7.9  | Success |
| gm    | async    | production  | 98.3%        | 812.0s     | 25.23s       | 16.13s          | 98.71s          | 6.2  | Success |
