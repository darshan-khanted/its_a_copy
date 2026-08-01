// Root application component: router, providers, grain, and toast host. Nothing else.
// Was 82,682 bytes with ~15 global subscriptions; now under 150 lines (design §G.3, req 30.5).
// BrowserRouter is outermost so SurfaceProvider can own the `?surface=` URL state (req 25.1).
import { BrowserRouter } from 'react-router-dom';
import { SessionProvider } from '@/app/providers/SessionProvider';
import { SurfaceProvider } from '@/app/providers/SurfaceProvider';
import { ToastProvider } from '@/app/providers/ToastProvider';
import { Grain } from '@/components/ink/Grain';
import { ToastHost } from '@/components/ink/ToastHost';
import { AppRoutes } from '@/routes';

export default function App() {
  // HoodProvider is mounted inside the router tree (AppShell) because it reads the :pin param.
  return (
    <BrowserRouter>
      <SurfaceProvider>
        <SessionProvider>
          <ToastProvider>
            <AppRoutes />
            <Grain />
            <ToastHost />
          </ToastProvider>
        </SessionProvider>
      </SurfaceProvider>
    </BrowserRouter>
  );
}
