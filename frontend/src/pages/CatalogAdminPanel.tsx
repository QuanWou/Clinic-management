import { type FormEvent, useState } from 'react';
import {
  createCatalogMedicine, createCatalogService, deactivateCatalogMedicine, deactivateCatalogService,
  publishCatalogPrice
} from '../api/clinic';
import Alert from '../components/Alert';
import type { CatalogServiceResponse, MedicineResponse } from '../types/domain';

const codePattern = /^[A-Za-z0-9_-]{1,60}$/;

/** Admin actions are verified by the role-restricted Catalog API, never saved locally. */
export default function CatalogAdminPanel({ services, medicines, onChanged }: {
  services: CatalogServiceResponse[]; medicines: MedicineResponse[]; onChanged: () => void;
}) {
  const [service, setService] = useState({ code: '', name: '', description: '' });
  const [medicine, setMedicine] = useState({ code: '', name: '', unit: '', description: '' });
  const [serviceId, setServiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function execute(action: () => Promise<void>, label: string) {
    setBusy(true); setError(null); setNotice(null);
    try { await action(); setNotice(label); onChanged(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Catalog rejected the operation'); }
    finally { setBusy(false); }
  }

  async function addService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!codePattern.test(service.code) || !service.name.trim()) return;
    await execute(async () => {
      const response = await createCatalogService({ ...service, active: true });
      if (!response.id || response.code.toUpperCase() !== service.code.toUpperCase() || !response.active) {
        throw new Error('Catalog did not confirm the service');
      }
      setService({ code: '', name: '', description: '' });
    }, 'Dịch vụ đã được Catalog ghi nhận; cần công bố đơn giá để tính phí.');
  }

  async function addMedicine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!codePattern.test(medicine.code) || !medicine.name.trim() || !medicine.unit.trim()) return;
    await execute(async () => {
      const response = await createCatalogMedicine({ ...medicine, active: true });
      if (!response.id || response.code.toUpperCase() !== medicine.code.toUpperCase() || !response.active) {
        throw new Error('Catalog did not confirm the medicine');
      }
      setMedicine({ code: '', name: '', unit: '', description: '' });
    }, 'Thuốc đã được Catalog ghi nhận.');
  }

  async function publishPrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!services.some((item) => item.id === serviceId) || !/^\d{1,11}$/.test(amount) || !effectiveFrom) {
      setError('Chọn dịch vụ, ngày hiệu lực và số tiền VND hợp lệ.'); return;
    }
    await execute(async () => {
      const response = await publishCatalogPrice(serviceId,
        { amount, currency: 'VND', effectiveFrom, effectiveUntil: null });
      if (response.serviceId !== serviceId || response.currency !== 'VND' ||
          response.effectiveFrom !== effectiveFrom || String(response.amount) !== String(Number(amount))) {
        throw new Error('Catalog did not confirm the service price; refresh to verify');
      }
      setAmount(''); setEffectiveFrom('');
    }, 'Đơn giá đã được Catalog công bố.');
  }

  return <section className="panel settings-form" aria-label="Admin quản lý Catalog">
    <h3>Quản lý Catalog · Chỉ Admin</h3>
    <p>Không có dữ liệu mẫu. Mọi thay đổi bên dưới ghi trực tiếp vào PostgreSQL thật thông qua API quản trị; chỉ nhập thông tin nghiệp vụ đã được phòng khám xác nhận.</p>
    {error && <Alert tone="error">{error}</Alert>}
    {notice && <Alert tone="info">{notice}</Alert>}
    <form onSubmit={(event) => void addService(event)}>
      <h4>Thêm dịch vụ khám / xét nghiệm</h4>
      <label>Mã dịch vụ<input required maxLength={60} pattern="[A-Za-z0-9_-]{1,60}" value={service.code}
        onChange={(event) => setService({ ...service, code: event.target.value })} /></label>
      <label>Tên dịch vụ<input required maxLength={255} value={service.name}
        onChange={(event) => setService({ ...service, name: event.target.value })} /></label>
      <label>Mô tả<textarea maxLength={1000} value={service.description}
        onChange={(event) => setService({ ...service, description: event.target.value })} /></label>
      <button disabled={busy} type="submit">Tạo dịch vụ</button>
    </form>
    <form onSubmit={(event) => void publishPrice(event)}>
      <h4>Công bố đơn giá dịch vụ (VND)</h4>
      <label>Dịch vụ<select required value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
        <option value="">Chọn dịch vụ đang hoạt động</option>
        {services.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}
      </select></label>
      <label>Đơn giá VND<input type="number" required min="0" step="1" value={amount}
        onChange={(event) => setAmount(event.target.value)} /></label>
      <label>Ngày bắt đầu hiệu lực<input type="date" required value={effectiveFrom}
        onChange={(event) => setEffectiveFrom(event.target.value)} /></label>
      <button type="submit" disabled={busy || !serviceId || !effectiveFrom}>Công bố giá</button>
    </form>
    <form onSubmit={(event) => void addMedicine(event)}>
      <h4>Thêm thuốc</h4>
      <label>Mã thuốc<input required maxLength={60} pattern="[A-Za-z0-9_-]{1,60}" value={medicine.code}
        onChange={(event) => setMedicine({ ...medicine, code: event.target.value })} /></label>
      <label>Tên thuốc<input required maxLength={255} value={medicine.name}
        onChange={(event) => setMedicine({ ...medicine, name: event.target.value })} /></label>
      <label>Đơn vị<input required maxLength={50} value={medicine.unit}
        onChange={(event) => setMedicine({ ...medicine, unit: event.target.value })} /></label>
      <label>Mô tả<textarea maxLength={1000} value={medicine.description}
        onChange={(event) => setMedicine({ ...medicine, description: event.target.value })} /></label>
      <button type="submit" disabled={busy}>Thêm thuốc</button>
    </form>
    <h4>Ngừng sử dụng dịch vụ hoặc thuốc (không xóa hồ sơ cũ)</h4>
    {services.map((item) => <div key={item.id} className="person-row"><span>{item.code} — {item.name}</span>
      <button disabled={busy} type="button" className="soft-button danger" onClick={() => {
        if (!window.confirm(`Ngừng sử dụng dịch vụ ${item.code}?`)) return;
        void execute(async () => {
          const response = await deactivateCatalogService(item.id);
          if (response.id !== item.id || response.active) throw new Error('Catalog did not confirm deactivation');
        }, 'Dịch vụ đã ngừng sử dụng.');
      }}>Ngừng dịch vụ</button></div>)}
    {medicines.map((item) => <div key={item.id} className="person-row"><span>{item.code} — {item.name}</span>
      <button disabled={busy} type="button" className="soft-button danger" onClick={() => {
        if (!window.confirm(`Ngừng sử dụng thuốc ${item.code}?`)) return;
        void execute(async () => {
          const response = await deactivateCatalogMedicine(item.id);
          if (response.id !== item.id || response.active) throw new Error('Catalog did not confirm deactivation');
        }, 'Thuốc đã ngừng sử dụng.');
      }}>Ngừng thuốc</button></div>)}
  </section>;
}