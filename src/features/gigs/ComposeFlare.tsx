// Compose a flare /flare (design §E.2, §F.2, requirements 10.1-10.11, 18.4, 18.5, 18.9, 18.10).
// The three-beat composer — what, value, where-and-when — wired to the ephemeral compose draft
// store (req 30.8), the authoritative idempotent POST /api/gigs endpoint (task 5.1), and the
// existing auth + hood-live gate (task 3.7). Composing itself is never gated (req 23.7); only the
// final broadcast is (req 23.2).
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/app/providers/SessionProvider';
import { useHoodContext } from '@/app/providers/HoodProvider';
import { useGatedAction } from '@/features/identity/hooks/useGatedAction';
import { useUiStore } from '@/store/ui';
import { useToast } from '@/app/providers/ToastProvider';
import { api } from '@/lib/api';
import { InkBox, InkPress, Price, TapeLabel } from '@/components/ink';
import { unlocksForRank } from '@/features/rep/lib/unlocks';
import { priceGuidance as priceGuidanceOf, reachCount } from '@/features/hood/lib/stats';
import { errors } from '@/copy/errors';
import { placeholders } from '@/copy/placeholders';
import { labels, reachLine, priceGuidanceLine } from '@/copy/labels';
import { rupees } from '@/lib/format';

type Beat = 'what' | 'value' | 'when';
const BEATS: Beat[] = ['what', 'value', 'when'];

/** `YYYY-MM-DD` for `today + offsetDays`, in the viewer's local timezone. */
function isoDateOffset(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('could not read file'));
    reader.readAsDataURL(file);
  });
}

export function ComposeFlare() {
  const navigate = useNavigate();
  const { firebaseUser, user } = useSession();
  const { pincode, hood, anchor } = useHoodContext();
  const { gate } = useGatedAction();
  const { pushToast } = useToast();
  const draft = useUiStore((s) => s.composeDraft);
  const setDraft = useUiStore((s) => s.setComposeDraft);
  const resetDraft = useUiStore((s) => s.resetComposeDraft);

  const [beat, setBeat] = useState<Beat>('what');
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Prefill hood + a sensible default date the first time the composer mounts with an
  // empty draft (req 10.8). Never overwrites a value the user has already touched.
  useEffect(() => {
    if (!draft.startDate) setDraft({ startDate: isoDateOffset(0) });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // One idempotency key per compose attempt (req 10.12's create-side half, task 5.1). A
  // double-tap or a retried request reuses the same key, so the server returns the
  // original gig rather than creating a duplicate.
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  // Keep the live preview above the on-screen keyboard using visual-viewport resize
  // information (req 10.3) rather than the viewport height, which does not shrink when
  // a mobile keyboard opens.
  const [keyboardInsetPx, setKeyboardInsetPx] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => setKeyboardInsetPx(Math.max(0, window.innerHeight - vv.height));
    vv.addEventListener('resize', onResize);
    onResize();
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  const rank = user?.rank ?? 'TAPPED_IN';
  const canAttachPhoto = unlocksForRank(rank).canAttachPhoto;
  const guidance = hood ? priceGuidanceOf(hood) : null;
  const reach = hood ? reachCount(hood) : 0;

  function beatIndex(b: Beat): number {
    return BEATS.indexOf(b);
  }

  function goNext() {
    if (beat === 'what') {
      if (!draft.title.trim()) {
        pushToast('warn', errors.titleEmpty);
        return;
      }
      if (!draft.body.trim()) {
        pushToast('warn', errors.bodyEmpty);
        return;
      }
      setBeat('value');
      return;
    }
    if (beat === 'value') {
      if (!draft.askPrice || draft.askPrice <= 0) {
        pushToast('warn', errors.priceZero);
        return;
      }
      setBeat('when');
      return;
    }
  }

  function goBack() {
    const idx = beatIndex(beat);
    if (idx > 0) setBeat(BEATS[idx - 1]);
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const result = await api<{ url: string; success: boolean }>('/api/upload', {
        method: 'POST',
        body: { dataUrl, type: 'gig', userId: firebaseUser?.uid },
      });
      setDraft({ photoUrl: result.url });
    } catch {
      pushToast('warn', errors.genericRetry);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function doSubmit() {
    if (!draft.startDate) {
      pushToast('warn', errors.dateRequired);
      return;
    }
    if (!pincode || !anchor) {
      pushToast('warn', errors.loadFailed);
      return;
    }
    setSubmitting(true);
    try {
      const result = await api<{ success: boolean; gig: { id: string } }>('/api/gigs', {
        method: 'POST',
        body: {
          title: draft.title.trim(),
          body: draft.body.trim(),
          askPrice: draft.askPrice,
          tags: draft.tags,
          urgent: draft.urgent,
          hoodId: pincode,
          startDate: draft.startDate,
          startTime: draft.startTime,
          // No address-picker precision layer exists yet (design §C.1 reserves that for a
          // later Google Maps route) — the hood centroid is the best available pin for now.
          location: anchor,
          photoUrl: draft.photoUrl ?? undefined,
          idempotencyKey: idempotencyKeyRef.current,
        },
      });
      resetDraft();
      navigate(`/flare/sent/${result.gig.id}`);
    } catch {
      pushToast('warn', errors.genericRetry);
    } finally {
      setSubmitting(false);
    }
  }

  function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    gate({ kind: 'flare', requireLiveHood: true }, () => {
      void doSubmit();
    });
  }

  const previewTags = draft.tags.filter(Boolean);

  return (
    <section style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <header>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 'var(--text-h2)',
            textTransform: 'lowercase',
            margin: 0,
          }}
        >
          {placeholders.gigTitle}
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-micro)',
            letterSpacing: '0.14em',
            color: 'var(--text-2)',
            margin: 'var(--space-2) 0 0',
          }}
        >
          {beat === 'what' ? labels.composeWhat : beat === 'value' ? labels.composeValue : labels.composeWhen}
          {' · '}
          {beatIndex(beat) + 1}/3
        </p>
      </header>

      <form onSubmit={handlePublish} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {/* ---- beat 1: what ---- */}
        {beat === 'what' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <input
              className="ink-box-sm field-input"
              placeholder={placeholders.gigTitle}
              value={draft.title}
              onChange={(e) => setDraft({ title: e.target.value })}
              aria-label="title"
              style={{ padding: 'var(--space-3)' }}
            />
            <textarea
              className="ink-box-sm field-input"
              placeholder={placeholders.gigBody}
              value={draft.body}
              onChange={(e) => setDraft({ body: e.target.value })}
              aria-label="body"
              rows={4}
              style={{ padding: 'var(--space-3)' }}
            />
            <input
              className="ink-box-sm field-input"
              placeholder={placeholders.tags}
              value={draft.tags.join(', ')}
              onChange={(e) =>
                setDraft({
                  tags: e.target.value
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean),
                })
              }
              aria-label="tags"
              style={{ padding: 'var(--space-3)' }}
            />
          </div>
        )}

        {/* ---- beat 2: value ---- */}
        {beat === 'value' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {guidance && (
              <p
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-micro)',
                  letterSpacing: '0.14em',
                  color: 'var(--text-2)',
                  margin: 0,
                }}
              >
                {priceGuidanceLine(rupees(guidance.p25), rupees(guidance.p75))}
                {' · '}
                <button
                  type="button"
                  className="ink-press"
                  onClick={() => setDraft({ askPrice: guidance.p50 })}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit' }}
                >
                  {rupees(guidance.p50)} {labels.median}
                </button>
              </p>
            )}
            <input
              className="ink-box-sm field-input"
              inputMode="numeric"
              placeholder="₹ ask"
              value={draft.askPrice ?? ''}
              onChange={(e) => setDraft({ askPrice: e.target.value ? Number(e.target.value) : null })}
              aria-label="ask price"
              style={{ padding: 'var(--space-3)' }}
            />
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-micro)',
                letterSpacing: '0.14em',
              }}
            >
              <input
                type="checkbox"
                checked={draft.urgent}
                onChange={(e) => setDraft({ urgent: e.target.checked })}
              />
              {labels.makeItUrgent} — {labels.urgentNote}
            </label>
            {canAttachPhoto ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <label
                  className="ink-box-sm ink-press tap-target"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: 'var(--space-2) var(--space-3)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-micro)',
                    letterSpacing: '0.14em',
                    cursor: 'pointer',
                  }}
                >
                  {uploadingPhoto ? 'uploading…' : labels.addPhoto}
                  <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
                </label>
                {draft.photoUrl && <span style={{ fontSize: 'var(--text-small)' }}>photo attached</span>}
              </div>
            ) : (
              <p
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-nano)',
                  letterSpacing: '0.16em',
                  color: 'var(--text-2)',
                  margin: 0,
                }}
                aria-label="locked capability, unlocks at HUSTLER"
              >
                {labels.addPhoto} — {labels.unlocksAtRank} HUSTLER
              </p>
            )}
          </div>
        )}

        {/* ---- beat 3: where & when ---- */}
        {beat === 'when' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              {[
                { label: labels.today, date: isoDateOffset(0) },
                { label: labels.tomorrow, date: isoDateOffset(1) },
                { label: labels.thisWeek, date: isoDateOffset(5) },
              ].map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  className="ink-box-sm ink-press tap-target"
                  onClick={() => setDraft({ startDate: chip.date })}
                  aria-pressed={draft.startDate === chip.date}
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-micro)',
                    letterSpacing: '0.14em',
                  }}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <input
              className="ink-box-sm field-input"
              type="date"
              value={draft.startDate}
              onChange={(e) => setDraft({ startDate: e.target.value })}
              aria-label="start date"
              style={{ padding: 'var(--space-3)' }}
            />
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              <input
                className="ink-box-sm field-input"
                type="time"
                value={draft.startTime === 'FLEXIBLE' ? '' : draft.startTime}
                onChange={(e) => setDraft({ startTime: e.target.value || 'FLEXIBLE' })}
                aria-label="start time"
                style={{ padding: 'var(--space-3)' }}
              />
              <button
                type="button"
                className="ink-box-sm ink-press tap-target"
                onClick={() => setDraft({ startTime: 'FLEXIBLE' })}
                aria-pressed={draft.startTime === 'FLEXIBLE'}
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-micro)',
                  letterSpacing: '0.14em',
                }}
              >
                {labels.flexible}
              </button>
            </div>
            {hood && (
              <p
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-micro)',
                  letterSpacing: '0.14em',
                  color: 'var(--text-2)',
                  margin: 0,
                }}
              >
                {reachLine(reach)} · {hood.area}
              </p>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
          {beatIndex(beat) > 0 ? (
            <InkPress type="button" variant="ghost" onClick={goBack}>
              {labels.back}
            </InkPress>
          ) : (
            <span />
          )}
          {beat === 'when' ? (
            <InkPress type="submit" variant="lime" loading={submitting} loadingLabel="sending the flare…">
              {labels.publishFlare}
            </InkPress>
          ) : (
            <InkPress type="button" variant="primary" onClick={goNext}>
              {labels.next}
            </InkPress>
          )}
        </div>
      </form>

      {/* live keyboard-aware signal-card preview (req 10.2, 10.3) */}
      <InkBox
        pop="lg"
        popColor={draft.urgent ? 'magenta' : 'ink'}
        style={{
          position: 'sticky',
          bottom: keyboardInsetPx > 0 ? keyboardInsetPx + 12 : 'var(--space-4)',
          padding: 'var(--space-4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          background: 'var(--surface-raised)',
        }}
      >
        {draft.urgent && <TapeLabel tone="magenta">{labels.urgent}</TapeLabel>}
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 'var(--text-h3)',
            margin: 0,
          }}
        >
          {draft.title || placeholders.gigTitle}
        </h2>
        <p style={{ margin: 0, color: 'var(--text-2)' }}>{draft.body || placeholders.gigBody}</p>
        <Price amount={draft.askPrice ?? 0} size="lg" />
        {previewTags.length > 0 && (
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {previewTags.map((tag) => (
              <span
                key={tag}
                className="ink-box-sm"
                style={{
                  padding: 'var(--space-1) var(--space-2)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-nano)',
                  letterSpacing: '0.16em',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </InkBox>
    </section>
  );
}
