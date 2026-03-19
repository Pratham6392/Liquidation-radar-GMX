import { app } from "../src/app";

// These exports are commonly required for Vercel to treat dynamic routes as
// server-rendered Node handlers (avoids various 404 routing/prerender quirks).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Vercel catch-all handler for every request under `/api/*`.
// We forward the request into the Express app, which defines `/api/v1/*` routes.
export default function handler(req: any, res: any) {
  const expressApp = app as unknown as (req: any, res: any) => void;
  expressApp(req, res);
}

