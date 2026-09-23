import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { HttpApiError } from '../api/client';
import type { CatalogServiceResponse, MedicalRecordResponse } from '../types/domain';
import { statusLabel } from '../utils/locale';
import LabOrdersPanel, { isFinalizedBillingConflict, isLaboratoryService } from './LabOrdersPanel';

const record: MedicalRecordResponse = {
  id: '10de38a1-3abf-82b6-d8f6-acbece5642c7', recordCode: 'BA001672',
  patientId: 'patient-uuid', doctorId: 'doctor-uuid', appointmentId: 'appointment-uuid',
  diagnosis: 'Đã ghi nhận', prescriptions: []
};
const service = (code: string, name: string, description: string, active = true): CatalogServiceResponse =>
  ({ id: `id-${code}`, code, name, description, active });

describe('laboratory orders and indications', () => {
  it('allows explicitly categorized active laboratory services but excludes consultation, imaging, and inactive items', () => {
    expect(isLaboratoryService(service('DEMO-CAT-S019', 'DỮ LIỆU THỬ - Công thức máu', '[DEMO / QA] Nhóm xét nghiệm; chỉ để test.'))).toBe(true);
    expect(isLaboratoryService(service('LAB-001', 'Công thức máu', ''))).toBe(true);
    expect(isLaboratoryService(service('XN_002', 'Đường huyết', ''))).toBe(true);
    expect(isLaboratoryService(service('OTHER-1', 'Xét nghiệm đường huyết', ''))).toBe(true);
    expect(isLaboratoryService(service('CONSULT', 'Khám tổng quát', 'Nhóm khám'))).toBe(false);
    expect(isLaboratoryService(service('DEMO-ECG', 'Đo điện tim', 'Nhóm thăm dò chức năng'))).toBe(false);
    expect(isLaboratoryService(service('DEMO-US', 'Siêu âm ổ bụng', 'Nhóm chẩn đoán hình ảnh'))).toBe(false);
    expect(isLaboratoryService(service('LAB-003', 'Test ngừng hoạt động', 'Nhóm xét nghiệm', false))).toBe(false);
  });

  it('shows patient read-only results scope without order, sample, result-entry, or release controls', () => {
    const html = renderToStaticMarkup(<LabOrdersPanel record={record} doctor={false} />);
    expect(html).toContain('Kết quả xét nghiệm');
    expect(html).toContain('BA001672');
    expect(html).toContain('Chỉ kết quả đã được công bố');
    expect(html).not.toContain(record.id);
    expect(html).not.toContain('Tạo chỉ định');
    expect(html).not.toContain('Nhập mã mẫu');
    expect(html).not.toContain('Công bố kết quả cho bệnh nhân');
  });

  it('does not advertise an available create action to doctors before catalog and appointment are verified', () => {
    const html = renderToStaticMarkup(<LabOrdersPanel record={record} doctor />);
    expect(html).toContain('Xét nghiệm &amp; chỉ định');
    expect(html).toContain('Tạo chỉ định');
    expect(html).toContain('disabled');
    expect(html).not.toContain('Xác nhận tạo chỉ định');
    expect(html).not.toContain('Công bố kết quả cho bệnh nhân');
  });

  it('translates every persisted lab stage without changing API enum identifiers', () => {
    expect(['ORDERED', 'COLLECTED', 'PROCESSING', 'RESULTED', 'RELEASED'].map(statusLabel))
      .toEqual(['Đã chỉ định', 'Đã lấy mẫu', 'Đang xử lý mẫu', 'Đã có kết quả', 'Đã công bố']);
  });

  it('recognizes only the exact finalized-billing conflict, not unrelated 409 or 403 errors', () => {
    expect(isFinalizedBillingConflict(new HttpApiError(409, 'Lab billing items are already finalized', 'CONFLICT'))).toBe(true);
    expect(isFinalizedBillingConflict(new HttpApiError(409, 'Sample identifier already exists', 'CONFLICT'))).toBe(false);
    expect(isFinalizedBillingConflict(new HttpApiError(403, 'Lab billing items are already finalized', 'FORBIDDEN'))).toBe(false);
    expect(isFinalizedBillingConflict(new Error('Lab billing items are already finalized'))).toBe(false);
  });

  it('keeps doctor mutations locked before the billing status endpoint verifies the record', () => {
    const html = renderToStaticMarkup(<LabOrdersPanel record={record} doctor />);
    expect(html).toContain('Đang kiểm tra trạng thái chốt xét nghiệm');
    expect(html).toContain('disabled');
    expect(html).not.toContain('Xác nhận tạo chỉ định');
  });
});
