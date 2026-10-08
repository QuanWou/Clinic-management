import {useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode} from 'react';
import '../styles/about-public-page.css';
import '../styles/contact-public-page.css';
import {
  ArrowRight,
  Activity,
  Baby,
  Bone,
  Brain,
  CalendarCheck2,
  Check,
  ClipboardCheck,
  Clock3,
  Droplets,
  Ear,
  Eye,
  HeartPulse,
  Hospital,
  MapPin,
  Microscope,
  Navigation,
  Ribbon,
  ScanFace,
  Search,
  ShieldCheck,
  Smile,
  Stethoscope,
  UserRound,
  Venus,
  Wind,
} from 'lucide-react';
import type {Clinic, Doctor, Offering, PublicDoctorProfile, PublicMediaItem, PublicWebContent} from '../api/booking';

export type PublicInfoView = 'about' | 'specialties' | 'specialty' | 'doctors' | 'doctor' | 'services' | 'service' | 'contact';

export const publicSlug = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/đ/g, 'd')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '');

type SharedProps = {
  clinic: Clinic | null;
  doctors: Doctor[];
  offerings: Offering[];
  content: PublicWebContent | null;
  navigate: (path: string) => void;
  book: (doctor?: Doctor, offering?: Offering) => void;
};

const uniqueDoctors = (doctors: Doctor[]) => [...new Map(doctors.map(doctor => [doctor.doctorId, doctor])).values()];
const uniqueOfferings = (offerings: Offering[]) => [...new Map(offerings.map(offering => [offering.offeringId, offering])).values()];
const doctorInitials = (name: string) => name.split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]).join('').toLocaleUpperCase('vi');
const specialtyIcon = (name: string) => {
  const key = publicSlug(name);
  if (key.includes('tim-mach') || key.includes('cardio')) return HeartPulse;
  if (key.includes('than-kinh') || key.includes('neuro')) return Brain;
  if (key.includes('mat') || key.includes('nhan-khoa') || key.includes('ophthal')) return Eye;
  if (key.includes('tai-mui-hong') || key.includes('ent')) return Ear;
  if (key === 'nhi' || key.includes('nhi-khoa') || key.includes('pediatric')) return Baby;
  if (key.includes('da-lieu') || key.includes('dermat')) return ScanFace;
  if (key.includes('co-xuong-khop') || key.includes('chan-thuong') || key.includes('orthop')) return Bone;
  if (key.includes('san') || key.includes('phu-khoa') || key.includes('obstetric') || key.includes('gyne')) return Venus;
  if (key.includes('rang-ham-mat') || key.includes('nha-khoa') || key.includes('dental')) return Smile;
  if (key.includes('ho-hap') || key.includes('phoi') || key.includes('respirat') || key.includes('pulmon')) return Wind;
  if (key.includes('ung-buou') || key.includes('ung-thu') || key.includes('oncol')) return Ribbon;
  if (key.includes('tiet-nieu') || key.includes('than-tiet-nieu') || key.includes('uro')) return Droplets;
  if (key.includes('xet-nghiem') || key.includes('lab') || key.includes('patholog')) return Microscope;
  if (key.includes('noi-tiet') || key.includes('tieu-hoa') || key.includes('noi-khoa')) return Activity;
  if (key.includes('tong-quat') || key.includes('general')) return Hospital;
  return Stethoscope;
};

export function PublicHomeV2({clinic, doctors, offerings, content, navigate, book}: SharedProps) {
  const team = uniqueDoctors(doctors);
  const services = uniqueOfferings(offerings);
  const doctorProfiles = useMemo(() => new Map((content?.doctors ?? []).map(profile => [profile.doctorId, profile])), [content]);
  const serviceProfiles = useMemo(() => new Map((content?.services ?? []).map(profile => [profile.offeringId, profile])), [content]);
  const specialties = useMemo(
    () => content?.specialties?.length ? content.specialties.map(item => item.displayName) : [...new Set(team.map(doctor => doctor.specialtyName).filter((value): value is string => Boolean(value)))],
    [content, team],
  );
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const specialtySectionRef = useRef<HTMLElement | null>(null);
  const [specialtiesVisible, setSpecialtiesVisible] = useState(false);
  const normalizedQuery = query.trim().toLocaleLowerCase('vi');
  const matchedSpecialties = normalizedQuery ? specialties.filter(value => value.toLocaleLowerCase('vi').includes(normalizedQuery)).slice(0, 4) : [];
  const matchedDoctors = normalizedQuery ? team.filter(doctor => `${doctor.displayName} ${doctor.specialtyName ?? ''}`.toLocaleLowerCase('vi').includes(normalizedQuery)).slice(0, 4) : [];
  const matchedServices = normalizedQuery ? services.filter(service => service.name.toLocaleLowerCase('vi').includes(normalizedQuery)).slice(0, 4) : [];
  const hasSearchResults = Boolean(matchedSpecialties.length || matchedDoctors.length || matchedServices.length);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setSearchOpen(Boolean(normalizedQuery));
  }

  useEffect(() => {
    const node = specialtySectionRef.current;
    if (!node) return;
    if (typeof window === 'undefined' || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setSpecialtiesVisible(true);
      return;
    }
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      setSpecialtiesVisible(true);
      observer.disconnect();
    }, {threshold: 0.18});
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return <div className="fresh-clinic-home">
    <section className="fresh-hero">
      <div className="fresh-container fresh-hero-grid">
        <div className="fresh-hero-copy">
          <span className="fresh-kicker"><span /> CHĂM SÓC SỨC KHỎE NGOẠI TRÚ</span>
          <h1>Chăm sóc sức khỏe bắt đầu từ một cuộc hẹn <em>đúng người, đúng thời điểm.</em></h1>
          <p>{content?.clinic.heroMessage || clinic?.description || 'Tìm hiểu đội ngũ bác sĩ, chuyên khoa và chủ động chọn một lịch khám phù hợp tại phòng khám.'}</p>
          <div className="fresh-actions">
            <button className="fresh-primary" onClick={() => book()}>Đặt lịch khám <ArrowRight size={18} /></button>
            <button className="fresh-secondary" onClick={() => navigate('/bac-si')}>Tìm bác sĩ</button>
          </div>
          <ul className="fresh-hero-assurances" aria-label="Thông tin đặt lịch">
            <li><Check size={15} /> Xem lịch trống trước</li>
            <li><Check size={15} /> Chọn giờ trực tiếp</li>
            <li><Check size={15} /> Đăng nhập sau khi chọn lịch</li>
          </ul>
        </div>
        <ClinicIllustration clinicName={clinic?.name ?? 'Phòng khám'} media={content?.clinic.media?.hero} />
      </div>
    </section>

    <section className="fresh-container fresh-search" id="tim-kiem">
      <div>
        <span className="fresh-kicker">Tìm nhanh</span>
        <h2>Bạn đang cần tìm gì?</h2>
        <p>Tìm trong bác sĩ, chuyên khoa và dịch vụ đang được phòng khám công bố.</p>
      </div>
      <form className="fresh-search-box" role="search" onSubmit={submitSearch}>
        <label className="sr-only" htmlFor="public-global-search">Tìm bác sĩ, chuyên khoa hoặc dịch vụ</label>
        <div className="fresh-search-input">
          <Search size={20} aria-hidden="true" />
          <input id="public-global-search" type="search" value={query} onFocus={() => setSearchOpen(Boolean(normalizedQuery))} onChange={event => { setQuery(event.target.value); setSearchOpen(Boolean(event.target.value.trim())); }} placeholder="Bác sĩ, chuyên khoa hoặc dịch vụ..." autoComplete="off" />
          <button type="submit">Tìm kiếm</button>
        </div>
        {searchOpen && normalizedQuery && <div className="fresh-search-results" aria-live="polite">
          {matchedSpecialties.length > 0 && <SearchGroup title="Chuyên khoa">{matchedSpecialties.map(specialty => <button type="button" key={specialty} onClick={() => navigate(`/chuyen-khoa/${publicSlug(specialty)}`)}><span>{specialty}<small>Xem chuyên khoa</small></span><ArrowRight size={15} /></button>)}</SearchGroup>}
          {matchedDoctors.length > 0 && <SearchGroup title="Bác sĩ">{matchedDoctors.map(doctor => <button type="button" key={doctor.doctorId} onClick={() => navigate(`/bac-si/${doctor.doctorId}`)}><span>{doctor.displayName}<small>{doctor.specialtyName ?? 'Bác sĩ tại phòng khám'}</small></span><ArrowRight size={15} /></button>)}</SearchGroup>}
          {matchedServices.length > 0 && <SearchGroup title="Dịch vụ">{matchedServices.map(service => <button type="button" key={service.offeringId} onClick={() => navigate(`/dich-vu/${service.offeringId}`)}><span>{service.name}<small>Xem thông tin dịch vụ</small></span><ArrowRight size={15} /></button>)}</SearchGroup>}
          {!hasSearchResults && <p>Không tìm thấy nội dung phù hợp. Hãy thử một từ khóa khác.</p>}
        </div>}
      </form>
    </section>

    <section ref={specialtySectionRef} className={`fresh-band fresh-specialties-section${specialtiesVisible ? ' is-visible' : ''}`} id="chuyen-khoa">
      <div className="fresh-container fresh-section">
        <div className="fresh-specialty-heading-reveal">
          <SectionHead kicker="Chuyên khoa" title="Chuyên khoa tại phòng khám" description="Bắt đầu từ nhu cầu khám để hiểu chuyên khoa phù hợp và tìm bác sĩ đang phụ trách." action="Xem tất cả chuyên khoa" onAction={() => navigate('/chuyen-khoa')} />
        </div>
        <div className="fresh-specialty-grid">{specialties.slice(0, 6).map(specialty => {
          const profile = content?.specialties.find(item => item.displayName === specialty);
          const activeDoctorCount = profile?.doctorCount ?? team.filter(doctor => doctor.specialtyName === specialty).length;
          const commonConditions = profile?.commonConditions?.filter(Boolean).slice(0, 4) ?? [];
          const SpecialtyIcon = specialtyIcon(specialty);
          return <article className="fresh-specialty-card" key={specialty}>
            <div className="fresh-specialty-card-top">
              <span className="fresh-specialty-icon" aria-hidden="true"><SpecialtyIcon size={20} /></span>
              {activeDoctorCount > 0 && <span className="fresh-specialty-doctor-count">{activeDoctorCount} bác sĩ đang hoạt động</span>}
            </div>
            <div className="fresh-specialty-card-copy">
              <h3>{specialty}</h3>
              <p>{profile?.shortDescription || 'Thông tin chuyên khoa đang được phòng khám cập nhật.'}</p>
            </div>
            <div className="fresh-specialty-conditions">
              <span>Vấn đề thường gặp</span>
              {commonConditions.length > 0
                ? <ul>{commonConditions.map(condition => <li key={condition}>{condition}</li>)}</ul>
                : <small>Danh mục đang được cập nhật.</small>}
            </div>
            <button className="fresh-specialty-cta" type="button" onClick={() => navigate(`/chuyen-khoa/${profile?.slug ?? publicSlug(specialty)}`)}>
              Xem chuyên khoa <ArrowRight size={16} />
            </button>
          </article>;
        })}</div>
        {!specialties.length && <Empty>Chưa có dữ liệu chuyên khoa công khai.</Empty>}
      </div>
    </section>

    <section className="fresh-container fresh-section" id="bac-si">
      <SectionHead kicker="Đội ngũ bác sĩ" title="Gặp gỡ đội ngũ bác sĩ" description="Thông tin chuyên khoa và chức danh được hiển thị trực tiếp từ dữ liệu phòng khám." action="Xem tất cả bác sĩ" onAction={() => navigate('/bac-si')} />
      <div className="fresh-doctor-grid">{team.slice(0, 6).map(doctor => <DoctorCard key={doctor.doctorId} doctor={doctor} profile={doctorProfiles.get(doctor.doctorId)} onProfile={() => navigate(`/bac-si/${doctor.doctorId}`)} onBook={() => book(doctor)} />)}</div>
      {!team.length && <Empty>Chưa có bác sĩ được công bố.</Empty>}
    </section>

    <section className="fresh-services-section" id="dich-vu">
      <div className="fresh-container fresh-section">
        <SectionHead kicker="Dịch vụ" title="Dịch vụ tại phòng khám" description="Xem thông tin dịch vụ trước khi chuyển sang lịch trống thực tế." action="Xem tất cả dịch vụ" onAction={() => navigate('/dich-vu')} />
        <div className="fresh-service-list">{services.slice(0, 6).map((service, index) => <article key={service.offeringId}><span>{String(index + 1).padStart(2, '0')}</span><div><h3>{service.name}</h3><p>{serviceProfiles.get(service.offeringId)?.description ?? 'Thông tin và lịch khám được đồng bộ từ phòng khám.'}</p></div><div className="fresh-service-actions"><button onClick={() => navigate(`/dich-vu/${service.offeringId}`)}>Tìm hiểu <ArrowRight size={16} /></button><button aria-label={`Đặt lịch dịch vụ ${service.name}`} onClick={() => book(undefined, service)}>Đặt lịch</button></div></article>)}</div>
        {!services.length && <Empty>Chưa có dịch vụ được công bố.</Empty>}
      </div>
    </section>

    <section className="fresh-trust-section">
      <div className="fresh-container fresh-section fresh-trust">
        <div><span className="fresh-kicker fresh-kicker-light">Vì sao chọn chúng tôi</span><h2>Một hành trình khám rõ ràng, từ trước khi đến đến sau khi ra về.</h2><p>Những điều dưới đây đến từ chính cách hệ thống vận hành — không dùng số liệu hay lời chứng thực giả.</p></div>
        <div className="fresh-trust-grid"><Fact icon={<UserRound />}>Bác sĩ và chuyên khoa<br />được công bố rõ ràng</Fact><Fact icon={<CalendarCheck2 />}>Chọn lịch theo<br />khung giờ thực tế</Fact><Fact icon={<ShieldCheck />}>Quy trình đặt khám<br />minh bạch</Fact><Fact icon={<ClipboardCheck />}>Tài liệu chỉ hiển thị<br />khi đã được phát hành</Fact></div>
      </div>
    </section>

    <section className="fresh-band" id="co-so">
      <div className="fresh-container fresh-section fresh-facility">
        <FacilityPhoto media={content?.clinic.media?.reception} />
        <div className="fresh-facility-copy"><span className="fresh-kicker">Phòng khám của chúng tôi</span><h2>{clinic?.name ?? 'Thông tin phòng khám'}</h2><p>{content?.clinic.facilities || content?.clinic.shortIntroduction || clinic?.description || 'Thông tin giới thiệu phòng khám đang được cập nhật từ dữ liệu công khai.'}</p>{clinic?.branches[0]?.address && <p className="fresh-address-line"><MapPin size={18} /> {clinic.branches[0].address}</p>}<button className="fresh-link" onClick={() => navigate('/gioi-thieu')}>Tìm hiểu phòng khám <ArrowRight size={16} /></button></div>
      </div>
    </section>

    <section className="fresh-container fresh-section" id="quy-trinh">
      <div className="fresh-process-intro"><span className="fresh-kicker">Quy trình khám</span><h2>Từ đặt lịch đến nhận hướng dẫn sau khám</h2>{content?.clinic.careProcess && <p>{content.clinic.careProcess}</p>}</div>
      <ol className="fresh-process"><Step n="01" title="Đặt lịch">Chọn chuyên khoa, bác sĩ, ngày và khung giờ.</Step><Step n="02" title="Đến phòng khám & check-in">Đến theo lịch hẹn và làm thủ tục tiếp nhận.</Step><Step n="03" title="Khám với bác sĩ">Thực hiện buổi khám theo hướng dẫn chuyên môn.</Step><Step n="04" title="Nhận hướng dẫn / hồ sơ">Xem tài liệu đã được phòng khám phát hành.</Step></ol>
    </section>

    <section className="fresh-band" id="lien-he"><div className="fresh-container fresh-section fresh-location"><LocationContent clinic={clinic} book={book} /></div></section>

    <section className="fresh-container fresh-section fresh-faq" id="faq">
      <div><span className="fresh-kicker">Câu hỏi thường gặp</span><h2>Chuẩn bị cho buổi khám</h2><p>Một vài câu trả lời ngắn giúp bạn chủ động hơn trước khi đến.</p></div>
      <div className="fresh-faq-list"><Faq question="Tôi có cần đặt lịch trước không?">Bạn có thể xem các khung giờ còn trống và chủ động chọn thời gian phù hợp trước khi đến.</Faq><Faq question="Tôi có thể chọn bác sĩ không?">Có, khi bác sĩ có lịch được hệ thống công bố. Bạn cũng có thể bắt đầu từ chuyên khoa.</Faq><Faq question="Khi nào tôi cần đăng nhập?">Bạn được chọn chuyên khoa, bác sĩ, ngày và giờ trước; hệ thống chỉ yêu cầu đăng nhập khi cần giữ giờ.</Faq><Faq question="Tôi nên đến sớm bao nhiêu phút?">Vui lòng làm theo hướng dẫn trong lịch hẹn hoặc liên hệ phòng khám nếu chưa có thông tin.</Faq><Faq question="Tôi xem hoặc đổi lịch ở đâu?">Mở khu vực Tài khoản bệnh nhân để xem lịch sắp tới và các thao tác đang được phép.</Faq><Faq question="Hồ sơ khám được xem ở đâu?">Tài liệu chỉ xuất hiện trong tài khoản bệnh nhân sau khi phòng khám phát hành.</Faq></div>
    </section>

    <section className="fresh-final-cta"><div className="fresh-container"><div><span>Chủ động sắp xếp buổi khám</span><h2>Một lịch khám phù hợp đang bắt đầu từ đây.</h2></div><button onClick={() => book()}>Đặt lịch khám <ArrowRight size={18} /></button></div></section>
  </div>;
}

export function PublicInfoPage({view, slug = '', clinic, doctors, offerings, content, navigate, book}: {view: PublicInfoView; slug?: string} & SharedProps) {
  const team = uniqueDoctors(doctors);
  const services = uniqueOfferings(offerings);
  const specialties = content?.specialties?.length ? content.specialties.map(item=>item.displayName) : [...new Set(team.map(doctor => doctor.specialtyName).filter((value): value is string => Boolean(value)))];
  const doctor = team.find(item => item.doctorId === slug || publicSlug(item.displayName) === slug);
  const doctorProfile = content?.doctors.find(item=>item.doctorId===doctor?.doctorId);
  const specialtyProfile = content?.specialties.find(item=>item.slug===slug || publicSlug(item.displayName)===slug);
  const specialty = specialtyProfile?.displayName ?? specialties.find(item => publicSlug(item) === slug);
  const service = services.find(item => item.offeringId === slug || publicSlug(item.name) === slug);
  const serviceProfile = content?.services.find(item=>item.offeringId===service?.offeringId);
  const doctorProfiles = new Map((content?.doctors ?? []).map(profile => [profile.doctorId, profile]));
  const serviceProfiles = new Map((content?.services ?? []).map(profile => [profile.offeringId, profile]));
  const [doctorQuery, setDoctorQuery] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('');
  const filteredDoctors = team.filter(item => `${item.displayName} ${item.specialtyName ?? ''}`.toLocaleLowerCase('vi').includes(doctorQuery.trim().toLocaleLowerCase('vi')) && (!specialtyFilter || item.specialtyName === specialtyFilter));
  if (view === 'about') return <AboutClinicPage clinic={clinic} content={content} team={team} specialties={specialties} doctorProfiles={doctorProfiles} navigate={navigate} book={book} />;
  if (view === 'contact') return <ContactClinicPage clinic={clinic} content={content} book={book} />;
  const title = view === 'specialties' ? 'Chuyên khoa' : view === 'specialty' ? (specialty ?? 'Chuyên khoa') : view === 'doctors' ? 'Đội ngũ bác sĩ' : view === 'doctor' ? (doctor?.displayName ?? 'Hồ sơ bác sĩ') : view === 'services' ? 'Dịch vụ' : view === 'service' ? (service?.name ?? 'Chi tiết dịch vụ') : 'Liên hệ & địa chỉ';

  return <div className="fresh-info-page">
    <header className="fresh-page-head"><div className="fresh-container"><button onClick={() => navigate('/public')}>← Trang chủ</button><span className="fresh-kicker">{clinic?.name ?? 'Phòng khám'}</span><h1>{title}</h1><p>{pageDescription(view)}</p></div></header>
    <main className="fresh-container fresh-page-body">
      {view === 'specialties' && <section className="fresh-specialty-page">
        <div className="fresh-listing-intro fresh-specialty-page-intro">
          <div>
            <span className="fresh-kicker">Chọn theo nhu cầu khám</span>
            <p>Mỗi chuyên khoa hiển thị phạm vi khám, các vấn đề thường gặp và đội ngũ bác sĩ đang được phòng khám công bố.</p>
          </div>
          <span>{specialties.length} chuyên khoa</span>
        </div>
        <div className="fresh-specialty-grid fresh-specialty-page-grid">{specialties.map(item => {
          const profile = content?.specialties.find(row => row.displayName === item);
          const activeDoctorCount = profile?.doctorCount ?? team.filter(doctorItem => doctorItem.specialtyName === item).length;
          const commonConditions = profile?.commonConditions?.filter(Boolean).slice(0, 4) ?? [];
          const SpecialtyIcon = specialtyIcon(item);
          return <article className="fresh-specialty-card" key={item}>
            <div className="fresh-specialty-card-top">
              <span className="fresh-specialty-icon" aria-hidden="true"><SpecialtyIcon size={20} /></span>
              {activeDoctorCount > 0 && <span className="fresh-specialty-doctor-count">{activeDoctorCount} bác sĩ đang hoạt động</span>}
            </div>
            <div className="fresh-specialty-card-copy">
              <h3>{item}</h3>
              <p>{profile?.shortDescription || 'Thông tin chuyên khoa đang được phòng khám cập nhật.'}</p>
            </div>
            <div className="fresh-specialty-conditions">
              <span>Vấn đề thường gặp</span>
              {commonConditions.length > 0
                ? <ul>{commonConditions.map(condition => <li key={condition}>{condition}</li>)}</ul>
                : <small>Danh mục đang được cập nhật.</small>}
            </div>
            <button className="fresh-specialty-cta" type="button" onClick={() => navigate(`/chuyen-khoa/${profile?.slug ?? publicSlug(item)}`)}>
              Xem chuyên khoa <ArrowRight size={16} />
            </button>
          </article>;
        })}</div>
        {!specialties.length && <Empty>Chưa có dữ liệu chuyên khoa.</Empty>}
      </section>}

      {view === 'specialty' && (specialty ? <div className="fresh-detail-layout"><div className="fresh-detail-main"><section><span className="fresh-kicker">Giới thiệu chuyên khoa</span><h2>{specialty}</h2>{specialtyProfile ? <p>{specialtyProfile.description}</p> : <Empty>Thông tin giới thiệu chi tiết của chuyên khoa chưa được phòng khám công bố.</Empty>}</section>{specialtyProfile && <section className="fresh-detail-columns"><div><h2>Bệnh/vấn đề thường gặp</h2><ContentList items={specialtyProfile.commonConditions}/></div><div><h2>Chuyên môn chính</h2><ContentList items={specialtyProfile.keyExpertise}/></div></section>}<section><h2>Đội ngũ bác sĩ</h2><div className="fresh-mini-list">{team.filter(item => item.specialtyName === specialty).map(item => <button key={item.doctorId} onClick={() => navigate(`/bac-si/${item.doctorId}`)}><DoctorPortrait name={item.displayName} profile={doctorProfiles.get(item.doctorId)} compact /><span><strong>{item.displayName}</strong>{item.professionalTitle && <small>{item.professionalTitle}</small>}</span><ArrowRight size={18} /></button>)}</div></section><section><h2>Dịch vụ thuộc chuyên khoa</h2><div className="fresh-mini-list">{(content?.services ?? []).filter(item=>item.specialtySlug===(specialtyProfile?.slug ?? publicSlug(specialty))).map(item=><button key={item.offeringId} onClick={()=>navigate(`/dich-vu/${item.offeringId}`)}><span><strong>{item.name}</strong><small>{item.description}</small></span><ArrowRight size={18}/></button>)}</div></section></div><AsideBooking title={`Đặt lịch ${specialty}`} description="Chọn bác sĩ, ngày và khung giờ đang còn trống." onBook={() => book(team.find(item => item.specialtyName === specialty))} /></div> : <Empty>Không tìm thấy chuyên khoa được công bố.</Empty>)}

      {view === 'doctors' && <><div className="fresh-doctor-filters"><label><span>Tìm tên bác sĩ</span><span className="fresh-filter-control"><Search size={17} /><input type="search" value={doctorQuery} onChange={event => setDoctorQuery(event.target.value)} placeholder="Nhập tên bác sĩ..." /></span></label><label><span>Chuyên khoa</span><select value={specialtyFilter} onChange={event => setSpecialtyFilter(event.target.value)}><option value="">Tất cả chuyên khoa</option>{specialties.map(item => <option key={item} value={item}>{item}</option>)}</select></label></div><div className="fresh-listing-intro"><p>Chọn bác sĩ theo thông tin chuyên khoa, học vị và kinh nghiệm đang được phòng khám công bố.</p><span>{filteredDoctors.length} kết quả</span></div><div className="fresh-doctor-grid">{filteredDoctors.map(item => <DoctorCard key={item.doctorId} doctor={item} profile={doctorProfiles.get(item.doctorId)} onProfile={() => navigate(`/bac-si/${item.doctorId}`)} onBook={() => book(item)} />)}</div>{!filteredDoctors.length && <Empty>Không tìm thấy bác sĩ phù hợp với bộ lọc.</Empty>}</>}

      {view === 'doctor' && (doctor ? <><div className="fresh-doctor-profile"><div className="fresh-doctor-profile-photo"><DoctorPortrait name={doctor.displayName} profile={doctorProfile} large /></div><div><span className="fresh-kicker">{doctor.specialtyName ?? 'Bác sĩ tại phòng khám'}</span><h2>{doctor.displayName}</h2><p>{doctorProfile?.headline ?? doctor.professionalTitle}</p>{doctorProfile && <div className="fresh-profile-meta"><span>{doctorProfile.title}</span>{doctorProfile.yearsExperience != null && doctorProfile.yearsExperience > 0 && <span>{doctorProfile.yearsExperience} năm kinh nghiệm</span>}</div>}<button className="fresh-primary" onClick={() => book(doctor)}>Đặt lịch với bác sĩ <ArrowRight size={17} /></button></div></div><div className="fresh-detail-layout fresh-doctor-detail-layout"><div className="fresh-profile-sections"><article><h3>Giới thiệu</h3>{doctorProfile?.summary ? <p>{doctorProfile.summary}</p> : <Empty>Phần giới thiệu chuyên môn chưa được phòng khám công bố.</Empty>}</article>{doctorProfile?.expertise?.length ? <article><h3>Chuyên môn nổi bật</h3><ContentList items={doctorProfile.expertise}/></article> : null}{doctorProfile?.consultationAreas?.length ? <article><h3>Khám và tư vấn</h3><ContentList items={doctorProfile.consultationAreas}/></article> : null}<article><h3>Quá trình đào tạo</h3>{doctorProfile?.education?.length ? <ContentList items={doctorProfile.education}/> : <Empty>Thông tin chưa được phòng khám công bố.</Empty>}</article><article><h3>Quá trình công tác</h3>{doctorProfile?.experience?.length ? <ContentList items={doctorProfile.experience}/> : <Empty>Thông tin chưa được phòng khám công bố.</Empty>}</article><article><h3>Lịch làm việc</h3><p>Chọn “Xem lịch trống” để tải các khung giờ thực tế đang còn nhận lịch.</p></article></div><AsideBooking title={`Khám với ${doctor.displayName}`} description="Xem ngày và khung giờ thực tế đang còn trống." onBook={() => book(doctor)} /></div></> : <Empty>Không tìm thấy bác sĩ được công bố.</Empty>)}

      {view === 'services' && <><div className="fresh-listing-intro"><p>Khám phá các dịch vụ đang được phòng khám mở cho người bệnh.</p><span>{services.length} dịch vụ</span></div><div className="fresh-service-list">{services.map((item, index) => <article key={item.offeringId}><span>{String(index + 1).padStart(2, '0')}</span><div><h3>{item.name}</h3><p>{serviceProfiles.get(item.offeringId)?.description ?? 'Thông tin và lịch khám được đồng bộ từ phòng khám.'}</p></div><div className="fresh-service-actions"><button onClick={() => navigate(`/dich-vu/${item.offeringId}`)}>Tìm hiểu <ArrowRight size={16} /></button><button aria-label={`Đặt lịch dịch vụ ${item.name}`} onClick={() => book(undefined, item)}>Đặt lịch</button></div></article>)}</div>{!services.length && <Empty>Chưa có dịch vụ được công bố.</Empty>}</>}

      {view === 'service' && (service ? <div className="fresh-detail-layout"><div className="fresh-detail-main"><section><span className="fresh-kicker">Mô tả dịch vụ</span><h2>{service.name}</h2>{serviceProfile ? <p>{serviceProfile.description}</p> : <Empty>Thông tin mô tả chi tiết chưa được phòng khám công bố.</Empty>}</section><section><h2>Dịch vụ này dành cho ai?</h2>{serviceProfile ? <p>{serviceProfile.suitableFor}</p> : <Empty>Thông tin chỉ định chưa được phòng khám công bố.</Empty>}</section><section><h2>Chuẩn bị trước khi đến</h2>{serviceProfile ? <p>{serviceProfile.preparation}</p> : <Empty>Hướng dẫn chuẩn bị chưa được phòng khám công bố.</Empty>}</section></div><AsideBooking title="Đặt lịch dịch vụ" description="Chuyển sang lịch thực tế để chọn bác sĩ, ngày và giờ." onBook={() => book(undefined, service)} /></div> : <Empty>Không tìm thấy dịch vụ được công bố.</Empty>)}

    </main>
  </div>;
}

function AboutClinicPage({clinic, content, team, specialties, doctorProfiles, navigate, book}: {
  clinic: Clinic | null;
  content: PublicWebContent | null;
  team: Doctor[];
  specialties: string[];
  doctorProfiles: Map<string, PublicDoctorProfile>;
  navigate: SharedProps['navigate'];
  book: SharedProps['book'];
}) {
  const branch = clinic?.branches?.[0];
  const address = branch?.address || clinic?.locationText;
  const directionsUrl = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : '';
  const clinicName = clinic?.name ?? 'Phòng khám Đa khoa Clinic V2';
  const featuredDoctors = team.slice(0, 3);
  const heroMedia = content?.clinic.media?.hero ?? {src:'/images/generated/clinic-exterior-ai.png',alt:'Hình ảnh minh họa ngoại thất phòng khám',caption:'Hình ảnh minh họa'};
  const receptionMedia = content?.clinic.media?.reception ?? {src:'/images/generated/clinic-reception-ai.png',alt:'Hình ảnh minh họa khu vực tiếp đón',caption:'Không gian tiếp đón · Hình ảnh minh họa'};
  const gallery = content?.clinic.media?.gallery?.length ? content.clinic.media.gallery : [
    {src:'/images/generated/clinic-waiting-area-ai.png',alt:'Hình ảnh minh họa không gian chờ',caption:'Không gian chờ · Minh họa'},
    {src:'/images/generated/clinic-consultation-room-ai.png',alt:'Hình ảnh minh họa phòng khám',caption:'Phòng khám · Minh họa'},
    {src:'/images/generated/clinic-corridor-ai.png',alt:'Hình ảnh minh họa khu vực hỗ trợ',caption:'Khu vực hỗ trợ · Minh họa'},
  ];

  return <div className="fresh-info-page fresh-about-v2">
    <main id="main-content">
      <section className="fresh-about-hero">
        <div className="fresh-container fresh-about-hero-grid">
          <div className="fresh-about-hero-copy">
            <span className="fresh-kicker">{clinicName}</span>
            <h1>Chăm sóc sức khỏe với quy trình rõ ràng và thuận tiện</h1>
            <p>Phòng khám cung cấp dịch vụ khám ngoại trú đa chuyên khoa, giúp người bệnh tìm hiểu bác sĩ, chuyên khoa và chủ động đặt lịch trước khi đến khám.</p>
            <button className="fresh-primary" type="button" onClick={() => book()}>Đặt lịch khám <ArrowRight size={18} /></button>
          </div>
          <figure className="fresh-about-hero-media">
            <img src={heroMedia.src} alt={heroMedia.alt} fetchPriority="high" />
            <figcaption>{heroMedia.caption ?? 'Hình ảnh minh họa'}</figcaption>
          </figure>
        </div>
      </section>

      <AboutReveal className="fresh-about-intro">
        <div className="fresh-container fresh-about-split">
          <figure className="fresh-about-editorial-image">
            <img src={receptionMedia.src} alt={receptionMedia.alt} loading="lazy" decoding="async" />
            <figcaption>{receptionMedia.caption ?? 'Hình ảnh minh họa'}</figcaption>
          </figure>
          <div className="fresh-about-intro-copy">
            <span className="fresh-kicker">Về phòng khám</span>
            <h2>{clinicName}</h2>
            <p>Phòng khám Đa khoa Clinic V2 hướng đến quy trình khám ngoại trú thuận tiện, rõ ràng và dễ tiếp cận. Người bệnh có thể tìm hiểu chuyên khoa, đội ngũ bác sĩ và dịch vụ trước khi lựa chọn lịch khám phù hợp.</p>
            <ul className="fresh-about-capability-list">
              <li><Stethoscope size={20} /><span>Khám ngoại trú đa chuyên khoa</span></li>
              <li><CalendarCheck2 size={20} /><span>Đặt lịch theo bác sĩ hoặc chuyên khoa</span></li>
              <li><UserRound size={20} /><span>Theo dõi lịch khám và thông tin bệnh nhân qua tài khoản</span></li>
            </ul>
          </div>
        </div>
      </AboutReveal>

      <AboutReveal className="fresh-about-capability-band">
        <div className="fresh-container fresh-about-capability-band-inner">
          <div><span className="fresh-kicker">Thông tin đang công bố</span><h2>Một hành trình khám được chuẩn bị từ trước khi bạn đến.</h2></div>
          <dl>
            <div><dt>{specialties.length}</dt><dd>chuyên khoa đang công bố</dd></div>
            <div><dt>{team.length}</dt><dd>bác sĩ đang công bố</dd></div>
            <div><dt><CalendarCheck2 size={29} /></dt><dd>chủ động chọn lịch trực tuyến</dd></div>
          </dl>
        </div>
      </AboutReveal>

      <AboutReveal className="fresh-about-facilities">
        <div className="fresh-container">
          <div className="fresh-about-section-head">
            <div><span className="fresh-kicker">Cơ sở vật chất</span><h2>Không gian được tổ chức cho hành trình khám ngoại trú.</h2></div>
            <p>{content?.clinic.facilities || 'Các hình ảnh dưới đây minh họa cách tổ chức một không gian khám hiện đại, sáng rõ và dễ tiếp cận.'}</p>
          </div>
          <div className="fresh-about-gallery">
            {gallery.slice(0,3).map((item,index)=><AboutGalleryImage key={item.src} src={item.src} alt={item.alt} caption={item.caption ?? 'Hình ảnh minh họa'} large={index===0} />)}
          </div>
        </div>
      </AboutReveal>

      <AboutReveal className="fresh-about-team">
        <div className="fresh-container">
          <div className="fresh-about-section-head fresh-about-team-head">
            <div><span className="fresh-kicker">Đội ngũ bác sĩ</span><h2>Tìm hiểu bác sĩ trước khi đặt lịch.</h2></div>
            <div><p>Xem chuyên khoa, thông tin chuyên môn đang được công bố và chọn bác sĩ phù hợp với nhu cầu khám.</p><button className="fresh-link" type="button" onClick={() => navigate('/bac-si')}>Xem tất cả bác sĩ <ArrowRight size={16} /></button></div>
          </div>
          <div className="fresh-doctor-grid fresh-about-doctor-grid">{featuredDoctors.map(doctor => <DoctorCard key={doctor.doctorId} doctor={doctor} profile={doctorProfiles.get(doctor.doctorId)} onProfile={() => navigate(`/bac-si/${doctor.doctorId}`)} onBook={() => book(doctor)} />)}</div>
          {!featuredDoctors.length && <Empty>Chưa có bác sĩ được công bố.</Empty>}
        </div>
      </AboutReveal>

      <AboutReveal className="fresh-about-process-section">
        <div className="fresh-container">
          <div className="fresh-about-section-head"><div><span className="fresh-kicker">Quy trình khám</span><h2>Một hành trình liền mạch, dễ theo dõi.</h2></div><p>Mỗi bước giúp người bệnh biết mình cần làm gì trước, trong và sau buổi khám.</p></div>
          <ol className="fresh-about-journey">
            <AboutJourneyStep number="01" title="Đặt lịch">Chọn chuyên khoa, bác sĩ và khung giờ phù hợp.</AboutJourneyStep>
            <AboutJourneyStep number="02" title="Đến phòng khám & check-in">Đến theo lịch hẹn và thực hiện thủ tục tiếp nhận.</AboutJourneyStep>
            <AboutJourneyStep number="03" title="Khám với bác sĩ">Thực hiện buổi khám theo hướng dẫn chuyên môn.</AboutJourneyStep>
            <AboutJourneyStep number="04" title="Theo dõi lịch khám / hồ sơ">Xem thông tin được phòng khám phát hành trong tài khoản.</AboutJourneyStep>
          </ol>
        </div>
      </AboutReveal>

      <AboutReveal className="fresh-about-location-section">
        <div className="fresh-container fresh-about-location-grid">
          <div className="fresh-about-location-copy">
            <span className="fresh-kicker">Địa chỉ & liên hệ</span>
            <h2>Hẹn gặp bạn tại {clinicName}</h2>
            {branch?.name && <strong>{branch.name}</strong>}
            {address && <p><MapPin size={19} /> {address}</p>}
            {branch?.openingHours && <p><Clock3 size={19} /> {branch.openingHours}</p>}
            <div className="fresh-actions">
              <button className="fresh-primary" type="button" onClick={() => book()}>Đặt lịch khám <ArrowRight size={17} /></button>
              {directionsUrl && <a className="fresh-secondary" href={directionsUrl} target="_blank" rel="noreferrer">Xem đường đi <Navigation size={16} /></a>}
            </div>
          </div>
          <ClinicMapPlaceholder clinicName={clinicName} branchName={branch?.name} address={address} />
        </div>
      </AboutReveal>
    </main>
  </div>;
}

function ContactClinicPage({clinic, content, book}: {clinic: Clinic | null; content: PublicWebContent | null; book: SharedProps['book']}) {
  const branches = clinic?.branches ?? [];
  const primaryBranch = branches[0];
  const clinicName = clinic?.name ?? 'Phòng khám Đa khoa Clinic V2';
  const primaryAddress = primaryBranch?.address || clinic?.locationText;
  const directionsUrl = primaryAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(primaryAddress)}` : '';
  const contactMedia = content?.clinic.media?.contact ?? {src:'/images/generated/clinic-corridor-ai.png',alt:'Hình ảnh minh họa không gian phòng khám',caption:'Hình ảnh minh họa'};

  return <div className="fresh-info-page fresh-contact-v2">
    <main id="main-content">
      <section className="fresh-contact-hero">
        <div className="fresh-container fresh-contact-hero-grid">
          <div className="fresh-contact-hero-copy">
            <span className="fresh-kicker">Địa chỉ & liên hệ</span>
            <h1>Tìm đường đến phòng khám và chủ động chuẩn bị lịch khám.</h1>
            <p>Xem địa chỉ, thời gian tiếp nhận đang được cấu hình và chọn lịch khám phù hợp trước khi đến phòng khám.</p>
            <div className="fresh-actions">
              <button className="fresh-primary" type="button" onClick={() => book()}>Đặt lịch khám <ArrowRight size={18} /></button>
              {directionsUrl && <a className="fresh-secondary" href={directionsUrl} target="_blank" rel="noreferrer">Xem đường đi <Navigation size={16} /></a>}
            </div>
          </div>
          <figure className="fresh-contact-hero-media">
            <img src={contactMedia.src} alt={contactMedia.alt} fetchPriority="high" />
            <figcaption>{contactMedia.caption ?? 'Hình ảnh minh họa'}</figcaption>
            {(primaryBranch?.name || primaryAddress) && <div className="fresh-contact-hero-address"><MapPin size={21} /><span>{primaryBranch?.name && <strong>{primaryBranch.name}</strong>}{primaryAddress && <small>{primaryAddress}</small>}</span></div>}
          </figure>
        </div>
      </section>

      <AboutReveal className="fresh-contact-details" >
        <div className="fresh-container">
          <div className="fresh-contact-section-head">
            <div><span className="fresh-kicker">Thông tin phòng khám</span><h2>Thông tin cần thiết trước khi bạn đến.</h2></div>
            <p>Các thông tin dưới đây được lấy trực tiếp từ cấu hình công khai của phòng khám.</p>
          </div>
          <div className="fresh-contact-details-grid">
            <div className="fresh-contact-directory">
              {branches.map(branch => {
                const branchDirections = branch.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(branch.address)}` : '';
                return <article key={branch.branchId}>
                  <span className="fresh-contact-index">Cơ sở</span>
                  <h3>{branch.name}</h3>
                  {branch.address && <p><MapPin size={18} /> {branch.address}</p>}
                  {branch.openingHours && <p><Clock3 size={18} /> {branch.openingHours}</p>}
                  {branchDirections && <a href={branchDirections} target="_blank" rel="noreferrer">Mở chỉ đường <Navigation size={15} /></a>}
                </article>;
              })}
              {clinic?.phone && <article><span className="fresh-contact-index">Liên hệ</span><h3>Điện thoại phòng khám</h3><a className="fresh-contact-phone" href={`tel:${clinic.phone.replace(/[^0-9+]/g, '')}`}>{clinic.phone}</a></article>}
              {!branches.length && !clinic?.phone && <Empty>Thông tin địa chỉ và liên hệ chưa được phòng khám công bố.</Empty>}
            </div>
            <ClinicMapPlaceholder clinicName={clinicName} branchName={primaryBranch?.name} address={primaryAddress} />
          </div>
        </div>
      </AboutReveal>

      <AboutReveal className="fresh-contact-before-visit">
        <div className="fresh-container">
          <div className="fresh-contact-section-head">
            <div><span className="fresh-kicker">Trước khi đến</span><h2>Ba bước để buổi khám thuận tiện hơn.</h2></div>
            <button className="fresh-link" type="button" onClick={() => book()}>Bắt đầu đặt lịch <ArrowRight size={16} /></button>
          </div>
          <ol className="fresh-contact-prep-list">
            <li><span>01</span><div><h3>Chọn lịch phù hợp</h3><p>Tìm bác sĩ hoặc chuyên khoa, sau đó chọn ngày và khung giờ đang còn trống.</p></div></li>
            <li><span>02</span><div><h3>Kiểm tra thông tin lịch hẹn</h3><p>Xem lại bác sĩ, cơ sở và thời gian trong khu vực tài khoản bệnh nhân.</p></div></li>
            <li><span>03</span><div><h3>Đến theo lịch hẹn</h3><p>Đến đúng cơ sở đã chọn và thực hiện thủ tục tiếp nhận theo hướng dẫn.</p></div></li>
          </ol>
        </div>
      </AboutReveal>

      <section className="fresh-contact-cta">
        <div className="fresh-container"><div><span className="fresh-kicker">Chủ động trước khi đến</span><h2>Chọn lịch khám phù hợp ngay từ bây giờ.</h2></div><button className="fresh-primary" type="button" onClick={() => book()}>Đặt lịch khám <ArrowRight size={18} /></button></div>
      </section>
    </main>
  </div>;
}

function AboutReveal({className, children}: {className: string; children: ReactNode}) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;
    if (typeof window === 'undefined' || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      setVisible(true);
      observer.disconnect();
    }, {threshold: 0.12, rootMargin: '0px 0px -40px'});
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <section ref={sectionRef} className={`fresh-about-reveal ${className}${visible ? ' is-visible' : ''}`}>{children}</section>;
}

function AboutGalleryImage({src, alt, caption, large = false}: {src: string; alt: string; caption: string; large?: boolean}) {
  return <figure className={`fresh-about-gallery-item${large ? ' is-large' : ''}`}><img src={src} alt={alt} loading="lazy" decoding="async" /><figcaption>{caption}</figcaption></figure>;
}

function AboutJourneyStep({number, title, children}: {number: string; title: string; children: ReactNode}) {
  return <li><span>{number}</span><div><h3>{title}</h3><p>{children}</p></div></li>;
}

function ClinicMapPlaceholder({clinicName, branchName, address}: {clinicName: string; branchName?: string; address?: string}) {
  return <div className="fresh-about-map" role="img" aria-label={address ? `Sơ đồ minh họa vị trí ${address}` : 'Khu vực bản đồ phòng khám'}>
    <span className="fresh-about-map-road fresh-about-map-road-a" />
    <span className="fresh-about-map-road fresh-about-map-road-b" />
    <span className="fresh-about-map-road fresh-about-map-road-c" />
    <span className="fresh-about-map-pin"><MapPin size={26} /></span>
    <div><strong>{branchName || clinicName}</strong>{address && <small>{address}</small>}</div>
  </div>;
}

function pageDescription(view: PublicInfoView) {
  if (view === 'doctors') return 'Tìm bác sĩ phù hợp với nhu cầu khám của bạn.';
  if (view === 'specialties' || view === 'specialty') return 'Bắt đầu từ chuyên khoa để khám phá bác sĩ và lịch khám đang công bố.';
  if (view === 'services' || view === 'service') return 'Thông tin dịch vụ công khai, không hiển thị giá trên trang giới thiệu.';
  if (view === 'contact') return 'Thông tin được lấy từ cấu hình công khai của phòng khám.';
  return 'Tìm hiểu cách phòng khám tổ chức hành trình chăm sóc và hỗ trợ người bệnh.';
}

function ClinicIllustration({clinicName, media}: {clinicName: string; media?: PublicMediaItem}) {
  const item=media ?? {src:'/images/generated/clinic-exterior-ai.png',alt:'Hình ảnh minh họa ngoại thất phòng khám hiện đại',caption:'Hình ảnh minh họa'};
  return <div className="fresh-hero-visual"><span className="fresh-visual-caption">{item.caption ?? 'Hình ảnh minh họa'}</span><img src={item.src} alt={item.alt} fetchPriority="high" /><div className="fresh-visual-card"><span><CalendarCheck2 size={22} /></span><div><small>Đặt lịch trực tiếp</small><strong>{clinicName}</strong><p>Chọn bác sĩ · Chọn giờ · Xác nhận</p></div></div></div>;
}

function FacilityPhoto({media}: {media?: PublicMediaItem}) {
  const item=media ?? {src:'/images/generated/clinic-reception-ai.png',alt:'Hình ảnh minh họa khu tiếp đón của phòng khám',caption:'Hình ảnh minh họa khu tiếp đón'};
  return <figure className="fresh-facility-photo"><img src={item.src} alt={item.alt} loading="lazy" decoding="async" /><figcaption>{item.caption ?? 'Hình ảnh minh họa'}</figcaption></figure>;
}

function SearchGroup({title, children}: {title: string; children: ReactNode}) { return <section><strong>{title}</strong>{children}</section>; }
function SectionHead({kicker, title, description, action, onAction}: {kicker: string; title: string; description: string; action: string; onAction: () => void}) { return <div className="fresh-section-head"><div><span className="fresh-kicker">{kicker}</span><h2>{title}</h2><p>{description}</p></div><button onClick={onAction}>{action} <ArrowRight size={16} /></button></div>; }
function Fact({icon, children}: {icon: ReactNode; children: ReactNode}) { return <article className="fresh-fact">{icon}<strong>{children}</strong></article>; }
function Step({n, title, children}: {n: string; title: string; children: ReactNode}) { return <li><span>{n}</span><div><h3>{title}</h3><p>{children}</p></div></li>; }
function Faq({question, children}: {question: string; children: ReactNode}) { return <details><summary>{question}<span aria-hidden="true">+</span></summary><p>{children}</p></details>; }
function Empty({children}: {children: ReactNode}) { return <p className="fresh-dev-note">{children}</p>; }
function ContentList({items}: {items: string[]}) { return <ul className="fresh-detail-list">{items.map(item=><li key={item}><Check size={15} aria-hidden="true"/><span>{item}</span></li>)}</ul>; }
function DoctorMonogram({name, large = false}: {name: string; large?: boolean}) { return <span className={`fresh-doctor-monogram${large ? ' is-large' : ''}`} aria-hidden="true"><UserRound size={large ? 36 : 18} /><strong>{doctorInitials(name)}</strong></span>; }

function DoctorPortrait({name, profile, large = false, compact = false}: {name: string; profile?: PublicDoctorProfile; large?: boolean; compact?: boolean}) {
  const className = `fresh-doctor-portrait${large ? ' is-large' : ''}${compact ? ' is-compact' : ''}`;
  if (profile?.imageUrl) return <span className={className} role="img" aria-label={`Ảnh minh họa bác sĩ ${name}`}><img src={profile.imageUrl} alt="" aria-hidden="true" loading="lazy" decoding="async" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}} />{!compact && <small>Ảnh minh họa</small>}</span>;
  const codeNumber = Number(profile?.code?.replace(/\D/g, ''));
  const portraitIndex = codeNumber - 5;
  if (!Number.isInteger(portraitIndex) || portraitIndex < 0 || portraitIndex > 17) return <DoctorMonogram name={name} large={large} />;
  const sheet = Math.floor(portraitIndex / 6) + 1;
  const position = portraitIndex % 6;
  const column = position % 3;
  const row = Math.floor(position / 3);
  return <span className={className} role="img" aria-label={`Ảnh minh họa bác sĩ ${name}`}><img src={`/images/generated/doctor-portraits-0${sheet}-ai.png`} alt="" aria-hidden="true" loading="lazy" decoding="async" style={{left: `-${column * 100}%`, top: `-${row * 100}%`}} />{!compact && <small>Ảnh minh họa</small>}</span>;
}

function DoctorCard({doctor, profile, onProfile, onBook}: {doctor: Doctor; profile?: PublicDoctorProfile; onProfile: () => void; onBook: () => void}) {
  const profileLine=profile ? [profile.title,profile.yearsExperience != null && profile.yearsExperience > 0 ? `${profile.yearsExperience} năm kinh nghiệm` : null].filter(Boolean).join(' · ') : doctor.professionalTitle;
  return <article><div className="fresh-doctor-photo"><DoctorPortrait name={doctor.displayName} profile={profile} /></div><span>{doctor.specialtyName ?? 'Bác sĩ tại phòng khám'}</span><h3>{doctor.displayName}</h3><p>{profileLine}</p>{profile?.summary && <small className="fresh-doctor-summary">{profile.summary}</small>}<div><button onClick={onProfile}>Xem hồ sơ</button><button aria-label={`Đặt lịch với ${doctor.displayName}`} onClick={onBook}>Đặt lịch</button></div></article>;
}

function AsideBooking({title, description, onBook}: {title: string; description: string; onBook: () => void}) {
  return <aside className="fresh-booking-aside"><CalendarCheck2 size={26} /><h3>{title}</h3><p>{description}</p><button className="fresh-primary" onClick={onBook}>Xem lịch trống <ArrowRight size={16} /></button><small>Bạn có thể chọn lịch trước khi đăng nhập.</small></aside>;
}

function LocationContent({clinic, book}: {clinic: Clinic | null; book: SharedProps['book']}) {
  const branches = clinic?.branches ?? [];
  return <><div className="fresh-location-copy"><span className="fresh-kicker">Địa chỉ & liên hệ</span><h2>Hẹn gặp bạn tại phòng khám</h2><p>Thông tin bên cạnh chỉ xuất hiện khi có dữ liệu cấu hình thật từ phòng khám.</p><button className="fresh-primary" onClick={() => book()}>Đặt lịch khám <ArrowRight size={17} /></button></div><div className="fresh-location-panel">{branches.map(branch => <article key={branch.branchId}><span className="fresh-location-icon"><MapPin size={21} /></span><div><strong>{branch.name}</strong>{branch.address && <p>{branch.address}</p>}{branch.openingHours && <p><Clock3 size={15} /> {branch.openingHours}</p>}{branch.address && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(branch.address)}`} target="_blank" rel="noreferrer">Xem đường đi <Navigation size={14} /></a>}</div></article>)}{clinic?.phone && <a className="fresh-phone" href={`tel:${clinic.phone.replace(/[^0-9+]/g, '')}`}>Hotline <strong>{clinic.phone}</strong></a>}{!branches.length && !clinic?.phone && <Empty>Thông tin liên hệ chưa được phòng khám công bố.</Empty>}</div></>;
}
