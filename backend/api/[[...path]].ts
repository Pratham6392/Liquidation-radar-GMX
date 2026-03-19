import { app } from "../src/app";

// Vercel catch-all handler for every request under `/api/*`.
// We forward the request into the Express app, which defines `/api/v1/*` routes.
export default function handler(req: any, res: any) {
  const expressApp = app as unknown as (req: any, res: any) => void;
  expressApp(req, res);
}

