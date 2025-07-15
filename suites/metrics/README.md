# Metrics Test Suite

Performance and delivery testing for XMTP protocol.

## Test Types

### Large Groups

Tests group performance with varying member counts.

```bash
yarn test large
BATCH_SIZES=10,50 yarn test large
```

### Performance

Tests core protocol performance metrics.

```bash
yarn test performance
```

### Delivery

Tests message delivery reliability across 200 streams.

```bash
yarn test delivery
DELIVERY_AMOUNT=100 yarn test delivery
```

## CI Schedules

- **Large**: Every 2 hours, batched by group sizes
- **Performance**: Every hour at :30
- **Delivery**: Twice hourly at :25 and :55

## Environment Variables

```bash
XMTP_ENV=dev|production
BATCH_SIZES=10,50,100     # Large test only
DELIVERY_AMOUNT=100       # Delivery test only
```
