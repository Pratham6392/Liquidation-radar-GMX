import { app } from "../../src/app";

// Vercel calls this handler for every request under `/api/v1/*`.
// We forward the request into the Express app.
export default function handler(req: any, res: any) {
  // Express expects `next` in its internal handler.
  // `app.handle` will route based on `req.url`.
  app.handle(req, res);
}

