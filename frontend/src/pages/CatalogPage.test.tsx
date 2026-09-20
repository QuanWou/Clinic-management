import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CatalogPage from './CatalogPage';
import CatalogAdminPanel from './CatalogAdminPanel';
import type { CatalogServiceResponse, MedicineResponse, SpecialtyResponse } from '../types/domain';
import { filterCatalogEntries } from '../utils/catalogDirectory';

vi.mock('../config/integrations.config', () => ({ integrations: { adminCatalog: true } }));

const services: CatalogServiceResponse[] = [
  { id: 'service-1', code: 'CONSULT', name: 'Khám tổng quát', description: 'Khám bệnh', active: true },
  { id: 'service-2', code: 'XRAY', name: 'Chụp X quang', description: null, active: false }
];
const medicines: MedicineResponse[] = [
  { id: 'med-1', code: 'MED-1', name: 'Thuốc tham khảo', unit: 'viên', description: '', active: true }
];
const specialties: SpecialtyResponse[] = [{ id: 'spec-1', name: 'Nội khoa', description: null }];

describe('catalog workspace', () => {
  it('exposes administrator catalog controls but no fictional prices or preloaded totals', () => {
    const html = renderToStaticMarkup(<CatalogPage role="ADMIN" />);
    expect(html).toContain('catalog-workspace');
    expect(html).toContain('Quản lý danh mục');
    expect(html).toContain('Dịch vụ');
    expect(html).toContain('Thuốc');
    expect(html).toContain('Chuyên khoa');
    expect(html).toContain('Đang tải danh mục');
    expect(html).not.toContain('catalog-price-current');
    expect(html).not.toContain('748.839');
  });

  it('doctor sees read-only directory and other roles never see catalog workspace', () => {
    const doctor = renderToStaticMarkup(<CatalogPage role="DOCTOR" />);
    expect(doctor).toContain('doctor-catalog');
    expect(doctor).toContain('Danh mục chuyên môn');
    expect(doctor).toContain('CHỈ TRA CỨU');
    expect(doctor).toContain('Đang tải danh mục từ API');
    expect(doctor).not.toContain('Quản lý danh mục');
    expect(doctor).not.toContain('Mục ngừng hoạt động');
    expect(doctor).not.toContain('Công bố đơn giá');
    expect(doctor).not.toContain('Thêm thuốc');
    for (const role of ['PATIENT', 'RECEPTIONIST'] as const) {
      const html = renderToStaticMarkup(<CatalogPage role={role} />);
      expect(html).not.toContain('catalog-workspace');
      expect(html).not.toContain('Quản lý danh mục');
    }
  });

  it('only filters returned records by name, code, unit and real active status', () => {
    expect(filterCatalogEntries(services, '', 'ALL')).toEqual(services);
    expect(filterCatalogEntries(services, 'xray', 'ACTIVE')).toEqual([]);
    expect(filterCatalogEntries(services, 'chụp', 'INACTIVE')).toEqual([services[1]]);
    expect(filterCatalogEntries(medicines, 'VIÊN', 'ACTIVE')).toEqual(medicines);
    expect(filterCatalogEntries(specialties, 'nội', 'ALL')).toEqual(specialties);
    expect(filterCatalogEntries(services, 'not-found', 'ALL')).toEqual([]);
  });

  it('keeps admin forms separate and never reports a successful write before a server response', () => {
    const html = renderToStaticMarkup(<CatalogAdminPanel services={services.filter((item) => item.active)} medicines={medicines} onChanged={() => {}} />);
    expect(html).toContain('Quản lý Catalog');
    expect(html).toContain('Công bố đơn giá');
    expect(html).not.toContain('Đơn giá đã được Catalog công bố.');
    expect(html).not.toContain('PostgreSQL thật');
  });
});
