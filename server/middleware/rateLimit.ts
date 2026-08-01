import type { Request, Response, NextFunction } from "express";

interface RateLimitRecord {
  timestamps: number[];
}

const ipLimits = new Map<string, RateLimitRecord>();
const emailLimits = new Map<string, RateLimitRecord>();

const WINDOW_MS = 15 * 60 * 1000; // 15 minute window
const MAX_ATTEMPTS_PER_IP = 10; // Max 10 attempts per IP per 15 mins
const MAX_ATTEMPTS_PER_EMAIL = 5; // Max 5 attempts per email per 15 mins

function cleanRecords(record: RateLimitRecord, now: number) {
  record.timestamps = record.timestamps.filter((ts) => now - ts < WINDOW_MS);
}

/**
 * Per-IP and per-email rate limiter for authentication endpoints. It is applied
 * unconditionally: there is no hostname/sandbox bypass, so no request can escape the
 * limit by presenting a particular `Host` header (requirement 23.8, NFR-3.4/3.5).
 */
export const authRateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const ip =
    (Array.isArray(req.headers["x-forwarded-for"])
      ? req.headers["x-forwarded-for"][0]
      : req.headers["x-forwarded-for"]) ||
    req.ip ||
    req.socket?.remoteAddress ||
    "unknown";
  const email = req.body?.email?.toLowerCase().trim();
  const now = Date.now();

  if (ip && ip !== "unknown") {
    let ipRecord = ipLimits.get(ip);
    if (!ipRecord) {
      ipRecord = { timestamps: [] };
      ipLimits.set(ip, ipRecord);
    }
    cleanRecords(ipRecord, now);

    if (ipRecord.timestamps.length >= MAX_ATTEMPTS_PER_IP) {
      return res.status(429).json({
        success: false,
        error: "Too many authentication requests from this IP. Please try again after 15 minutes.",
      });
    }
    ipRecord.timestamps.push(now);
  }

  if (email) {
    let emailRecord = emailLimits.get(email);
    if (!emailRecord) {
      emailRecord = { timestamps: [] };
      emailLimits.set(email, emailRecord);
    }
    cleanRecords(emailRecord, now);

    if (emailRecord.timestamps.length >= MAX_ATTEMPTS_PER_EMAIL) {
      return res.status(429).json({
        success: false,
        error: "Too many login/reset attempts for this account. Please try again after 15 minutes.",
      });
    }
    emailRecord.timestamps.push(now);
  }

  return next();
};

/**
 * Per-IP rate limiter for authenticated email-notification triggers (server-side
 * write rate limit per NFR-3.5).
 */
export const emailNotificationRateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const ip =
    (Array.isArray(req.headers["x-forwarded-for"])
      ? req.headers["x-forwarded-for"][0]
      : req.headers["x-forwarded-for"]) ||
    req.ip ||
    "unknown";
  const now = Date.now();

  let ipRecord = ipLimits.get(ip);
  if (!ipRecord) {
    ipRecord = { timestamps: [] };
    ipLimits.set(ip, ipRecord);
  }
  cleanRecords(ipRecord, now);

  if (ipRecord.timestamps.length >= 20) {
    return res.status(429).json({
      success: false,
      error: "Rate limit exceeded. Please wait a few minutes before triggering more email notifications.",
    });
  }
  ipRecord.timestamps.push(now);
  return next();
};
