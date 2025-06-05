# Storage Test Suite

Measures storage efficiency by creating groups of different sizes until reaching a target storage threshold, then analyzing the storage cost per member and efficiency gains compared to baseline configurations.

- Analyzes storage efficiency across different group sizes (2, 10, 50, 100, 150, 200 members)
- Creates groups until reaching ~5MB of storage per configuration
- Measures total storage, groups created, average group size, and cost per member
- Calculates efficiency gains compared to 2-member baseline groups
- Provides detailed analysis of storage scaling patterns

## How to Run

```bash
# Run storage efficiency tests
yarn test suites/storage

# Run with custom target size
TARGET_SIZE_MB=10 yarn test suites/storage/storage.test.ts
```

### Environment Variables

**Storage Tests:**

- `TARGET_SIZE_MB` - Target storage size in MB for testing (default: 5)
- `MEMBER_COUNTS` - Comma-separated list of member counts to test (default: "2,10,50,100,150,200")

### Details

| Group Size  | Groups | Sender storage | Avg Group Size | Receiver storage | Efficiency Gain |
| ----------- | ------ | -------------- | -------------- | ---------------- | --------------- |
| 2 members   | 261    | 5.1 MB         | 0.020 MB       | 1.617 MB         | baseline        |
| 10 members  | 114    | 5.1 MB         | 0.044 MB       | 3.133 MB         | 2.2× better     |
| 50 members  | 31     | 5.3 MB         | 0.169 MB       | 3.625 MB         | 2.9× better     |
| 100 members | 19     | 5.6 MB         | 0.292 MB       | 5.566 MB         | 3.3× better     |
| 150 members | 12     | 5.6 MB         | 0.465 MB       | 6.797 MB         | 3.2× better     |
| 200 members | 10     | 6.2 MB         | 0.618 MB       | 8.090 MB         | 3.2× better     |
