/**
 * EventHandlers.ts — Unified Cross-Chain Margin Terminal
 *
 * Currently indexes GMX v2 (Arbitrum, chain 42161).
 * Hyperliquid (HL1, chain 999) will be added once the user provides the
 * confirmed Fill / FundingRateUpdate contract address and ABI.
 *
 * GMX v2 uses a generic log-bus model: every protocol event is emitted as
 * EventLog1 / EventLog2 from the EventEmitter contract.  `eventName` in
 * event.params identifies the semantic type; `eventData` carries the payload
 * in a positional 7-tuple of typed key-value arrays (see helpers.ts for
 * the GMXEventData type alias and extractor functions).
 */

import { GMXEventEmitter, BigDecimal } from "generated";
import type { Position, PositionUpdate, FundingRate } from "generated";

import {
  getPositionId,
  getUpdateId,
  getAddressItem,
  getUintItem,
  getIntItem,
  getBoolItem,
  fromGmxUsd,
  fromGmxInt,
  fromGmxTokens,
  calculateLeverage,
  estimateLiquidationPrice,
  calculateMarginHealth,
  resolveGmxMarket,
  ZERO,
  type GMXEventData,
} from "./utils/helpers";

// Prevent "unused import" lint errors for entities used only in Hyperliquid handlers.
// Remove this line when HL handlers are re-enabled.
void (undefined as unknown as FundingRate);

// ── Protocol identifiers ─────────────────────────────────────────────────────
const PROTOCOL_GMX = "GMX";

// ── GMX event name constants (as emitted in EventLog1/EventLog2.eventName) ───
// GMX v2 emits generic position lifecycle events:
// - "PositionIncrease"
// - "PositionDecrease"
// The semantic reason for a decrease (normal close vs liquidation) is encoded
// in the `orderType` uint inside the PositionDecrease event payload, not in
// a separate event name. We decode that below.
const GMX_POSITION_INCREASE = "PositionIncrease";
const GMX_POSITION_DECREASE = "PositionDecrease";

// ─────────────────────────────────────────────────────────────────────────────
// GMX HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * EventLog1 — carries one indexed position key (topic1).
 * Most GMX v2 position lifecycle events arrive via this log type.
 */
GMXEventEmitter.EventLog1.handler(async ({ event, context }) => {
  const { eventName, eventData } = event.params as unknown as {
    eventName: string;
    eventData: GMXEventData;
  };

  if (eventName === GMX_POSITION_INCREASE) {
    await handleGmxPositionIncrease({ event, context, eventData });
  } else if (eventName === GMX_POSITION_DECREASE) {
    await handleGmxPositionDecrease({ event, context, eventData });
  }
  // All other EventLog1 types (orders, swaps, pricing) are intentionally ignored.
});

/**
 * EventLog2 — carries two indexed keys (position key + collateral token key).
 * Some position events are routed here when the protocol needs two topics.
 * Handler logic is identical to EventLog1.
 */
GMXEventEmitter.EventLog2.handler(async ({ event, context }) => {
  const { eventName, eventData } = event.params as unknown as {
    eventName: string;
    eventData: GMXEventData;
  };

  if (eventName === GMX_POSITION_INCREASE) {
    await handleGmxPositionIncrease({ event, context, eventData });
  } else if (eventName === GMX_POSITION_DECREASE) {
    await handleGmxPositionDecrease({ event, context, eventData });
  }
});

// ── GMX sub-handlers ─────────────────────────────────────────────────────────

type GMXHandlerArgs = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  event: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any;
  eventData: GMXEventData;
};

/** Extract tx hash safely from an event. */
function getTxHash(event: GMXHandlerArgs["event"]): string {
  return (event.transaction && typeof event.transaction.hash === "string")
    ? event.transaction.hash
    : "";
}

/** Called for every GMX v2 PositionIncrease event. */
async function handleGmxPositionIncrease({
  event,
  context,
  eventData,
}: GMXHandlerArgs): Promise<void> {

  // ── Extract fields from the GMX EventLogData tuple ────────────────────────
  const user            = getAddressItem(eventData, "account");
  const marketAddr      = getAddressItem(eventData, "market");
  const collateralToken = getAddressItem(eventData, "collateralToken");
  const isLong          = getBoolItem(eventData, "isLong");

  const executionPriceRaw  = getUintItem(eventData, "executionPrice");
  const sizeInUsdRaw       = getUintItem(eventData, "sizeInUsd");
  const sizeInTokensRaw    = getUintItem(eventData, "sizeInTokens");
  const collateralAmountRaw = getUintItem(eventData, "collateralAmount");
  const positionFeeRaw     = getUintItem(eventData, "positionFeeAmount");
  const borrowingFeeRaw    = getUintItem(eventData, "borrowingFeeAmount");
  const fundingFeeRaw      = getUintItem(eventData, "fundingFeeAmount");
  const sizeDeltaUsdRaw    = getUintItem(eventData, "sizeDeltaUsd");

  // ── Convert to human-readable BigDecimal values ───────────────────────────
  const executionPrice  = fromGmxUsd(executionPriceRaw);
  const notionalSizeUsd = fromGmxUsd(sizeInUsdRaw);
  const tokenSize       = fromGmxTokens(sizeInTokensRaw);
  const sizeDeltaUsd    = fromGmxUsd(sizeDeltaUsdRaw);

  // Collateral in USD: GMX stores collateralAmount in USDC (6 decimals) for
  // stablecoin-collateralised positions and in the token's native precision
  // for crypto-collateralised ones. We use 1e6 (USDC) as the default here.
  // TODO: make this dynamic by inspecting collateralToken address.
  const collateralUsd = new BigDecimal(collateralAmountRaw.toString()).div(new BigDecimal("1e6"));

  const accruedFeesUsd = fromGmxUsd(positionFeeRaw + borrowingFeeRaw + fundingFeeRaw);
  const leverage       = calculateLeverage(notionalSizeUsd, collateralUsd);

  const market     = resolveGmxMarket(marketAddr);
  const positionId = getPositionId(PROTOCOL_GMX, user, market, isLong);

  // ── Load or initialise the Position entity ────────────────────────────────
  const existing: Position | undefined = await context.Position.get(positionId);

  let entryPrice: BigDecimal;
  let initialCollateralUsd: BigDecimal;
  let realizedPnlUsd: BigDecimal;
  let cumulativeFeesUsd: BigDecimal;

  if (existing && existing.isOpen) {
    const prevNotional = existing.notionalSizeUsd as BigDecimal;
    const prevEntry    = existing.entryPrice as BigDecimal;
    const totalNotional = prevNotional.plus(sizeDeltaUsd);
    // Weighted average: (prevNotional × prevEntry + delta × execPrice) / totalNotional
    entryPrice = totalNotional.isZero()
      ? executionPrice
      : prevNotional.times(prevEntry)
          .plus(sizeDeltaUsd.times(executionPrice))
          .div(totalNotional);

    initialCollateralUsd = collateralUsd;
    realizedPnlUsd       = (existing.realizedPnlUsd as BigDecimal).plus(ZERO);
    cumulativeFeesUsd    = (existing.accruedFeesUsd as BigDecimal).plus(accruedFeesUsd);
  } else {
    entryPrice           = executionPrice;
    initialCollateralUsd = collateralUsd;
    realizedPnlUsd       = ZERO;
    cumulativeFeesUsd    = accruedFeesUsd;
  }

  const health = calculateMarginHealth(
    isLong,
    executionPrice,
    entryPrice,
    tokenSize,
    initialCollateralUsd,
    cumulativeFeesUsd,
    notionalSizeUsd,
  );

  const liquidationPrice = estimateLiquidationPrice(
    isLong, entryPrice, notionalSizeUsd, initialCollateralUsd,
  );

  const position: Position = {
    id:                   positionId,
    user:                 user.toLowerCase(),
    protocol:             PROTOCOL_GMX,
    market,
    isLong,
    entryPrice,
    sizeUsd:              notionalSizeUsd,
    notionalSizeUsd,
    initialCollateralUsd,
    leverage,
    accruedFeesUsd:       cumulativeFeesUsd,
    unrealizedPnlUsd:     health.unrealizedPnlUsd,
    realizedPnlUsd,
    liquidationPrice,
    healthScore:          health.healthScore,
    marginHealth:         health.marginHealth,
    collateralToken:      collateralToken.toLowerCase(),
    indexToken:           marketAddr.toLowerCase(),
    blockTimestamp:       BigInt(event.block.timestamp),
    lastUpdatedBlock:     BigInt(event.block.number),
    isOpen:               true,
  };

  context.Position.set(position);

  const updateId = getUpdateId(positionId, "INCREASE", event.block.number, event.logIndex);
  const update: PositionUpdate = {
    id:                 updateId,
    position_id:        positionId,
    user:               user.toLowerCase(),
    protocol:           PROTOCOL_GMX,
    eventType:          "INCREASE",
    executionPrice,
    sizeDeltaUsd,
    collateralDeltaUsd: collateralUsd,
    realizedPnlDelta:   ZERO,
    blockNumber:        BigInt(event.block.number),
    blockTimestamp:     BigInt(event.block.timestamp),
    txHash:             getTxHash(event),
  };
  context.PositionUpdate.set(update);
}

/** Called for every GMX v2 PositionDecrease event. */
async function handleGmxPositionDecrease({
  event,
  context,
  eventData,
}: GMXHandlerArgs): Promise<void> {

  const user            = getAddressItem(eventData, "account");
  const marketAddr      = getAddressItem(eventData, "market");
  const collateralToken = getAddressItem(eventData, "collateralToken");
  const isLong          = getBoolItem(eventData, "isLong");

  const executionPriceRaw   = getUintItem(eventData, "executionPrice");
  const sizeInUsdRaw        = getUintItem(eventData, "sizeInUsd");
  const sizeInTokensRaw     = getUintItem(eventData, "sizeInTokens");
  const collateralAmountRaw = getUintItem(eventData, "collateralAmount");
  const sizeDeltaUsdRaw     = getUintItem(eventData, "sizeDeltaUsd");
  const positionFeeRaw      = getUintItem(eventData, "positionFeeAmount");
  const borrowingFeeRaw     = getUintItem(eventData, "borrowingFeeAmount");
  const fundingFeeRaw       = getUintItem(eventData, "fundingFeeAmount");

  // realizedPnl comes from intItems (can be negative)
  const realizedPnlRaw = getIntItem(eventData, "realizedPnlUsd");

  // GMX encodes the semantic reason for the decrease in `orderType`:
  // see Order.sol: enum OrderType { ..., MarketDecrease (4), LimitDecrease (5),
  // StopLossDecrease (6), Liquidation (7), ... }.
  const orderTypeRaw = getUintItem(eventData, "orderType");

  const executionPrice   = fromGmxUsd(executionPriceRaw);
  const notionalSizeUsd  = fromGmxUsd(sizeInUsdRaw);
  const tokenSize        = fromGmxTokens(sizeInTokensRaw);
  const sizeDeltaUsd     = fromGmxUsd(sizeDeltaUsdRaw);
  const realizedPnlDelta = fromGmxInt(realizedPnlRaw);
  const collateralUsd    = new BigDecimal(collateralAmountRaw.toString()).div(new BigDecimal("1e6"));
  const newFeesUsd       = fromGmxUsd(positionFeeRaw + borrowingFeeRaw + fundingFeeRaw);

  const market     = resolveGmxMarket(marketAddr);
  const positionId = getPositionId(PROTOCOL_GMX, user, market, isLong);

  const existing: Position | undefined = await context.Position.get(positionId);

  const priorFees         = (existing?.accruedFeesUsd as BigDecimal | undefined) ?? ZERO;
  const priorPnl          = (existing?.realizedPnlUsd as BigDecimal | undefined) ?? ZERO;
  const entryPrice        = (existing?.entryPrice as BigDecimal | undefined) ?? executionPrice;
  const cumulativeFeesUsd = priorFees.plus(newFeesUsd);
  const totalRealizedPnl  = priorPnl.plus(realizedPnlDelta);

  const isFullClose = notionalSizeUsd.isZero();

  const health = calculateMarginHealth(
    isLong,
    executionPrice,
    entryPrice,
    tokenSize,
    collateralUsd,
    cumulativeFeesUsd,
    notionalSizeUsd,
  );

  const liquidationPrice = isFullClose
    ? ZERO
    : estimateLiquidationPrice(isLong, entryPrice, notionalSizeUsd, collateralUsd);

  // Classify the event:
  // - orderTypeRaw == 7 (Liquidation) → LIQUIDATION event
  // - everything else                   → DECREASE
  const isLiquidationOrder = orderTypeRaw === 7n;
  const eventType: "DECREASE" | "LIQUIDATION" = isLiquidationOrder ? "LIQUIDATION" : "DECREASE";

  // Margin health semantics:
  // - Normal full close       → CLOSED
  // - Liquidation full close  → LIQUIDATED
  // - Partial anything        → live health bucket from calculateMarginHealth
  let marginHealth: string;
  if (isFullClose && isLiquidationOrder) {
    marginHealth = "LIQUIDATED";
  } else if (isFullClose) {
    marginHealth = "CLOSED";
  } else {
    marginHealth = health.marginHealth;
  }

  const position: Position = {
    id:                   positionId,
    user:                 user.toLowerCase(),
    protocol:             PROTOCOL_GMX,
    market,
    isLong,
    entryPrice,
    sizeUsd:              notionalSizeUsd,
    notionalSizeUsd,
    initialCollateralUsd: collateralUsd,
    leverage:             calculateLeverage(notionalSizeUsd, collateralUsd),
    accruedFeesUsd:       cumulativeFeesUsd,
    unrealizedPnlUsd:     health.unrealizedPnlUsd,
    realizedPnlUsd:       totalRealizedPnl,
    liquidationPrice,
    healthScore:          health.healthScore,
    marginHealth,
    collateralToken:      collateralToken.toLowerCase(),
    indexToken:           marketAddr.toLowerCase(),
    blockTimestamp:       BigInt(event.block.timestamp),
    lastUpdatedBlock:     BigInt(event.block.number),
    isOpen:               !isFullClose,
  };

  context.Position.set(position);

  const updateId = getUpdateId(positionId, eventType, event.block.number, event.logIndex);
  const update: PositionUpdate = {
    id:                 updateId,
    position_id:        positionId,
    user:               user.toLowerCase(),
    protocol:           PROTOCOL_GMX,
    eventType,
    executionPrice,
    sizeDeltaUsd,
    collateralDeltaUsd: collateralUsd,
    realizedPnlDelta,
    blockNumber:        BigInt(event.block.number),
    blockTimestamp:     BigInt(event.block.timestamp),
    txHash:             getTxHash(event),
  };
  context.PositionUpdate.set(update);
}

/** Called for every GMX v2 LiquidatePosition (or PositionLiquidated) event. */
async function handleGmxLiquidation({
  event,
  context,
  eventData,
}: GMXHandlerArgs): Promise<void> {

  const user            = getAddressItem(eventData, "account");
  const marketAddr      = getAddressItem(eventData, "market");
  const collateralToken = getAddressItem(eventData, "collateralToken");
  const isLong          = getBoolItem(eventData, "isLong");

  const executionPriceRaw     = getUintItem(eventData, "executionPrice");
  const sizeInUsdRaw          = getUintItem(eventData, "sizeInUsd");
  const collateralAmountRaw   = getUintItem(eventData, "collateralAmount");
  const positionFeeRaw        = getUintItem(eventData, "positionFeeAmount");
  const borrowingFeeRaw       = getUintItem(eventData, "borrowingFeeAmount");
  const fundingFeeRaw         = getUintItem(eventData, "fundingFeeAmount");
  const collateralDeltaUsdRaw = getUintItem(eventData, "collateralDeltaUsd");

  // Realized PnL at liquidation can be an int (negative if position was underwater)
  const finalPnlRaw = getIntItem(eventData, "basePnlUsd");

  const executionPrice    = fromGmxUsd(executionPriceRaw);
  const sizeDeltaUsd      = fromGmxUsd(sizeInUsdRaw);
  const collateralUsd     = new BigDecimal(collateralAmountRaw.toString()).div(new BigDecimal("1e6"));
  const collateralDeltaUsd = fromGmxUsd(collateralDeltaUsdRaw);
  const liquidationFeesUsd = fromGmxUsd(positionFeeRaw + borrowingFeeRaw + fundingFeeRaw);

  // The realized PnL delta at the liquidation event is the final settlement PnL
  // (usually negative — the remaining collateral after fees is the loss)
  const finalRealizedPnlDelta = fromGmxInt(finalPnlRaw);

  const market     = resolveGmxMarket(marketAddr);
  const positionId = getPositionId(PROTOCOL_GMX, user, market, isLong);

  const existing: Position | undefined = await context.Position.get(positionId);
  const entryPrice    = (existing?.entryPrice as BigDecimal | undefined) ?? executionPrice;
  const priorPnl      = (existing?.realizedPnlUsd as BigDecimal | undefined) ?? ZERO;
  const priorFees     = (existing?.accruedFeesUsd as BigDecimal | undefined) ?? ZERO;
  const totalFees     = priorFees.plus(liquidationFeesUsd);
  // Final cumulative realized PnL: all previous realized PnL + final settlement
  const totalRealizedPnl = priorPnl.plus(finalRealizedPnlDelta);

  const position: Position = {
    id:                   positionId,
    user:                 user.toLowerCase(),
    protocol:             PROTOCOL_GMX,
    market,
    isLong,
    entryPrice,
    sizeUsd:              ZERO,
    notionalSizeUsd:      ZERO,
    initialCollateralUsd: ZERO,
    leverage:             ZERO,
    accruedFeesUsd:       totalFees,
    unrealizedPnlUsd:     ZERO,
    realizedPnlUsd:       totalRealizedPnl,
    liquidationPrice:     ZERO,
    healthScore:          ZERO,
    marginHealth:         "LIQUIDATED",
    collateralToken:      collateralToken.toLowerCase(),
    indexToken:           marketAddr.toLowerCase(),
    blockTimestamp:       BigInt(event.block.timestamp),
    lastUpdatedBlock:     BigInt(event.block.number),
    isOpen:               false,
  };

  context.Position.set(position);

  const updateId = getUpdateId(positionId, "LIQUIDATION", event.block.number, event.logIndex);
  const update: PositionUpdate = {
    id:                 updateId,
    position_id:        positionId,
    user:               user.toLowerCase(),
    protocol:           PROTOCOL_GMX,
    eventType:          "LIQUIDATION",
    executionPrice,
    sizeDeltaUsd,
    collateralDeltaUsd: collateralUsd.isZero() ? collateralDeltaUsd : collateralUsd,
    realizedPnlDelta:   finalRealizedPnlDelta,
    blockNumber:        BigInt(event.block.number),
    blockTimestamp:     BigInt(event.block.timestamp),
    txHash:             getTxHash(event),
  };
  context.PositionUpdate.set(update);
}
