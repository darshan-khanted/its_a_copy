import express from "express";
import { checkConcludedGigs } from "../services/gigMonitor";

const router = express.Router();

/**
 * Resolves the configured cron secret. Authorization is by a shared machine secret
 * (`CRON_SECRET`), never by request hostname (NFR-3.4). In non-production a
 * development default is used so scheduled maintenance can be exercised locally.
 */
function resolveCronSecret(): string | undefined {
  return process.env.CRON_SECRET || (process.env.NODE_ENV !== "production" ? "dev-secret" : undefined);
}

function extractClientSecret(req: express.Request): string | undefined {
  return (
    (req.query.secret as string) ||
    (req.headers["x-cron-secret"] as string) ||
    (req.headers["authorization"] as string)?.replace("Bearer ", "")
  );
}

async function handleCronCheck(req: express.Request, res: express.Response, source: string) {
  try {
    const systemSecret = resolveCronSecret();

    if (!systemSecret) {
      return res.status(401).json({
        success: false,
        error: "CRON_SECRET is not configured in environment variables. Please add CRON_SECRET to your Settings secrets.",
        instructions:
          "Define CRON_SECRET in your Secrets with a secure random string, then trigger this URL with '?secret=<your-key>' or using the 'Authorization: Bearer <your-key>' header.",
      });
    }

    const clientSecret = extractClientSecret(req);

    if (clientSecret !== systemSecret) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Invalid or missing secret token.",
      });
    }

    console.log(`[Cron] Secure external cron trigger received via ${source}. Running checkConcludedGigs...`);
    const report = await checkConcludedGigs();
    return res.json({
      success: true,
      source,
      timestamp: new Date().toISOString(),
      report,
    });
  } catch (err: any) {
    console.error("[Cron] Secure external cron execution failed:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

router.get("/check-gigs", (req, res) => handleCronCheck(req, res, "external-trigger-get"));
router.post("/check-gigs", (req, res) => handleCronCheck(req, res, "external-trigger-post"));

export default router;
