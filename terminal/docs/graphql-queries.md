# GraphQL Query Reference

All queries target the Envio/Hasura GraphQL endpoint (default: `http://localhost:8080/v1/graphql`).

---

## Layer 1 — Liquidation Feed & Post-Mortems

### 1.1 Latest Liquidations Tape (global)

Fetches the 50 most recent liquidation events across all markets. Use this for a live
CEX-style liquidation ticker.

```graphql
query LatestLiquidations($limit: Int = 50) {
  PositionUpdate(
    where: { eventType: { _eq: "LIQUIDATION" } }
    order_by: { blockTimestamp: desc }
    limit: $limit
  ) {
    id
    position_id
    user
    protocol
    executionPrice
    sizeDeltaUsd
    realizedPnlDelta
    blockNumber
    blockTimestamp
    txHash
  }
}
```

### 1.2 Latest Liquidations by Market

Filter the tape to a single market (e.g. `"ETH-USD"`).

```graphql
query LiquidationsByMarket($market: String!, $limit: Int = 50) {
  PositionUpdate(
    where: {
      eventType: { _eq: "LIQUIDATION" }
      position_id: { _ilike: $market }
    }
    order_by: { blockTimestamp: desc }
    limit: $limit
  ) {
    id
    position_id
    user
    protocol
    executionPrice
    sizeDeltaUsd
    realizedPnlDelta
    blockNumber
    blockTimestamp
    txHash
  }
}
```

> Note: `position_id` has the form `GMX-<user>-<market>-long|short`, so `_ilike: "%-eth-usd-%"`
> matches all ETH-USD positions. Alternatively, join on `Position.market` for precise matching.

### 1.3 Latest Liquidations by User

All liquidation events for a specific trader's wallet.

```graphql
query LiquidationsByUser($user: String!, $limit: Int = 100) {
  PositionUpdate(
    where: {
      eventType: { _eq: "LIQUIDATION" }
      user: { _eq: $user }
    }
    order_by: { blockTimestamp: desc }
    limit: $limit
  ) {
    id
    position_id
    protocol
    executionPrice
    sizeDeltaUsd
    realizedPnlDelta
    blockNumber
    blockTimestamp
    txHash
  }
}
```

### 1.4 Position Post-Mortem — Full History

Given a `position_id`, return the entire ordered event history (INCREASE → DECREASE* → LIQUIDATION).
This enables the "how did this position die?" reconstruction panel.

```graphql
query PositionPostMortem($positionId: String!) {
  PositionUpdate(
    where: { position_id: { _eq: $positionId } }
    order_by: { blockTimestamp: asc, blockNumber: asc }
  ) {
    id
    eventType
    executionPrice
    sizeDeltaUsd
    collateralDeltaUsd
    realizedPnlDelta
    blockNumber
    blockTimestamp
    txHash
  }

  # Final state snapshot
  Position_by_pk(id: $positionId) {
    user
    market
    isLong
    entryPrice
    sizeUsd
    initialCollateralUsd
    accruedFeesUsd
    realizedPnlUsd
    healthScore
    marginHealth
    isOpen
  }
}
```

### 1.5 Aggregate Liquidation Stats (last 24h)

Total notional liquidated and count of liquidations in the last 24 hours.
Requires passing the Unix timestamp for 24 hours ago.

```graphql
query LiquidationStats24h($since: numeric!) {
  PositionUpdate_aggregate(
    where: {
      eventType: { _eq: "LIQUIDATION" }
      blockTimestamp: { _gte: $since }
    }
  ) {
    aggregate {
      count
      sum {
        sizeDeltaUsd
      }
    }
  }
}
```

---

## Layer 2 — Margin Health Distribution & Stress Testing

### 2.1 Open Position Count per Health Bucket (per market)

Group open positions by `marginHealth` for a single market. Use on the frontend
to render the distribution bar chart.

```graphql
query MarginHealthDistribution($market: String!) {
  HEALTHY: Position_aggregate(
    where: { market: { _eq: $market }, isOpen: { _eq: true }, marginHealth: { _eq: "HEALTHY" } }
  ) { aggregate { count sum { sizeUsd } } }

  MODERATE: Position_aggregate(
    where: { market: { _eq: $market }, isOpen: { _eq: true }, marginHealth: { _eq: "MODERATE" } }
  ) { aggregate { count sum { sizeUsd } } }

  AT_RISK: Position_aggregate(
    where: { market: { _eq: $market }, isOpen: { _eq: true }, marginHealth: { _eq: "AT_RISK" } }
  ) { aggregate { count sum { sizeUsd } } }

  WARNING: Position_aggregate(
    where: { market: { _eq: $market }, isOpen: { _eq: true }, marginHealth: { _eq: "WARNING" } }
  ) { aggregate { count sum { sizeUsd } } }

  CRITICAL: Position_aggregate(
    where: { market: { _eq: $market }, isOpen: { _eq: true }, marginHealth: { _eq: "CRITICAL" } }
  ) { aggregate { count sum { sizeUsd } } }
}
```

### 2.2 Open Positions for Stress Testing

Fetch all open positions for a given market so the frontend can pass them to
the `simulateStressForMarket` helper.

```graphql
query OpenPositionsForStress($market: String!, $protocol: String = "GMX") {
  Position(
    where: {
      market: { _eq: $market }
      protocol: { _eq: $protocol }
      isOpen: { _eq: true }
    }
  ) {
    id
    user
    isLong
    entryPrice
    sizeUsd
    notionalSizeUsd
    initialCollateralUsd
    accruedFeesUsd
    healthScore
    marginHealth
    liquidationPrice
  }
}
```

> The result is fed into `simulateStressForMarket(positions, shockedPrice)` in
> `src/utils/stressTest.ts` to compute hypothetical health shifts without any
> database writes.

### 2.3 Distribution of healthScore buckets (raw distribution)

For a finer view, bucket `healthScore` into numeric ranges directly in the query.
This approach does not require handler changes.

```graphql
query HealthScoreRanges($market: String!) {
  score_0_100: Position_aggregate(
    where: { market: { _eq: $market }, isOpen: { _eq: true }, healthScore: { _lte: "100" } }
  ) { aggregate { count sum { sizeUsd } } }

  score_100_110: Position_aggregate(
    where: {
      market: { _eq: $market }
      isOpen: { _eq: true }
      healthScore: { _gt: "100", _lte: "110" }
    }
  ) { aggregate { count sum { sizeUsd } } }

  score_110_150: Position_aggregate(
    where: {
      market: { _eq: $market }
      isOpen: { _eq: true }
      healthScore: { _gt: "110", _lte: "150" }
    }
  ) { aggregate { count sum { sizeUsd } } }

  score_150_200: Position_aggregate(
    where: {
      market: { _eq: $market }
      isOpen: { _eq: true }
      healthScore: { _gt: "150", _lte: "200" }
    }
  ) { aggregate { count sum { sizeUsd } } }

  score_over_200: Position_aggregate(
    where: { market: { _eq: $market }, isOpen: { _eq: true }, healthScore: { _gt: "200" } }
  ) { aggregate { count sum { sizeUsd } } }
}
```

### 2.4 At-Risk Positions Near Liquidation

Fetch all WARNING + CRITICAL positions for a market (useful for the "danger zone" UI panel).

```graphql
query AtRiskPositions($market: String!) {
  Position(
    where: {
      market: { _eq: $market }
      isOpen: { _eq: true }
      marginHealth: { _in: ["WARNING", "CRITICAL"] }
    }
    order_by: { healthScore: asc }
  ) {
    id
    user
    isLong
    entryPrice
    sizeUsd
    healthScore
    marginHealth
    liquidationPrice
    leverage
  }
}
```

---

## Sorting / Cursor Pagination Pattern

For infinite scroll on the liquidation tape, use cursor-based pagination:

```graphql
query LiquidationTapePage($before: numeric, $limit: Int = 50) {
  PositionUpdate(
    where: {
      eventType: { _eq: "LIQUIDATION" }
      blockTimestamp: { _lt: $before }
    }
    order_by: { blockTimestamp: desc }
    limit: $limit
  ) {
    id
    position_id
    user
    protocol
    executionPrice
    sizeDeltaUsd
    realizedPnlDelta
    blockTimestamp
    txHash
  }
}
```

Pass the `blockTimestamp` of the last item as `$before` for the next page.
