import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AppointmentResponse, CurrentUser, DashboardResponse, MedicalRecordResponse } from '../types/domain';

vi.mock('../config/integrations.config', () => ({ integrations: {
  appointmentOwnership: true, reception: true, adminCatalog: true, notifications: true, billing: true
} }));
import PatientDashboard from './PatientDashboard';
import AppointmentsPage from './AppointmentsPage';
import PatientsPage from './PatientsPage';
import DoctorsPage from './DoctorsPage';
import MedicalRecordsPage from './MedicalRecordsPage';
import InvoicesPage from './InvoicesPage';
import NotificationsPage from './NotificationsPage';
import SettingsPage from './SettingsPage';
import Sidebar from '../layouts/Sidebar';
import Topbar from '../layouts/Topbar';

const user: CurrentUser = { id: 'identity-123', fullName: 'Bệnh nhân kiểm thử', email: 'patient@clinic.test', roles: ['ROLE_PATIENT'], status: 'ACTIVE' };
const appointment: AppointmentResponse = { id: 'appointment-real-01', patientId: 'patient-profile-01', doctorId: 'doctor-real-01',
  appointmentDate: '2099-09-22', startTime: '09:00:00', endTime: '09:30:00', status: 'CONFIRMED', reason: 'Tái khám' };
const record: MedicalRecordResponse = { id: 'record-01', appointmentId: appointment.id, patientId: appointment.patientId,
  doctorId: appointment.doctorId, diagnosis: 'Chẩn đoán theo API', prescriptions: [{ id: 'prescription-01',
    items: [{ id: 'medicine-01', medicineName: 'Thuốc kiểm thử', dosage: 'Một viên', frequency: 'Mỗi ngày', duration: 'Một tuần' }] }] };
const dashboard: DashboardResponse = { user, appointments: [appointment], medicalRecords: [record], invoices: [] };
const noop = () => undefined;

describe('patient portal role isolation and actual data', () => {
  it('renders only patient-supplied dashboard figures and a real upcoming visit, never staff-wide totals', () => {
    const html = renderToStaticMarkup(<PatientDashboard data={dashboard} user={user} onNavigate={noop} />);
    expect(html).toContain('patient-dashboard');
    expect(html).toContain('Bệnh nhân kiểm thử');
    expect(html).toContain('Tái khám');
    expect(html).toContain('1 lịch sắp tới');
    expect(html).not.toContain('Doanh thu phòng khám');
    expect(html).not.toContain('clinic-preview-dashboard');
  });

  it('shows personal bookings, status and confirmation flow, without staff check-in actions', () => {
    const html = renderToStaticMarkup(<AppointmentsPage appointments={[appointment]} role="PATIENT" error={null} loading={false} onRefresh={noop} />);
    expect(html).toContain('patient-portal');
    expect(html).toContain('Tái khám');
    expect(html).toContain('Đặt lịch mới');
    expect(html).toContain('Yêu cầu hủy lịch');
    expect(html).not.toContain('Check-in bệnh nhân');
    expect(html).not.toContain('Xác nhận thu tiền mặt');
  });

  it('uses only the personal profile path with loading state, never the staff directory', () => {
    const html = renderToStaticMarkup(<PatientsPage role="PATIENT" user={user} />);
    expect(html).toContain('Hồ sơ của tôi');
    expect(html).toContain('Đang tải hồ sơ bệnh nhân');
    expect(html).not.toContain('reception-patients');
    expect(html).not.toContain('Đăng ký bệnh nhân vãng lai');
  });

  it('uses the public active doctor directory without administrative controls', () => {
    const html = renderToStaticMarkup(<DoctorsPage role="PATIENT" />);
    expect(html).toContain('Bác sĩ phòng khám');
    expect(html).toContain('Đang tải danh sách bác sĩ');
    expect(html).not.toContain('Ngừng hoạt động bác sĩ');
    expect(html).not.toContain('admin-doctors');
  });

  it('shows the actual diagnosis and prescription without doctor edit controls', () => {
    const html = renderToStaticMarkup(<MedicalRecordsPage role="PATIENT" records={[record]} error={null} loading={false} onRefresh={noop} />);
    expect(html).toContain('Chẩn đoán theo API');
    expect(html).toContain('Thuốc kiểm thử');
    expect(html).toContain('Kết quả được công bố');
    expect(html).not.toContain('Tạo bệnh án');
    expect(html).not.toContain('Công bố kết quả cho bệnh nhân');
  });

  it('keeps invoice actions read-only for patients and only loads their own invoices', () => {
    const html = renderToStaticMarkup(<InvoicesPage role="PATIENT" invoices={[]} error={null} loading={false} onRefresh={noop} />);
    expect(html).toContain('patient-invoices');
    expect(html).toContain('Hóa đơn của tôi');
    expect(html).not.toContain('Xuất hóa đơn');
    expect(html).not.toContain('Xác nhận thu tiền mặt');
    expect(html).not.toContain('Tra cứu hóa đơn theo bệnh nhân');
  });

  it('shows only the patient inbox with unread focus and no organization-wide actions', () => {
    const html = renderToStaticMarkup(<NotificationsPage role="PATIENT" />);
    expect(html).toContain('patient-notifications');
    expect(html).toContain('KHÔNG GIAN BỆNH NHÂN');
    expect(html).toContain('Thông báo chưa đọc của tôi');
    expect(html).toContain('Hộp thư riêng tư');
    expect(html).not.toContain('Danh sách thông báo toàn hệ thống');
  });

  it('separates patient settings, navigation and breadcrumb from staff roles', () => {
    const settings = renderToStaticMarkup(<SettingsPage role="PATIENT" user={user} />);
    const sidebar = renderToStaticMarkup(<Sidebar activeItemId="patients" user={user} onNavigate={noop} onLogout={noop} />);
    const topbar = renderToStaticMarkup(<Topbar primaryRole="PATIENT" user={user} loading={false} onRefresh={noop} activeView="patients" menuButton={null} />);
    expect(settings).toContain('patient-settings');
    expect(settings).toContain('Hồ sơ bệnh nhân');
    expect(settings).not.toContain('admin-settings-workspace');
    expect(sidebar).toContain('BỆNH NHÂN');
    expect(sidebar).toContain('Hồ sơ của tôi');
    expect(sidebar).not.toContain('Hồ sơ bác sĩ');
    expect(topbar).toContain('Clinic / Bệnh nhân');
    expect(topbar).toContain('Hồ sơ của tôi');
  });

  it('shows the signed-in account in the compact header profile card', () => {
    const admin = { ...user, fullName: 'Demo Administrator', roles: ['ROLE_ADMIN'] };
    const topbar = renderToStaticMarkup(<Topbar primaryRole="ADMIN" user={admin} loading={false}
      onRefresh={noop} activeView="dashboard" menuButton={null} />);
    expect(topbar).toContain('aria-label="Tài khoản hiện tại"');
    expect(topbar).toContain('class="user-menu-details"');
    expect(topbar).toContain('Demo Administrator');
    expect(topbar).toContain('Quản trị viên');
    expect(topbar).toContain('>DA</span>');
  });
});
