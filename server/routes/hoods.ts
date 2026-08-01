import express from "express";
import { requireAuth, requireDeveloper, type AuthedRequest } from "../middleware/auth";
import {
  createManualHood,
  isValidPincode,
  recomputeHoodStats,
  resolveHood,
  setHoodStatus,
  type HoodStatus,
} from "../services/hood";

const router = express.Router();

/**
 * Resolve + cache a hood by pincode. Public and unauthenticated: a visitor claims a
 * hood and browses the Field/Board before ever creating an account (requirement
 * 23.1, design §E.1). Wraps the postal API with server-side cleanup and the static
 * fallback table (design §C.7).
 */
router.get("/:pincode", async (req, res) => {
  const pincode = String(req.params.pincode || "").trim();
  if (!isValidPincode(pincode)) {
    return res.status(400).json({ success: false, code: "PINCODE_INVALID", error: "6 digits. the one on your courier packages" });
  }

  try {
    const result = await resolveHood(pincode);
    if (!result.found) {
      // Neither the API nor the fallback table resolved it — offer manual entry.
      return res.status(404).json({
        success: false,
        code: "HOOD_NOT_FOUND",
        needsManualArea: Boolean(result.needsManualArea),
        error: "NOT FOUND — YOU CAN STILL TYPE YOUR AREA",
      });
    }
    return res.json({ success: true, hood: result.hood });
  } catch (err: any) {
    console.error(`[Hood] resolve failed for ${pincode}:`, err?.message || err);
    return res.status(500).json({ success: false, code: "HOOD_RESOLVE_FAILED", error: err?.message || "resolution failed" });
  }
});

/**
 * Persist a manually entered area name for a pincode the API/fallback could not
 * resolve (design §C.7, requirement 8.5).
 */
router.post("/:pincode/manual", async (req, res) => {
  const pincode = String(req.params.pincode || "").trim();
  const area = String(req.body?.area || "").trim();
  if (!isValidPincode(pincode)) {
    return res.status(400).json({ success: false, code: "PINCODE_INVALID", error: "6 digits. the one on your courier packages" });
  }
  if (area.length < 2) {
    return res.status(400).json({ success: false, code: "AREA_REQUIRED", error: "type your area name" });
  }

  try {
    const result = await createManualHood(pincode, area);
    return res.json({ success: true, hood: result.hood });
  } catch (err: any) {
    console.error(`[Hood] manual create failed for ${pincode}:`, err?.message || err);
    return res.status(500).json({ success: false, code: "HOOD_MANUAL_FAILED", error: err?.message || "manual create failed" });
  }
});

/**
 * Recompute a hood's statistics (price guidance, hour histogram, counts). Gated to
 * the developer identity; the scheduled equivalent runs from cron (task 11.x).
 */
router.post("/:pincode/stats", requireAuth, requireDeveloper, async (req: AuthedRequest, res) => {
  const pincode = String(req.params.pincode || "").trim();
  if (!isValidPincode(pincode)) {
    return res.status(400).json({ success: false, code: "PINCODE_INVALID", error: "invalid pincode" });
  }
  try {
    const hood = await recomputeHoodStats(pincode);
    if (!hood) return res.status(404).json({ success: false, code: "HOOD_NOT_FOUND", error: "hood not found" });
    return res.json({ success: true, hood });
  } catch (err: any) {
    console.error(`[Hood] stats recompute failed for ${pincode}:`, err?.message || err);
    return res.status(500).json({ success: false, code: "HOOD_STATS_FAILED", error: err?.message || "stats failed" });
  }
});

/**
 * Flip the pincode-by-pincode launch switch (design §C.7). Developer-gated; the
 * per-hood launch notification fan-out to the waitlist lands with task 11.11.
 */
router.post("/:pincode/status", requireAuth, requireDeveloper, async (req: AuthedRequest, res) => {
  const pincode = String(req.params.pincode || "").trim();
  const status = String(req.body?.status || "") as HoodStatus;
  if (!isValidPincode(pincode)) {
    return res.status(400).json({ success: false, code: "PINCODE_INVALID", error: "invalid pincode" });
  }
  if (status !== "waitlist" && status !== "live" && status !== "paused") {
    return res.status(400).json({ success: false, code: "STATUS_INVALID", error: "status must be waitlist | live | paused" });
  }
  try {
    await setHoodStatus(pincode, status);
    return res.json({ success: true });
  } catch (err: any) {
    console.error(`[Hood] status update failed for ${pincode}:`, err?.message || err);
    return res.status(500).json({ success: false, code: "HOOD_STATUS_FAILED", error: err?.message || "status update failed" });
  }
});

export default router;
