# Load Test Examples

## Basic Message Load Test

Test with 100% message sending (original behavior):

```bash
# Setup
npx tsx setup.ts -i 50 -g 5 -m 10 -e dev

# Run (adaptive mode)
npm run test
```

## Realistic Production Mix

Test with production-like traffic (70% messages, 30% operations):

```bash
# Setup
npx tsx setup.ts -i 100 -g 10 -m 20 -p 100 -e dev -w realistic

# Run (adaptive mode)
npm run test
```

## Heavy Member Churn

Test with lots of add/remove operations:

```bash
# Setup (need large pool for add/remove)
npx tsx setup.ts -i 100 -g 10 -m 20 -p 300 -e dev -w memberChurn

# Run (adaptive mode)
npm run test
```

## Metadata Update Stress Test

Test group metadata operations:

```bash
# Setup
npx tsx setup.ts -i 50 -g 10 -m 15 -e dev -w metadata

# Run (adaptive mode)
npm run test
```

## Admin Operations Test

Test admin promotion/demotion:

```bash
# Setup
npx tsx setup.ts -i 100 -g 20 -m 10 -e dev -w adminOps

# Run (adaptive mode)
npm run test
```

## Fixed-Rate Testing

If you need a specific throughput instead of adaptive:

```bash
# Setup
npx tsx setup.ts -i 100 -g 10 -m 20 -p 100 -e dev -w balanced

# Edit artillery-config.yml to set arrivalRate and duration

# Run fixed-rate test
npm run test:fixed
```

## Quick Verification

Fast test to verify setup is working:

```bash
# Setup minimal config
npx tsx setup.ts -i 5 -g 2 -m 3 -e dev

# Run simple test
npm run test:simple
```

## All Workload Presets

Test each preset for comparison:

```bash
# Messages only (baseline)
npx tsx setup.ts -i 100 -g 10 -m 20 -e dev -w messagesOnly
npm run test
# Wait for results...

# Balanced mix
npx tsx setup.ts -i 100 -g 10 -m 20 -p 100 -e dev -w balanced
npm run test
# Wait for results...

# Compare reports in ./data/adaptive-report.json
```

