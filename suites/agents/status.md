# LOCAL LOCAL

| Agent | Environment | Success Rate | Total Time | Avg Response | Median Response | 95th Percentile | M/s   | Status  |
| ----- | ----------- | ------------ | ---------- | ------------ | --------------- | --------------- | ----- | ------- |
| local | dev         | 100.0%       | 3.2s       | 1.1s         | 1.1s            | 1.3s            | 93.0  | Success |
| local | local       | 100.0%       | 2.3s       | 0.4s         | 0.4s            | 0.7s            | 130.0 | Success |
| local | production  | 100.0%       | 3.6s       | 1.2s         | 1.2s            | 1.4s            | 84.3  | Success |
| gm    | dev         | 66.7%        | 120.9s     | 7.5s         | 7.5s            | 14.0s           | 2.5   | Failure |
| gm    | dev         | 99.7%        | 120.7s     | 16.8s        | 18.4s           | 30.4s           | 2.5   | Success |
| gm    | production  | 100.0%       | 61.0s      | 42.6s        | 45.3s           | 57.2s           | 4.9   | Success |
