import { useEffect, useState } from 'react';
import {
  ArrowRight, BookOpen, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight,
  ClipboardList, FileText, HeartPulse, Info, Package, Pill, RefreshCw,
  Search, ShieldCheck, Stethoscope, Tag, X
} from 'lucide-react';
import { getCatalogMedicines, getCatalogServices, getServicePrice, getSpecialties } from '../api/clinic';
import Alert from '../components/Alert';
import PageHeader from '../components/PageHeader';
import type { CatalogServiceResponse, MedicineResponse, PriceResponse, SpecialtyResponse } from '../types/domain';
import { filterCatalogEntries, type CatalogTab } from '../utils/catalogDirectory';
import { formatCurrency, formatDate, shortId } from '../utils/format';
import './doctorCatalog.css';

const PAGE_SIZE = 8;
const categories: { id: CatalogTab; label: string; icon: typeof ClipboardList; hint: string }[] = [
  { id: 'services', label: 'Dịch vụ', icon: ClipboardList, hint: 'Khám và xét nghiệm' },
  { id: 'medicines', label: 'Thuốc', icon: Pill, hint: 'Tên và đơn vị thuốc' },
  { id: 'specialties', label: 'Chuyên khoa', icon: Stethoscope, hint: 'Chuyên môn phòng khám' }
];

type CatalogErrors = Partial<Record<CatalogTab, string>>;

function errorText(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Không thể tải dữ liệu từ máy chủ.';
}

/** Clinician-only read view: never calls /api/catalog/admin or sends mutations. */
export default function DoctorCatalogWorkspace() {
  const [services, setServices] = useState<CatalogServiceResponse[] | null>(null);
  const [medicines, setMedicines] = useState<MedicineResponse[] | null>(null);
  const [specialties, setSpecialties] = useState<SpecialtyResponse[] | null>(null);
  const [errors, setErrors] = useState<CatalogErrors>({});
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [tab, setTab] = useState<CatalogTab>('services');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState('');
  const [price, setPrice] = useState<PriceResponse | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErrors({});
    setServices(null);
    setMedicines(null);
    setSpecialties(null);
    setSelectedId('');
    // Each directory loads independently; one unavailable API must not hide the others.
    void Promise.allSettled([getCatalogServices(), getCatalogMedicines(), getSpecialties()])
      .then(([serviceResult, medicineResult, specialtyResult]) => {
        if (!active) return;
        const failures: CatalogErrors = {};
        if (serviceResult.status === 'fulfilled' && Array.isArray(serviceResult.value)) {
          setServices(serviceResult.value.filter((item) => item.active));
        } else failures.services = serviceResult.status === 'rejected' ? errorText(serviceResult.reason) : 'Dữ liệu dịch vụ không hợp lệ.';
        if (medicineResult.status === 'fulfilled' && Array.isArray(medicineResult.value)) {
          setMedicines(medicineResult.value.filter((item) => item.active));
        } else failures.medicines = medicineResult.status === 'rejected' ? errorText(medicineResult.reason) : 'Dữ liệu thuốc không hợp lệ.';
        if (specialtyResult.status === 'fulfilled' && Array.isArray(specialtyResult.value)) {
          setSpecialties(specialtyResult.value);
        } else failures.specialties = specialtyResult.status === 'rejected' ? errorText(specialtyResult.reason) : 'Dữ liệu chuyên khoa không hợp lệ.';
        setErrors(failures);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);

  const entries = tab === 'services' ? services : tab === 'medicines' ? medicines : specialties;
  const filtered = entries ? filterCatalogEntries(entries, query, 'ACTIVE') : [];
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selectedService = tab === 'services' ? services?.find((item) => item.id === selectedId) : undefined;
  const selectedMedicine = tab === 'medicines' ? medicines?.find((item) => item.id === selectedId) : undefined;
  const selectedSpecialty = tab === 'specialties' ? specialties?.find((item) => item.id === selectedId) : undefined;
  const selected = selectedService ?? selectedMedicine ?? selectedSpecialty;

  useEffect(() => {
    if (!selectedService) { setPrice(null); setPriceError(null); setPriceLoading(false); return; }
    let active = true;
    setPrice(null);
    setPriceError(null);
    setPriceLoading(true);
    void getServicePrice(selectedService.id).then((result) => {
      if (!active) return;
      if (result.serviceId !== selectedService.id) throw new Error('Giá dịch vụ không khớp với mục đã chọn.');
      setPrice(result);
    }).catch((cause: unknown) => {
      if (active) setPriceError(errorText(cause));
    }).finally(() => { if (active) setPriceLoading(false); });
    return () => { active = false; };
  }, [selectedService]);

  function chooseCategory(next: CatalogTab) {
    setTab(next); setQuery(''); setPage(1); setSelectedId('');
  }

  return <div className="doctor-catalog">
    <PageHeader title="Danh mục chuyên môn" subtitle="Tra cứu dịch vụ, thuốc và chuyên khoa đang được phòng khám sử dụng"
      actions={<button type="button" className="soft-button" disabled={loading} onClick={() => setRevision((value) => value + 1)}>
        <RefreshCw size={16} aria-hidden="true" /> Làm mới
      </button>} />

    <section className="doctor-catalog-hero" aria-label="Tra cứu danh mục cho bác sĩ">
      <div><span className="doctor-catalog-eyebrow"><ShieldCheck size={15} aria-hidden="true" /> KHÔNG GIAN BÁC SĨ · CHỈ TRA CỨU</span>
        <h3>Thông tin chuyên môn, trong tầm tay.</h3>
        <p>Tìm mã dịch vụ, tham khảo danh mục thuốc và chuyên khoa. Bạn chỉ có thể xem thông tin.</p>
        <span className="doctor-catalog-hero-note"><CheckCircle2 size={15} aria-hidden="true" /> Chỉ hiển thị dịch vụ và thuốc đang hoạt động</span>
      </div>
      <span className="doctor-catalog-hero-icon" aria-hidden="true"><HeartPulse size={69} strokeWidth={1.5} /></span>
    </section>

    <section className="doctor-catalog-summary" aria-label="Số mục danh mục hiện có">
      {categories.map(({ id, label, icon: Icon, hint }) => {
        const count = id === 'services' ? services?.length : id === 'medicines' ? medicines?.length : specialties?.length;
        return <button key={id} type="button" className={`doctor-catalog-stat ${tab === id ? 'is-active' : ''}`}
          aria-pressed={tab === id} onClick={() => chooseCategory(id)}>
          <span className="doctor-catalog-stat-icon"><Icon size={21} aria-hidden="true" /></span>
          <span className="doctor-catalog-stat-number">{count === undefined ? '—' : count.toLocaleString('vi-VN')}</span>
          <strong>{label}</strong><small>{hint}</small>
          <ArrowRight size={16} className="doctor-catalog-stat-arrow" aria-hidden="true" />
        </button>;
      })}
    </section>

    {loading && <p className="doctor-catalog-loading" role="status"><RefreshCw size={17} aria-hidden="true" /> Đang tải danh mục...</p>}
    {categories.map(({ id, label }) => errors[id] && <Alert key={id} tone="error">Không tải được {label.toLocaleLowerCase('vi-VN')}: {errors[id]}. <button type="button" className="soft-button" disabled={loading} onClick={() => setRevision((value) => value + 1)}>Thử lại</button></Alert>)}

    <div className="doctor-catalog-layout">
      <section className="panel doctor-catalog-directory" aria-label="Danh sách danh mục dành cho bác sĩ">
        <header className="doctor-catalog-section-header"><div><span>THƯ VIỆN DANH MỤC</span><h3>Tra cứu nhanh</h3><p>Chọn loại danh mục, tìm kiếm và mở một mục để xem thông tin.</p></div>
          <span className="doctor-catalog-readonly"><BookOpen size={15} aria-hidden="true" /> Chỉ xem</span></header>
        <div className="doctor-catalog-tabs" role="group" aria-label="Nhóm danh mục">
          {categories.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={tab === id ? 'is-active' : ''} aria-pressed={tab === id}
            onClick={() => chooseCategory(id)}><Icon size={16} aria-hidden="true" /> {label}</button>)}
        </div>
        <label className="doctor-catalog-search"><Search size={18} aria-hidden="true" />
          <span className="doctor-catalog-sr-only">Tìm trong danh mục {categories.find((item) => item.id === tab)?.label}</span>
          <input type="search" aria-label="Tìm trong danh mục" value={query} placeholder={tab === 'services' ? 'Tên hoặc mã dịch vụ...' : tab === 'medicines' ? 'Tên thuốc, mã, đơn vị...' : 'Tên chuyên khoa...'}
            onChange={(event) => { setQuery(event.target.value); setPage(1); setSelectedId(''); }} />
          {query && <button type="button" aria-label="Xóa tìm kiếm" onClick={() => { setQuery(''); setPage(1); setSelectedId(''); }}><X size={16} /></button>}
        </label>
        <div className="doctor-catalog-list-status" aria-live="polite">{entries ? `${filtered.length} / ${entries.length} mục trong danh mục` : 'Chưa có dữ liệu'}</div>
        {entries && visible.length > 0 && <div className="doctor-catalog-results">
          {visible.map((entry) => <button type="button" key={entry.id} className={`doctor-catalog-result ${selectedId === entry.id ? 'is-selected' : ''}`}
            aria-pressed={selectedId === entry.id} onClick={() => setSelectedId(entry.id)}>
            <span className="doctor-catalog-result-icon">{tab === 'services' ? <ClipboardList size={19} /> : tab === 'medicines' ? <Pill size={19} /> : <Stethoscope size={19} />}</span>
            <span className="doctor-catalog-result-copy"><strong>{entry.name}</strong><small>{'code' in entry && typeof entry.code === 'string' ? entry.code : shortId(entry.id)}{'unit' in entry ? ` · ${entry.unit}` : ''}</small>
              {entry.description && <span>{entry.description}</span>}</span><ArrowRight size={17} className="doctor-catalog-result-arrow" aria-hidden="true" />
          </button>)}
        </div>}
        {!loading && entries?.length === 0 && <div className="doctor-catalog-empty"><Package size={25} aria-hidden="true" /><strong>Chưa có mục nào</strong><p>Nhóm danh mục này hiện chưa có dữ liệu.</p></div>}
        {!loading && entries && entries.length > 0 && !filtered.length && <div className="doctor-catalog-empty"><Search size={25} aria-hidden="true" /><strong>Không tìm thấy kết quả</strong><p>Thử một từ khóa khác.</p></div>}
        {!loading && entries === null && <div className="doctor-catalog-empty"><Info size={25} aria-hidden="true" /><strong>Nhóm danh mục chưa khả dụng</strong><p>Thử nhấn Làm mới để tải dữ liệu.</p></div>}
        {filtered.length > PAGE_SIZE && <nav className="doctor-catalog-pagination" aria-label="Phân trang danh mục bác sĩ">
          <span>Trang {currentPage}/{totalPages}</span><div>
            <button type="button" disabled={currentPage === 1} onClick={() => { setPage((value) => Math.max(1, value - 1)); setSelectedId(''); }}><ChevronLeft size={16} aria-hidden="true" /> Trước</button>
            <button type="button" disabled={currentPage >= totalPages} onClick={() => { setPage((value) => Math.min(totalPages, value + 1)); setSelectedId(''); }}>Sau <ChevronRight size={16} aria-hidden="true" /></button>
          </div></nav>}
      </section>

      <aside className="panel doctor-catalog-detail" aria-label="Thông tin chi tiết danh mục">
        <header className="doctor-catalog-section-header"><div><span>THÔNG TIN CHI TIẾT</span><h3>{selected?.name ?? 'Chọn một mục để xem'}</h3></div>
          {selected && <button type="button" className="doctor-catalog-close" aria-label="Đóng chi tiết" onClick={() => setSelectedId('')}><X size={17} /></button>}</header>
        {!selected ? <div className="doctor-catalog-detail-empty"><BookOpen size={35} aria-hidden="true" /><strong>Thông tin tra cứu</strong><p>Chọn dịch vụ, thuốc hoặc chuyên khoa ở danh sách bên trái để xem nội dung từ hệ thống.</p></div> : <div className="doctor-catalog-detail-body">
          <span className="doctor-catalog-detail-pill"><CheckCircle2 size={14} aria-hidden="true" /> {selectedSpecialty ? 'Chuyên khoa' : 'Đang hoạt động'}</span>
          <dl><div><dt><Tag size={15} /> Mã danh mục</dt><dd>{'code' in selected && typeof selected.code === 'string' ? selected.code : shortId(selected.id)}</dd></div>
            <div><dt><FileText size={15} /> Mô tả</dt><dd>{selected.description || 'Chưa được cập nhật'}</dd></div>
            {selectedMedicine && <div><dt><Package size={15} /> Đơn vị</dt><dd>{selectedMedicine.unit}</dd></div>}
            <div><dt>ID trong hệ thống</dt><dd className="doctor-catalog-id">{selected.id}</dd></div></dl>
          {selectedService && <section className="doctor-catalog-price" aria-label="Đơn giá dịch vụ hiện hành"><h4><CalendarDays size={17} aria-hidden="true" /> Đơn giá đang hiệu lực</h4>
            {priceLoading && <p role="status">Đang xác minh đơn giá...</p>}
            {priceError && <Alert tone="info">Chưa xác minh được giá dịch vụ: {priceError}. Không sử dụng giá chưa xác minh để tính phí.</Alert>}
            {!priceLoading && !priceError && price && <div className="doctor-catalog-price-box"><strong>{formatCurrency(price.amount, price.currency)}</strong>
              <span>Hiệu lực từ {formatDate(price.effectiveFrom)}{price.effectiveUntil ? ` đến trước ${formatDate(price.effectiveUntil)}` : ''}</span>
              <small>Mã phiên bản giá: {price.id}</small></div>}
          </section>}
          {selectedMedicine && <p className="doctor-catalog-disclaimer"><ShieldCheck size={17} aria-hidden="true" /> Dữ liệu thuốc chỉ để tra cứu. Chỉ định và kê đơn phải được kiểm tra trong luồng bệnh án có phân quyền.</p>}
          {selectedSpecialty && <p className="doctor-catalog-disclaimer"><Stethoscope size={17} aria-hidden="true" /> Thông tin chuyên khoa được lấy từ danh mục chuyên khoa của phòng khám.</p>}
        </div>}
      </aside>
    </div>
    <p className="doctor-catalog-footer"><ShieldCheck size={15} aria-hidden="true" /> Bác sĩ chỉ xem danh mục, giá và thông tin thuốc tại đây.</p>
  </div>;
}
