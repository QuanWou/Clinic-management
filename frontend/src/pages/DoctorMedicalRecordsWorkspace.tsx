import { type FormEvent, useEffect, useRef, useState } from 'react';
import {
  ArrowRight, CalendarCheck2, CheckCircle2, ChevronLeft, ChevronRight, ClipboardPlus,
  ClipboardList, Clock3, FileCheck2, FileText, HeartPulse, Info, LockKeyhole, Pill,
  RefreshCw, Search, ShieldCheck, Stethoscope, UserRound, X
} from 'lucide-react';
import { createMedicalRecord, getAppointment, getDoctorPatientMedicalRecordsByCode, getMyDoctorMedicalRecords, getPatientMedicalRecords, getReceptionQueue } from '../api/clinic';
import { clinicToday } from '../api/staffDashboard';
import Alert from '../components/Alert';
import PageHeader from '../components/PageHeader';
import type { AppointmentResponse, MedicalRecordResponse, PageResponse, ReceptionVisitResponse } from '../types/domain';
import { completedVisitsForRecord, filterDoctorMedicalRecords, medicalRecordsSummary, validClinicUuid } from '../utils/doctorMedicalRecords';
import { shiftClinicDay } from '../utils/doctorAppointments';
import { formatDate, formatTime, shortId } from '../utils/format';
import LabOrdersPanel from './LabOrdersPanel';
import './doctorMedicalRecords.css';

const PAGE_SIZE = 8;
const emptyDraft = { symptoms: '', diagnosis: '', notes: '' };
const errorText = (cause: unknown) => cause instanceof Error ? cause.message : 'Không thể thực hiện yêu cầu. Vui lòng thử lại.';

/** Human-readable identifiers only; UUIDs remain internal foreign keys and are never displayed here. */
export function DoctorRecordIdentity({ record }: { record: MedicalRecordResponse }) {
  return <dl className="doctor-records-detail-grid">
    <div><dt><FileText size={15} aria-hidden="true" /> Mã bệnh án</dt><dd>{record.recordCode || 'Chưa có mã bệnh án'}</dd></div>
    <div><dt><UserRound size={15} aria-hidden="true" /> Bệnh nhân</dt><dd>{record.patientName || 'Chưa đồng bộ tên'}<small>{record.patientCode || 'Chưa có mã BN'}</small></dd></div>
    <div><dt><CalendarCheck2 size={15} aria-hidden="true" /> Lịch khám</dt><dd>{record.appointmentDate ? formatDate(record.appointmentDate) : 'Chưa đồng bộ ngày khám'}<small>{record.startTime ? `${formatTime(record.startTime)}${record.endTime ? ` – ${formatTime(record.endTime)}` : ''}` : 'Chưa đồng bộ giờ khám'}</small></dd></div>
    <div><dt><Stethoscope size={15} aria-hidden="true" /> Bác sĩ điều trị</dt><dd>{record.doctorName || 'Chưa đồng bộ tên'}<small>{record.doctorCode || 'Chưa có mã BS'}</small></dd></div>
  </dl>;
}

/** All queries in this view are scoped by the backend to the treating doctor. */
export default function DoctorMedicalRecordsWorkspace() {
  const [patientInput, setPatientInput] = useState('');
  const [patientId, setPatientId] = useState('');
  const [records, setRecords] = useState<MedicalRecordResponse[] | null>(null);
  const [listScope, setListScope] = useState<'mine' | 'patient' | 'new-only'>('mine');
  const [directoryPage, setDirectoryPage] = useState<PageResponse<MedicalRecordResponse> | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [detailTab, setDetailTab] = useState<'clinical' | 'lab'>('clinical');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [suggestionDate, setSuggestionDate] = useState(clinicToday);
  const [suggestions, setSuggestions] = useState<ReceptionVisitResponse[] | null>(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [suggestionRevision, setSuggestionRevision] = useState(0);
  const [appointmentId, setAppointmentId] = useState('');
  const [verifiedAppointment, setVerifiedAppointment] = useState<AppointmentResponse | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [acknowledged, setAcknowledged] = useState(false);
  const [saving, setSaving] = useState(false);
  const requestId = useRef(0);
  const verifyId = useRef(0);
  const detailDialog = useRef<HTMLDivElement>(null);
  const detailOpener = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    void loadMyRecords(0);
    return () => { requestId.current += 1; };
  }, []);

  useEffect(() => {
    if (!showCreate) return;
    let active = true;
    setSuggestionsLoading(true); setSuggestions(null); setSuggestionsError(null);
    // Backend limits a doctor to their own check-in queue for exactly this date.
    void getReceptionQueue({ date: suggestionDate }).then((visits) => {
      const eligible = completedVisitsForRecord(visits, suggestionDate);
      if (active) setSuggestions(eligible);
    }).catch((cause: unknown) => {
      if (active) setSuggestionsError(errorText(cause));
    }).finally(() => { if (active) setSuggestionsLoading(false); });
    return () => { active = false; };
  }, [showCreate, suggestionDate, suggestionRevision]);

  async function loadMyRecords(nextPage: number) {
    const current = ++requestId.current;
    setLoading(true); setRecords(null); setDirectoryPage(null); setListScope('mine');
    setPatientId(''); setPatientInput(''); setSelectedId(''); setFilter(''); setPage(1);
    setListError(null); setNotice(null);
    try {
      const result = await getMyDoctorMedicalRecords(nextPage, PAGE_SIZE);
      if (!result || !Array.isArray(result.content) || result.number !== nextPage
        || !Number.isInteger(result.totalElements) || !Number.isInteger(result.totalPages)
        || result.content.length > PAGE_SIZE || result.content.some((record) =>
          !record.id || !record.patientId || !record.appointmentId || !record.doctorId)
        || new Set(result.content.map((record) => record.doctorId)).size > 1) {
        throw new Error('Danh sách bệnh án được phân công trả về không hợp lệ.');
      }
      if (current !== requestId.current) return;
      setDirectoryPage(result); setRecords(result.content);
    } catch (cause) {
      if (current === requestId.current) setListError(errorText(cause));
    } finally { if (current === requestId.current) setLoading(false); }
  }

  async function searchPatient(event?: FormEvent<HTMLFormElement>, suppliedId?: string) {
    event?.preventDefault();
    const code = (suppliedId ?? patientInput).trim().toUpperCase();
    const current = ++requestId.current;
    setRecords(null); setDirectoryPage(null); setSelectedId(''); setPatientId(''); setListError(null); setNotice(null); setFilter(''); setPage(1);
    if (!/^BN[0-9]{6,}$/.test(code)) { setLoading(false); setListError('Nhập mã bệnh nhân theo dạng BN000001.'); return; }
    setPatientInput(code); setLoading(true);
    try {
      const result = await getDoctorPatientMedicalRecordsByCode(code);
      if (!Array.isArray(result) || result.some((record) => record.patientCode !== code || !record.id || !record.appointmentId)) {
        throw new Error('Dữ liệu trả về không khớp với bệnh nhân đang tra cứu.');
      }
      if (current !== requestId.current) return;
      setPatientId(code); setRecords(result); setListScope('patient');
    } catch (cause) {
      if (current === requestId.current) setListError(errorText(cause));
    } finally { if (current === requestId.current) setLoading(false); }
  }

  function openCreation() {
    setShowCreate((value) => !value); setCreateError(null); setNotice(null);
    ++verifyId.current;
    setVerifying(false); setVerifiedAppointment(null); setAppointmentId(''); setDraft(emptyDraft); setAcknowledged(false);
    setSuggestionDate(clinicToday()); setSuggestions(null); setSuggestionsError(null);
  }

  function chooseSuggestionDate(date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > clinicToday() || verifying || saving) return;
    ++verifyId.current;
    setSuggestionDate(date); setAppointmentId(''); setVerifiedAppointment(null);
    setDraft(emptyDraft); setAcknowledged(false); setCreateError(null);
  }

  async function verifyAppointment(event?: FormEvent<HTMLFormElement>, visit?: ReceptionVisitResponse) {
    event?.preventDefault();
    if (verifying || saving) return;
    // An item must still belong to the active, doctor-scoped suggestions list.
    if (visit && (!suggestions?.some((item) => item.id === visit.id && item.appointmentId === visit.appointmentId)
      || visit.status !== 'COMPLETED' || visit.visitDate !== suggestionDate)) return;
    const id = (visit?.appointmentId ?? appointmentId).trim().toLowerCase();
    const current = ++verifyId.current;
    setAppointmentId(id); setVerifiedAppointment(null); setCreateError(null); setAcknowledged(false);
    if (!validClinicUuid(id)) { setCreateError('Nhập mã lịch hẹn hợp lệ.'); return; }
    setVerifying(true);
    try {
      // GET /api/appointments/{id} checks assigned-doctor ownership server-side.
      const appointment = await getAppointment(id);
      if (appointment.id.toLowerCase() !== id || !appointment.patientId || !appointment.doctorId ||
          (visit && (appointment.patientId !== visit.patientId || appointment.doctorId !== visit.doctorId ||
            appointment.appointmentDate !== visit.visitDate))) {
        throw new Error('Thông tin lịch hẹn không hợp lệ.');
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
        throw new Error('Chưa xác nhận được bệnh án đúng lịch hẹn. Vui lòng kiểm tra lại, không gửi lặp.');
      }
      // Clear existing patient results before switching to another patient's sensitive data.
      ++requestId.current;
      setRecords(null); setDirectoryPage(null); setSelectedId(''); setPatientId(''); setListError(null); setFilter(''); setPage(1);
      setPatientInput('');
      setShowCreate(false); setVerifiedAppointment(null); setAppointmentId('');
      setDraft(emptyDraft); setAcknowledged(false);
      try {
        const fetched = await getPatientMedicalRecords(created.patientId);
        if (!Array.isArray(fetched) || fetched.some((record) => record.patientId !== created.patientId)
          || !fetched.some((record) => record.id === created.id)) {
          throw new Error('Danh sách tải lại không xác nhận bệnh án vừa tạo.');
        }
        setRecords(fetched); setListScope('patient');
        setPatientInput(fetched[0]?.patientCode || '');
        setPatientId(fetched[0]?.patientCode || '');
        setNotice('Bệnh án đã lưu và danh sách đã được cập nhật.');
      } catch {
        // Show only the confirmed created record, never pretend the whole patient history loaded.
        setRecords([created]); setListScope('new-only');
        setNotice('Máy chủ đã xác nhận tạo bệnh án. Chưa tải lại được lịch sử; chỉ hiển thị bệnh án vừa tạo.');
      }
      setSelectedId(created.id);
    } catch (cause) { setCreateError(errorText(cause)); }
    finally { setSaving(false); }
  }

  const filtered = filterDoctorMedicalRecords(records ?? [], filter);
  const numberOfPages = listScope === 'mine' ? Math.max(1, directoryPage?.totalPages ?? 1) : Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = listScope === 'mine' ? (directoryPage?.number ?? 0) + 1 : Math.min(page, numberOfPages);
  const visible = listScope === 'mine' ? filtered : filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selected = records?.find((record) => record.id === selectedId) ?? null;
  const summary = records ? medicalRecordsSummary(records) : null;

  function openDetails(id: string, opener: HTMLButtonElement) {
    detailOpener.current = opener;
    setDetailTab('clinical');
    setSelectedId(id);
  }

  function closeDetails() {
    setSelectedId('');
    setDetailTab('clinical');
  }

  useEffect(() => {
    if (!selected) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    detailDialog.current?.querySelector<HTMLButtonElement>('[aria-label="Đóng chi tiết"]')?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); closeDetails(); return; }
      if (event.key !== 'Tab' || !detailDialog.current) return;
      const focusables = Array.from(detailDialog.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]'
      ));
      if (!focusables.length) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === focusables[0]) {
        event.preventDefault(); focusables[focusables.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === focusables[focusables.length - 1]) {
        event.preventDefault(); focusables[0].focus();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
      if (detailOpener.current?.isConnected) detailOpener.current.focus();
    };
  }, [selected?.id]);

  return <div className="doctor-records" aria-label="Hồ sơ bệnh án được phân công cho bác sĩ">
    <PageHeader title="Hồ sơ bệnh án" subtitle="Tra cứu, lập bệnh án và quản lý chỉ định theo phạm vi bác sĩ điều trị"
      actions={<button type="button" onClick={openCreation} disabled={saving || verifying} className={showCreate ? 'soft-button' : undefined}>
        {showCreate ? <X size={17} /> : <ClipboardPlus size={17} />}{showCreate ? 'Đóng biểu mẫu' : 'Tạo bệnh án'}</button>} />

    <div className="doctor-records-privacy"><LockKeyhole size={17} aria-hidden="true" />
      <p><strong>Chỉ hồ sơ được phân công.</strong> Danh sách bệnh án của bạn được tải tự động; tra cứu theo mã bệnh nhân khi cần.</p></div>

    {notice && <Alert tone="info">{notice}</Alert>}

    {showCreate && <section className="panel doctor-records-create" aria-label="Tạo bệnh án mới">
      <div className="doctor-records-section-head"><div><span>HỒ SƠ MỚI</span><h3>Lập bệnh án sau khi hoàn tất khám</h3>
        <p>Chọn một lượt khám đã hoàn tất để tự điền mã lịch, hoặc tra cứu thủ công.</p></div><ShieldCheck size={25} aria-hidden="true" /></div>
      {createError && <Alert tone="error">{createError}</Alert>}
      <div className="doctor-records-steps"><span className="active">1 · Xác minh lịch</span><span className={verifiedAppointment ? 'active' : ''}>2 · Nhập bệnh án</span><span>3 · Lưu hồ sơ</span></div>
      {!verifiedAppointment && <div className="doctor-records-appointment-picker">
        <div className="doctor-records-suggestion-heading"><div><strong><CalendarCheck2 size={18} aria-hidden="true" /> Gợi ý lượt khám đã hoàn tất</strong>
          <p>Chỉ lấy lượt được phân công cho bạn. Lịch mới xác nhận nhưng chưa hoàn tất khám chưa thể lập bệnh án.</p></div>
          <button type="button" className="soft-button" disabled={suggestionsLoading || verifying || saving}
            onClick={() => setSuggestionRevision((value) => value + 1)}><RefreshCw size={15} /> Làm mới</button></div>
        <div className="doctor-records-suggestion-date">
          <button type="button" className="soft-button" disabled={verifying || saving} onClick={() => chooseSuggestionDate(shiftClinicDay(suggestionDate, -1))}>
            <ChevronLeft size={15} /> Ngày trước</button>
          <label htmlFor="doctor-records-suggestion-date">Ngày khám
            <input id="doctor-records-suggestion-date" type="date" max={clinicToday()} value={suggestionDate} disabled={verifying || saving}
              onChange={(event) => chooseSuggestionDate(event.target.value)} /></label>
          <button type="button" className="soft-button" disabled={verifying || saving || suggestionDate === clinicToday()}
            onClick={() => chooseSuggestionDate(clinicToday())}>Hôm nay</button>
        </div>
        {suggestionsLoading && <p role="status" className="doctor-records-suggestion-state">Đang tìm lượt khám đã hoàn tất...</p>}
        {suggestionsError && <Alert tone="error">Không tải được gợi ý: {suggestionsError}. Bạn vẫn có thể nhập mã lịch bên dưới.</Alert>}
        {suggestions && suggestions.length === 0 && <p role="status" className="doctor-records-suggestion-state">
          Không có lượt khám đã hoàn tất ngày {formatDate(suggestionDate)}. Chọn ngày khác hoặc nhập mã lịch thủ công.</p>}
        {suggestions && suggestions.length > 0 && <div className="doctor-records-suggestion-list" aria-label="Chọn lượt khám để lập bệnh án">
          {suggestions.map((visit) => <button key={visit.id} type="button" disabled={verifying || saving}
            className="doctor-records-suggestion" onClick={() => void verifyAppointment(undefined, visit)}>
            <span className="doctor-records-suggestion-number">#{visit.queueNumber}</span>
            <span className="doctor-records-suggestion-info"><strong>Lượt khám số {visit.queueNumber}</strong>
              <small>Ngày {formatDate(visit.visitDate)} · Check-in {visit.checkedInAt?.slice(11, 16) || 'chưa rõ giờ'}</small></span>
            <span className="doctor-records-suggestion-select">Chọn lịch <ArrowRight size={15} aria-hidden="true" /></span>
          </button>)}</div>}
        {verifying && <p role="status" className="doctor-records-suggestion-state">Đang xác minh lịch được phân công...</p>}
        <details className="doctor-records-manual-lookup"><summary>Không thấy lượt khám? Nhập mã lịch hẹn thủ công</summary>
          <form className="doctor-records-verify" onSubmit={(event) => void verifyAppointment(event)}>
            <label htmlFor="doctor-records-appointment">Mã lịch hẹn</label>
            <div><input id="doctor-records-appointment" required value={appointmentId} disabled={saving || verifying}
              placeholder="Nhập mã lịch hẹn" onChange={(event) => {
                ++verifyId.current; setAppointmentId(event.target.value); setVerifiedAppointment(null); setCreateError(null); setAcknowledged(false);
              }} />
              <button type="submit" disabled={saving || verifying || !appointmentId.trim()}>{verifying ? 'Đang kiểm tra...' : 'Kiểm tra lịch'}</button></div>
          </form>
        </details>
      </div>}
      {verifiedAppointment && <><div className="doctor-records-verified" role="status"><CheckCircle2 size={20} />
        <div><strong>Lịch hẹn đã hoàn tất, được cấp quyền truy cập</strong>
          <span>Ngày khám {formatDate(verifiedAppointment.appointmentDate)} · {formatTime(verifiedAppointment.startTime)}–{formatTime(verifiedAppointment.endTime)}</span></div>
        <button type="button" className="soft-button doctor-records-change-appointment" disabled={saving} onClick={() => {
          ++verifyId.current; setVerifiedAppointment(null); setAppointmentId(''); setCreateError(null);
          setDraft(emptyDraft); setAcknowledged(false); setSuggestionRevision((value) => value + 1);
        }}>Đổi lịch</button></div>
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
          <p className="doctor-records-form-note"><Info size={16} /> Biểu mẫu này chỉ lưu thông tin bệnh án. Chỉ định xét nghiệm được tạo sau khi lưu.</p>
          <label className="doctor-records-ack"><input type="checkbox" checked={acknowledged} disabled={saving}
            onChange={(event) => setAcknowledged(event.target.checked)} /> Tôi đã kiểm tra nội dung và xác nhận lập bệnh án cho đúng lịch khám.</label>
          <button type="submit" disabled={saving || !acknowledged || !draft.diagnosis.trim()}><FileCheck2 size={17} /> {saving ? 'Đang lưu...' : 'Lưu bệnh án'}</button>
        </form>
      </>}
    </section>}

    <section className="panel doctor-records-search" aria-label="Tra cứu bệnh án theo bệnh nhân">
      <div className="doctor-records-section-head"><div><span>TRA CỨU BỆNH ÁN</span><h3>Tra cứu theo bệnh nhân</h3>
        <p>Chỉ hiển thị bệnh án của bệnh nhân do bạn điều trị. Nhập mã BN trên hồ sơ bệnh nhân.</p></div>
        <div className="doctor-records-search-actions">
          {listScope !== 'mine' && <button type="button" className="soft-button doctor-records-refresh" disabled={loading || saving} onClick={() => void loadMyRecords(0)}>Xem tất cả bệnh án của tôi</button>}
          <button type="button" className="soft-button doctor-records-refresh" disabled={loading || saving}
            onClick={() => listScope === 'mine' ? void loadMyRecords(directoryPage?.number ?? 0) : patientId ? void searchPatient(undefined, patientId) : void loadMyRecords(0)}><RefreshCw size={16} /> Làm mới</button>
        </div></div>
      <form className="doctor-records-search-form" onSubmit={(event) => void searchPatient(event)}>
        <label><Search size={19} aria-hidden="true" /><span className="doctor-records-sr-only">Mã bệnh nhân</span>
          <input required aria-label="Mã bệnh nhân" placeholder="Nhập mã bệnh nhân, ví dụ BN000005..." value={patientInput}
            disabled={loading || saving} onChange={(event) => setPatientInput(event.target.value)} /></label>
        <button type="submit" disabled={loading || saving || !patientInput.trim()}>{loading ? 'Đang tải...' : 'Tra cứu hồ sơ'} <ArrowRight size={16} /></button></form>
      {listError && <Alert tone="error">{listError}</Alert>}
      {loading && <p role="status" className="doctor-records-loading">Đang tải các bệnh án được cấp quyền...</p>}
      {!loading && records === null && !listError && <div className="doctor-records-intro"><Search size={29} aria-hidden="true" />
        <strong>Chưa tải được danh sách</strong><p>Chọn Làm mới để tải lại hồ sơ của bạn.</p></div>}
      {records !== null && <><div className="doctor-records-scope"><ShieldCheck size={16} />
        {listScope === 'mine' ? `Bệnh án thuộc bác sĩ đăng nhập · Tổng ${directoryPage?.totalElements ?? 0} hồ sơ`
          : listScope === 'new-only' ? 'Chỉ hiển thị bệnh án vừa tạo.' : `${patientId || 'Bệnh nhân đang tra cứu'} · ${records.length} bệnh án`}</div>
        <div className="doctor-records-metrics" aria-label="Thống kê trong kết quả đã tải">
          {[{ label: listScope === 'mine' ? 'Tổng bệnh án của tôi' : 'Bệnh án đã tải', value: (listScope === 'mine' ? directoryPage?.totalElements ?? 0 : summary!.count).toLocaleString('vi-VN'), hint: listScope === 'mine' ? `Đang xem ${records.length} hồ sơ trên trang` : 'Chỉ trong phạm vi đã trả về', icon: FileText, tone: 'blue' },
            { label: 'Lịch khám liên kết', value: summary!.appointmentCount.toLocaleString('vi-VN'), hint: 'Mã lịch hẹn duy nhất', icon: CalendarCheck2, tone: 'green' },
            { label: 'Đơn thuốc đã ghi', value: summary!.prescriptionCount.toLocaleString('vi-VN'), hint: 'Chỉ đơn có trong bệnh án', icon: Pill, tone: 'purple' },
            { label: 'Bệnh án mới nhất', value: summary!.latestDate ? formatDate(summary!.latestDate) : '—', hint: 'Ngày tạo gần nhất', icon: Clock3, tone: 'orange' }]
            .map(({ label, value, hint, icon: Icon, tone }) => <article className={`doctor-records-metric doctor-records-metric-${tone}`} key={label}>
              <span className="doctor-records-metric-icon"><Icon size={21} aria-hidden="true" /></span><strong>{value}</strong><h4>{label}</h4><p>{hint}</p></article>)}</div>
      </>}
    </section>

    {records !== null && <section className="doctor-records-content">
      <article className="panel doctor-records-directory" aria-label="Danh sách bệnh án được cấp quyền">
        <div className="doctor-records-section-head"><div><span>DANH SÁCH HỒ SƠ</span><h3>{listScope === 'mine' ? 'Bệnh án của tôi' : 'Bệnh án của bệnh nhân'}</h3>
          <p>{filtered.length} / {records.length} bệnh án trên trang{listScope === 'mine' ? ` · Tổng ${directoryPage?.totalElements ?? 0} bệnh án` : ''}</p></div><span className="doctor-records-api"><ShieldCheck size={15} /> Hồ sơ được phân công</span></div>
        <label className="doctor-records-filter"><Search size={16} aria-hidden="true" /><span className="doctor-records-sr-only">Tìm trong kết quả bệnh án</span>
          <input type="search" aria-label="Tìm trong kết quả bệnh án" placeholder={listScope === 'mine' ? 'Lọc trong trang đang xem...' : 'Mã bệnh án, mã BN hoặc chẩn đoán...'} value={filter}
            onChange={(event) => { setFilter(event.target.value); setPage(1); }} /></label>
        {filtered.length > 0 ? <><div className="doctor-records-table-scroll" tabIndex={0} aria-label="Danh sách bệnh án có thể cuộn ngang">
          <table className="doctor-records-table"><thead><tr><th scope="col">Hồ sơ</th><th scope="col">Bệnh nhân</th><th scope="col">Ngày khám</th><th scope="col">Thao tác</th></tr></thead>
            <tbody>{visible.map((record) => <tr key={record.id} className={record.id === selectedId ? 'selected' : undefined}>
              <td><div className="doctor-records-record"><span><FileText size={19} /></span><div><strong>{record.recordCode || 'Chưa có mã bệnh án'}</strong>
                <small>{record.diagnosis}</small></div></div></td>
              <td><strong>{record.patientName || 'Chưa đồng bộ tên'}</strong><br /><small>{record.patientCode || 'Chưa có mã BN'}</small></td><td>{record.appointmentDate ? formatDate(record.appointmentDate) : 'Chưa đồng bộ'}</td>
              <td><button type="button" className="doctor-records-row-action" onClick={(event) => openDetails(record.id, event.currentTarget)}>Chi tiết <ArrowRight size={14} /></button></td>
            </tr>)}</tbody></table></div>
        </> : <div className="doctor-records-empty" role="status">{records.length ? 'Không tìm thấy hồ sơ khớp bộ lọc.' : listScope === 'mine' ? 'Bạn chưa có bệnh án nào được phân công.' : 'Bác sĩ chưa có bệnh án được cấp quyền cho bệnh nhân này.'}</div>}
        {numberOfPages > 1 && <nav className="doctor-records-pagination" aria-label="Phân trang bệnh án"><span>{listScope === 'mine' ? `Tổng ${directoryPage?.totalElements ?? 0} bệnh án` : `Có ${filtered.length} bệnh án phù hợp`}</span>
          <div><button type="button" disabled={loading || currentPage === 1} onClick={() => listScope === 'mine' ? void loadMyRecords(currentPage - 2) : setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={15} /> Trước</button><span>Trang {currentPage}/{numberOfPages}</span>
            <button type="button" disabled={loading || currentPage >= numberOfPages} onClick={() => listScope === 'mine' ? void loadMyRecords(currentPage) : setPage((value) => Math.min(numberOfPages, value + 1))}>Sau <ChevronRight size={15} /></button></div></nav>}
        <p className="doctor-records-data-note"><Info size={15} /> {listScope === 'mine' ? 'Danh sách phân trang theo bác sĩ đăng nhập; bộ lọc chỉ áp dụng cho trang hiện tại.' : 'Số liệu trong danh sách của bệnh nhân đang xem.'}</p>
      </article>

    </section>}
    {selected && <div className="doctor-records-modal-layer">
      <div className="doctor-records-modal-backdrop" aria-hidden="true" onClick={closeDetails} />
      <div className="doctor-records-modal" ref={detailDialog} role="dialog" aria-modal="true" aria-labelledby="doctor-records-modal-title" aria-describedby="doctor-records-modal-date">
        <header className="doctor-records-modal-header">
          <div><span className="doctor-records-modal-kicker">HỒ SƠ ĐIỀU TRỊ</span>
            <h3 id="doctor-records-modal-title">Bệnh án {selected.recordCode || 'chưa có mã'}</h3>
            <p id="doctor-records-modal-date">{selected.patientName || selected.patientCode || 'Bệnh nhân chưa đồng bộ tên'} · Tạo ngày {formatDate(selected.createdAt)}</p></div>
          <button type="button" className="doctor-records-modal-close" onClick={closeDetails} aria-label="Đóng chi tiết"><X size={19} aria-hidden="true" /></button>
        </header>
        <nav className="doctor-records-modal-tabs" aria-label="Nội dung chi tiết bệnh án">
          <button type="button" aria-pressed={detailTab === 'clinical'} className={detailTab === 'clinical' ? 'active' : ''} onClick={() => setDetailTab('clinical')}><FileText size={16} /> Thông tin bệnh án</button>
          <button type="button" aria-pressed={detailTab === 'lab'} className={detailTab === 'lab' ? 'active' : ''} onClick={() => setDetailTab('lab')}><Stethoscope size={16} /> Xét nghiệm & chỉ định</button>
        </nav>
        <div className="doctor-records-modal-body" key={detailTab}>
          {detailTab === 'clinical' ? <>
            <div className="doctor-records-detail-status"><CheckCircle2 size={16} aria-hidden="true" /> Bệnh án đã được lưu bởi hệ thống</div>
            <DoctorRecordIdentity record={selected} />
            <div className="doctor-records-clinical-grid">
              <section className="doctor-records-clinical"><h4><HeartPulse size={17} /> Chẩn đoán</h4><p>{selected.diagnosis}</p></section>
              <section className="doctor-records-clinical"><h4><ClipboardList size={17} /> Triệu chứng</h4><p>{selected.symptoms || 'Chưa ghi nhận triệu chứng.'}</p></section>
              <section className="doctor-records-clinical doctor-records-clinical-notes"><h4><FileText size={17} /> Ghi chú điều trị</h4><p>{selected.notes || 'Chưa có ghi chú.'}</p></section>
            </div>
            <section className="doctor-records-prescriptions"><h4><Pill size={17} /> Đơn thuốc đã ghi nhận</h4>
              {!selected.prescriptions?.length ? <p>Chưa có đơn thuốc trong bệnh án này.</p> : selected.prescriptions.map((prescription) =>
                <article key={prescription.id} className="doctor-records-prescription"><strong>Đơn #{shortId(prescription.id)} · {formatDate(prescription.createdAt)}</strong>
                  {prescription.items.map((item) => <div key={item.id}><strong>{item.medicineName}</strong>
                    <span>{item.dosage} · {item.frequency} · {item.duration}{item.note ? ` · ${item.note}` : ''}</span></div>)}
                </article>)}</section>
          </> : <section className="doctor-records-lab" aria-label="Chỉ định và kết quả xét nghiệm của bệnh án">
            <p className="doctor-records-lab-intro">Quản lý chỉ định và theo dõi kết quả xét nghiệm của bệnh án {selected.recordCode || 'đang xem'}.</p>
            <LabOrdersPanel key={selected.id} record={selected} doctor />
          </section>}
        </div>
      </div>
    </div>}
  </div>;
}
