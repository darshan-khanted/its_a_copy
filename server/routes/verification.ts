import express from "express";
import { requireAuth, requireDeveloper, type AuthedRequest } from "../middleware/auth";
import { approveVerification, rejectVerification, submitVerification } from "../services/verification";

const router = express.Router();

/**
 * Submit identity-verification document material. Mutating route → requires a verified
 * Firebase ID token (NFR-3.5). The doer submitting is always the caller — there is no `uid`
 * body field to spoof someone else's verification (requirement 21.9, §K.1).
 */
router.post("/submit", requireAuth, async (req: AuthedRequest, res) => {
  const uid = req.auth?.uid;
  if (!uid) {
    return res.status(401).json({ success: false, code: "UNAUTHENTICATED", error: "sign in first" });
  }

  const documentUrls = Array.isArray(req.body?.documentUrls)
    ? req.body.documentUrls.filter((u: unknown) => typeof u === "string")
    : [];
  const documentType = String(req.body?.documentType || "aadhar");

  if (documentUrls.length === 0) {
    return res.status(400).json({ success: false, code: "DOCUMENT_REQUIRED", error: "attach a document first" });
  }

  try {
    const result = await submitVerification(uid, documentUrls, documentType);
    return res.json({ success: true, verification: result });
  } catch (err: any) {
    console.error(`[Verification] submit failed for ${uid}:`, err?.message || err);
    return res.status(500).json({ success: false, code: "VERIFICATION_SUBMIT_FAILED", error: err?.message || "submit failed" });
  }
});

/**
 * Admin-gated approval. Sets ONLY `verification.status = 'approved'` and appends the
 * unprocessed `VERIFICATION_APPROVED` fact for task 7.2's rep ledger to consume into the
 * one-time +60 grant — this route never mutates `rep` itself (append-only ledger invariant,
 * requirement 15.1, 15.3).
 */
router.post("/:uid/approve", requireAuth, requireDeveloper, async (req: AuthedRequest, res) => {
  const uid = String(req.params.uid || "").trim();
  if (!uid) {
    return res.status(400).json({ success: false, code: "UID_REQUIRED", error: "uid required" });
  }
  try {
    const result = await approveVerification(uid);
    return res.json({ success: true, verification: result });
  } catch (err: any) {
    console.error(`[Verification] approve failed for ${uid}:`, err?.message || err);
    return res.status(500).json({ success: false, code: "VERIFICATION_APPROVE_FAILED", error: err?.message || "approve failed" });
  }
});

/**
 * Admin-gated rejection. Sets ONLY `verification.status = 'rejected'`; the doer keeps full
 * browse/navigation access and a clear retry path (design §E.1).
 */
router.post("/:uid/reject", requireAuth, requireDeveloper, async (req: AuthedRequest, res) => {
  const uid = String(req.params.uid || "").trim();
  if (!uid) {
    return res.status(400).json({ success: false, code: "UID_REQUIRED", error: "uid required" });
  }
  try {
    const result = await rejectVerification(uid);
    return res.json({ success: true, verification: result });
  } catch (err: any) {
    console.error(`[Verification] reject failed for ${uid}:`, err?.message || err);
    return res.status(500).json({ success: false, code: "VERIFICATION_REJECT_FAILED", error: err?.message || "reject failed" });
  }
});

export default router;
