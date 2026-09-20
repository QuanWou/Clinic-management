import { useEffect, useRef, useState } from 'react';
import { getCurrentUser, logout } from '../api/auth';
import { getDashboard } from '../api/dashboard';
import { getAccessToken } from '../api/token';
import Alert from '../components/Alert';
import AppShell from '../layouts/AppShell';
import AppointmentsPage from '../pages/AppointmentsPage';
import DashboardPage from '../pages/DashboardPage';
import DoctorProfilePage from '../pages/DoctorProfilePage';
import DoctorsPage from '../pages/DoctorsPage';
import InvoicesPage from '../pages/InvoicesPage';
import LoginPage from '../pages/LoginPage';
import MedicalRecordsPage from '../pages/MedicalRecordsPage';
import NotificationsPage from '../pages/NotificationsPage';
import CatalogPage from '../pages/CatalogPage';
import PatientsPage from '../pages/PatientsPage';
import SettingsPage from '../pages/SettingsPage';
import type { CurrentUser, DashboardResponse } from '../types/domain';
import type { AppView } from '../types/view';
import { canAccess, getPrimaryRole, normalizeRoles, type ClinicRole } from '../utils/roles';

export default function App() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const requestId = useRef(0);

  async function loadSession() {
    const currentRequest = ++requestId.current;
    if (!getAccessToken()) {
      setUser(null);
      setDashboard(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const currentUser = await getCurrentUser();
      if (currentRequest !== requestId.current) return;
      setUser(currentUser);
      setDashboard(null);
      const roles = normalizeRoles(currentUser.roles);
      // The current gateway dashboard aggregates patient-only /my endpoints.
      // Never invoke it for staff until a role-aware aggregation endpoint exists.
      if (getPrimaryRole(roles) === 'PATIENT') {
        try {
          const result = await getDashboard();
          if (currentRequest === requestId.current) setDashboard(result);
        } catch (cause) {
          if (currentRequest === requestId.current) setError(errorMessage(cause));
        }
      }
    } catch (cause) {
      if (currentRequest === requestId.current) {
        setUser(null);
        setDashboard(null);
        setError(errorMessage(cause));
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }

  async function handleLogout() {
    ++requestId.current;
    setUser(null);
    setDashboard(null);
    setActiveView('dashboard');
    setError(null);
    try {
      await logout();
    } catch {
      setError('Signed out locally, but the server could not confirm token revocation.');
    }
  }

  useEffect(() => {
    const onUnauthorized = () => {
      ++requestId.current;
      setUser(null);
      setDashboard(null);
      setError('Your session expired. Please sign in again.');
      setLoading(false);
    };
    window.addEventListener('clinic:unauthorized', onUnauthorized);
    void loadSession();
    return () => {
      ++requestId.current;
      window.removeEventListener('clinic:unauthorized', onUnauthorized);
    };
  }, []);

  if (loading && !user) return <main className="auth-shell" role="status">Loading your session...</main>;
  if (!getAccessToken() || !user) {
    return <LoginPage onLogin={loadSession} sessionError={error} />;
  }

  const roles = normalizeRoles(user.roles);
  const primaryRole = getPrimaryRole(roles);
  if (!primaryRole) {
    return <main className="auth-shell"><Alert tone="error">This account has no supported clinic role.</Alert><button type="button" onClick={() => void handleLogout()}>Sign out</button></main>;
  }
  const activeRole: ClinicRole = primaryRole;
  // A multi-role account uses one consistent active role, not the union of
  // patient and administrative navigation permissions.
  const allowedView = canAccess(activeView, [activeRole]) ? activeView : 'dashboard';
  function navigate(view: AppView) {
    if (canAccess(view, [activeRole])) setActiveView(view);
  }

  return (
    <AppShell activeItemId={allowedView} user={user} loading={loading} primaryRole={primaryRole}
      onNavigate={navigate} onRefresh={() => void loadSession()} onLogout={() => void handleLogout()}>
      {renderView(allowedView, user, dashboard, error, loading, primaryRole, () => void loadSession())}
    </AppShell>
  );
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Unable to load data';
}

function renderView(
  activeView: AppView,
  user: CurrentUser,
  dashboard: DashboardResponse | null,
  error: string | null,
  loading: boolean,
  role: ClinicRole,
  refresh: () => void
) {
  switch (activeView) {
    case 'appointments':
      return <AppointmentsPage appointments={role === 'PATIENT' ? dashboard?.appointments : null}
        role={role} error={role === 'PATIENT' ? error : null} loading={loading} onRefresh={refresh} />;
    case 'patients':
      return <PatientsPage role={role} user={user} />;
    case 'doctors':
      return <DoctorsPage role={role} />;
    case 'doctor-profile':
      return <DoctorProfilePage user={user} />;
    case 'medical-records':
      return <MedicalRecordsPage records={role === 'PATIENT' ? dashboard?.medicalRecords : null}
        role={role} loading={loading} error={role === 'PATIENT' ? error : null} onRefresh={refresh} />;
    case 'invoices':
      return <InvoicesPage invoices={role === 'PATIENT' ? dashboard?.invoices : null}
        role={role} loading={loading} error={role === 'PATIENT' ? error : null} onRefresh={refresh} />;
    case 'catalog':
      return <CatalogPage role={role} />;
    case 'notifications':
      return <NotificationsPage />;
    case 'settings':
      return <SettingsPage user={user} role={role} />;
    case 'dashboard':
    default:
      return <DashboardPage dashboard={dashboard} user={user} role={role} error={error} loading={loading} onRefresh={refresh} />;
  }
}
