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
    return <Alert tone="error">Trang hồ sơ bệnh án dành cho bệnh nhân và bác sĩ điều trị.</Alert>;
  }
  if (role === 'DOCTOR' && !integrations.laboratory) {
    return <><PageHeader title="Hồ sơ bệnh án" subtitle="Hồ sơ của bác sĩ điều trị" />
      <Alert tone="info">Tra cứu hồ sơ bác sĩ hiện chưa khả dụng.</Alert></>;
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
      if (!/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(patientId.trim())) throw new Error('Nhập mã bệnh nhân hợp lệ.');
      const result = await getPatientMedicalRecords(patientId.trim());
      if (!Array.isArray(result)) throw new Error('Dữ liệu bệnh án không hợp lệ.');
      setStaffRecords(result);
    } catch (cause) { setQueryError(cause instanceof Error ? cause.message : 'Không thể tải hồ sơ bệnh án.'); }
    finally { setBusy(false); }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setQueryError(null); setNotice(null);
    try {
      if (!/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(newRecord.appointmentId)) {
        throw new Error('Mã lịch hẹn không hợp lệ.');
      }
      const created = await createMedicalRecord({ ...newRecord, prescriptionItems: [] });
      if (created.appointmentId !== newRecord.appointmentId || !created.id) {
        throw new Error('Chưa xác nhận được việc tạo bệnh án.');
      }
      setStaffRecords((previous) => [created, ...(previous ?? []).filter((record) => record.id !== created.id)]);
      setSelectedId(created.id);
      setNewRecord({ appointmentId: '', symptoms: '', diagnosis: '', notes: '' });
      setNotice('Hồ sơ bệnh án đã được ghi nhận. Chỉ định xét nghiệm có thể tạo phía dưới.');
    } catch (cause) { setQueryError(cause instanceof Error ? cause.message : 'Không thể tạo bệnh án.'); }
    finally { setBusy(false); }
  }

  return <>
    <PageHeader title="Hồ sơ bệnh án" subtitle={isPatient ? 'Hồ sơ bệnh án và đơn thuốc của bạn.' : 'Tra cứu hồ sơ theo mã bệnh nhân.'}
      actions={isPatient ? <button type="button" className="soft-button" onClick={onRefresh} disabled={loading}>Làm mới</button> : undefined} />
    {error && <Alert tone="error">{error} <button type="button" onClick={onRefresh} disabled={loading}>Thử lại</button></Alert>}
    {queryError && <Alert tone="error">{queryError}</Alert>}
    {notice && <Alert tone="info">{notice}</Alert>}
    {!isPatient && <form className="panel settings-form" onSubmit={(event) => void create(event)}>
      <h3>Tạo bệnh án sau khi khám hoàn thành</h3>
      <p>Chỉ bác sĩ được phân công có thể tạo bệnh án sau khi lịch khám hoàn tất.</p>
      <label>Mã lịch hẹn<input required value={newRecord.appointmentId} onChange={(event) => setNewRecord({ ...newRecord, appointmentId: event.target.value })} /></label>
      <label>Chẩn đoán<textarea required maxLength={4000} value={newRecord.diagnosis} onChange={(event) => setNewRecord({ ...newRecord, diagnosis: event.target.value })} /></label>
      <label>Triệu chứng<textarea maxLength={4000} value={newRecord.symptoms} onChange={(event) => setNewRecord({ ...newRecord, symptoms: event.target.value })} /></label>
      <label>Ghi chú bác sĩ<textarea maxLength={4000} value={newRecord.notes} onChange={(event) => setNewRecord({ ...newRecord, notes: event.target.value })} /></label>
      <p>Biểu mẫu này chỉ lưu bệnh án; đơn thuốc được ghi ở bước tiếp theo.</p>
      <button type="submit" disabled={busy || !newRecord.diagnosis.trim()}>Lưu bệnh án</button>
    </form>}
    {!isPatient && <form className="inline-search" onSubmit={(event) => void search(event)}>
      <Search size={16} /><input aria-label="Mã bệnh nhân" required placeholder="Mã bệnh nhân" value={patientId} onChange={(event) => setPatientId(event.target.value)} />
      <button type="submit" disabled={busy}>Tra cứu hồ sơ</button>
    </form>}
    {loading && isPatient && <p role="status">Đang tải hồ sơ bệnh án...</p>}
    <section className="split-page">
      <article className="panel table-panel">
        {rows.length === 0 && <p>{busy ? 'Đang tải hồ sơ...' : !isPatient && !staffRecords ? 'Nhập mã bệnh nhân để tải hồ sơ.' : isPatient && !records ? 'Chưa tải được hồ sơ bệnh án.' : 'Chưa có hồ sơ bệnh án.'}</p>}
        {rows.length > 0 && <div className="data-table">
          <div className="table-row table-head records-grid"><span>Mã bệnh nhân</span><span>Loại hồ sơ</span><span>Ngày tạo</span><span>Mã bác sĩ</span><span>Trạng thái</span></div>
          {rows.map((record) => <button type="button" className="table-row records-grid" key={record.id} aria-pressed={selected?.id === record.id} onClick={() => setSelectedId(record.id)}>
            <span className="person-cell"><Avatar label={record.patientName} size="sm" />{record.patientName}</span>
            <span>{record.recordType}</span><span>{formatDate(record.createdAt)}</span><span>{record.doctorName}</span>
            <span><Badge tone={record.status}>{record.status}</Badge></span>
          </button>)}
        </div>}
      </article>
      {selected && <article className="panel detail-panel">
        <div className="panel-heading"><h3>{selected.patientName}</h3><Badge tone={selected.status}>{selected.status}</Badge></div>
        <p>Mã hồ sơ: MR-{shortId(selected.id)}</p>
        <dl className="details-list compact">
          <div><dt>Lịch hẹn</dt><dd>{selected.appointmentId}</dd></div>
          <div><dt>Chẩn đoán</dt><dd>{selected.diagnosis}</dd></div>
          <div><dt>Triệu chứng</dt><dd>{selected.symptoms ?? 'Chưa ghi nhận'}</dd></div>
          <div><dt>Ghi chú bác sĩ</dt><dd>{selected.notes ?? 'Chưa ghi nhận'}</dd></div>
        </dl>
        <h4>Prescriptions</h4>
        {!selected.prescriptions?.length ? <p>Chưa có đơn thuốc.</p> : selected.prescriptions.map((prescription) =>
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
