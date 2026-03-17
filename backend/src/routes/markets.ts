import { Router } from "express";
import { marketSummaryController } from "../controllers/marketSummaryController";
import { marketHeatmapController } from "../controllers/marketHeatmapController";
import { whalesAtRiskController } from "../controllers/whalesAtRiskController";

export const marketsRouter = Router();

marketsRouter.get("/:marketId/summary", marketSummaryController);

marketsRouter.get("/:marketId/heatmap", marketHeatmapController);

marketsRouter.get("/:marketId/whales-at-risk", whalesAtRiskController);



