import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DashboardPage from './DashboardPage';
import AppointmentsPage from './AppointmentsPage';
import InvoicesPage from './InvoicesPage';
import MedicalRecordsPage from './MedicalRecordsPage';
import Sidebar from '../layouts/Sidebar';
import NotificationsPage from './NotificationsPage';
import CatalogPage from './CatalogPage';
import ReceptionAppointmentsPage, { allowedQueueTransitions } from './ReceptionAppointmentsPage';
import ReceptionPatientsPage from './ReceptionPatientsPage';
import DoctorsPage from './DoctorsPage';
import type { CurrentUser, DashboardResponse } from '../types/domain';

const patient: CurrentUser = { id: 'p', email: 'patient@clinic.test', fullName: 'Current Patient', roles: ['ROLE_PATIENT'] };
const doctor: CurrentUser = { id: 'd', email: 'doctor@clinic.test', roles: ['ROLE_DOCTOR'] };
const admin: CurrentUser = { id: 'a', email: 'admin@clinic.test', roles: ['ROLE_ADMIN'] };
const receptionist: CurrentUser = { id: 'r', email: 'reception@clinic.test', roles: ['ROLE_RECEPTIONIST'] };
const emptyDashboard: DashboardResponse = { user: patient, appointments: [], medicalRecords: [], invoices: [] };
const noop = () => undefined;

describe('role-aware pages and empty states', () => {
  it('renders only authorized sidebar links for patients', () => {
    const html = renderToStaticMarkup(<Sidebar activeItemId="dashboard" user={patient} onNavigate={noop} onLogout={noop} />);
    expect(html).not.toContain('Doctor Profile');
    expect(html).toContain('Invoices');
  });

  it('does not render invoices or staff-wide data for a doctor', () => {
    const html = renderToStaticMarkup(<Sidebar activeItemId="dashboard" user={doctor} onNavigate={noop} onLogout={noop} />);
    expect(html).not.toContain('Invoices');
    expect(html).toContain('Doctor Profile');
    const dashboard = renderToStaticMarkup(<DashboardPage dashboard={null} user={doctor} role="DOCTOR" error={null} loading={false} onRefresh={noop} />);
    expect(dashboard).toContain('role-scoped dashboard');
    expect(dashboard).not.toContain('Revenue');
  });

  it('shows genuine empty patient dashboard instead of fake figures', () => {
    const html = renderToStaticMarkup(<DashboardPage dashboard={emptyDashboard} user={patient} role="PATIENT" error={null} loading={false} onRefresh={noop} />);
    expect(html).toContain('Welcome, Current Patient');
    expect(html).toContain('No appointments found.');
    expect(html).toContain('No medical records found.');
    expect(html).toContain('No invoices found.');
    expect(html).not.toContain('Olivia');
    expect(html).not.toContain('748,839');
  });

  it('renders empty appointment, invoice, and record lists without patient data', () => {
    const appointments = renderToStaticMarkup(<AppointmentsPage appointments={[]} role="PATIENT" error={null} loading={false} onRefresh={noop} />);
    const invoices = renderToStaticMarkup(<InvoicesPage invoices={[]} role="PATIENT" error={null} loading={false} onRefresh={noop} />);
    const records = renderToStaticMarkup(<MedicalRecordsPage records={[]} role="PATIENT" error={null} loading={false} onRefresh={noop} />);
    expect(appointments).toContain('No appointments found.');
    expect(invoices).toContain('No invoices found.');
    expect(records).toContain('No medical records found.');
    expect(invoices).not.toContain('December 12, 2024');
    expect(records).not.toContain('December 26, 2024');
  });

  it('never renders medical-record navigation or search for administrators or receptionists', () => {
    for (const user of [admin, receptionist]) {
      const html = renderToStaticMarkup(<Sidebar activeItemId="dashboard" user={user} onNavigate={noop} onLogout={noop} />);
      expect(html).not.toContain('Medical Records');
      const role = user.roles?.[0] === 'ROLE_ADMIN' ? 'ADMIN' : 'RECEPTIONIST';
      const records = renderToStaticMarkup(<MedicalRecordsPage records={[]} role={role} error={null} loading={false} onRefresh={noop} />);
      expect(records).toContain('restricted to patients');
      expect(records).not.toContain('Patient UUID');
      expect(records).not.toContain('Diagnosis');
    }
  });

  it('isolates navigation when a user switches from patient to admin or doctor accounts', () => {
    const patientMenu = renderToStaticMarkup(<Sidebar activeItemId="dashboard" user={patient} onNavigate={noop} onLogout={noop} />);
    const adminMenu = renderToStaticMarkup(<Sidebar activeItemId="dashboard" user={admin} onNavigate={noop} onLogout={noop} />);
    const doctorMenu = renderToStaticMarkup(<Sidebar activeItemId="dashboard" user={doctor} onNavigate={noop} onLogout={noop} />);
    expect(patientMenu).toContain('Medical Records');
    expect(adminMenu).not.toContain('Medical Records');
    expect(doctorMenu).not.toContain('Invoices');
    const multiRole = { ...admin, roles: ['ROLE_ADMIN', 'ROLE_PATIENT'] };
    const multiRoleMenu = renderToStaticMarkup(<Sidebar activeItemId="dashboard" user={multiRole} onNavigate={noop} onLogout={noop} />);
    expect(multiRoleMenu).not.toContain('Medical Records');
  });

  it('blocks unmerged Task 02–06 screens without showing fake data or mutation buttons', () => {
    const catalog = renderToStaticMarkup(<CatalogPage role="ADMIN" />);
    const notifications = renderToStaticMarkup(<NotificationsPage />);
    const reception = renderToStaticMarkup(<ReceptionAppointmentsPage role="RECEPTIONIST" />);
    const patients = renderToStaticMarkup(<ReceptionPatientsPage role="RECEPTIONIST" />);
    const doctors = renderToStaticMarkup(<DoctorsPage role="ADMIN" />);
    expect(catalog).toContain('unmerged');
    expect(notifications).toContain('unavailable');
    expect(reception).toContain('unavailable');
    expect(patients).toContain('unavailable');
    expect(doctors).toContain('unmerged');
    expect(notifications).not.toContain('Mark as read');
    expect(reception).not.toContain('Check in');
    expect(patients).not.toContain('Register patient');
  });

  it('does not show cash/online payment controls to a patient or record a fake payment', () => {
    const invoice = { id: 'invoice', patientId: 'patient', appointmentId: 'appointment', totalAmount: '100000', currency: 'VND', status: 'UNPAID' as const,
      items: [{ id: 'item', sourceType: 'SERVICE', sourceId: 'source', serviceId: 'service', serviceCode: 'CONSULT', serviceName: 'Consultation',
        priceId: 'version-1', serviceDate: '2026-09-20', unitPrice: '100000', quantity: 1, lineAmount: '100000', currency: 'VND' }] };
    const html = renderToStaticMarkup(<InvoicesPage invoices={[invoice]} role="PATIENT" error={null} loading={false} onRefresh={noop} />);
    expect(html).toContain('Online payment is unavailable');
    expect(html).toContain('VND');
    expect(html).toContain('Consultation');
    expect(html).toContain('version-1');
    expect(html).not.toContain('Confirm cash receipt');
    expect(html).not.toContain('Payment successful');
  });

  it('renders refund/reconciliation status as server-provided facts, never as a payment success', () => {
    for (const status of ['REFUNDED', 'RECONCILIATION_REQUIRED'] as const) {
      const html = renderToStaticMarkup(<InvoicesPage invoices={[{ id: 'invoice', patientId: 'patient', appointmentId: 'appointment', totalAmount: 0, currency: 'VND', status }]} role="PATIENT" error={null} loading={false} onRefresh={noop} />);
      expect(html).toContain(status);
      expect(html).not.toContain('Confirm cash receipt');
      expect(html).not.toContain('Payment successful');
    }
  });

  it('keeps Task 03 queue transition controls aligned with server role permissions', () => {
    expect(allowedQueueTransitions('WAITING', 'RECEPTIONIST')).toEqual(['CALLED', 'SKIPPED']);
    expect(allowedQueueTransitions('CALLED', 'RECEPTIONIST')).toEqual(['SKIPPED']);
    expect(allowedQueueTransitions('CALLED', 'DOCTOR')).toEqual(['IN_PROGRESS', 'SKIPPED']);
    expect(allowedQueueTransitions('IN_PROGRESS', 'RECEPTIONIST')).toEqual([]);
    expect(allowedQueueTransitions('IN_PROGRESS', 'DOCTOR')).toEqual(['COMPLETED']);
    expect(allowedQueueTransitions('COMPLETED', 'ADMIN')).toEqual([]);
  });
});
