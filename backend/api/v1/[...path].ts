import { app } from "../../src/app";

// Vercel calls this handler for every request under `/api/v1/*`.
// We forward the request into the Express app.
export default function handler(req: any, res: any) {
  // Express's Application is callable; using it directly avoids relying on
  // `.handle`, which may not exist on the Express type for Express v5.
  const expressApp = app as unknown as (req: any, res: any) => void;
  expressApp(req, res);
}

