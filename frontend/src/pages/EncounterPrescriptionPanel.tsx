import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Pill, Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  getCatalogMedicines,
  getPrescriptions,
  savePrescriptionDraft,
  signPrescription
} from '../api/clinic';
import Alert from '../components/Alert';
import Badge from '../components/Badge';
import type {
  MedicalRecordResponse,
  MedicineResponse,
  PrescriptionItemDraftRequest,
  PrescriptionResponse
} from '../types/domain';

type Props = {
  record: MedicalRecordResponse;
  canEdit: boolean;
  onChanged?: () => void;
};

type EditableItem = PrescriptionItemDraftRequest & { key: string };

function keyForItem(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'rx-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

export default function EncounterPrescriptionPanel({ record, canEdit, onChanged }: Props) {
  const [prescriptions, setPrescriptions] = useState<PrescriptionResponse[] | null>(null);
  const [medicines, setMedicines] = useState<MedicineResponse[] | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [version, setVersion] = useState<number | null>(null);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [medicineId, setMedicineId] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('');
  const [duration, setDuration] = useState('');
  const [route, setRoute] = useState('');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(null); setNotice(null);
    void Promise.all([getPrescriptions(record.id), getCatalogMedicines()])
      .then(([rows, catalog]) => {
        if (!active) return;
        setPrescriptions(rows);
        setMedicines(catalog.filter((medicine) => medicine.active));
        const draft = rows.find((item) => item.status === 'DRAFT') ?? null;
        setDraftId(draft?.id ?? null);
        setVersion(draft?.version ?? null);
        setItems((draft?.items ?? []).filter((item) => Boolean(item.medicineId)).map((item) => ({
          key: item.id || keyForItem(),
          medicineId: item.medicineId!,
          dosage: item.dosage,
          frequency: item.frequency,
          duration: item.duration,
          route: item.route ?? null,
          quantity: item.quantity ?? null,
          note: item.note ?? null
        })));
        setDirty(false);
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Không tải được đơn thuốc.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [record.id, revision]);

  const selectedMedicine = useMemo(() => medicines?.find((medicine) => medicine.id === medicineId) ?? null,
    [medicines, medicineId]);

  function resetEntry() {
    setMedicineId(''); setDosage(''); setFrequency(''); setDuration('');
    setRoute(''); setQuantity(''); setNote('');
  }

  function addItem() {
    if (!selectedMedicine || !dosage.trim() || !frequency.trim() || !duration.trim()) return;
    setItems((previous) => [...previous, {
      key: keyForItem(),
      medicineId: selectedMedicine.id,
      dosage: dosage.trim(),
      frequency: frequency.trim(),
      duration: duration.trim(),
      route: route.trim() || null,
      quantity: quantity ? Number(quantity) : null,
      note: note.trim() || null
    }]);
    setDirty(true);
    resetEntry();
  }

  async function saveDraft(): Promise<PrescriptionResponse | null> {
    if (!canEdit || busy) return null;
    setBusy(true); setError(null); setNotice(null);
    try {
      const saved = await savePrescriptionDraft(record.id, {
        version,
        items: items.map(({ key: _key, ...item }) => item)
      });
      setDraftId(saved.id);
      setVersion(saved.version ?? null);
      setPrescriptions((previous) => {
        const others = (previous ?? []).filter((item) => item.id !== saved.id && item.status !== 'DRAFT');
        return [saved, ...others];
      });
      setDirty(false);
      setNotice('Đơn thuốc nháp đã được lưu.');
      onChanged?.();
      return saved;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể lưu đơn thuốc.');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function sign() {
    if (!canEdit || busy || items.length === 0) return;
    let currentId = draftId;
    let currentVersion = version;
    if (dirty || !currentId) {
      const saved = await saveDraft();
      if (!saved) return;
      currentId = saved.id;
      currentVersion = saved.version ?? null;
    }
    if (!currentId || currentVersion == null) {
      setError('Máy chủ chưa trả phiên bản đơn thuốc. Hãy làm mới trước khi ký.');
      return;
    }
    setBusy(true); setError(null); setNotice(null);
    try {
      const signed = await signPrescription(record.id, currentId, currentVersion);
      setPrescriptions((previous) => [signed, ...(previous ?? []).filter((item) => item.id !== signed.id)]);
      setDraftId(null); setVersion(null); setItems([]); setDirty(false);
      setNotice('Đơn thuốc đã được bác sĩ xác nhận và khóa chỉnh sửa.');
      onChanged?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể xác nhận đơn thuốc.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="panel doctor-encounter-module" aria-label="Kê đơn trong lượt khám">
    <div className="doctor-encounter-section-head">
      <div><span>KÊ ĐƠN</span><h3><Pill size={19} /> Thuốc điều trị</h3></div>
      <button type="button" className="soft-button" disabled={busy || loading}
        onClick={() => setRevision((value) => value + 1)}><RefreshCw size={15} /> Làm mới</button>
    </div>
    <Alert tone="info">Thông tin dị ứng và tương tác thuốc chưa có nguồn dữ liệu lâm sàng được xác minh trong hệ thống. Bác sĩ phải tự rà soát trước khi ký đơn.</Alert>
    {loading && <p role="status">Đang tải đơn thuốc...</p>}
    {error && <Alert tone="error">{error}</Alert>}
    {notice && <Alert tone="info">{notice}</Alert>}

    {canEdit && <div className="doctor-encounter-rx-editor">
      <div className="doctor-encounter-rx-fields">
        <label>Thuốc
          <select value={medicineId} disabled={busy} onChange={(event) => setMedicineId(event.target.value)}>
            <option value="">Chọn thuốc đang hoạt động</option>
            {medicines?.map((medicine) => <option key={medicine.id} value={medicine.id}>
              {medicine.code} · {medicine.name} · {medicine.unit}
            </option>)}
          </select>
        </label>
        <label>Liều dùng<input value={dosage} maxLength={100} onChange={(event) => setDosage(event.target.value)} /></label>
        <label>Tần suất<input value={frequency} maxLength={100} onChange={(event) => setFrequency(event.target.value)} /></label>
        <label>Thời gian<input value={duration} maxLength={100} onChange={(event) => setDuration(event.target.value)} /></label>
        <label>Đường dùng<input value={route} maxLength={100} onChange={(event) => setRoute(event.target.value)} /></label>
        <label>Số lượng<input type="number" min="1" max="100000" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
        <label className="doctor-encounter-rx-note">Ghi chú<input value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} /></label>
      </div>
      <button type="button" className="soft-button" disabled={busy || !selectedMedicine || !dosage.trim() || !frequency.trim() || !duration.trim()}
        onClick={addItem}><Plus size={16} /> Thêm thuốc</button>

      <div className="doctor-encounter-rx-draft">
        {items.length === 0 ? <p>Chưa có thuốc trong đơn nháp.</p> : items.map((item) => {
          const medicine = medicines?.find((entry) => entry.id === item.medicineId);
          return <article key={item.key}>
            <div><strong>{medicine?.name || item.medicineId}</strong>
              <span>{item.dosage} · {item.frequency} · {item.duration}{item.route ? ' · ' + item.route : ''}{item.quantity ? ' · SL ' + item.quantity : ''}</span></div>
            <button type="button" className="icon-button" aria-label="Xóa thuốc khỏi đơn nháp" disabled={busy}
              onClick={() => { setItems((previous) => previous.filter((entry) => entry.key !== item.key)); setDirty(true); }}>
              <Trash2 size={16} />
            </button>
          </article>;
        })}
      </div>
      <div className="doctor-encounter-rx-actions">
        <button type="button" className="soft-button" disabled={busy || (!dirty && Boolean(draftId))}
          onClick={() => void saveDraft()}>Lưu đơn nháp</button>
        <button type="button" disabled={busy || items.length === 0} onClick={() => void sign()}>
          <CheckCircle2 size={16} /> Xác nhận đơn thuốc
        </button>
      </div>
    </div>}

    <div className="doctor-encounter-signed-list">
      {prescriptions?.filter((item) => item.status !== 'DRAFT').map((prescription) => <article key={prescription.id}>
        <div className="doctor-encounter-section-head"><strong>Đơn thuốc đã xác nhận</strong><Badge tone="COMPLETED">SIGNED</Badge></div>
        <ul>{prescription.items.map((item) => <li key={item.id}>
          <strong>{item.medicineName}</strong> — {item.dosage}, {item.frequency}, {item.duration}
          {item.route ? ', ' + item.route : ''}{item.quantity ? ', SL ' + item.quantity : ''}
        </li>)}</ul>
      </article>)}
    </div>
  </section>;
}
