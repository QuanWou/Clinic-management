import { describe, expect, it } from 'vitest';
import { getUiAppointments, getUiInvoices, getUiMedicalRecords } from './uiData';
import type { AppointmentResponse, InvoiceResponse, MedicalRecordResponse } from '../types/domain';

describe('live API presentation', () => {
  it('never substitutes demo records for a missing or empty response', () => {
    expect(getUiAppointments()).toEqual([]);
    expect(getUiAppointments([])).toEqual([]);
    expect(getUiMedicalRecords(null)).toEqual([]);
    expect(getUiInvoices([])).toEqual([]);
  });

  it('maps only real appointment ids and does not fabricate personal names', () => {
    const appointment: AppointmentResponse = {
      id: 'appointment-1', patientId: 'patient-id', doctorId: 'doctor-id',
      appointmentDate: '2026-09-21', startTime: '08:00', endTime: '09:00', status: 'PENDING'
    };
    const rows = getUiAppointments([appointment]);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(appointment.id);
    expect(rows[0].patientName).toBe('Patient PATIENT-');
    expect(rows[0].doctorName).toBe('Doctor DOCTOR-I');
    expect(rows[0].department).toBe('Not available');
  });

  it('does not infer treatment completion or payment from an API record', () => {
    const record: MedicalRecordResponse = {
      id: 'r', appointmentId: 'a', patientId: 'p', doctorId: 'd', diagnosis: 'Recorded diagnosis', prescriptions: []
    };
    const invoice: InvoiceResponse = {
      id: 'i', appointmentId: 'a', patientId: 'p', totalAmount: '0', status: 'UNPAID'
    };
    expect(getUiMedicalRecords([record])[0].status).toBe('FINAL');
    expect(getUiInvoices([invoice])[0].status).toBe('UNPAID');
    expect(getUiInvoices([invoice])[0].totalAmount).toBe('0');
  });
});
