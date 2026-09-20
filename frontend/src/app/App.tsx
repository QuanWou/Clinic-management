import { useEffect, useState } from 'react';
import { getCurrentUser, logout } from '../api/auth';
import { ApiError } from '../api/client';
import { getPatientProfile } from '../api/clinic';
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
import PatientOnboardingPage from '../pages/PatientOnboardingPage';
import SettingsPage from '../pages/SettingsPage';
import type { CurrentUser, DashboardResponse, PatientProfileResponse } from '../types/domain';
import type { AppView } from '../types/view';
import { getPrimaryRole, normalizeRoles } from '../utils/roles';

export default function App() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [patientProfile, setPatientProfile] = useState<PatientProfileResponse | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<AppView>('dashboard');

  async function loadSession() {
    if (!getAccessToken()) {
      setUser(null);
      setDashboard(null);
      setPatientProfile(undefined);
      return;
    }

    setLoading(true);
    setError(null);
    setDashboard(null);
    setPatientProfile(undefined);

    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      const warnings: string[] = [];
      const roles = normalizeRoles(currentUser.roles);

      if (roles.includes('ROLE_PATIENT')) {
        try {
          setPatientProfile(await getPatientProfile());
        } catch (err) {
          if (err instanceof ApiError && err.status === 404) {
            setPatientProfile(null);
          } else {
            const detail = err instanceof Error ? err.message : 'Unknown error';
            warnings.push(`Unable to load patient profile: ${detail}`);
          }
        }
      }

      try {
        const dashboardResponse = await getDashboard();
        setDashboard(dashboardResponse);
      } catch (err) {
        const detail = err instanceof Error ? `: ${err.message}` : '';
        warnings.push(`${appConfig.dashboardLoadError}${detail}`);
      }

      setError(warnings.length > 0 ? warnings.join(' ') : null);
    } catch (err) {
      setUser(null);
      setDashboard(null);
      setPatientProfile(undefined);
      setError(err instanceof Error ? err.message : appConfig.dashboardLoadError);
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    logout();
    setUser(null);
    setDashboard(null);
    setPatientProfile(undefined);
  }

  useEffect(() => {
    void loadSession();
  }, []);

  if (!getAccessToken() || !user) {
    return <LoginPage onLogin={loadSession} />;
  }

  const roles = normalizeRoles(user.roles);
  const primaryRole = getPrimaryRole(roles);

  if (roles.includes('ROLE_PATIENT') && patientProfile === null) {
    return (
      <PatientOnboardingPage
        user={user}
        onComplete={setPatientProfile}
        onLogout={handleLogout}
      />
    );
  }

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
      {renderView(activeView, user, dashboard, patientProfile, error, setPatientProfile)}
    </AppShell>
  );
}

function renderView(
  activeView: AppView,
  user: CurrentUser,
  dashboard: DashboardResponse | null,
  patientProfile: PatientProfileResponse | null | undefined,
  error: string | null,
  onPatientProfileSaved: (profile: PatientProfileResponse) => void
) {
  switch (activeView) {
    case 'appointments':
      return <AppointmentsPage appointments={dashboard?.appointments} />;
    case 'patients':
      return <PatientsPage />;
    case 'doctors':
      return <DoctorsPage />;
    case 'doctor-profile':
      return normalizeRoles(user.roles).includes('ROLE_DOCTOR')
        ? <DoctorProfilePage user={user} />
        : <DashboardPage dashboard={dashboard} error="Doctor profile access requires the doctor role." />;
    case 'medical-records':
      return <MedicalRecordsPage records={dashboard?.medicalRecords} />;
    case 'invoices':
      return <InvoicesPage invoices={dashboard?.invoices} />;
    case 'settings':
      return (
        <SettingsPage
          user={user}
          patientProfile={patientProfile}
          onPatientProfileSaved={onPatientProfileSaved}
        />
      );
    case 'dashboard':
    default:
      return <DashboardPage dashboard={dashboard} error={error} />;
  }
}
