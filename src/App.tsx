import { useState } from 'react';
import { TopBar, AppRoute } from './components/TopBar';
import { DriverTripForm } from './components/DriverTripForm';
import { AdminLoginModal } from './components/AdminLoginModal';
import { AdminDashboard } from './components/AdminDashboard';

export default function App() {
  // Keep admin session token strictly in React memory (never localStorage/sessionStorage)
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [adminUsername, setAdminUsername] = useState<string | null>(null);
  const [activeRoute, setActiveRoute] = useState<AppRoute>('driver');
  const [loginOpen, setLoginOpen] = useState(false);

  const handleNavigate = (route: AppRoute) => {
    if (route !== 'driver' && !adminToken) {
      setLoginOpen(true);
      return;
    }
    setActiveRoute(route);
  };

  const handleLoginSuccess = (token: string, username: string) => {
    setAdminToken(token);
    setAdminUsername(username);
    setLoginOpen(false);
    setActiveRoute('sheet');
  };

  const handleLogout = () => {
    setAdminToken(null);
    setAdminUsername(null);
    setActiveRoute('driver');
  };

  const handleSessionExpired = () => {
    setAdminToken(null);
    setAdminUsername(null);
    setActiveRoute('driver');
    setLoginOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <TopBar
        activeRoute={activeRoute}
        onNavigate={handleNavigate}
        adminUsername={adminUsername}
        onOpenLogin={() => setLoginOpen(true)}
        onLogout={handleLogout}
      />

      <main className="flex-1">
        {activeRoute === 'driver' || !adminToken ? (
          <DriverTripForm />
        ) : (
          <AdminDashboard
            token={adminToken}
            activeTab={activeRoute}
            onChangeTab={(tab) => setActiveRoute(tab)}
            onSessionExpired={handleSessionExpired}
          />
        )}
      </main>

      <AdminLoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={handleLoginSuccess}
      />
    </div>
  );
}
