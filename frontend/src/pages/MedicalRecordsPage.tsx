import Alert from '../components/Alert';
import PageHeader from '../components/PageHeader';
import type { MedicalRecordResponse } from '../types/domain';
import type { AppView } from '../types/view';
import type { ClinicRole } from '../utils/roles';
import { integrations } from '../config/integrations.config';
import DoctorMedicalRecordsWorkspace from './DoctorMedicalRecordsWorkspace';
import PatientMedicalRecordsWorkspace from './PatientMedicalRecordsWorkspace';

type MedicalRecordsPageProps = {
  records: MedicalRecordResponse[] | null | undefined;
  role: ClinicRole;
  error: string | null;
  loading: boolean;
  onRefresh: () => void;
  onNavigate?: (view: AppView) => void;
};

export default function MedicalRecordsPage({ records, role, error, loading, onRefresh, onNavigate }: MedicalRecordsPageProps) {
  // Doctors author records inside the active encounter. This page is for authorized history lookup.
  if (role !== 'PATIENT' && role !== 'DOCTOR') {
    return <Alert tone="error">Trang hồ sơ bệnh án dành cho bệnh nhân và bác sĩ điều trị.</Alert>;
  }
  if (role === 'DOCTOR' && !integrations.laboratory) {
    return <><PageHeader title="Hồ sơ bệnh án" subtitle="Hồ sơ của bác sĩ điều trị" />
      <Alert tone="info">Tra cứu hồ sơ bác sĩ hiện chưa khả dụng.</Alert></>;
  }
  if (role === 'DOCTOR') return <DoctorMedicalRecordsWorkspace onNavigate={onNavigate} />;
  return <PatientMedicalRecordsWorkspace records={records} error={error} loading={loading} onRefresh={onRefresh} />;
}