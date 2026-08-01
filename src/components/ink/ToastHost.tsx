// Renders the active toast stack from ToastProvider (design §G.2), using the styled Toast
// primitive (task 3.4). The live region is polite; each toast is individually dismissible.
import { useToast } from '@/app/providers/ToastProvider';
import { Toast } from './Toast';

export function ToastHost() {
  const { toasts, dismissToast } = useToast();
  if (toasts.length === 0) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{ position: 'fixed', left: 0, right: 0, bottom: 88, zIndex: 80, pointerEvents: 'none' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
        {toasts.map((t) => (
          <Toast key={t.id} tone={t.tone} message={t.message} onDismiss={() => dismissToast(t.id)} />
        ))}
      </div>
    </div>
  );
}
