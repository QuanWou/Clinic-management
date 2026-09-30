import { type FormEvent, useEffect, useRef, useState } from 'react';
import {
  ArrowRight, CalendarCheck2, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight,
  ClipboardList, Clock3, FileText, HeartPulse, Info, LockKeyhole, Pill,
  RefreshCw, Search, ShieldCheck, Stethoscope, UserRound, X
} from 'lucide-react';
import { getDoctorPatientMedicalRecordsByCode, getMyDoctorMedicalRecords } from '../api/clinic';
import Alert from '../components/Alert';
import PageHeader from '../components/PageHeader';
import type { MedicalRecordResponse, PageResponse } from '../types/domain';
import type { AppView } from '../types/view';
import { filterDoctorMedicalRecords, medicalRecordsSummary } from '../utils/doctorMedicalRecords';
import { formatDate, formatTime, shortId } from '../utils/format';
import LabOrdersPanel from './LabOrdersPanel';
import './doctorMedicalRecords.css';

const PAGE_SIZE = 8;
const errorText = (cause: unknown) => cause instanceof Error ? cause.message : 'Không thể thực hiện yêu cầu. Vui lòng thử lại.';

type Props = { onNavigate?: (view: AppView) => void };

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
export default function DoctorMedicalRecordsWorkspace({ onNavigate }: Props) {
  const [patientInput, setPatientInput] = useState('');
  const [patientId, setPatientId] = useState('');
  const [records, setRecords] = useState<MedicalRecordResponse[] | null>(null);
  const [listScope, setListScope] = useState<'mine' | 'patient'>('mine');
  const [directoryPage, setDirectoryPage] = useState<PageResponse<MedicalRecordResponse> | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [detailTab, setDetailTab] = useState<'clinical' | 'lab'>('clinical');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const requestId = useRef(0);
  const detailDialog = useRef<HTMLDivElement>(null);
  const detailOpener = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    void loadMyRecords(0);
    return () => { requestId.current += 1; };
  }, []);

  async function loadMyRecords(nextPage: number) {
    const current = ++requestId.current;
    setLoading(true); setRecords(null); setDirectoryPage(null); setListScope('mine');
    setPatientId(''); setPatientInput(''); setSelectedId(''); setFilter(''); setPage(1);
    setListError(null);
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
    setRecords(null); setDirectoryPage(null); setSelectedId(''); setPatientId(''); setListError(null); setFilter(''); setPage(1);
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
    <PageHeader title="Hồ sơ bệnh án" subtitle="Tra cứu hồ sơ đã ghi nhận; lập bệnh án được thực hiện trong không gian khám"
      actions={onNavigate ? <button type="button" onClick={() => onNavigate('appointments')}>
        <CalendarDays size={17} /> Mở lịch hẹn</button> : undefined} />

    <div className="doctor-records-privacy"><LockKeyhole size={17} aria-hidden="true" />
      <p><strong>Luồng khám mới đang được áp dụng.</strong> Bệnh án, xét nghiệm và đơn thuốc được tạo trong <strong>Khám bệnh</strong> khi lượt ở trạng thái Đã gọi/Đang khám. Trang này chỉ dùng để tra cứu hồ sơ đã ghi nhận.</p></div>

    <section className="panel doctor-records-workflow" aria-label="Luồng lập bệnh án mới">
      <div className="doctor-records-section-head"><div><span>LUỒNG KHÁM MỚI</span><h3>Lập hồ sơ ngay trong lượt khám</h3>
        <p>Vào Lịch hẹn, mở lượt đã được gọi, bắt đầu khám, lưu bản nháp bệnh án, xử lý xét nghiệm/đơn thuốc, xác nhận hồ sơ rồi mới hoàn tất lượt khám.</p></div><Stethoscope size={25} aria-hidden="true" /></div>
      <div className="doctor-records-workflow-steps" aria-label="Các bước lập bệnh án">
        <span><strong>1</strong> Lịch hẹn / hàng đợi</span><ArrowRight size={16} aria-hidden="true" />
        <span><strong>2</strong> Khám bệnh</span><ArrowRight size={16} aria-hidden="true" />
        <span><strong>3</strong> Bệnh án nháp</span><ArrowRight size={16} aria-hidden="true" />
        <span><strong>4</strong> Xác nhận & hoàn tất</span>
      </div>
      {onNavigate && <button type="button" className="doctor-records-workflow-action" onClick={() => onNavigate('appointments')}>
        <CalendarDays size={17} /> Đến lịch hẹn để khám <ArrowRight size={16} />
      </button>}
    </section>

    <section className="panel doctor-records-search" aria-label="Tra cứu bệnh án theo bệnh nhân">
      <div className="doctor-records-section-head"><div><span>TRA CỨU BỆNH ÁN</span><h3>Tra cứu theo bệnh nhân</h3>
        <p>Chỉ hiển thị bệnh án của bệnh nhân do bạn điều trị. Nhập mã BN trên hồ sơ bệnh nhân.</p></div>
        <div className="doctor-records-search-actions">
          {listScope !== 'mine' && <button type="button" className="soft-button doctor-records-refresh" disabled={loading} onClick={() => void loadMyRecords(0)}>Xem tất cả bệnh án của tôi</button>}
          <button type="button" className="soft-button doctor-records-refresh" disabled={loading}
            onClick={() => listScope === 'mine' ? void loadMyRecords(directoryPage?.number ?? 0) : patientId ? void searchPatient(undefined, patientId) : void loadMyRecords(0)}><RefreshCw size={16} /> Làm mới</button>
        </div></div>
      <form className="doctor-records-search-form" onSubmit={(event) => void searchPatient(event)}>
        <label><Search size={19} aria-hidden="true" /><span className="doctor-records-sr-only">Mã bệnh nhân</span>
          <input required aria-label="Mã bệnh nhân" placeholder="Nhập mã bệnh nhân, ví dụ BN000005..." value={patientInput}
            disabled={loading} onChange={(event) => setPatientInput(event.target.value)} /></label>
        <button type="submit" disabled={loading || !patientInput.trim()}>{loading ? 'Đang tải...' : 'Tra cứu hồ sơ'} <ArrowRight size={16} /></button></form>
      {listError && <Alert tone="error">{listError}</Alert>}
      {loading && <p role="status" className="doctor-records-loading">Đang tải các bệnh án được cấp quyền...</p>}
      {!loading && records === null && !listError && <div className="doctor-records-intro"><Search size={29} aria-hidden="true" />
        <strong>Chưa tải được danh sách</strong><p>Chọn Làm mới để tải lại hồ sơ của bạn.</p></div>}
      {records !== null && <><div className="doctor-records-scope"><ShieldCheck size={16} />
        {listScope === 'mine' ? `Bệnh án thuộc bác sĩ đăng nhập · Tổng ${directoryPage?.totalElements ?? 0} hồ sơ`
          : `${patientId || 'Bệnh nhân đang tra cứu'} · ${records.length} bệnh án`}</div>
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
            <p className="doctor-records-lab-intro">Theo dõi chỉ định và kết quả xét nghiệm đã ghi nhận của bệnh án {selected.recordCode || 'đang xem'}.</p>
            <LabOrdersPanel key={selected.id} record={selected} doctor readOnly />
          </section>}
        </div>
      </div>
    </div>}
  </div>;
}
