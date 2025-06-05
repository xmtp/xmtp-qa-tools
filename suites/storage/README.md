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

| Group Size  | Groups | Total Storage | Avg Group Size | Efficiency Gain |
| ----------- | ------ | ------------- | -------------- | --------------- |
| 2 members   | 239    | 5.0 MB        | 0.021 MB       | baseline        |
| 10 members  | 110    | 5.3 MB        | 0.048 MB       | 2.2× better     |
| 50 members  | 32     | 5.5 MB        | 0.173 MB       | 3.0× better     |
| 100 members | 17     | 5.3 MB        | 0.311 MB       | 3.4× better     |
| 150 members | 13     | 6.3 MB        | 0.482 MB       | 3.3× better     |
| 200 members | 8      | 5.0 MB        | 0.627 MB       | 3.3× better     |
