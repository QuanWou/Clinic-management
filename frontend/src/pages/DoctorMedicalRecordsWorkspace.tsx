import { type FormEvent, useRef, useState } from 'react';
import {
  ArrowRight, CalendarCheck2, CheckCircle2, ChevronLeft, ChevronRight, ClipboardPlus,
  ClipboardList, Clock3, FileCheck2, FileText, HeartPulse, Info, LockKeyhole, Pill,
  RefreshCw, Search, ShieldCheck, Stethoscope, UserRound, X
} from 'lucide-react';
import { createMedicalRecord, getAppointment, getPatientMedicalRecords } from '../api/clinic';
import Alert from '../components/Alert';
import PageHeader from '../components/PageHeader';
import type { AppointmentResponse, MedicalRecordResponse } from '../types/domain';
import { filterDoctorMedicalRecords, medicalRecordsSummary, validClinicUuid } from '../utils/doctorMedicalRecords';
import { formatDate, formatTime, shortId } from '../utils/format';
import LabOrdersPanel from './LabOrdersPanel';
import './doctorMedicalRecords.css';

const PAGE_SIZE = 8;
const emptyDraft = { symptoms: '', diagnosis: '', notes: '' };
const errorText = (cause: unknown) => cause instanceof Error ? cause.message : 'Không thể thực hiện yêu cầu. Vui lòng thử lại.';

/** All queries in this view are scoped by the backend to the treating doctor. */
export default function DoctorMedicalRecordsWorkspace() {
  const [patientInput, setPatientInput] = useState('');
  const [patientId, setPatientId] = useState('');
  const [records, setRecords] = useState<MedicalRecordResponse[] | null>(null);
  const [listScope, setListScope] = useState<'patient' | 'new-only'>('patient');
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [appointmentId, setAppointmentId] = useState('');
  const [verifiedAppointment, setVerifiedAppointment] = useState<AppointmentResponse | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [acknowledged, setAcknowledged] = useState(false);
  const [saving, setSaving] = useState(false);
  const requestId = useRef(0);
  const verifyId = useRef(0);

  async function searchPatient(event?: FormEvent<HTMLFormElement>, suppliedId?: string) {
    event?.preventDefault();
    const id = (suppliedId ?? patientInput).trim().toLowerCase();
    const current = ++requestId.current;
    setRecords(null); setSelectedId(''); setPatientId(''); setListError(null); setNotice(null); setFilter(''); setPage(1);
    if (!validClinicUuid(id)) { setListError('Nhập mã UUID bệnh nhân hợp lệ do phòng khám cung cấp.'); return; }
    setPatientInput(id); setLoading(true);
    try {
      const result = await getPatientMedicalRecords(id);
      if (!Array.isArray(result) || result.some((record) => record.patientId !== id || !record.id || !record.appointmentId)) {
        throw new Error('Máy chủ trả dữ liệu không khớp bệnh nhân đang tra cứu.');
      }
      if (current !== requestId.current) return;
      setPatientId(id); setRecords(result); setListScope('patient');
      setSelectedId(result[0]?.id ?? '');
    } catch (cause) {
      if (current === requestId.current) setListError(errorText(cause));
    } finally { if (current === requestId.current) setLoading(false); }
  }

  function openCreation() {
    setShowCreate((value) => !value); setCreateError(null); setNotice(null);
    ++verifyId.current;
    setVerifiedAppointment(null); setAppointmentId(''); setDraft(emptyDraft); setAcknowledged(false);
  }

  async function verifyAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = appointmentId.trim().toLowerCase();
    const current = ++verifyId.current;
    setVerifiedAppointment(null); setCreateError(null); setAcknowledged(false);
    if (!validClinicUuid(id)) { setCreateError('Nhập UUID lịch hẹn hợp lệ.'); return; }
    setVerifying(true);
    try {
      // GET /api/appointments/{id} checks assigned-doctor ownership server-side.
      const appointment = await getAppointment(id);
      if (appointment.id !== id || !appointment.patientId || !appointment.doctorId) {
        throw new Error('Thông tin lịch hẹn máy chủ trả về không hợp lệ.');
      }
      if (appointment.status !== 'COMPLETED') {
        throw new Error('Lịch hẹn chưa hoàn tất. Chỉ tạo bệnh án sau khi hoàn tất khám.');
      }
      if (current === verifyId.current) { setAppointmentId(id); setVerifiedAppointment(appointment); }
    } catch (cause) { if (current === verifyId.current) setCreateError(errorText(cause)); }
    finally { if (current === verifyId.current) setVerifying(false); }
  }

  async function saveRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const appointment = verifiedAppointment;
    if (!appointment || appointment.status !== 'COMPLETED' || !acknowledged || !draft.diagnosis.trim() || saving) {
      setCreateError('Xác minh lịch đã hoàn tất, nhập chẩn đoán và xác nhận trước khi lưu.'); return;
    }
    setSaving(true); setCreateError(null); setNotice(null);
    try {
      // The backend rechecks the doctor, completed appointment and uniqueness at write time.
      const created = await createMedicalRecord({ appointmentId: appointment.id,
        diagnosis: draft.diagnosis.trim(), symptoms: draft.symptoms.trim(), notes: draft.notes.trim(), prescriptionItems: [] });
      if (!created.id || created.appointmentId !== appointment.id || created.patientId !== appointment.patientId
        || created.doctorId !== appointment.doctorId || !created.diagnosis) {
        throw new Error('Máy chủ chưa xác nhận bệnh án đúng lịch hẹn. Vui lòng kiểm tra lại, không gửi lặp.');
      }
      // Clear existing patient results before switching to another patient's sensitive data.
      ++requestId.current;
      setRecords(null); setSelectedId(''); setPatientId(''); setListError(null); setFilter(''); setPage(1);
      setPatientInput(created.patientId);
      setShowCreate(false); setVerifiedAppointment(null); setAppointmentId('');
      setDraft(emptyDraft); setAcknowledged(false);
      try {
        const fetched = await getPatientMedicalRecords(created.patientId);
        if (!Array.isArray(fetched) || fetched.some((record) => record.patientId !== created.patientId)
          || !fetched.some((record) => record.id === created.id)) {
          throw new Error('Danh sách tải lại không xác nhận bệnh án vừa tạo.');
        }
        setRecords(fetched); setListScope('patient');
        setNotice('Bệnh án đã lưu và danh sách bệnh án được máy chủ tải lại thành công.');
      } catch {
        // Show only the confirmed created record, never pretend the whole patient history loaded.
        setRecords([created]); setListScope('new-only');
        setNotice('Máy chủ đã xác nhận tạo bệnh án. Chưa tải lại được lịch sử; chỉ hiển thị bệnh án vừa tạo.');
      }
      setPatientId(created.patientId); setSelectedId(created.id);
    } catch (cause) { setCreateError(errorText(cause)); }
    finally { setSaving(false); }
  }

  const filtered = filterDoctorMedicalRecords(records ?? [], filter);
  const numberOfPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, numberOfPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selected = records?.find((record) => record.id === selectedId) ?? null;
  const summary = records ? medicalRecordsSummary(records) : null;

  return <div className="doctor-records" aria-label="Hồ sơ bệnh án được phân công cho bác sĩ">
    <PageHeader title="Hồ sơ bệnh án" subtitle="Tra cứu, lập bệnh án và quản lý chỉ định theo phạm vi bác sĩ điều trị"
      actions={<button type="button" onClick={openCreation} disabled={saving || verifying} className={showCreate ? 'soft-button' : undefined}>
        {showCreate ? <X size={17} /> : <ClipboardPlus size={17} />}{showCreate ? 'Đóng biểu mẫu' : 'Tạo bệnh án'}</button>} />

    <section className="doctor-records-hero"><div>
      <span className="doctor-records-kicker"><HeartPulse size={16} /> HỒ SƠ ĐIỀU TRỊ · RIÊNG TƯ</span>
      <h3>Thông tin y khoa, đúng người điều trị.</h3>
      <p>Tra cứu bệnh án theo mã bệnh nhân được cung cấp, theo dõi chẩn đoán, đơn thuốc và xét nghiệm từ dữ liệu phòng khám.</p>
      <span className="doctor-records-hero-chip"><LockKeyhole size={15} /> Chỉ hồ sơ được backend cấp quyền</span>
    </div><span className="doctor-records-hero-icon" aria-hidden="true"><FileCheck2 size={64} strokeWidth={1.35} /></span></section>

    {notice && <Alert tone="info">{notice}</Alert>}

    {showCreate && <section className="panel doctor-records-create" aria-label="Tạo bệnh án mới">
      <div className="doctor-records-section-head"><div><span>HỒ SƠ MỚI</span><h3>Lập bệnh án sau khi hoàn tất khám</h3>
        <p>Xác minh lịch hẹn đã hoàn tất trước khi nhập nội dung chẩn đoán.</p></div><ShieldCheck size={25} aria-hidden="true" /></div>
      {createError && <Alert tone="error">{createError}</Alert>}
      <div className="doctor-records-steps"><span className="active">1 · Xác minh lịch</span><span className={verifiedAppointment ? 'active' : ''}>2 · Nhập bệnh án</span><span>3 · Lưu hồ sơ</span></div>
      <form className="doctor-records-verify" onSubmit={(event) => void verifyAppointment(event)}>
        <label htmlFor="doctor-records-appointment">Mã lịch hẹn UUID</label>
        <div><input id="doctor-records-appointment" required value={appointmentId} disabled={saving || verifying}
          placeholder="Mã lịch hẹn do phòng khám cung cấp" onChange={(event) => {
            ++verifyId.current; setAppointmentId(event.target.value); setVerifiedAppointment(null); setCreateError(null); setAcknowledged(false);
          }} />
          <button type="submit" disabled={saving || verifying || !appointmentId.trim()}>{verifying ? 'Đang kiểm tra...' : 'Kiểm tra lịch'}</button></div>
      </form>
      {verifiedAppointment && <><div className="doctor-records-verified" role="status"><CheckCircle2 size={20} />
        <div><strong>Lịch hẹn đã hoàn tất, được cấp quyền truy cập</strong>
          <span>BN #{shortId(verifiedAppointment.patientId)} · {formatDate(verifiedAppointment.appointmentDate)} · {formatTime(verifiedAppointment.startTime)}–{formatTime(verifiedAppointment.endTime)}</span></div></div>
        <form className="doctor-records-create-fields" onSubmit={(event) => void saveRecord(event)}>
          <label>Chẩn đoán <span className="doctor-records-required">*</span>
            <textarea required maxLength={4000} rows={3} placeholder="Nhập chẩn đoán được bác sĩ xác định..." value={draft.diagnosis}
              onChange={(event) => setDraft({ ...draft, diagnosis: event.target.value })} disabled={saving} /></label>
          <label>Triệu chứng
            <textarea maxLength={4000} rows={3} placeholder="Triệu chứng theo đánh giá lâm sàng..." value={draft.symptoms}
              onChange={(event) => setDraft({ ...draft, symptoms: event.target.value })} disabled={saving} /></label>
          <label>Ghi chú điều trị
            <textarea maxLength={4000} rows={3} placeholder="Ghi chú của bác sĩ..." value={draft.notes}
              onChange={(event) => setDraft({ ...draft, notes: event.target.value })} disabled={saving} /></label>
          <p className="doctor-records-form-note"><Info size={16} /> Biểu mẫu này không phát sinh đơn thuốc. Chỉ định xét nghiệm được tạo sau khi bệnh án được máy chủ lưu.</p>
          <label className="doctor-records-ack"><input type="checkbox" checked={acknowledged} disabled={saving}
            onChange={(event) => setAcknowledged(event.target.checked)} /> Tôi đã kiểm tra nội dung và xác nhận lập bệnh án cho đúng lịch khám.</label>
          <button type="submit" disabled={saving || !acknowledged || !draft.diagnosis.trim()}><FileCheck2 size={17} /> {saving ? 'Đang lưu...' : 'Lưu bệnh án'}</button>
        </form>
      </>}
    </section>}

    <section className="panel doctor-records-search" aria-label="Tra cứu bệnh án theo bệnh nhân">
      <div className="doctor-records-section-head"><div><span>TRA CỨU BỆNH ÁN</span><h3>Tìm bệnh án theo mã bệnh nhân</h3>
        <p>Chỉ hiển thị bệnh án do bác sĩ đang đăng nhập điều trị; không có API danh sách toàn phòng khám.</p></div>
        {patientId && <button type="button" className="soft-button doctor-records-refresh" disabled={loading || saving} onClick={() => void searchPatient(undefined, patientId)}><RefreshCw size={16} /> Làm mới</button>}</div>
      <form className="doctor-records-search-form" onSubmit={(event) => void searchPatient(event)}>
        <label><Search size={19} aria-hidden="true" /><span className="doctor-records-sr-only">Patient UUID</span>
          <input required aria-label="Patient UUID" placeholder="Nhập mã UUID bệnh nhân..." value={patientInput}
            disabled={loading || saving} onChange={(event) => setPatientInput(event.target.value)} /></label>
        <button type="submit" disabled={loading || saving || !patientInput.trim()}>{loading ? 'Đang tải...' : 'Tra cứu hồ sơ'} <ArrowRight size={16} /></button></form>
      {listError && <Alert tone="error">{listError}</Alert>}
      {loading && <p role="status" className="doctor-records-loading">Đang tải các bệnh án được cấp quyền...</p>}
      {!loading && records === null && !listError && <div className="doctor-records-intro"><Search size={29} aria-hidden="true" />
        <strong>Chưa có bệnh nhân được tra cứu</strong><p>Nhập mã bệnh nhân được phòng khám cung cấp để xem hồ sơ được cấp quyền. Không có dữ liệu mẫu.</p></div>}
      {records !== null && <><div className="doctor-records-scope"><ShieldCheck size={16} />
        {listScope === 'new-only' ? 'Chỉ hiển thị bệnh án vừa tạo; chưa tải đầy đủ lịch sử.' : `Kết quả API cho BN #${shortId(patientId)} · ${records.length} bệnh án được cấp quyền`}</div>
        <div className="doctor-records-metrics" aria-label="Thống kê trong kết quả đã tải">
          {[{ label: 'Bệnh án đã tải', value: summary!.count.toLocaleString('vi-VN'), hint: 'Chỉ trong phạm vi đã trả về', icon: FileText, tone: 'blue' },
            { label: 'Lịch khám liên kết', value: summary!.appointmentCount.toLocaleString('vi-VN'), hint: 'Mã lịch hẹn duy nhất', icon: CalendarCheck2, tone: 'green' },
            { label: 'Đơn thuốc đã ghi', value: summary!.prescriptionCount.toLocaleString('vi-VN'), hint: 'Chỉ đơn có trong bệnh án', icon: Pill, tone: 'purple' },
            { label: 'Bệnh án mới nhất', value: summary!.latestDate ? formatDate(summary!.latestDate) : '—', hint: 'Ngày tạo từ API', icon: Clock3, tone: 'orange' }]
            .map(({ label, value, hint, icon: Icon, tone }) => <article className={`doctor-records-metric doctor-records-metric-${tone}`} key={label}>
              <span className="doctor-records-metric-icon"><Icon size={21} aria-hidden="true" /></span><strong>{value}</strong><h4>{label}</h4><p>{hint}</p></article>)}</div>
      </>}
    </section>

    {records !== null && <section className="doctor-records-content">
      <article className="panel doctor-records-directory" aria-label="Danh sách bệnh án được cấp quyền">
        <div className="doctor-records-section-head"><div><span>DANH SÁCH HỒ SƠ</span><h3>Bệnh án của bệnh nhân</h3>
          <p>{filtered.length} / {records.length} bệnh án phù hợp</p></div><span className="doctor-records-api"><ShieldCheck size={15} /> API theo quyền bác sĩ</span></div>
        <label className="doctor-records-filter"><Search size={16} aria-hidden="true" /><span className="doctor-records-sr-only">Tìm trong kết quả bệnh án</span>
          <input type="search" aria-label="Tìm trong kết quả bệnh án" placeholder="Mã hồ sơ, lịch hẹn hoặc chẩn đoán..." value={filter}
            onChange={(event) => { setFilter(event.target.value); setPage(1); }} /></label>
        {filtered.length > 0 ? <><div className="doctor-records-table-scroll" tabIndex={0} aria-label="Danh sách bệnh án có thể cuộn ngang">
          <table className="doctor-records-table"><thead><tr><th scope="col">Hồ sơ</th><th scope="col">Lịch hẹn</th><th scope="col">Ngày tạo</th><th scope="col">Thao tác</th></tr></thead>
            <tbody>{visible.map((record) => <tr key={record.id} className={record.id === selectedId ? 'selected' : undefined}>
              <td><div className="doctor-records-record"><span><FileText size={19} /></span><div><strong>BA #{shortId(record.id)}</strong>
                <small>{record.diagnosis}</small></div></div></td>
              <td className="doctor-records-id">{shortId(record.appointmentId)}</td><td>{formatDate(record.createdAt)}</td>
              <td><button type="button" className="doctor-records-row-action" onClick={() => setSelectedId(record.id)}>Chi tiết <ArrowRight size={14} /></button></td>
            </tr>)}</tbody></table></div>
          {filtered.length > PAGE_SIZE && <nav className="doctor-records-pagination" aria-label="Phân trang bệnh án"><span>Hiển thị {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} / {filtered.length}</span>
            <div><button type="button" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={15} /> Trước</button><span>Trang {currentPage}/{numberOfPages}</span>
              <button type="button" disabled={currentPage >= numberOfPages} onClick={() => setPage((value) => Math.min(numberOfPages, value + 1))}>Sau <ChevronRight size={15} /></button></div></nav>}
        </> : <div className="doctor-records-empty" role="status">{records.length ? 'Không tìm thấy hồ sơ khớp bộ lọc.' : 'Bác sĩ chưa có bệnh án được cấp quyền cho bệnh nhân này.'}</div>}
        <p className="doctor-records-data-note"><Info size={15} /> Số liệu chỉ tính trên các bản ghi đã tải, không đại diện toàn phòng khám.</p>
      </article>

      <aside className="panel doctor-records-detail" aria-label="Chi tiết bệnh án">
        <div className="doctor-records-section-head"><div><span>THÔNG TIN ĐIỀU TRỊ</span><h3>{selected ? `Bệnh án #${shortId(selected.id)}` : 'Chọn bệnh án'}</h3>
          <p>{selected ? `Được tạo ${formatDate(selected.createdAt)}` : 'Chọn một mục trong danh sách bên trái'}</p></div>
          {selected && <button type="button" className="soft-button" onClick={() => setSelectedId('')} aria-label="Đóng chi tiết"><X size={16} /></button>}</div>
        {!selected ? <div className="doctor-records-detail-empty"><ClipboardList size={33} aria-hidden="true" /><strong>Thông tin bệnh án</strong>
          <p>Chọn hồ sơ để xem chẩn đoán, triệu chứng, ghi chú và đơn thuốc đã ghi nhận.</p></div> : <>
          <div className="doctor-records-detail-status"><CheckCircle2 size={16} /> Bệnh án đã được lưu bởi hệ thống</div>
          <dl className="doctor-records-detail-grid">
            <div><dt><FileText size={15} /> Mã bệnh án</dt><dd>{selected.id}</dd></div>
            <div><dt><UserRound size={15} /> Mã bệnh nhân</dt><dd>{selected.patientId}</dd></div>
            <div><dt><CalendarCheck2 size={15} /> Mã lịch khám</dt><dd>{selected.appointmentId}</dd></div>
            <div><dt><Stethoscope size={15} /> Mã bác sĩ</dt><dd>{selected.doctorId}</dd></div>
          </dl>
          <section className="doctor-records-clinical"><h4><HeartPulse size={17} /> Chẩn đoán</h4><p>{selected.diagnosis}</p></section>
          <section className="doctor-records-clinical"><h4><ClipboardList size={17} /> Triệu chứng</h4><p>{selected.symptoms || 'Chưa ghi nhận triệu chứng.'}</p></section>
          <section className="doctor-records-clinical"><h4><FileText size={17} /> Ghi chú điều trị</h4><p>{selected.notes || 'Chưa có ghi chú.'}</p></section>
          <section className="doctor-records-prescriptions"><h4><Pill size={17} /> Đơn thuốc đã ghi nhận</h4>
            {!selected.prescriptions?.length ? <p>Chưa có đơn thuốc trong bệnh án này.</p> : selected.prescriptions.map((prescription) =>
              <article key={prescription.id} className="doctor-records-prescription"><strong>Đơn #{shortId(prescription.id)} · {formatDate(prescription.createdAt)}</strong>
                {prescription.items.map((item) => <div key={item.id}><strong>{item.medicineName}</strong>
                  <span>{item.dosage} · {item.frequency} · {item.duration}{item.note ? ` · ${item.note}` : ''}</span></div>)}
              </article>)}</section>
        </>}
      </aside>
    </section>}
    {selected && <section className="doctor-records-lab" aria-label="Chỉ định và kết quả xét nghiệm của bệnh án">
      <div className="doctor-records-section-head"><div><span>THEO DÕI CẬN LÂM SÀNG</span><h3>Xét nghiệm theo bệnh án #{shortId(selected.id)}</h3>
        <p>Giữ nguyên luồng xét nghiệm và quyền công bố kết quả do backend kiểm tra.</p></div></div>
      <LabOrdersPanel key={selected.id} record={selected} doctor />
    </section>}
  </div>;
}
