import { type FormEvent, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { createMedicalRecord, getPatientMedicalRecords } from '../api/clinic';
import Alert from '../components/Alert';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import PageHeader from '../components/PageHeader';
import type { MedicalRecordResponse } from '../types/domain';
import type { ClinicRole } from '../utils/roles';
import { formatDate, shortId } from '../utils/format';
import { getUiMedicalRecords } from '../utils/uiData';
import { integrations } from '../config/integrations.config';
import LabOrdersPanel from './LabOrdersPanel';
import DoctorMedicalRecordsWorkspace from './DoctorMedicalRecordsWorkspace';
import PatientMedicalRecordsWorkspace from './PatientMedicalRecordsWorkspace';

type MedicalRecordsPageProps = {
  records: MedicalRecordResponse[] | null | undefined;
  role: ClinicRole;
  error: string | null;
  loading: boolean;
  onRefresh: () => void;
};

export default function MedicalRecordsPage({ records, role, error, loading, onRefresh }: MedicalRecordsPageProps) {
  // Defense in depth: the view must never expose records to administrative staff.
  // Task 04 authorizes only the patient and their treating doctor.
  if (role !== 'PATIENT' && role !== 'DOCTOR') {
    return <Alert tone="error">Medical records are restricted to patients and their authorized treating doctors.</Alert>;
  }
  if (role === 'DOCTOR' && !integrations.laboratory) {
    return <><PageHeader title="Medical Records" subtitle="Treating doctor records" />
      <Alert tone="info">Doctor record lookup is unavailable until Task 04 ownership checks are merged, running and verified.</Alert></>;
  }
  if (role === 'DOCTOR') return <DoctorMedicalRecordsWorkspace />;
  if (role === 'PATIENT') return <PatientMedicalRecordsWorkspace records={records} error={error} loading={loading} onRefresh={onRefresh} />;
  return <AuthorizedMedicalRecordsPage records={records} role={role} error={error} loading={loading} onRefresh={onRefresh} />;
}

function AuthorizedMedicalRecordsPage({ records, role, error, loading, onRefresh }: MedicalRecordsPageProps) {
  const [patientId, setPatientId] = useState('');
  const [staffRecords, setStaffRecords] = useState<MedicalRecordResponse[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newRecord, setNewRecord] = useState({ appointmentId: '', symptoms: '', diagnosis: '', notes: '' });
  const [notice, setNotice] = useState<string | null>(null);
  const isPatient = role === 'PATIENT';
  useEffect(() => { setSelectedId(null); }, [records]);
  const rows = getUiMedicalRecords(isPatient ? records : staffRecords);
  const selected = rows.find((row) => row.id === selectedId) ?? rows[0];

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setQueryError(null); setStaffRecords(null); setSelectedId(null);
    try {
      if (!/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(patientId.trim())) throw new Error('Enter a valid patient UUID.');
      const result = await getPatientMedicalRecords(patientId.trim());
      if (!Array.isArray(result)) throw new Error('Unexpected medical record response');
      setStaffRecords(result);
    } catch (cause) { setQueryError(cause instanceof Error ? cause.message : 'Unable to load medical records'); }
    finally { setBusy(false); }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setQueryError(null); setNotice(null);
    try {
      if (!/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(newRecord.appointmentId)) {
        throw new Error('Appointment UUID is invalid');
      }
      const created = await createMedicalRecord({ ...newRecord, prescriptionItems: [] });
      if (created.appointmentId !== newRecord.appointmentId || !created.id) {
        throw new Error('Medical record creation was not confirmed by the server');
      }
      setStaffRecords((previous) => [created, ...(previous ?? []).filter((record) => record.id !== created.id)]);
      setSelectedId(created.id);
      setNewRecord({ appointmentId: '', symptoms: '', diagnosis: '', notes: '' });
      setNotice('Hồ sơ bệnh án đã được ghi nhận. Chỉ định xét nghiệm có thể tạo phía dưới.');
    } catch (cause) { setQueryError(cause instanceof Error ? cause.message : 'Unable to create medical record'); }
    finally { setBusy(false); }
  }

  return <>
    <PageHeader title="Medical Records" subtitle={isPatient ? 'Your medical records and prescriptions.' : 'Search records by patient ID. The backend enforces record access.'}
      actions={isPatient ? <button type="button" className="soft-button" onClick={onRefresh} disabled={loading}>Refresh</button> : undefined} />
    {error && <Alert tone="error">{error} <button type="button" onClick={onRefresh} disabled={loading}>Retry</button></Alert>}
    {queryError && <Alert tone="error">{queryError}</Alert>}
    {notice && <Alert tone="info">{notice}</Alert>}
    {!isPatient && <form className="panel settings-form" onSubmit={(event) => void create(event)}>
      <h3>Tạo bệnh án sau khi khám hoàn thành</h3>
      <p>Chỉ bác sĩ được phân công có thể tạo bệnh án; backend kiểm tra appointment COMPLETED.</p>
      <label>Appointment UUID<input required value={newRecord.appointmentId} onChange={(event) => setNewRecord({ ...newRecord, appointmentId: event.target.value })} /></label>
      <label>Chẩn đoán<textarea required maxLength={4000} value={newRecord.diagnosis} onChange={(event) => setNewRecord({ ...newRecord, diagnosis: event.target.value })} /></label>
      <label>Triệu chứng<textarea maxLength={4000} value={newRecord.symptoms} onChange={(event) => setNewRecord({ ...newRecord, symptoms: event.target.value })} /></label>
      <label>Ghi chú bác sĩ<textarea maxLength={4000} value={newRecord.notes} onChange={(event) => setNewRecord({ ...newRecord, notes: event.target.value })} /></label>
      <p>Đơn thuốc chỉ được ghi khi đã chọn thuốc từ Catalog qua luồng được kiểm chứng; biểu mẫu này chưa tạo đơn thuốc.</p>
      <button type="submit" disabled={busy || !newRecord.diagnosis.trim()}>Lưu bệnh án</button>
    </form>}
    {!isPatient && <form className="inline-search" onSubmit={(event) => void search(event)}>
      <Search size={16} /><input aria-label="Patient UUID" required placeholder="Patient UUID" value={patientId} onChange={(event) => setPatientId(event.target.value)} />
      <button type="submit" disabled={busy}>Search records</button>
    </form>}
    {loading && isPatient && <p role="status">Loading records...</p>}
    <section className="split-page">
      <article className="panel table-panel">
        {rows.length === 0 && <p>{busy ? 'Loading records...' : !isPatient && !staffRecords ? 'Enter a patient UUID to load records.' : isPatient && !records ? 'No medical record data loaded.' : 'No medical records found.'}</p>}
        {rows.length > 0 && <div className="data-table">
          <div className="table-row table-head records-grid"><span>Patient ID</span><span>Record Type</span><span>Date</span><span>Doctor ID</span><span>Status</span></div>
          {rows.map((record) => <button type="button" className="table-row records-grid" key={record.id} aria-pressed={selected?.id === record.id} onClick={() => setSelectedId(record.id)}>
            <span className="person-cell"><Avatar label={record.patientName} size="sm" />{record.patientName}</span>
            <span>{record.recordType}</span><span>{formatDate(record.createdAt)}</span><span>{record.doctorName}</span>
            <span><Badge tone={record.status}>{record.status}</Badge></span>
          </button>)}
        </div>}
      </article>
      {selected && <article className="panel detail-panel">
        <div className="panel-heading"><h3>{selected.patientName}</h3><Badge tone={selected.status}>{selected.status}</Badge></div>
        <p>Record ID: MR-{shortId(selected.id)}</p>
        <dl className="details-list compact">
          <div><dt>Appointment</dt><dd>{selected.appointmentId}</dd></div>
          <div><dt>Diagnosis</dt><dd>{selected.diagnosis}</dd></div>
          <div><dt>Symptoms</dt><dd>{selected.symptoms ?? 'Not recorded'}</dd></div>
          <div><dt>Doctor notes</dt><dd>{selected.notes ?? 'Not recorded'}</dd></div>
        </dl>
        <h4>Prescriptions</h4>
        {!selected.prescriptions?.length ? <p>No prescriptions recorded.</p> : selected.prescriptions.map((prescription) =>
          <div key={prescription.id}>
            <p>Prescription {shortId(prescription.id)} · {formatDate(prescription.createdAt)}</p>
            <ul>{prescription.items.map((item) => <li key={item.id}>
              <strong>{item.medicineName}</strong> — {item.dosage}, {item.frequency}, {item.duration}{item.note ? ` (${item.note})` : ''}
            </li>)}</ul>
          </div>
        )}
      </article>}
    </section>
    {selected && <LabOrdersPanel key={selected.id} record={selected} doctor={!isPatient} />}
  </>;
}
