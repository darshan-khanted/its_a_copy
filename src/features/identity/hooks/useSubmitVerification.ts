// Client submission for identity verification (design §E.1, requirement 21.9). Uploads the
// document via the existing storage helper, then calls the server-authoritative
// `POST /api/verification/submit`, which stores the material under the private KYC subdocument
// and flips `verification.status` to `pending`. The server is the sole writer of
// `verification` (requirement 15.2) — this hook only ever reports the server's result back.
import { useCallback, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { uploadFileWithFallback } from '@/lib/firebase';
import { useSession } from '@/app/providers/SessionProvider';

export type SubmitVerificationStatus = 'idle' | 'uploading' | 'submitting' | 'done' | 'error';

interface SubmitResponse {
  success: boolean;
  verification: { status: 'pending' | 'approved'; submittedAt: number };
}

export interface UseSubmitVerificationResult {
  status: SubmitVerificationStatus;
  error: string | null;
  submit: (documentDataUrl: string, documentType?: string) => Promise<boolean>;
}

export function useSubmitVerification(): UseSubmitVerificationResult {
  const { firebaseUser } = useSession();
  const [status, setStatus] = useState<SubmitVerificationStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (documentDataUrl: string, documentType = 'aadhar'): Promise<boolean> => {
      if (!firebaseUser) {
        setStatus('error');
        setError('sign in first');
        return false;
      }
      setError(null);
      try {
        setStatus('uploading');
        const url = await uploadFileWithFallback(documentDataUrl, 'aadhar', firebaseUser.uid);

        setStatus('submitting');
        await api<SubmitResponse>('/api/verification/submit', {
          method: 'POST',
          body: { documentUrls: [url], documentType },
        });

        setStatus('done');
        return true;
      } catch (err) {
        setStatus('error');
        setError(err instanceof ApiError ? err.message : 'that did not go through — tap to try again');
        return false;
      }
    },
    [firebaseUser],
  );

  return { status, error, submit };
}
