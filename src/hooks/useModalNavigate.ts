// Modal-route navigation (requirements 25.3, 25.4, design §F.2). Modals are real routes
// (`/auth`, `/u/:handle`, `/capture`, `/report/:targetType/:id`, `/rank-up/:rankId`) opened
// OVER a background location, so the browser back gesture closes the modal and returns to the
// underlying screen instead of exiting the app.
import { useCallback } from 'react';
import { type Location, useLocation, useNavigate } from 'react-router-dom';

export interface ModalBackgroundState {
  background?: Location;
}

/** Read the background location a modal is rendered over, if any. */
export function useModalBackground(): Location | undefined {
  const location = useLocation();
  return (location.state as ModalBackgroundState | null)?.background;
}

/**
 * Returns `openModal(to)` which navigates to a modal route while stashing the current
 * location as the background, and `closeModal()` which reverses it. Callers use `openModal`
 * for the modal routes listed above; everything else uses ordinary <Link>/navigate.
 */
export function useModalNavigate(): {
  openModal: (to: string) => void;
  closeModal: () => void;
} {
  const navigate = useNavigate();
  const location = useLocation();
  const background = (location.state as ModalBackgroundState | null)?.background;

  const openModal = useCallback(
    (to: string) => {
      navigate(to, { state: { background: location } });
    },
    [navigate, location],
  );

  const closeModal = useCallback(() => {
    // If we arrived here over a background (normal in-app open), pop history so the back
    // stack stays honest. If deep-linked directly to a modal URL, fall back to root.
    if (background) navigate(-1);
    else navigate('/', { replace: true });
  }, [background, navigate]);

  return { openModal, closeModal };
}
