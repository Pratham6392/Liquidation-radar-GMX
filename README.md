# Liquidation Radar

Liquidation Radar is a real-time liquidation intelligence app for GMX markets. It combines an Envio HyperIndex indexer, an Express backend, and a React frontend to surface market summary metrics, liquidation heatmaps, and whale positions at risk.

## What It Does
- Indexes GMX position data with Envio HyperIndex.
- Queries indexed positions from GraphQL.
- Pulls live market prices from the GMX oracle API.
- Aggregates open interest and liquidation zones in the backend.
- Renders a trader-facing dashboard with summary cards, heatmap bars, and whale risk tables.

## Repo Structure
```text
.
├── backend/   # Express + TypeScript API
├── frontend/  # Vite + React dashboard
└── terminal/  # Envio HyperIndex indexer
```

## Architecture
1. `terminal/` indexes GMX data and exposes it through a GraphQL endpoint after deployment.
2. `backend/` reads indexed data from GraphQL, fetches current prices from the GMX oracle, and computes:
   - market summary
   - liquidation heatmap buckets
   - whales at risk
3. `frontend/` calls the backend API and renders the dashboard UI.

## Backend API
Base path: `/api/v1`

Endpoints:
- `GET /health`
- `GET /markets/:marketId/summary?protocol=GMX`
- `GET /markets/:marketId/heatmap?protocol=GMX&bucketSizePct=1`
- `GET /markets/:marketId/whales-at-risk?protocol=GMX&minSizeUsd=5000&limit=20`

Supported markets are driven by the current backend logic and frontend market state, with GMX as the active protocol.

## Tech Stack
- Indexer: Envio HyperIndex
- Backend: Node.js, Express, TypeScript
- Frontend: React, Vite, TypeScript, Recharts
- Data sources:
  - Envio GraphQL endpoint for indexed positions
  - GMX oracle API for live prices

## Local Development

### 1. Indexer
```bash
cd terminal
pnpm install
pnpm codegen
pnpm dev
```

### 2. Backend
Create `backend/.env`:

```env
GRAPHQL_URL=https://<your-indexer-endpoint>/v1/graphql
ORACLE_BASE_URL=https://arbitrum-api.gmxinfra.io
PORT=4000
```

Run:

```bash
cd backend
npm install
npm run dev
```

### 3. Frontend
The frontend currently reads the API base directly from `frontend/src/services/backend.ts`.

Run:

```bash
cd frontend
npm install
npm run dev
```

## Build Commands

Backend:
```bash
cd backend
npm run build
```

Frontend:
```bash
cd frontend
npm run build
```

Indexer:
```bash
cd terminal
pnpm build
```

## Deployment

### Envio Indexer
- Deploy `terminal/` to Envio Hosted Service.
- Use `terminal/config.yaml` as the indexer config.
- After deployment, copy the hosted GraphQL endpoint.

### Backend
- Deploy `backend/` to Vercel.
- Set:
  - `GRAPHQL_URL` to the deployed Envio GraphQL endpoint
  - `ORACLE_BASE_URL=https://arbitrum-api.gmxinfra.io`
- The Express app exposes serverless-friendly routes under `/api/v1`.

### Frontend
- Deploy `frontend/` to Vercel as a Vite app.
- Ensure `frontend/src/services/backend.ts` points to the deployed backend base URL:
  - `https://<your-backend-domain>/api/v1`

## Key Notes
- Backend calculations depend on both correct indexer price fields and current oracle price scaling.
- Heatmap and whale views rely on backend-side validation to avoid invalid liquidation zones.
- The frontend is intentionally thin: market computation lives in the backend, not the UI.

## Scripts Overview

`terminal/`
- `pnpm codegen`
- `pnpm dev`
- `pnpm start`
- `pnpm build`

`backend/`
- `npm run dev`
- `npm run build`
- `npm start`

`frontend/`
- `npm run dev`
- `npm run build`
- `npm run preview`

## Status
Current implementation focuses on GMX liquidation visibility:
- market summary
- liquidation heatmap
- whales at risk

This repo is structured so the same pattern can later expand to more markets, more protocols, alerts, and richer liquidation analytics.
