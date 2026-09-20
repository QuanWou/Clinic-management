import Alert from '../components/Alert';
import PageHeader from '../components/PageHeader';
import { integrations } from '../config/integrations.config';
import type { ClinicRole } from '../utils/roles';
import type { AppView } from '../types/view';
import AdminDoctorsWorkspace from './AdminDoctorsWorkspace';
import ReceptionDoctorsWorkspace from './ReceptionDoctorsWorkspace';
import PatientDoctorsWorkspace from './PatientDoctorsWorkspace';

export default function DoctorsPage({ role, onNavigate }: { role: ClinicRole; onNavigate?: (view: AppView) => void }) {
  if (role === 'RECEPTIONIST') return <ReceptionDoctorsWorkspace onAppointments={onNavigate ? () => onNavigate('appointments') : undefined} />;
  if (role === 'PATIENT') return <PatientDoctorsWorkspace onAppointments={onNavigate ? () => onNavigate('appointments') : undefined} />;
  if (role !== 'ADMIN') return <Alert tone="error">Doctor directory is not available for this role.</Alert>;
  if (!integrations.adminCatalog) return <>
    <PageHeader title="Doctors" subtitle="Administrator doctor directory" />
    <Alert tone="info">Administrator doctor management is not enabled in this deployment.</Alert>
  </>;
  return <AdminDoctorsWorkspace />;
}
