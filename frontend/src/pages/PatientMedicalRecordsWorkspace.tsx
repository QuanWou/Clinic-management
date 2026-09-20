import { useState } from 'react';
import { ClipboardList, FileText, HeartPulse, RefreshCw, ShieldCheck, Stethoscope } from 'lucide-react';
import Alert from '../components/Alert';
import PageHeader from '../components/PageHeader';
import type { MedicalRecordResponse } from '../types/domain';
import { formatDate, shortId } from '../utils/format';
import LabOrdersPanel from './LabOrdersPanel';
import './patientPortal.css';

/** Records come only from /dashboard/me for the current patient; no staff search or mutation endpoints. */
export default function PatientMedicalRecordsWorkspace({ records, error, loading, onRefresh }: {
  records: MedicalRecordResponse[] | null | undefined; error: string | null; loading: boolean; onRefresh: () => void;
}) {
  const [selectedId, setSelectedId] = useState('');
  const rows = [...(records ?? [])].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  const selected = rows.find((item) => item.id === selectedId) ?? rows[0] ?? null;
  const prescriptions = rows.reduce((total, record) => total + (record.prescriptions?.length ?? 0), 0);
  return <div className="patient-portal" aria-label="Bệnh án bệnh nhân"><PageHeader title="Hồ sơ bệnh án của tôi" subtitle="Xem chẩn đoán, chỉ định và đơn thuốc trong hồ sơ cá nhân"
    actions={<button type="button" disabled={loading} className="soft-button" onClick={onRefresh}><RefreshCw size={16} /> Làm mới</button>} />
    <section className="patient-hero"><div><span className="patient-kicker"><ShieldCheck size={15} /> BỆNH ÁN CÁ NHÂN · RIÊNG TƯ</span><h3>Lưu giữ hành trình chăm sóc sức khỏe.</h3>
      <p>Chỉ hiển thị bệnh án thuộc tài khoản bệnh nhân. Kết quả xét nghiệm chỉ xuất hiện khi đã được công bố.</p><div className="patient-hero-tags"><span><FileText size={15} /> {rows.length} hồ sơ</span><span><ClipboardList size={15} /> {prescriptions} đơn thuốc</span></div></div><HeartPulse size={64} aria-hidden="true" /></section>
    {error && <Alert tone="error">{error} <button type="button" disabled={loading} onClick={onRefresh}>Thử lại</button></Alert>}
    {loading && <p role="status">Đang tải bệnh án cá nhân...</p>}
    {!loading && !error && records == null && <Alert tone="info">Chưa tải được dữ liệu bệnh án, vui lòng làm mới.</Alert>}
    <div className="patient-two-columns"><section className="panel patient-panel"><div className="patient-section-head"><div><span>DANH SÁCH BỆNH ÁN</span><h3>Lần khám được ghi nhận</h3><p>{rows.length} hồ sơ từ API.</p></div><FileText size={22} /></div>
      {!loading && records != null && rows.length === 0 && <div className="patient-empty"><FileText size={29} /><strong>Chưa có hồ sơ bệnh án.</strong><p>Hồ sơ sẽ được hiển thị sau khi bác sĩ hoàn tất và ghi nhận lần khám.</p></div>}
      <div className="patient-worklist">{rows.map((record) => <button type="button" key={record.id} className={selected?.id === record.id ? 'is-active' : ''} aria-pressed={selected?.id === record.id} onClick={() => setSelectedId(record.id)}>
        <span className="patient-row-icon"><ClipboardList size={19} /></span><div><strong>{formatDate(record.createdAt)}</strong><small>Bệnh án #{shortId(record.id)} · Bác sĩ #{shortId(record.doctorId)}</small></div></button>)}</div></section>
      <aside className="panel patient-panel"><div className="patient-section-head"><div><span>THÔNG TIN KHÁM</span><h3>Chi tiết bệnh án</h3><p>Chỉ xem dữ liệu được bác sĩ ghi nhận.</p></div><Stethoscope size={22} /></div>
        {!selected ? <div className="patient-empty"><FileText size={27} /><strong>Chọn hồ sơ để xem thông tin</strong></div> : <><dl className="patient-fields"><div><dt>Mã bệnh án</dt><dd>{selected.id}</dd></div>
          <div><dt>Ngày tạo</dt><dd>{formatDate(selected.createdAt)}</dd></div><div><dt>Mã lịch khám</dt><dd>{selected.appointmentId}</dd></div><div><dt>Bác sĩ</dt><dd>#{shortId(selected.doctorId)}</dd></div>
          <div className="patient-field-wide"><dt>Chẩn đoán</dt><dd>{selected.diagnosis || 'Chưa được ghi nhận'}</dd></div>
          <div className="patient-field-wide"><dt>Triệu chứng</dt><dd>{selected.symptoms || 'Chưa được ghi nhận'}</dd></div>
          <div className="patient-field-wide"><dt>Ghi chú của bác sĩ</dt><dd>{selected.notes || 'Chưa có ghi chú'}</dd></div></dl>
          <div className="patient-section-head" style={{ marginTop: '1.5rem' }}><div><span>ĐƠN THUỐC</span><h3>Đơn thuốc đã ghi nhận</h3></div></div>
          {!selected.prescriptions?.length && <p className="patient-details-copy">Chưa có đơn thuốc trong bệnh án này.</p>}
          {selected.prescriptions?.map((prescription) => <div className="patient-doctor-card" key={prescription.id} style={{ marginBottom: '.7rem' }}>
            <strong>Đơn #{shortId(prescription.id)} · {formatDate(prescription.createdAt)}</strong>
            {!prescription.items.length && <p>Chưa có thuốc được ghi nhận.</p>}
            {prescription.items.map((item) => <p key={item.id} className="patient-details-copy"><strong>{item.medicineName}</strong>: {item.dosage} · {item.frequency} · {item.duration}{item.note ? ` · ${item.note}` : ''}</p>)}
          </div>)}
        </>}
      </aside></div>
    {selected && <section className="panel patient-panel"><div className="patient-section-head"><div><span>XÉT NGHIỆM</span><h3>Kết quả được công bố</h3><p>Chỉ hiển thị kết quả xét nghiệm đã được phát hành cho bệnh nhân.</p></div><ShieldCheck size={22} /></div>
      <LabOrdersPanel key={selected.id} record={selected} doctor={false} /></section>}
  </div>;
}