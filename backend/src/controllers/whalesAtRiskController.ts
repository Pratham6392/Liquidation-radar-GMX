import type { Request, Response, NextFunction } from "express";
import { graphqlQuery } from "../lib/graphqlClient";
import { getCurrentPriceUsd } from "../lib/oracleClient";

interface PositionRow {
  id: string;
  user: string;
  isLong: boolean;
  isOpen: boolean;
  sizeUsd: string;
  initialCollateralUsd: string | null;
  liquidationPrice: string;
}

interface WhalesQueryResponse {
  Position: PositionRow[];
}

const WHALES_QUERY = `
  query WhalesAtRiskPositions($market: String!, $protocol: String!, $minSizeUsd: numeric!) {
    Position(
      where: {
        market: { _eq: $market }
        protocol: { _eq: $protocol }
        isOpen: { _eq: true }
        sizeUsd: { _gte: $minSizeUsd }
      }
    ) {
      id
      user
      isLong
      isOpen
      sizeUsd
      initialCollateralUsd
      liquidationPrice
    }
  }
`;

function distanceToLiqPct(
  isLong: boolean,
  liq: number,
  spot: number,
): number {
  if (!spot || !Number.isFinite(spot) || !Number.isFinite(liq) || liq <= 0) {
    return Infinity;
  }

  if (isLong) {
    // Long: liquidated when price DROPS to liq
    return ((spot - liq) / spot) * 100;
  }

  // Short: liquidated when price RISES to liq
  return ((liq - spot) / spot) * 100;
}

export async function whalesAtRiskController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const marketId = String(req.params.marketId);
    const protocol = String(req.query.protocol ?? "GMX");
    const minSizeUsd = Number(req.query.minSizeUsd ?? "5000");
    const limit = Number(req.query.limit ?? "20");

    const symbol =
      marketId === "ETH-USD"
        ? "ETH"
        : marketId === "BTC-USD"
        ? "BTC"
        : marketId === "SOL-USD"
        ? "SOL"
        : "ETH";

    const [graphqlData, currentPrice] = await Promise.all([
      graphqlQuery<WhalesQueryResponse>(WHALES_QUERY, {
        market: marketId,
        protocol,
        minSizeUsd,
      }),
      getCurrentPriceUsd(symbol),
    ]);

    const whales = graphqlData.Position.map((p) => {
      const sizeUsd = Number(p.sizeUsd);
      const liq = Number(p.liquidationPrice);
      const dist = distanceToLiqPct(p.isLong, liq, currentPrice);
      const collateral = p.initialCollateralUsd
        ? Number(p.initialCollateralUsd)
        : 0;
      const leverage =
        collateral > 0 ? sizeUsd / collateral : undefined;

      return {
        id: p.id,
        user: p.user,
        isLong: p.isLong,
        sizeUsd,
        initialCollateralUsd: collateral,
        liquidationPrice: liq,
        leverage,
        distanceToLiqPct: dist,
      };
    })
      .filter(
        (p) =>
          Number.isFinite(p.distanceToLiqPct) && p.distanceToLiqPct > 0,
      )
      .sort((a, b) => {
        const distDiff = a.distanceToLiqPct - b.distanceToLiqPct;
        if (Math.abs(distDiff) > 1e-6) return distDiff;
        return b.sizeUsd - a.sizeUsd;
      })
      .slice(0, limit);

    res.json({
      marketId,
      protocol,
      currentPrice,
      minSizeUsd,
      limit,
      whales,
    });
  } catch (err) {
    next(err);
  }
}

