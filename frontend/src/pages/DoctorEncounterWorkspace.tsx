import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, ClipboardCheck, HeartPulse, Save, ShieldCheck, Stethoscope, UserRound } from 'lucide-react';
import {
  finalizeMedicalRecord,
  getEncounterContext,
  getMedicalRecordByAppointment,
  saveMedicalRecordDraft,
  updateReceptionQueue
} from '../api/clinic';
import { HttpApiError } from '../api/client';
import Alert from '../components/Alert';
import Badge from '../components/Badge';
import PageHeader from '../components/PageHeader';
import EncounterLabOrdersPanel from './EncounterLabOrdersPanel';
import EncounterPrescriptionPanel from './EncounterPrescriptionPanel';
import type { EncounterContextResponse, MedicalRecordResponse } from '../types/domain';
import { formatDate, formatTime } from '../utils/format';
import { statusLabel } from '../utils/locale';
import './doctorEncounter.css';
import './doctorEncounterModules.css';

type Props = {
  appointmentId: string | null;
  onBack: () => void;
  onCompleted?: () => void;
};

type Draft = {
  symptoms: string;
  diagnosis: string;
  notes: string;
};

const emptyDraft: Draft = { symptoms: '', diagnosis: '', notes: '' };
const errorMessage = (cause: unknown) => cause instanceof Error ? cause.message : 'Không thể thực hiện yêu cầu.';

function draftFromRecord(record: MedicalRecordResponse | null): Draft {
  return {
    symptoms: record?.symptoms ?? '',
    diagnosis: record?.diagnosis ?? '',
    notes: record?.notes ?? ''
  };
}

export default function DoctorEncounterWorkspace({ appointmentId, onBack, onCompleted }: Props) {
  const [context, setContext] = useState<EncounterContextResponse | null>(null);
  const [record, setRecord] = useState<MedicalRecordResponse | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [loading, setLoading] = useState(Boolean(appointmentId));
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!appointmentId) {
      setContext(null); setRecord(null); setDraft(emptyDraft); setLoading(false);
      return;
    }
    let active = true;
    setLoading(true); setError(null); setNotice(null); setContext(null); setRecord(null); setDirty(false);
    void (async () => {
      try {
        const nextContext = await getEncounterContext(appointmentId);
        if (!active) return;
        setContext(nextContext);
        try {
          const nextRecord = await getMedicalRecordByAppointment(appointmentId);
          if (!active) return;
          setRecord(nextRecord);
          setDraft(draftFromRecord(nextRecord));
        } catch (cause) {
          if (cause instanceof HttpApiError && cause.status === 404) {
            if (!active) return;
            setRecord(null);
            setDraft(emptyDraft);
          } else {
            throw cause;
          }
        }
      } catch (cause) {
        if (active) setError(errorMessage(cause));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [appointmentId]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const finalized = record?.status === 'FINAL';
  const canEdit = context?.queueStatus === 'IN_PROGRESS' && !finalized;
  const patientMeta = useMemo(() => {
    if (!context) return '';
    return [
      context.patient.dob ? 'Ngày sinh ' + formatDate(context.patient.dob) : null,
      context.patient.gender || null,
      context.patient.bloodType ? 'Nhóm máu ' + context.patient.bloodType : null
    ].filter(Boolean).join(' · ');
  }, [context]);

  function updateDraft(field: keyof Draft, value: string) {
    setDraft((previous) => ({ ...previous, [field]: value }));
    setDirty(true);
    setNotice(null);
  }

  async function saveDraft(): Promise<MedicalRecordResponse | null> {
    if (!appointmentId || !context || context.queueStatus !== 'IN_PROGRESS' || finalized || busy) return record;
    setBusy(true); setError(null); setNotice(null);
    try {
      const saved = await saveMedicalRecordDraft(appointmentId, {
        ...draft,
        version: record?.version ?? null
      });
      setRecord(saved);
      setDraft(draftFromRecord(saved));
      setDirty(false);
      setNotice('Bản nháp bệnh án đã được máy chủ lưu.');
      return saved;
    } catch (cause) {
      setError(errorMessage(cause));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function finalizeRecord() {
    if (!context || context.queueStatus !== 'IN_PROGRESS' || finalized || busy) return;
    setError(null); setNotice(null);
    let current = record;
    if (dirty || !current) {
      current = await saveDraft();
      if (!current) return;
    }
    if (current.version == null) {
      setError('Máy chủ chưa trả phiên bản bệnh án. Hãy tải lại trước khi xác nhận.');
      return;
    }
    setBusy(true);
    try {
      const finalizedRecord = await finalizeMedicalRecord(current.id, current.version);
      setRecord(finalizedRecord);
      setDraft(draftFromRecord(finalizedRecord));
      setDirty(false);
      setNotice('Bệnh án đã được xác nhận. Bạn có thể hoàn tất lượt khám.');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function startEncounter() {
    if (!context || context.queueStatus !== 'CALLED' || busy) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const updated = await updateReceptionQueue(context.visitId, 'IN_PROGRESS');
      if (updated.status !== 'IN_PROGRESS' || updated.appointmentId !== context.appointmentId) {
        throw new Error('Máy chủ chưa xác nhận lượt khám đang diễn ra.');
      }
      setContext((previous) => previous ? { ...previous, queueStatus: 'IN_PROGRESS' } : previous);
      setNotice('Đã bắt đầu lượt khám. Có thể ghi và lưu bệnh án.');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function completeEncounter() {
    if (!context || !finalized || context.queueStatus !== 'IN_PROGRESS' || busy) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const updated = await updateReceptionQueue(context.visitId, 'COMPLETED');
      if (updated.status !== 'COMPLETED' || updated.appointmentId !== context.appointmentId) {
        throw new Error('Máy chủ chưa xác nhận hoàn tất đúng lượt khám.');
      }
      setContext((previous) => previous ? { ...previous, queueStatus: 'COMPLETED' } : previous);
      setNotice('Lượt khám và lịch hẹn đã được máy chủ ghi nhận hoàn tất.');
      onCompleted?.();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  if (!appointmentId) {
    return <div className="doctor-encounter-empty">
      <HeartPulse size={38} aria-hidden="true" />
      <h2>Chưa chọn lượt khám</h2>
      <p>Chọn một bệnh nhân từ hàng đợi bác sĩ để mở không gian khám.</p>
      <button type="button" onClick={onBack}><ArrowLeft size={16} /> Về hàng đợi</button>
    </div>;
  }

  return <div className="doctor-encounter">
    <PageHeader title="Không gian khám" subtitle="Bệnh án, chỉ định và hoàn tất lượt khám theo đúng ngữ cảnh bệnh nhân"
      actions={<button type="button" className="soft-button" onClick={onBack} disabled={busy}><ArrowLeft size={16} /> Hàng đợi</button>} />

    {error && <Alert tone="error">{error}</Alert>}
    {notice && <Alert tone="info">{notice}</Alert>}
    {loading && <p role="status" className="doctor-encounter-loading">Đang xác minh lượt khám và bệnh án...</p>}

    {context && <>
      <section className="doctor-encounter-hero">
        <div className="doctor-encounter-patient-icon"><UserRound size={27} /></div>
        <div className="doctor-encounter-patient">
          <span className="doctor-encounter-eyebrow"><ShieldCheck size={15} /> LƯỢT KHÁM ĐƯỢC PHÂN CÔNG</span>
          <h2>{context.patient.fullName || 'Bệnh nhân'}</h2>
          <p>{patientMeta || 'Thông tin hành chính tối thiểu theo quyền bác sĩ'}</p>
        </div>
        <div className="doctor-encounter-summary">
          <span>Số thứ tự <strong>#{context.queueNumber}</strong></span>
          <Badge tone={context.queueStatus}>{statusLabel(context.queueStatus)}</Badge>
        </div>
      </section>

      <section className="doctor-encounter-facts" aria-label="Thông tin lượt khám">
        <article><span>Ngày khám</span><strong>{formatDate(context.appointmentDate)}</strong></article>
        <article><span>Khung giờ</span><strong>{formatTime(context.startTime)} – {formatTime(context.endTime)}</strong></article>
        <article><span>Lý do khám</span><strong>{context.reason || 'Chưa ghi nhận'}</strong></article>
        <article><span>Bệnh án</span><strong>{record ? (record.status === 'FINAL' ? 'Đã xác nhận' : 'Bản nháp') : 'Chưa tạo'}</strong></article>
      </section>

      {context.queueStatus === 'CALLED' && <section className="panel doctor-encounter-gate">
        <Stethoscope size={25} />
        <div><h3>Bệnh nhân đã được gọi</h3><p>Bắt đầu khám trước khi nhập dữ liệu lâm sàng.</p></div>
        <button type="button" onClick={() => void startEncounter()} disabled={busy}>Bắt đầu khám</button>
      </section>}

      <section className="doctor-encounter-grid">
        <article className="panel doctor-encounter-clinical">
          <div className="doctor-encounter-section-head">
            <div><span>KHÁM LÂM SÀNG</span><h3>Ghi nhận trong buổi khám</h3></div>
            <Badge tone={finalized ? 'COMPLETED' : 'IN_PROGRESS'}>{finalized ? 'FINAL' : record ? 'DRAFT' : 'CHƯA LƯU'}</Badge>
          </div>

          <label>Triệu chứng
            <textarea rows={4} disabled={!canEdit || busy} value={draft.symptoms}
              onChange={(event) => updateDraft('symptoms', event.target.value)}
              placeholder="Triệu chứng và diễn tiến được bác sĩ ghi nhận..." />
          </label>
          <label>Chẩn đoán <span className="doctor-encounter-required">Bắt buộc khi xác nhận</span>
            <textarea rows={4} disabled={!canEdit || busy} value={draft.diagnosis}
              onChange={(event) => updateDraft('diagnosis', event.target.value)}
              placeholder="Có thể để trống khi lưu nháp; bắt buộc trước khi xác nhận bệnh án." />
          </label>
          <label>Ghi chú điều trị
            <textarea rows={4} disabled={!canEdit || busy} value={draft.notes}
              onChange={(event) => updateDraft('notes', event.target.value)}
              placeholder="Kế hoạch theo dõi, dặn dò hoặc ghi chú lâm sàng..." />
          </label>

          <div className="doctor-encounter-save-state">
            {finalized ? <><CheckCircle2 size={17} /> Bệnh án đã xác nhận và chuyển sang chỉ đọc.</>
              : dirty ? 'Có thay đổi chưa lưu.' : record ? 'Dữ liệu đang hiển thị đã đồng bộ với máy chủ.' : 'Chưa có bản nháp trên máy chủ.'}
          </div>
        </article>

        <aside className="doctor-encounter-side">
          <article className="panel">
            <span className="doctor-encounter-side-tag">QUY TRÌNH</span>
            <h3>Trạng thái xử lý</h3>
            <ol className="doctor-encounter-steps">
              <li className={context.queueStatus === 'IN_PROGRESS' || context.queueStatus === 'COMPLETED' ? 'done' : ''}>Bắt đầu khám</li>
              <li className={record ? 'done' : ''}>Lưu bệnh án</li>
              <li className={finalized ? 'done' : ''}>Xác nhận bệnh án</li>
              <li className={context.queueStatus === 'COMPLETED' ? 'done' : ''}>Hoàn tất lượt khám</li>
            </ol>
          </article>
          <article className="panel doctor-encounter-module-note">
            <ClipboardCheck size={22} />
            <h3>Xét nghiệm & đơn thuốc</h3>
            <p>Các module chỉ định sẽ dùng cùng encounter context; dữ liệu không yêu cầu nhập lại UUID.</p>
          </article>
        </aside>
      </section>

      {record && <div className="doctor-encounter-module-grid">
        <EncounterLabOrdersPanel record={record} performedOn={context.appointmentDate}
          canOrder={context.queueStatus === 'IN_PROGRESS' && record.status !== 'FINAL'} />
        <EncounterPrescriptionPanel record={record}
          canEdit={context.queueStatus === 'IN_PROGRESS' && record.status !== 'FINAL'} />
      </div>}

      <section className="doctor-encounter-actionbar" aria-label="Thao tác bệnh án">
        <div>
          <strong>{context.patient.fullName}</strong>
          <span>{finalized ? 'Bệnh án đã khóa chỉnh sửa' : dirty ? 'Có dữ liệu chưa lưu' : 'Đã đồng bộ'}</span>
        </div>
        <div>
          {!finalized && context.queueStatus === 'IN_PROGRESS' && <button type="button" className="soft-button"
            disabled={busy || (!dirty && Boolean(record))} onClick={() => void saveDraft()}><Save size={17} /> Lưu nháp</button>}
          {!finalized && context.queueStatus === 'IN_PROGRESS' && <button type="button" disabled={busy}
            onClick={() => void finalizeRecord()}><ClipboardCheck size={17} /> Kiểm tra & xác nhận</button>}
          {finalized && context.queueStatus === 'IN_PROGRESS' && <button type="button" disabled={busy}
            onClick={() => void completeEncounter()}><CheckCircle2 size={17} /> Hoàn tất lượt khám</button>}
          {context.queueStatus === 'COMPLETED' && <span className="doctor-encounter-completed"><CheckCircle2 size={17} /> Lượt khám đã hoàn tất</span>}
        </div>
      </section>
    </>}
  </div>;
}
