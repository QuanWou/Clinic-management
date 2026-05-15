import { useEffect, useState } from 'react';
import { getCurrentUser, logout } from '../api/auth';
import { getDashboard } from '../api/dashboard';
import { getAccessToken } from '../api/token';
import { appConfig } from '../config/app.config';
import AppShell from '../layouts/AppShell';
import AppointmentsPage from '../pages/AppointmentsPage';
import DashboardPage from '../pages/DashboardPage';
import DoctorProfilePage from '../pages/DoctorProfilePage';
import DoctorsPage from '../pages/DoctorsPage';
import InvoicesPage from '../pages/InvoicesPage';
import LoginPage from '../pages/LoginPage';
import MedicalRecordsPage from '../pages/MedicalRecordsPage';
import PatientsPage from '../pages/PatientsPage';
import SettingsPage from '../pages/SettingsPage';
import type { CurrentUser, DashboardResponse } from '../types/domain';
import type { AppView } from '../types/view';
import { getPrimaryRole, normalizeRoles } from '../utils/roles';

export default function App() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<AppView>('dashboard');

  async function loadSession() {
    if (!getAccessToken()) {
      setUser(null);
      setDashboard(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [currentUser, dashboardResponse] = await Promise.all([
        getCurrentUser(),
        getDashboard()
      ]);
      setUser(currentUser);
      setDashboard(dashboardResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : appConfig.dashboardLoadError);
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    logout();
    setUser(null);
    setDashboard(null);
  }

  useEffect(() => {
    void loadSession();
  }, []);

  if (!getAccessToken() || !user) {
    return <LoginPage onLogin={loadSession} />;
  }

  const roles = normalizeRoles(user.roles);
  const primaryRole = getPrimaryRole(roles);

  return (
    <AppShell
      activeItemId={activeView}
      user={user}
      loading={loading}
      primaryRole={primaryRole}
      onNavigate={setActiveView}
      onRefresh={loadSession}
      onLogout={handleLogout}
    >
      {renderView(activeView, user, dashboard, error)}
    </AppShell>
  );
}

function renderView(
  activeView: AppView,
  user: CurrentUser,
  dashboard: DashboardResponse | null,
  error: string | null
) {
  switch (activeView) {
    case 'appointments':
      return <AppointmentsPage appointments={dashboard?.appointments} />;
    case 'patients':
      return <PatientsPage />;
    case 'doctors':
      return <DoctorsPage />;
    case 'doctor-profile':
      return <DoctorProfilePage />;
    case 'medical-records':
      return <MedicalRecordsPage records={dashboard?.medicalRecords} />;
    case 'invoices':
      return <InvoicesPage invoices={dashboard?.invoices} />;
    case 'settings':
      return <SettingsPage user={user} />;
    case 'dashboard':
    default:
      return <DashboardPage dashboard={dashboard} error={error} />;
  }
}
