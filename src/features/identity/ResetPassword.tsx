// Password reset /reset-password (design §F.2, kept). Confirms token via the server API.
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { useToast } from '@/app/providers/ToastProvider';
import { errors } from '@/copy/errors';

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { pushToast } = useToast();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/api/auth/confirm-password-reset', {
        method: 'POST',
        auth: false,
        body: { token, password },
      });
      pushToast('win', 'password updated. sign in with the new one.');
    } catch {
      pushToast('warn', errors.genericRetry);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ padding: 16 }}>
      <h1 style={{ textTransform: 'lowercase' }}>reset password</h1>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          type="password"
          placeholder="new password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        <button type="submit" disabled={busy || !token}>
          update
        </button>
      </form>
    </section>
  );
}
