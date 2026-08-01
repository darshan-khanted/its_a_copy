import type { Request, Response, NextFunction } from "express";
import { getFirebaseAdminAuth } from "../config/firebase";

export interface DecodedAuth {
  uid?: string;
  email?: string;
  name?: string;
  [key: string]: any;
}

export interface AuthedRequest extends Request {
  auth?: DecodedAuth;
}

/**
 * Verifies the Firebase ID token on the `Authorization: Bearer <token>` header and
 * returns the decoded token. Authentication depends solely on Firebase Auth token
 * verification — never on the request hostname and never on a magic sandbox token
 * (requirement 23.8, NFR-3.4). Local development points the Admin SDK at the Auth
 * emulator through the explicit `FIREBASE_AUTH_EMULATOR_HOST` variable (23.9).
 */
export async function verifyIdToken(req: Request): Promise<DecodedAuth> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing or invalid authorization token.");
  }
  const idToken = authHeader.split("Bearer ")[1];
  return await getFirebaseAdminAuth().verifyIdToken(idToken);
}

/**
 * Express middleware that enforces a verified Firebase ID token on every mutating
 * route (NFR-3.5). On success the decoded token is attached to `req.auth`.
 */
export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    req.auth = await verifyIdToken(req);
    return next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized. A valid authenticated login session is required.",
    });
  }
}

/**
 * The email authorised to trigger developer/administrative maintenance endpoints.
 */
export const DEVELOPER_EMAIL = "dkdkdkdk00701@gmail.com";

/**
 * Express middleware that restricts a route to the verified developer account. Must
 * run after `requireAuth`. Authorization is by verified identity only — there is no
 * hostname branch anywhere in this decision (NFR-3.4).
 */
export function requireDeveloper(req: AuthedRequest, res: Response, next: NextFunction) {
  const callerEmail = req.auth?.email?.toLowerCase().trim();
  if (callerEmail !== DEVELOPER_EMAIL) {
    return res.status(403).json({
      success: false,
      error: `Forbidden: Only the verified developer (${DEVELOPER_EMAIL}) is authorized to perform this action.`,
    });
  }
  return next();
}
