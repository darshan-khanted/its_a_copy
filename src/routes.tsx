// Route map — URL is the single source of truth (design §F.2, requirements 25.1, 25.2, 25.5).
// The old ActiveView enum is gone. Modal routes render OVER a background location so the
// browser back gesture closes them and returns to the underlying screen (requirements 25.3, 25.4).
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { PhaseScreen } from '@/components/PhaseScreen';
import { ModalRoute } from '@/components/layout/ModalRoute';
import { ClaimHood } from '@/features/hood/ClaimHood';
import { HandshakeDetail } from '@/features/handshake/HandshakeDetail';
import { FieldScreen } from '@/features/field/components/FieldScreen';
import { BoardScreen } from '@/features/gigs/BoardScreen';
import { SignalDetail } from '@/features/gigs/SignalDetail';
import { ComposeFlare } from '@/features/gigs/ComposeFlare';
import { Inbox } from '@/features/chat/Inbox';
import { Thread } from '@/features/chat/Thread';
import { AlertsList } from '@/features/notifications/AlertsList';
import { MeScreen } from '@/features/identity/MeScreen';
import { VerifyScreen } from '@/features/identity/VerifyScreen';
import { PublicProfile } from '@/features/identity/PublicProfile';
import { RepLedger } from '@/features/rep/RepLedger';
import { AuthSheet } from '@/features/identity/AuthSheet';
import { ResetPassword } from '@/features/identity/ResetPassword';
import { ReportSheet } from '@/features/safety/ReportSheet';
import { RankUpModal } from '@/features/rep/RankUpModal';
import { CaptureModal } from '@/features/media/CaptureModal';
import { preferredEntryPath } from '@/lib/prefs';
import type { ModalBackgroundState } from '@/hooks/useModalNavigate';

/** `/` and any unknown path resolve to the last hood (preferred mode) or the claim screen. */
function RootRedirect() {
  return <Navigate to={preferredEntryPath()} replace />;
}

export function AppRoutes() {
  const location = useLocation();
  const background = (location.state as ModalBackgroundState | null)?.background;

  return (
    <>
      {/* Primary routes render against the background location while a modal is open, so the
          underlying screen stays visible and addressable beneath the modal. */}
      <Routes location={background ?? location}>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route element={<AppShell />}>
          {/* public · no auth */}
          <Route path="/claim" element={<ClaimHood />} />
          <Route path="/hood/:pin" element={<FieldScreen />} />
          <Route path="/hood/:pin/board" element={<BoardScreen />} />
          <Route
            path="/hood/:pin/leaderboard"
            element={<PhaseScreen title="leaderboard" note="rank 03+ unlock — arrives in phase 5." />}
          />
          <Route path="/g/:gigId" element={<SignalDetail />} />
          <Route path="/u/:handle" element={<PublicProfile />} />

          {/* authed */}
          <Route path="/flare" element={<ComposeFlare />} />
          <Route
            path="/flare/sent/:gigId"
            element={<PhaseScreen title="flare sent" note="the broadcast animation arrives in phase 2." />}
          />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/t/:threadId" element={<Thread />} />
          <Route path="/h/:handshakeId" element={<HandshakeDetail />} />
          <Route
            path="/live/:handshakeId"
            element={<PhaseScreen title="live gig" note="the live runner arrives in phase 4." />}
          />
          <Route
            path="/receipt/:handshakeId"
            element={<PhaseScreen title="receipt" note="the money moment arrives in phase 4." />}
          />
          <Route
            path="/loop/:handshakeId"
            element={<PhaseScreen title="loop" note="the 20-second review arrives in phase 4." />}
          />
          <Route path="/me" element={<MeScreen />} />
          <Route path="/me/rep" element={<RepLedger />} />
          <Route path="/me/flares" element={<PhaseScreen title="my flares" note="arrives in phase 2." />} />
          <Route path="/me/claims" element={<PhaseScreen title="my claims" note="arrives in phase 2." />} />
          <Route path="/me/verify" element={<VerifyScreen />} />
          <Route path="/alerts" element={<AlertsList />} />
        </Route>

        {/* Modal routes are also registered standalone so a direct deep link still resolves
            (they self-render as a centred dialog with a root fallback close). */}
        <Route path="/auth" element={<AuthSheet />} />
        <Route path="/capture" element={<CaptureModal />} />
        <Route path="/report/:targetType/:id" element={<ReportSheet />} />
        <Route path="/rank-up/:rankId" element={<RankUpModal />} />

        <Route path="*" element={<RootRedirect />} />
      </Routes>

      {/* When a background exists, the modal is rendered on top of the primary routes above. */}
      {background && (
        <Routes>
          <Route path="/auth" element={<AuthSheet />} />
          <Route
            path="/u/:handle"
            element={
              <ModalRoute label="profile">
                <PublicProfile />
              </ModalRoute>
            }
          />
          <Route path="/capture" element={<CaptureModal />} />
          <Route path="/report/:targetType/:id" element={<ReportSheet />} />
          <Route path="/rank-up/:rankId" element={<RankUpModal />} />
        </Routes>
      )}
    </>
  );
}
