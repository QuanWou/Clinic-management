import { useEffect, useState } from 'react';
import {
  ArrowRight, BookOpen, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight,
  CircleAlert, ClipboardList, Clock3, FileText, History, Package, Pill, Plus,
  RefreshCw, Search, ShieldCheck, Stethoscope, Tag, X
} from 'lucide-react';
import {
  getAdminCatalogMedicines, getAdminCatalogServices, getCatalogMedicines,
  getCatalogServices, getServicePrice, getServicePriceHistory, getSpecialties
} from '../api/clinic';
import Alert from '../components/Alert';
import PageHeader from '../components/PageHeader';
import { integrations } from '../config/integrations.config';
import type { CatalogServiceResponse, MedicineResponse, PriceResponse, SpecialtyResponse } from '../types/domain';
import type { ClinicRole } from '../utils/roles';
import { formatDate, formatMoney, shortId } from '../utils/format';
import { filterCatalogEntries, type CatalogStatus, type CatalogTab } from '../utils/catalogDirectory';
import CatalogAdminPanel from './CatalogAdminPanel';
import DoctorCatalogWorkspace from './DoctorCatalogWorkspace';

const PAGE_SIZE = 12;
const tabs: { id: CatalogTab; title: string; icon: typeof ClipboardList }[] = [
  { id: 'services', title: 'Dịch vụ', icon: ClipboardList },
  { id: 'medicines', title: 'Thuốc', icon: Pill },
  { id: 'specialties', title: 'Chuyên khoa', icon: Stethoscope }
];

function message(cause: unknown) {
  return cause instanceof Error ? cause.message : 'Không tải được dữ liệu danh mục.';
}

export default function CatalogPage({ role }: { role: ClinicRole }) {
  if (role !== 'ADMIN' && role !== 'DOCTOR') return <Alert tone="error">Bạn không có quyền truy cập danh mục.</Alert>;
  if (!integrations.adminCatalog) return <>
    <PageHeader title="Danh mục" subtitle="Dịch vụ, thuốc và chuyên khoa" />
    <Alert tone="info">Catalog is not enabled in this deployment. Danh mục chưa được bật tại môi trường này.</Alert>
  </>;
  if (role === 'DOCTOR') return <DoctorCatalogWorkspace />;
  return <CatalogWorkspace role={role} />;
}

function CatalogWorkspace({ role }: { role: 'ADMIN' | 'DOCTOR' }) {
  const admin = role === 'ADMIN';
  const [services, setServices] = useState<CatalogServiceResponse[] | null>(null);
  const [medicines, setMedicines] = useState<MedicineResponse[] | null>(null);
  const [specialties, setSpecialties] = useState<SpecialtyResponse[] | null>(null);
  const [errors, setErrors] = useState<{ services?: string; medicines?: string; specialties?: string }>({});
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [tab, setTab] = useState<CatalogTab>('services');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<CatalogStatus>('ALL');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState('');
  const [price, setPrice] = useState<PriceResponse | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceResponse[] | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [showManagement, setShowManagement] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErrors({});
    // Do not make Catalog depend on the unrelated doctor directory or on one failed API.
    const serviceRequest = admin ? getAdminCatalogServices() : getCatalogServices();
    const medicineRequest = admin ? getAdminCatalogMedicines() : getCatalogMedicines();
    void Promise.allSettled([serviceRequest, medicineRequest, getSpecialties()]).then(([serviceResult, medicineResult, specialtyResult]) => {
      if (!active) return;
      const failures: { services?: string; medicines?: string; specialties?: string } = {};
      if (serviceResult.status === 'fulfilled' && Array.isArray(serviceResult.value)) {
        setServices(admin ? serviceResult.value : serviceResult.value.filter((item) => item.active));
      } else {
        setServices(null);
        failures.services = serviceResult.status === 'rejected' ? message(serviceResult.reason) : 'API trả danh sách dịch vụ không hợp lệ.';
      }
      if (medicineResult.status === 'fulfilled' && Array.isArray(medicineResult.value)) {
        setMedicines(admin ? medicineResult.value : medicineResult.value.filter((item) => item.active));
      } else {
        setMedicines(null);
        failures.medicines = medicineResult.status === 'rejected' ? message(medicineResult.reason) : 'API trả danh sách thuốc không hợp lệ.';
      }
      if (specialtyResult.status === 'fulfilled' && Array.isArray(specialtyResult.value)) {
        setSpecialties(specialtyResult.value);
      } else {
        setSpecialties(null);
        failures.specialties = specialtyResult.status === 'rejected' ? message(specialtyResult.reason) : 'API trả chuyên khoa không hợp lệ.';
      }
      setErrors(failures);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [admin, revision]);

  useEffect(() => {
    if (!selectedId || tab !== 'services' || !services?.some((item) => item.id === selectedId)) {
      setPrice(null); setPriceHistory(null); setPriceError(null); setHistoryError(null); setPriceLoading(false);
      return;
    }
    let active = true;
    setPrice(null); setPriceHistory(null); setPriceError(null); setHistoryError(null); setPriceLoading(true);
    void Promise.allSettled([getServicePrice(selectedId), getServicePriceHistory(selectedId)]).then(([current, history]) => {
      if (!active) return;
      if (current.status === 'fulfilled' && current.value.serviceId === selectedId) setPrice(current.value);
      else setPriceError(current.status === 'rejected' ? message(current.reason) : 'Giá hiện hành không khớp dịch vụ.');
      if (history.status === 'fulfilled' && Array.isArray(history.value) && history.value.every((item) => item.serviceId === selectedId)) {
        setPriceHistory(history.value);
      } else setHistoryError(history.status === 'rejected' ? message(history.reason) : 'Lịch sử giá không khớp dịch vụ.');
    }).finally(() => { if (active) setPriceLoading(false); });
    return () => { active = false; };
  }, [selectedId, services, tab, revision]);

  function changeTab(next: CatalogTab) {
    setTab(next); setQuery(''); setStatus('ALL'); setSelectedId(''); setPage(1);
  }
  function refresh() { setRevision((value) => value + 1); }

  const entries = tab === 'services' ? services : tab === 'medicines' ? medicines : specialties;
  const filtered = entries == null ? [] : filterCatalogEntries(entries, query, admin ? status : 'ACTIVE');
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selectedService = tab === 'services' ? services?.find((item) => item.id === selectedId) : undefined;
  const selectedMedicine = tab === 'medicines' ? medicines?.find((item) => item.id === selectedId) : undefined;
  const selectedSpecialty = tab === 'specialties' ? specialties?.find((item) => item.id === selectedId) : undefined;
  const activeServices = services?.filter((item) => item.active) ?? [];
  const activeMedicines = medicines?.filter((item) => item.active) ?? [];
  const inactiveCount = (services?.filter((item) => !item.active).length ?? 0) + (medicines?.filter((item) => !item.active).length ?? 0);

  return <div className="catalog-workspace">
    <PageHeader title="Danh mục" subtitle="Quản lý dịch vụ, thuốc, chuyên khoa và bảng giá của phòng khám"
      actions={<><button type="button" className="soft-button" disabled={loading} onClick={refresh}><RefreshCw size={16} /> Làm mới</button>
        {admin && <button type="button" onClick={() => setShowManagement((value) => !value)}>
          {showManagement ? <X size={17} /> : <Plus size={17} />}{showManagement ? 'Đóng quản trị' : 'Quản lý danh mục'}</button>}</>} />
    <section className="catalog-hero" aria-label="Giới thiệu danh mục">
      <div className="catalog-hero-copy"><span className="catalog-hero-kicker"><ShieldCheck size={15} /> {admin ? 'DANH MỤC QUẢN TRỊ' : 'DANH MỤC THAM KHẢO'}</span>
        <h3>Dữ liệu chuẩn, chăm sóc nhất quán.</h3>
        <p>Tra cứu dịch vụ khám, thuốc, chuyên khoa và thông tin giá được công bố trực tiếp từ hệ thống.</p>
        <span className="catalog-hero-chip"><CheckCircle2 size={15} /> {admin ? 'Danh sách đầy đủ trong phạm vi API Admin' : 'Chỉ dữ liệu đang hoạt động'}</span></div>
      <span className="catalog-hero-icon" aria-hidden="true"><BookOpen size={72} strokeWidth={1.4} /></span>
    </section>

    {loading && <p role="status" className="catalog-loading">Đang tải danh mục từ API...</p>}
    {Object.entries(errors).map(([scope, error]) => <Alert key={scope} tone="error">Không tải được {scope === 'services' ? 'dịch vụ' : scope === 'medicines' ? 'thuốc' : 'chuyên khoa'}: {error} <button type="button" className="soft-button" onClick={refresh}>Thử lại</button></Alert>)}
    {admin && showManagement && <div className="catalog-management"><CatalogAdminPanel services={activeServices} medicines={activeMedicines} onChanged={refresh} /></div>}

    <section className="catalog-metrics" aria-label="Thống kê danh mục thực tế">
      <article className="catalog-metric"><span className="catalog-metric-icon"><ClipboardList size={21} /></span><strong>{services == null ? '—' : activeServices.length.toLocaleString('vi-VN')}</strong><h3>Dịch vụ đang hoạt động</h3><p>Danh sách do API trả về</p></article>
      <article className="catalog-metric catalog-metric-blue"><span className="catalog-metric-icon"><Pill size={21} /></span><strong>{medicines == null ? '—' : activeMedicines.length.toLocaleString('vi-VN')}</strong><h3>Thuốc đang hoạt động</h3><p>Danh mục thuốc tham khảo</p></article>
      <article className="catalog-metric catalog-metric-purple"><span className="catalog-metric-icon"><Stethoscope size={21} /></span><strong>{specialties == null ? '—' : specialties.length.toLocaleString('vi-VN')}</strong><h3>Chuyên khoa</h3><p>Theo danh mục chuyên khoa thực tế</p></article>
      {admin && <article className="catalog-metric catalog-metric-orange"><span className="catalog-metric-icon"><CircleAlert size={21} /></span><strong>{services == null || medicines == null ? '—' : inactiveCount.toLocaleString('vi-VN')}</strong><h3>Mục ngừng hoạt động</h3><p>Dịch vụ và thuốc · Theo API Admin</p></article>}
    </section>

    <section className="panel catalog-directory" aria-label="Tra cứu danh mục">
      <div className="catalog-section-heading"><div><span className="catalog-section-kicker">DỮ LIỆU THỰC</span><h3>Tra cứu danh mục</h3>
        <p>Chọn nhóm để tìm kiếm và xem thông tin chi tiết.</p></div><span className="catalog-source">Không có dữ liệu mẫu</span></div>
      <div className="catalog-tabs" role="tablist" aria-label="Loại danh mục">
        {tabs.map(({ id, title, icon: Icon }) => <button key={id} role="tab" type="button" aria-selected={tab === id} className={tab === id ? 'is-active' : ''} onClick={() => changeTab(id)}><Icon size={17} /> {title}</button>)}
      </div>
      <div className="catalog-filters"><label><Search size={17} /><span className="catalog-sr-only">Tìm trong danh mục</span>
        <input type="search" aria-label="Tìm trong danh mục" placeholder={tab === 'services' ? 'Mã dịch vụ, tên dịch vụ...' : tab === 'medicines' ? 'Tên thuốc, mã thuốc, đơn vị...' : 'Tên chuyên khoa...'} value={query}
          onChange={(event) => { setQuery(event.target.value); setPage(1); setSelectedId(''); }} /></label>
        {admin && tab !== 'specialties' && <label><span className="catalog-sr-only">Lọc trạng thái danh mục</span><select aria-label="Lọc trạng thái danh mục" value={status} onChange={(event) => { setStatus(event.target.value as CatalogStatus); setPage(1); setSelectedId(''); }}>
          <option value="ALL">Tất cả trạng thái</option><option value="ACTIVE">Đang hoạt động</option><option value="INACTIVE">Ngừng hoạt động</option></select></label>}</div>
      {entries !== null && <>
        <div className="catalog-table-scroll" role="tabpanel" tabIndex={0} aria-label="Danh sách danh mục có thể cuộn ngang">
          <table className="catalog-table"><thead><tr><th scope="col">{tab === 'specialties' ? 'Chuyên khoa' : tab === 'medicines' ? 'Thuốc' : 'Dịch vụ'}</th><th scope="col">Mã / ID</th>
            {tab === 'medicines' && <th scope="col">Đơn vị</th>}{tab !== 'specialties' && <th scope="col">Trạng thái</th>}<th scope="col">Thao tác</th></tr></thead>
            <tbody>{visible.map((entry) => <tr key={entry.id} className={entry.id === selectedId ? 'is-selected' : undefined}>
              <td><div className="catalog-item-cell"><span className="catalog-item-icon">{tab === 'services' ? <ClipboardList size={19} /> : tab === 'medicines' ? <Pill size={19} /> : <Stethoscope size={19} />}</span>
                <span><strong>{entry.name}</strong><small>{entry.description || 'Chưa có mô tả'}</small></span></div></td>
              <td><span className="catalog-code">{'code' in entry && typeof entry.code === 'string' ? entry.code : shortId(entry.id)}</span></td>
              {tab === 'medicines' && <td>{'unit' in entry && typeof entry.unit === 'string' ? entry.unit : '—'}</td>}
              {tab !== 'specialties' && <td><span className={`catalog-state ${'active' in entry && entry.active ? 'active' : 'inactive'}`}>{'active' in entry && entry.active ? 'Đang hoạt động' : 'Ngừng hoạt động'}</span></td>}
              <td><button type="button" className="catalog-row-action" onClick={() => setSelectedId(entry.id)} aria-label={`Xem ${entry.name}`}>Chi tiết <ArrowRight size={14} /></button></td>
            </tr>)}</tbody></table>
        </div>
        {filtered.length === 0 && <p className="catalog-empty" role="status">{entries.length ? 'Không có mục phù hợp với điều kiện tìm kiếm.' : 'Danh mục hiện chưa có dữ liệu được API trả về.'}</p>}
        <div className="catalog-directory-footer"><p>Hiển thị {filtered.length} / {entries.length} mục trong phạm vi dữ liệu đã tải.</p>
          {filtered.length > PAGE_SIZE && <nav className="catalog-pagination" aria-label="Phân trang danh mục"><button type="button" className="soft-button" disabled={currentPage === 1} onClick={() => { setPage((value) => Math.max(1, value - 1)); setSelectedId(''); }}><ChevronLeft size={16} /> Trước</button>
            <span>Trang {currentPage}/{pageCount}</span><button type="button" className="soft-button" disabled={currentPage >= pageCount} onClick={() => { setPage((value) => Math.min(pageCount, value + 1)); setSelectedId(''); }}>Sau <ChevronRight size={16} /></button></nav>}</div>
      </>}
      {entries === null && !loading && <p className="catalog-empty">Dữ liệu nhóm này chưa khả dụng. Thử tải lại.</p>}
    </section>

    {(selectedService || selectedMedicine || selectedSpecialty) && <section className="panel catalog-detail" aria-label="Chi tiết danh mục">
      <div className="catalog-section-heading"><div><span className="catalog-section-kicker">CHI TIẾT DANH MỤC</span><h3>{selectedService?.name || selectedMedicine?.name || selectedSpecialty?.name}</h3>
        <p>Mã ID: {selectedId}</p></div><button type="button" className="soft-button" onClick={() => setSelectedId('')}><X size={16} /> Đóng</button></div>
      <dl className="catalog-detail-grid"><div><dt><Tag size={15} /> {selectedSpecialty ? 'Chuyên khoa' : 'Mã danh mục'}</dt><dd>{selectedService?.code || selectedMedicine?.code || selectedSpecialty?.name}</dd></div>
        <div><dt><FileText size={15} /> Mô tả</dt><dd>{selectedService?.description || selectedMedicine?.description || selectedSpecialty?.description || 'Chưa cập nhật'}</dd></div>
        {selectedMedicine && <div><dt><Package size={15} /> Đơn vị thuốc</dt><dd>{selectedMedicine.unit}</dd></div>}
        {(selectedMedicine || selectedService) && <div><dt>Trạng thái</dt><dd><span className={`catalog-state ${(selectedMedicine || selectedService)?.active ? 'active' : 'inactive'}`}>{(selectedMedicine || selectedService)?.active ? 'Đang hoạt động' : 'Ngừng hoạt động'}</span></dd></div>}</dl>
      {selectedService && <div className="catalog-price-section"><h4><Clock3 size={18} /> Giá đang hiệu lực</h4>
        {priceLoading && <p role="status">Đang tra cứu giá hiện hành và lịch sử giá...</p>}
        {priceError && <Alert tone="info">Chưa xác minh được giá hiện hành: {priceError}. Không sử dụng mục này để tính phí cho đến khi Catalog xác nhận.</Alert>}
        {price && <div className="catalog-price-current"><div><span>Đơn giá được API xác nhận</span><strong>{formatMoney(price.amount)} {price.currency}</strong></div>
          <p><CalendarDays size={15} /> Hiệu lực từ {formatDate(price.effectiveFrom)} {price.effectiveUntil ? `đến trước ${formatDate(price.effectiveUntil)}` : '· Chưa ghi ngày kết thúc'}</p><small>Mã phiên bản giá: {price.id}</small></div>}
        <h4><History size={18} /> Lịch sử giá</h4>
        {historyError && <Alert tone="info">Không tải được lịch sử giá: {historyError}</Alert>}
        {priceHistory?.length === 0 && <p>Chưa có lịch sử giá được Catalog trả về.</p>}
        {priceHistory?.map((entry) => <div key={entry.id} className="catalog-price-history"><span><strong>{formatMoney(entry.amount)} {entry.currency}</strong><small>Phiên bản: {entry.id}</small></span>
          <span>{formatDate(entry.effectiveFrom)} – {entry.effectiveUntil ? formatDate(entry.effectiveUntil) : 'Không xác định ngày kết thúc'}</span></div>)}
      </div>}
      {selectedMedicine && <p className="catalog-caution"><ShieldCheck size={17} /> Danh mục chỉ để tham khảo; chỉ định thuốc phải được Medical Service kiểm tra bằng ID hợp lệ.</p>}
    </section>}
  </div>;
}
