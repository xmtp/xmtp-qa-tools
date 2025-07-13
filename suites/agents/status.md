# LOCAL LOCAL

| Agent               | Environment | Success Rate | Total Time | Avg Response | Median Response | 95th Percentile | M/s   | Status  |
| ------------------- | ----------- | ------------ | ---------- | ------------ | --------------- | --------------- | ----- | ------- |
| local               | dev         | 100.0%       | 3.2s       | 1.1s         | 1.1s            | 1.3s            | 93.0  | Success |
| local               | local       | 100.0%       | 2.3s       | 0.4s         | 0.4s            | 0.7s            | 130.0 | Success |
| local               | production  | 100.0%       | 3.6s       | 1.2s         | 1.2s            | 1.4s            | 84.3  | Success |
| gm (first time)     | dev         | 66.7%        | 120.9s     | 7.5s         | 7.5s            | 14.0s           | 2.5   | Failure |
| gm (optimistic)     | dev         | 99.7%        | 120.7s     | 16.8s        | 18.4s           | 30.4s           | 2.5   | Success |
| gm (optimistic)     | production  | 100.0%       | 61.0s      | 42.6s        | 45.3s           | 57.2s           | 4.9   | Success |
| gm (non-optimistic) | production  | 99.3%        | 120.7s     | 15.03s       | 15.24s          | 27.12s          | 2.5   | Success |

# 📊 STRESS TEST RESULTS

this was with 2nd time running the test

Agent: gm
Env: production
Success Rate: 497/500 (99.4%)
⏱️ Total Execution Time: 121.2s
Average Response Time: 59.89s
Median Response Time: 80.28s
95th Percentile Response Time: 101.87s
Messages per Second: 4.1
✅ SUCCESS: 99.4% ≥ 99% threshold
🏆 Test completed successfully!

# 📊 STRESS TEST RESULTS

Agent: gm
Env: production
Success Rate: 497/500 (99.4%)
⏱️ Total Execution Time: 121.0s
Average Response Time: 48.73s
Median Response Time: 24.42s
95th Percentile Response Time: 109.33s
Messages per Second: 4.1
✅ SUCCESS: 99.4% ≥ 99% threshold
🏆 Test completed successfully!
