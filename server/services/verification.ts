// Server-authoritative identity verification (design §E.1, §K.1; requirements 11.11, 11.12,
// 17.12, 21.9, 23.4, 23.5).
//
// Two responsibilities, both server-only (clients cannot write any of these paths — see
// `firestore.rules`, `users/{uid}.verification` and `users/{uid}/private/kyc`):
//   - `submitVerification` stores the doer's identity-document material under the private KYC
//     subdocument (never on the public user doc) and flips `verification.status` to `pending`.
//   - `approveVerification` / `rejectVerification` are the admin-gated decision. Approval sets
//     ONLY `verification.status = 'approved'` and appends an unprocessed fact to
//     `verificationEvents` for task 7.2's rep ledger to later consume into the one-time
//     `IDENTITY_VERIFIED +60` grant (design §D.3). It deliberately does NOT touch `rep` —
//     the append-only ledger invariant (req 15.1, 15.2) means only the Rep Engine (task 7.2)
//     may ever apply a rep delta.
import { getFirebaseAdminDb } from "../config/firebase";

export type VerificationStatus = "none" | "pending" | "approved" | "rejected";

export interface KycSubmission {
  /** URL(s) of the uploaded identity document(s), typically from `/api/upload` (type=aadhar). */
  documentUrls: string[];
  documentType: string;
  submittedAt: number;
}

export interface SubmitVerificationResult {
  status: VerificationStatus;
  submittedAt: number;
}

/**
 * Persist the submitted document material under `users/{uid}/private/kyc` (client reads and
 * writes denied — req 21.9) and set `verification.status = 'pending'` on the public user doc
 * (client writes to `verification` denied — req 15.2). Idempotent: resubmitting while already
 * `pending` or `approved` simply overwrites the stored material and (re)stamps `pending`,
 * except once already `approved` — an approved verification is not reopened by a resubmission.
 */
export async function submitVerification(
  uid: string,
  documentUrls: string[],
  documentType: string,
): Promise<SubmitVerificationResult> {
  const db = getFirebaseAdminDb();
  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new Error("USER_NOT_FOUND");
  }

  const currentStatus: VerificationStatus = userSnap.data()?.verification?.status ?? "none";
  if (currentStatus === "approved") {
    // Already verified — nothing to resubmit (verification is a one-time approval, req 17.12).
    return { status: "approved", submittedAt: userSnap.data()?.verification?.submittedAt ?? Date.now() };
  }

  const submittedAt = Date.now();
  const kyc: KycSubmission = { documentUrls, documentType, submittedAt };

  await userRef.collection("private").doc("kyc").set(kyc, { merge: true });
  await userRef.set(
    { verification: { status: "pending", submittedAt } },
    { merge: true },
  );

  return { status: "pending", submittedAt };
}

export interface VerificationEvent {
  uid: string;
  type: "VERIFICATION_APPROVED" | "VERIFICATION_REJECTED";
  createdAt: number;
}

/**
 * Approve a pending verification. Sets `verification.status = 'approved'` and the `verified`
 * approval flag itself (the identity-prerequisite gate the Claim Flow and rank-02 evaluation
 * read — design §D.5, §E.1, req 11.11, 17.12), then appends one unprocessed
 * `VERIFICATION_APPROVED` fact to `verificationEvents` for the Rep Engine (task 7.2) to
 * consume into the one-time +60 grant (design §D.3). Deliberately does NOT mutate `rep`,
 * `repVersion`, or any other ledger-derived field — that boundary belongs entirely to the
 * Rep Engine's append-only ledger (req 15.1, 15.3). Approval alone never changes rank; a
 * rank-01 user stays rank 01 until the independently required rep threshold is met (req 17.12).
 */
export async function approveVerification(uid: string): Promise<{ status: VerificationStatus }> {
  const db = getFirebaseAdminDb();
  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new Error("USER_NOT_FOUND");
  }

  await userRef.set(
    { verified: true, verification: { status: "approved", reviewedAt: Date.now() } },
    { merge: true },
  );

  const event: VerificationEvent = { uid, type: "VERIFICATION_APPROVED", createdAt: Date.now() };
  await db.collection("verificationEvents").doc().set(event);

  return { status: "approved" };
}

/**
 * Reject a pending verification. Sets ONLY `verification.status = 'rejected'`; the doer keeps
 * full browse/navigation access and can resubmit (design §E.1 — rejection "leaves
 * browse/navigation available with a clear retry path").
 */
export async function rejectVerification(uid: string): Promise<{ status: VerificationStatus }> {
  const db = getFirebaseAdminDb();
  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new Error("USER_NOT_FOUND");
  }

  await userRef.set(
    { verification: { status: "rejected", reviewedAt: Date.now() } },
    { merge: true },
  );

  const event: VerificationEvent = { uid, type: "VERIFICATION_REJECTED", createdAt: Date.now() };
  await db.collection("verificationEvents").doc().set(event);

  return { status: "rejected" };
}
