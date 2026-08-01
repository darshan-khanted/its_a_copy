/**
 * Hook to call POST /api/handshakes/:id/transition with the current user's
 * auth token. Returns a submit function, loading state, and last error.
 */
import { useCallback, useState } from 'react';
import { useSession } from '@/app/providers/SessionProvider';
import type { Handshake } from '@/types/handshake';
import type { HandshakeActionType } from '@/features/handshake/lib/reducer';

export interface TransitionInput {
  handshakeId: string;
  action: HandshakeActionType;
  seq?: number;
  offer?: { price: number; date: string; startTime: string; endTime?: string; note?: string };
  reason?: string;
  method?: 'upi' | 'cash';
}

export interface TransitionResult {
  success: boolean;
  handshake?: Handshake;
  code?: string;
  error?: string;
}

export interface UseTransitionReturn {
  transition: (input: TransitionInput) => Promise<TransitionResult>;
  submitting: boolean;
  lastError: string | null;
}

export function useTransition(): UseTransitionReturn {
  const { firebaseUser } = useSession();
  const [submitting, setSubmitting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const transition = useCallback(
    async (input: TransitionInput): Promise<TransitionResult> => {
      if (!firebaseUser) {
        const result: TransitionResult = { success: false, code: 'UNAUTHENTICATED', error: 'sign in first' };
        setLastError(result.error!);
        return result;
      }

      setSubmitting(true);
      setLastError(null);

      try {
        const token = await firebaseUser.getIdToken();

        const body: Record<string, unknown> = { action: input.action };
        if (input.seq !== undefined) body.seq = input.seq;
        if (input.offer) body.offer = input.offer;
        if (input.reason) body.reason = input.reason;
        if (input.method) body.method = input.method;

        const response = await fetch(`/api/handshakes/${input.handshakeId}/transition`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });

        const data: TransitionResult = await response.json();

        if (!data.success) {
          setLastError(data.error ?? 'transition failed');
        }

        return data;
      } catch (err: any) {
        const result: TransitionResult = {
          success: false,
          code: 'NETWORK_ERROR',
          error: err?.message ?? 'network error',
        };
        setLastError(result.error!);
        return result;
      } finally {
        setSubmitting(false);
      }
    },
    [firebaseUser],
  );

  return { transition, submitting, lastError };
}
