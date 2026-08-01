/**
 * Client claim-submission hook. Calls POST /api/claims with the auth token and
 * returns the created (or existing) handshake and threadId.
 *
 * This is the thin wiring layer between the claim ritual UI (task 5.6) and the
 * server-authoritative atomic claim endpoint (task 5.5). It handles:
 * - Attaching the Firebase ID token
 * - Generating the idempotency key (UUID per attempt)
 * - Surfacing structured error responses
 *
 * Requirements: 11.6 (atomic), 11.7 (idempotent retries return existing).
 */
import { useCallback, useState } from 'react';
import { useSession } from '@/app/providers/SessionProvider';
import type { Handshake } from '@/types/handshake';

export interface SubmitClaimInput {
  gigId: string;
  oneLiner: string;
  offerPrice: number;
  availability: string;
}

export interface SubmitClaimResult {
  success: boolean;
  handshake?: Handshake;
  threadId?: string;
  existing?: boolean;
  code?: string;
  error?: string;
}

export interface UseSubmitClaimReturn {
  submitClaim: (input: SubmitClaimInput) => Promise<SubmitClaimResult>;
  submitting: boolean;
  lastError: string | null;
}

export function useSubmitClaim(): UseSubmitClaimReturn {
  const { firebaseUser } = useSession();
  const [submitting, setSubmitting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const submitClaim = useCallback(
    async (input: SubmitClaimInput): Promise<SubmitClaimResult> => {
      if (!firebaseUser) {
        const result: SubmitClaimResult = { success: false, code: 'UNAUTHENTICATED', error: 'sign in first' };
        setLastError(result.error!);
        return result;
      }

      setSubmitting(true);
      setLastError(null);

      try {
        const token = await firebaseUser.getIdToken();
        const idempotencyKey = crypto.randomUUID();

        const response = await fetch('/api/claims', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            gigId: input.gigId,
            oneLiner: input.oneLiner,
            offerPrice: input.offerPrice,
            availability: input.availability,
            idempotencyKey,
          }),
        });

        const data: SubmitClaimResult = await response.json();

        if (!data.success) {
          setLastError(data.error ?? 'claim failed');
        }

        return data;
      } catch (err: any) {
        const result: SubmitClaimResult = {
          success: false,
          code: 'NETWORK_ERROR',
          error: err?.message ?? 'network error — check your connection',
        };
        setLastError(result.error!);
        return result;
      } finally {
        setSubmitting(false);
      }
    },
    [firebaseUser],
  );

  return { submitClaim, submitting, lastError };
}
