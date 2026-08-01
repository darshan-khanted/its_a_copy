// App chrome: TopBar + routed content + BottomNav, with the desktop two-pane shell.
// At >= 1024px on a detail route the Field stays persistent on the left and the detail renders
// on the right (requirement 25.9, design §F.4/§I.7). Below that it is single-pane mobile.
import { matchPath, Outlet, useLocation } from 'react-router-dom';
import { HoodProvider, useHoodContext } from '@/app/providers/HoodProvider';
import { FieldScreen } from '@/features/field/components/FieldScreen';
import { useTwoPane } from '@/hooks/useTwoPane';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';

// Routes that read as a "detail" of the current hood get the persistent-Field treatment.
const DETAIL_PATTERNS = [
  '/g/:gigId',
  '/t/:threadId',
  '/handshake/:id',
  '/receipt/:handshakeId',
  '/live/:handshakeId',
  '/loop/:handshakeId',
];

function isDetailRoute(pathname: string): boolean {
  return DETAIL_PATTERNS.some((pattern) => matchPath(pattern, pathname) !== null);
}

function Shell() {
  const twoPane = useTwoPane();
  const location = useLocation();
  const { pincode } = useHoodContext();
  const showPersistentField = twoPane && isDetailRoute(location.pathname) && !!pincode;

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 72 }}>
      <TopBar />
      {showPersistentField ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            alignItems: 'start',
          }}
        >
          <aside aria-label="field" style={{ position: 'sticky', top: 44, alignSelf: 'start' }}>
            <FieldScreen />
          </aside>
          <main aria-label="detail">
            <Outlet />
          </main>
        </div>
      ) : (
        <main>
          <Outlet />
        </main>
      )}
      <BottomNav />
    </div>
  );
}

export function AppShell() {
  // HoodProvider reads the :pin route param, so it must sit inside the router tree.
  return (
    <HoodProvider>
      <Shell />
    </HoodProvider>
  );
}
