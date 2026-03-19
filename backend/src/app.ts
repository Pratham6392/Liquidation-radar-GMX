import express from "express";
import cors from "cors";
import { marketsRouter } from "./routes/markets";

/**
 * Creates the Express app without calling `listen()`.
 *
 * This makes it compatible with both:
 * - local `node dist/index.js` (we call `listen()` in `src/index.ts`)
 * - Vercel serverless (Vercel calls a handler that forwards to this app)
 */
const app = express();

// IMPORTANT: Vercel's Express integration expects a default export.
export default app;

app.use(cors());
app.use(express.json());

app.get("/api/v1/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/v1/markets", marketsRouter);

app.use(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    // Vercel/serverless will capture this output in logs.
    console.error("Unhandled error in backend", err);
    res.status(500).json({ error: "internal_error" });
  },
);

