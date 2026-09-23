import { useEffect, useRef, useState } from 'react';
import { getCurrentUser, logout } from '../api/auth';
import { getDashboard } from '../api/dashboard';
import { loadStaffDashboard, type StaffDashboard } from '../api/staffDashboard';
import { getAccessToken } from '../api/token';
import Alert from '../components/Alert';
import AppShell from '../layouts/AppShell';
import AppointmentsPage from '../pages/AppointmentsPage';
import DashboardPage from '../pages/DashboardPage';
import DoctorEncounterWorkspace from '../pages/DoctorEncounterWorkspace';
import DoctorProfilePage from '../pages/DoctorProfilePage';
import DoctorsPage from '../pages/DoctorsPage';
import InvoicesPage from '../pages/InvoicesPage';
import LoginPage from '../pages/LoginPage';
import MedicalRecordsPage from '../pages/MedicalRecordsPage';
import NotificationsPage from '../pages/NotificationsPage';
import CatalogPage from '../pages/CatalogPage';
import PatientsPage from '../pages/PatientsPage';
import SettingsPage from '../pages/SettingsPage';
import type { CurrentUser, DashboardResponse, ReceptionPatientResponse, ReceptionVisitResponse } from '../types/domain';
import type { AppView } from '../types/view';
import { canAccess, getPrimaryRole, normalizeRoles, type ClinicRole } from '../utils/roles';

const ENCOUNTER_SESSION_KEY = 'clinic:active-encounter-appointment';

function initialEncounterId(): string | null {
  try {
    return sessionStorage.getItem(ENCOUNTER_SESSION_KEY);
  } catch {
    return null;
  }
}

export default function App() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [staffDashboard, setStaffDashboard] = useState<StaffDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const [encounterAppointmentId, setEncounterAppointmentId] = useState<string | null>(initialEncounterId);
  const [receptionBookingPatient, setReceptionBookingPatient] = useState<ReceptionPatientResponse | null>(null);
  const requestId = useRef(0);

  function persistEncounter(id: string | null) {
    setEncounterAppointmentId(id);
    try {
      if (id) sessionStorage.setItem(ENCOUNTER_SESSION_KEY, id);
      else sessionStorage.removeItem(ENCOUNTER_SESSION_KEY);
    } catch {
      // Session persistence is optional; server state remains authoritative.
    }
  }

  async function loadSession() {
    const currentRequest = ++requestId.current;
    if (!getAccessToken()) {
      setUser(null);
      setDashboard(null);
      setStaffDashboard(null);
      setReceptionBookingPatient(null);
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
      setStaffDashboard(null);
      const roles = normalizeRoles(currentUser.roles);
      const role = getPrimaryRole(roles);
      if (role !== 'DOCTOR') persistEncounter(null);
      if (role !== 'ADMIN' && role !== 'RECEPTIONIST') setReceptionBookingPatient(null);
      // The gateway /dashboard/me aggregates patient-only endpoints. Staff use
      // their own role-authorized appointment and queue controllers instead.
      if (role === 'PATIENT') {
        try {
          const result = await getDashboard();
          if (currentRequest === requestId.current) setDashboard(result);
        } catch (cause) {
          if (currentRequest === requestId.current) setError(errorMessage(cause));
        }
      } else if (role) {
        try {
          const result = await loadStaffDashboard(role);
          if (currentRequest === requestId.current) setStaffDashboard(result);
        } catch (cause) {
          if (currentRequest === requestId.current) setError(errorMessage(cause));
        }
      }
    } catch (cause) {
      if (currentRequest === requestId.current) {
        setUser(null);
        setDashboard(null);
        setStaffDashboard(null);
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
    setStaffDashboard(null);
    persistEncounter(null);
    setReceptionBookingPatient(null);
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
      setStaffDashboard(null);
      persistEncounter(null);
      setReceptionBookingPatient(null);
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
  const allowedView = canAccess(activeView, [activeRole]) ? activeView : 'dashboard';

  function navigate(view: AppView) {
    if (canAccess(view, [activeRole])) setActiveView(view);
  }

  function openEncounter(visit: ReceptionVisitResponse) {
    if (activeRole !== 'DOCTOR') return;
    persistEncounter(visit.appointmentId);
    setActiveView('encounter');
  }

  function bookReceptionPatient(patient: ReceptionPatientResponse) {
    if (activeRole !== 'RECEPTIONIST' && activeRole !== 'ADMIN') return;
    setReceptionBookingPatient(patient);
    setActiveView('appointments');
  }

  function completeEncounterNavigation() {
    persistEncounter(null);
  }

  return (
    <AppShell activeItemId={allowedView} user={user} loading={loading} primaryRole={primaryRole}
      onNavigate={navigate} onRefresh={() => void loadSession()} onLogout={() => void handleLogout()}>
      {renderView(
        allowedView,
        user,
        dashboard,
        staffDashboard,
        error,
        loading,
        primaryRole,
        () => void loadSession(),
        navigate,
        encounterAppointmentId,
        openEncounter,
        completeEncounterNavigation,
        receptionBookingPatient,
        bookReceptionPatient,
        () => setReceptionBookingPatient(null)
      )}
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
  staffDashboard: StaffDashboard | null,
  error: string | null,
  loading: boolean,
  role: ClinicRole,
  refresh: () => void,
  navigate: (view: AppView) => void,
  encounterAppointmentId: string | null,
  openEncounter: (visit: ReceptionVisitResponse) => void,
  clearEncounter: () => void,
  receptionBookingPatient: ReceptionPatientResponse | null,
  bookReceptionPatient: (patient: ReceptionPatientResponse) => void,
  clearReceptionBookingPatient: () => void
) {
  switch (activeView) {
    case 'appointments':
      return <AppointmentsPage appointments={role === 'PATIENT' ? dashboard?.appointments : null}
        role={role} error={role === 'PATIENT' ? error : null} loading={loading} onRefresh={refresh}
        onOpenEncounter={role === 'DOCTOR' ? openEncounter : undefined}
        preselectedReceptionPatient={role === 'RECEPTIONIST' || role === 'ADMIN' ? receptionBookingPatient : null}
        onReceptionPatientConsumed={clearReceptionBookingPatient} />;
    case 'encounter':
      return role === 'DOCTOR'
        ? <DoctorEncounterWorkspace appointmentId={encounterAppointmentId}
            onBack={() => navigate('appointments')}
            onCompleted={() => { clearEncounter(); refresh(); navigate('appointments'); }} />
        : <Alert tone="error">Không có quyền truy cập không gian khám.</Alert>;
    case 'patients':
      return <PatientsPage role={role} user={user}
        onBookPatient={role === 'RECEPTIONIST' || role === 'ADMIN' ? bookReceptionPatient : undefined} />;
    case 'doctors':
      return <DoctorsPage role={role} onNavigate={navigate} />;
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
      return <NotificationsPage key={(user.id ?? user.userId ?? user.email) + ':' + role} role={role} />;
    case 'settings':
      return <SettingsPage user={user} role={role} />;
    case 'dashboard':
    default:
      return <DashboardPage dashboard={dashboard} staffDashboard={staffDashboard} user={user} role={role}
        error={error} loading={loading} onRefresh={refresh} onNavigate={navigate}
        onOpenEncounter={role === 'DOCTOR' ? openEncounter : undefined} />;
  }
}
