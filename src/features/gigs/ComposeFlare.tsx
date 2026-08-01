// Compose a flare /flare (design §E.2, §F.2). The three-beat composer, price guidance,
// authoritative idempotent create endpoint and offline queue land in Phase 2/5 (tasks 5.1, 11.18).
// This wires the ephemeral compose draft store (req 30.8) and the auth gate.
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/app/providers/SessionProvider';
import { useUiStore } from '@/store/ui';
import { errors } from '@/copy/errors';
import { useToast } from '@/app/providers/ToastProvider';

export function ComposeFlare() {
  const navigate = useNavigate();
  const { firebaseUser } = useSession();
  const { pushToast } = useToast();
  const draft = useUiStore((s) => s.composeDraft);
  const setDraft = useUiStore((s) => s.setComposeDraft);

  function next(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.title.trim()) {
      pushToast('warn', errors.titleEmpty);
      return;
    }
    if (!firebaseUser) {
      navigate('/auth');
      return;
    }
    // Authoritative POST /api/gigs lands in task 5.1.
    pushToast('neutral', 'compose is wired — publishing arrives in phase 2');
  }

  return (
    <section style={{ padding: 16 }}>
      <h1 style={{ textTransform: 'lowercase' }}>what do you need doing</h1>
      <form onSubmit={next} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          placeholder="assemble my ikea desk"
          value={draft.title}
          onChange={(e) => setDraft({ title: e.target.value })}
          aria-label="title"
        />
        <textarea
          placeholder="a couple more details…"
          value={draft.body}
          onChange={(e) => setDraft({ body: e.target.value })}
          aria-label="body"
        />
        <input
          inputMode="numeric"
          placeholder="₹ ask"
          value={draft.askPrice ?? ''}
          onChange={(e) => setDraft({ askPrice: e.target.value ? Number(e.target.value) : null })}
          aria-label="ask price"
        />
        <button type="submit">next</button>
      </form>
    </section>
  );
}
