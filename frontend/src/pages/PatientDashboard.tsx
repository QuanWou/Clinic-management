import { ArrowRight, CalendarCheck2, CalendarDays, Clock3, FileText, HeartPulse, ReceiptText, ShieldCheck, Stethoscope } from 'lucide-react';
import Badge from '../components/Badge';
import type { CurrentUser, DashboardResponse } from '../types/domain';
import type { AppView } from '../types/view';
import { clinicToday } from '../api/staffDashboard';
import { formatDate, formatTime, shortId } from '../utils/format';
import { statusLabel } from '../utils/locale';
import './patientPortal.css';

export default function PatientDashboard({ data, user, onNavigate }: { data: DashboardResponse; user: CurrentUser; onNavigate?: (view: AppView) => void }) {
  const today = clinicToday();
  const upcoming = data.appointments.filter((item) => item.appointmentDate >= today && ['PENDING', 'CONFIRMED'].includes(item.status))
    .sort((a, b) => `${a.appointmentDate}${a.startTime}`.localeCompare(`${b.appointmentDate}${b.startTime}`));
  const unpaid = data.invoices.filter((item) => item.status === 'UNPAID').length;
  const next = upcoming[0];
  const actions: { label: string; description: string; view: AppView; icon: typeof CalendarDays }[] = [
    { label: 'Lịch hẹn', description: 'Xem và yêu cầu lịch khám', view: 'appointments', icon: CalendarDays },
    { label: 'Bác sĩ', description: 'Tìm bác sĩ đang hoạt động', view: 'doctors', icon: Stethoscope },
    { label: 'Bệnh án', description: 'Xem hồ sơ của chính bạn', view: 'medical-records', icon: FileText },
    { label: 'Hóa đơn', description: 'Theo dõi chi phí và trạng thái', view: 'invoices', icon: ReceiptText }
  ];
  return <div className="patient-portal patient-dashboard" aria-label="Tổng quan bệnh nhân">
    <section className="patient-hero"><div><span className="patient-kicker"><ShieldCheck size={15} /> CỔNG THÔNG TIN BỆNH NHÂN · DỮ LIỆU CÁ NHÂN</span>
      <h3>Chủ động theo dõi sức khỏe của bạn.</h3><p>Xin chào {user.fullName || user.email}. Lịch khám, bệnh án và chi phí dưới đây được tổng hợp riêng từ tài khoản đang đăng nhập.</p>
      <div className="patient-hero-tags"><span><CalendarDays size={15} /> {formatDate(today)}</span><span><CalendarCheck2 size={15} /> {upcoming.length} lịch sắp tới</span></div></div>
      {onNavigate && <button type="button" className="patient-hero-action" onClick={() => onNavigate('appointments')}>Xem lịch khám <ArrowRight size={17} /></button>}
    </section>
    <section className="patient-metrics" aria-label="Số liệu cá nhân">{[
      { label: 'Lịch khám của tôi', value: data.appointments.length, hint: 'Tất cả trạng thái', icon: CalendarDays, tone: 'green' },
      { label: 'Lịch sắp tới', value: upcoming.length, hint: 'Chờ hoặc đã xác nhận', icon: Clock3, tone: 'blue' },
      { label: 'Hồ sơ bệnh án', value: data.medicalRecords.length, hint: 'Trong hồ sơ của tôi', icon: FileText, tone: 'purple' },
      { label: 'Hóa đơn chưa thanh toán', value: unpaid, hint: 'Trạng thái từ Billing', icon: ReceiptText, tone: 'orange' }
    ].map(({ label, value, hint, icon: Icon, tone }) => <article key={label}><span className={`patient-metric-icon ${tone}`}><Icon size={21} /></span><strong>{value}</strong><h4>{label}</h4><p>{hint}</p></article>)}</section>
    <div className="patient-dashboard-layout"><section className="panel patient-panel"><div className="patient-section-head"><div><span>LỊCH KHÁM CỦA TÔI</span><h3>Lịch khám sắp tới</h3><p>{upcoming.length ? 'Những lịch khám cần theo dõi.' : 'Chưa có lịch khám sắp tới.'}</p></div>
        {onNavigate && <button type="button" className="soft-button" onClick={() => onNavigate('appointments')}>Tất cả lịch <ArrowRight size={15} /></button>}</div>
        {!next && <div className="patient-empty"><CalendarDays size={30} /><strong>Bạn chưa có lịch khám sắp tới</strong><p>Bạn có thể xem bác sĩ và yêu cầu đặt lịch trong mục Lịch hẹn.</p></div>}
        {next && <div className="patient-next"><div className="patient-next-date"><CalendarDays size={22} /><strong>{formatDate(next.appointmentDate)}</strong><span>{formatTime(next.startTime)}–{formatTime(next.endTime)}</span></div>
          <div><span>LỊCH GẦN NHẤT</span><h4>Bác sĩ #{shortId(next.doctorId)}</h4><p>{next.reason?.trim() || 'Chưa ghi lý do khám.'}</p><Badge tone={next.status}>{statusLabel(next.status)}</Badge></div></div>}
        {upcoming.slice(next ? 1 : 0, 4).map((item) => <div className="patient-compact-row" key={item.id}><span className="patient-row-icon"><CalendarCheck2 size={18} /></span><div><strong>{formatDate(item.appointmentDate)} · {formatTime(item.startTime)}</strong><small>Bác sĩ #{shortId(item.doctorId)} · Lịch #{shortId(item.id)}</small></div><Badge tone={item.status}>{statusLabel(item.status)}</Badge></div>)}
      </section><div className="patient-dashboard-side"><section className="panel patient-panel"><div className="patient-section-head"><div><span>HỒ SƠ CỦA BẠN</span><h3>Tóm tắt sức khỏe</h3></div><HeartPulse size={23} /></div>
          <div className="patient-info-row"><FileText size={20} /><div><strong>{data.medicalRecords.length} hồ sơ bệnh án</strong><p>{data.medicalRecords.length ? 'Hồ sơ bệnh án của bạn đã có trong hệ thống.' : 'Chưa có hồ sơ bệnh án.'}</p></div></div>
          {onNavigate && <button className="patient-text-action" type="button" onClick={() => onNavigate('medical-records')}>Xem bệnh án <ArrowRight size={15} /></button>}</section>
        <section className="panel patient-panel"><div className="patient-section-head"><div><span>CHI PHÍ KHÁM</span><h3>Hóa đơn của tôi</h3></div><ReceiptText size={23} /></div>
          <div className="patient-info-row"><ReceiptText size={20} /><div><strong>{data.invoices.length} hóa đơn</strong><p>{data.invoices.length ? `${unpaid} hóa đơn chưa thanh toán.` : 'Chưa có hóa đơn.'}</p></div></div>
          {onNavigate && <button className="patient-text-action" type="button" onClick={() => onNavigate('invoices')}>Xem hóa đơn <ArrowRight size={15} /></button>}</section></div></div>
    <section className="panel patient-panel"><div className="patient-section-head"><div><span>TRUY CẬP NHANH</span><h3>Tiếp tục với Clinic</h3><p>Chọn công việc bạn cần trong phạm vi tài khoản bệnh nhân.</p></div></div>
      <div className="patient-shortcuts">{actions.map(({ label, description, view, icon: Icon }) => <button key={view} type="button" disabled={!onNavigate} onClick={() => onNavigate?.(view)}><span><Icon size={22} /></span><strong>{label}</strong><small>{description}</small><ArrowRight size={17} /></button>)}</div></section>
  </div>;
}