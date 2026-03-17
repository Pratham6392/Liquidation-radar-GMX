import type { Request, Response, NextFunction } from "express";
import { graphqlQuery } from "../lib/graphqlClient";
import { getCurrentPriceUsd } from "../lib/oracleClient";

interface PositionRow {
  isLong: boolean;
  sizeUsd: string;
}

interface MarketSummaryResponse {
  Position: PositionRow[];
}

const MARKET_SUMMARY_QUERY = `
  query MarketSummaryPositions($market: String!, $protocol: String!) {
    Position(
      where: {
        market: { _eq: $market }
        protocol: { _eq: $protocol }
        isOpen: { _eq: true }
      }
    ) {
      isLong
      sizeUsd
    }
  }
`;

export async function marketSummaryController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const marketId = String(req.params.marketId);
    const protocol = String(req.query.protocol ?? "GMX");

    const symbol =
      marketId === "ETH-USD"
        ? "ETH"
        : marketId === "BTC-USD"
        ? "BTC"
        : marketId === "SOL-USD"
        ? "SOL"
        : "ETH";

    const [graphqlData, currentPrice] = await Promise.all([
      graphqlQuery<MarketSummaryResponse>(MARKET_SUMMARY_QUERY, {
        market: marketId,
        protocol,
      }),
      getCurrentPriceUsd(symbol),
    ]);

    let totalSize = 0;
    let longSize = 0;
    let shortSize = 0;

    for (const row of graphqlData.Position) {
      const size = Number(row.sizeUsd);
      if (!Number.isFinite(size) || size <= 0) continue;

      totalSize += size;
      if (row.isLong) longSize += size;
      else shortSize += size;
    }

    const count = graphqlData.Position.length;

    res.json({
      marketId,
      protocol,
      currentPrice,
      totalOpenInterestUsd: totalSize,
      longOpenInterestUsd: longSize,
      shortOpenInterestUsd: shortSize,
      positionCount: count,
    });
  } catch (err) {
    next(err);
  }
}

