// Modal shell for background-location routes (requirements 25.3, 25.4).
// A modal is rendered over the underlying screen; the browser back gesture, the Escape key,
// and a backdrop tap all close it and return to that screen. On deep-link (no background)
// closing falls back to root so the user is never trapped.
import { useEffect, useRef, type ReactNode } from 'react';
import { useModalNavigate } from '@/hooks/useModalNavigate';

export function ModalRoute({ children, label }: { children: ReactNode; label: string }) {
  const { closeModal } = useModalNavigate();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Escape closes the modal (design §I.3). Capture the previously focused element and move
  // focus into the dialog on mount, restoring it on unmount.
  useEffect(() => {
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeModal();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    const { body } = document;
    const prevOverflow = body.style.overflow;
    body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      body.style.overflow = prevOverflow;
      restoreFocusRef.current?.focus?.();
    };
  }, [closeModal]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 70,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        aria-hidden="true"
        onClick={closeModal}
        style={{ position: 'absolute', inset: 0, background: 'rgba(12,11,9,0.4)' }}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        style={{ position: 'relative', zIndex: 1, maxWidth: 420, width: '100%', outline: 'none' }}
      >
        {children}
      </div>
    </div>
  );
}
