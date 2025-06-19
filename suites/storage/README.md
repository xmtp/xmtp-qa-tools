# Storage Efficiency Testing Suite

This test suite analyzes XMTP protocol storage efficiency across different group sizes, measuring storage costs and optimization patterns for various group configurations.

## What it does

- Analyzes storage efficiency across different group sizes (2-200 members)
- Creates groups until reaching configurable storage threshold (~5MB default)
- Measures total storage, groups created, average group size, and cost per member
- Calculates efficiency gains compared to baseline configurations
- Provides detailed analysis of storage scaling patterns and optimization opportunities

## Environment Setup

Set `XMTP_ENV` to `dev` or `production` to test storage efficiency on the corresponding network.

### Configuration Variables

- `TARGET_SIZE_MB` - Target storage size in MB for testing (default: 5)
- `MEMBER_COUNTS` - Comma-separated list of member counts to test (default: "2,10,50,100,150,200")

## How to run

### Run storage efficiency tests

```bash
yarn test storage
```

### Run with custom parameters

```bash
# Test with larger storage target
TARGET_SIZE_MB=10 yarn test storage

# Test with custom member count configurations
MEMBER_COUNTS="5,25,75,125" yarn test storage
```

## Test Analysis

### Storage Efficiency Metrics

For each group size configuration, the test measures:

- **Total storage consumed** (sender and receiver perspectives)
- **Number of groups created** to reach storage threshold
- **Average group size** and storage cost per member
- **Efficiency gains** compared to baseline (2-member groups)
- **Storage scaling patterns** across different group sizes

### Sample Results

| Group Size  | Groups Created | Sender Storage | Avg Cost/Member | Receiver Storage | Efficiency Gain |
| ----------- | -------------- | -------------- | --------------- | ---------------- | --------------- |
| 2 members   | 261            | 5.1 MB         | 0.020 MB        | 1.617 MB         | baseline        |
| 10 members  | 114            | 5.1 MB         | 0.044 MB        | 3.133 MB         | 2.2× better     |
| 50 members  | 31             | 5.3 MB         | 0.169 MB        | 3.625 MB         | 2.9× better     |
| 100 members | 19             | 5.6 MB         | 0.292 MB        | 5.566 MB         | 3.3× better     |
| 150 members | 12             | 5.6 MB         | 0.465 MB        | 6.797 MB         | 3.2× better     |
| 200 members | 10             | 6.2 MB         | 0.618 MB        | 8.090 MB         | 3.2× better     |

## Storage Insights

### Optimization Patterns

- **Small Groups (≤10 members)**: Significant storage overhead per member
- **Medium Groups (50-100 members)**: Optimal efficiency gains (2.9-3.3× improvement)
- **Large Groups (150+ members)**: Efficiency plateaus around 3.2× improvement

### Storage Scaling

- **Sender storage** grows gradually with group size
- **Receiver storage** increases more significantly with larger groups
- **Cost per member** decreases substantially as group size increases
- **Efficiency gains** plateau around 100+ member groups

## Recommendations

Based on storage analysis:

- **Use larger groups** (50+ members) for better storage efficiency
- **Optimal range**: 100-150 members for maximum efficiency gains
- **Small groups** should be used sparingly due to storage overhead
- **Consider group splitting** strategies for very large groups to balance efficiency vs performance

## Key Files

- **[storage.test.ts](./storage.test.ts)** - Storage efficiency testing implementation
- **[README.md](./README.md)** - This documentation
