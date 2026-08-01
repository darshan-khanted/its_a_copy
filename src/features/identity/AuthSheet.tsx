// Single-step auth sheet (design §E.1, requirements 23.2, 23.3). Uses Firebase Auth directly —
// Google sign-in via GoogleAuthProvider popup, replacing the removed @react-oauth/google
// dependency (design §K.8, task 1.2).
//
// The sheet is the resume point for a preserved gated action: it shows the intent-specific
// prompt ("you need a name on the board…"), and on successful authentication it consumes the
// pending intent and returns to `returnTo` so the original action continues through its
// remaining eligibility gates (the recheck + atomic submit for a claim lands in Phase 2,
// task 5.2). With no pending intent it simply closes back to the underlying screen. It never
// gates navigation (req 23.7).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerWithEmail, signInWithEmail, signInWithGoogle } from '@/lib/firebase';
import { useToast } from '@/app/providers/ToastProvider';
import { ModalRoute } from '@/components/layout/ModalRoute';
import { useModalNavigate } from '@/hooks/useModalNavigate';
import { useIntentStore } from '@/features/identity/lib/intent';
import { errors } from '@/copy/errors';
import { authGate } from '@/copy/empty';

export function AuthSheet() {
  const navigate = useNavigate();
  const { closeModal } = useModalNavigate();
  const { pushToast } = useToast();
  const pending = useIntentStore((s) => s.pending);
  const consumeIntent = useIntentStore((s) => s.consumeIntent);

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const prompt = pending ? authGate[pending.kind] : null;

  // Resume the preserved action: return to where it was triggered so it can continue through
  // its remaining eligibility gates. Falls back to closing the modal when there is no intent.
  function resume() {
    const intent = consumeIntent();
    if (intent) navigate(intent.returnTo, { replace: true });
    else closeModal();
  }

  async function handleGoogle() {
    setBusy(true);
    try {
      await signInWithGoogle();
      resume();
    } catch {
      pushToast('warn', errors.genericRetry);
    } finally {
      setBusy(false);
    }
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes('@')) {
      pushToast('warn', errors.emailBad);
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signup') {
        await registerWithEmail(email.trim(), password);
      } else {
        await signInWithEmail(email.trim(), password);
      }
      resume();
    } catch {
      pushToast('warn', errors.genericRetry);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalRoute label="sign in">
      <form onSubmit={handleEmail} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ textTransform: 'lowercase' }}>
          {mode === 'signup' ? 'join the hood' : 'welcome back'}
        </h2>
        {/* Intent-specific reason the account is needed (design §E.1). */}
        {prompt && <p>{prompt}</p>}
        <button type="button" onClick={handleGoogle} disabled={busy}>
          continue with google
        </button>
        <input
          type="email"
          placeholder="you@email"
          value={email}
          autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="password"
          value={password}
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit" disabled={busy}>
          {mode === 'signup' ? 'create account' : 'sign in'}
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
        >
          {mode === 'signup' ? 'have an account? sign in' : 'new here? make an account'}
        </button>
      </form>
    </ModalRoute>
  );
}
