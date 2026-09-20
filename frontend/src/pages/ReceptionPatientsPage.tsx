import { type FormEvent, useState } from 'react';
import { registerReceptionPatient, searchReceptionPatients } from '../api/clinic';
import Alert from '../components/Alert';
import PageHeader from '../components/PageHeader';
import { integrations } from '../config/integrations.config';
import type { ReceptionPatientResponse, RegisterWalkInPatientRequest } from '../types/domain';
import type { ClinicRole } from '../utils/roles';
import { formatDate } from '../utils/format';

const initialForm: RegisterWalkInPatientRequest = { fullName: '', phone: '', dob: '', gender: '', address: '', bloodType: '' };
const phonePattern = /^[+0-9() .-]{7,20}$/;

export default function ReceptionPatientsPage({ role }: { role: ClinicRole }) {
  if (role !== 'ADMIN' && role !== 'RECEPTIONIST') return <Alert tone="error">You cannot access the receptionist patient directory.</Alert>;
  if (!integrations.reception) return <><PageHeader title="Patients" subtitle="Reception patient search" />
    <Alert tone="info">Patient search and walk-in registration are unavailable until Task 03 is merged, running and routed.</Alert></>;
  return <ActiveReceptionPatientsPage />;
}

function ActiveReceptionPatientsPage() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [patients, setPatients] = useState<ReceptionPatientResponse[] | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState(initialForm);
  const [registering, setRegistering] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const selected = patients?.find((item) => item.id === selectedId) ?? patients?.[0];

  async function search(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault(); setError(null); setNotice(null);
    if (!name.trim() && !phone.trim()) { setError('Enter a name or phone number to search.'); return; }
    setBusy(true); setPatients(null); setSelectedId('');
    try {
      const result = await searchReceptionPatients({ name, phone });
      if (!Array.isArray(result)) throw new Error('Invalid patient search response');
      setPatients(result);
    } catch (cause) { setError(message(cause)); }
    finally { setBusy(false); }
  }

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setNotice(null);
    if (!form.fullName.trim() || !phonePattern.test(form.phone)) { setError('Enter a patient name and valid phone number.'); return; }
    setBusy(true);
    try {
      const created = await registerReceptionPatient({ ...form, fullName: form.fullName.trim(), phone: form.phone.trim() });
      if (!created.id || created.fullName !== form.fullName.trim()) throw new Error('Server did not confirm patient registration');
      setPatients([created]); setSelectedId(created.id); setRegistering(false); setForm(initialForm);
      setNotice('Walk-in patient registered by the clinic.');
    } catch (cause) { setError(message(cause)); }
    finally { setBusy(false); }
  }

  return <>
    <PageHeader title="Patients" subtitle="Search authorized patient profiles and register walk-ins"
      actions={<button type="button" onClick={() => setRegistering((value) => !value)} disabled={busy}>{registering ? 'Close registration' : 'Register walk-in'}</button>} />
    {error && <Alert tone="error">{error} <button type="button" disabled={busy} onClick={() => void search()}>Retry search</button></Alert>}
    {notice && <Alert tone="info">{notice}</Alert>}
    {registering && <form className="panel settings-form" onSubmit={(event) => void register(event)}>
      <h3>Walk-in registration</h3>
      <label>Full name<input required maxLength={150} value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} /></label>
      <label>Phone<input required maxLength={20} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
      <label>Date of birth<input type="date" value={form.dob ?? ''} onChange={(event) => setForm({ ...form, dob: event.target.value || null })} /></label>
      <label>Gender<input maxLength={10} value={form.gender ?? ''} onChange={(event) => setForm({ ...form, gender: event.target.value })} /></label>
      <label>Address<input maxLength={255} value={form.address ?? ''} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
      <label>Blood group<input maxLength={5} value={form.bloodType ?? ''} onChange={(event) => setForm({ ...form, bloodType: event.target.value })} /></label>
      <button type="submit" disabled={busy}>Register patient</button>
    </form>}
    <form className="panel settings-form" onSubmit={(event) => void search(event)}>
      <h3>Search patients</h3>
      <label>Name<input value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>Phone<input value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
      <button type="submit" disabled={busy}>Search</button>
    </form>
    {busy && <p role="status">Processing patient request...</p>}
    {patients?.length === 0 && <p>No matching patients.</p>}
    {patients && patients.length > 0 && <section className="split-page">
      <article className="panel table-panel"><h3>Search results</h3>
        {patients.map((item) => <button type="button" className="table-row" key={item.id}
          aria-pressed={selected?.id === item.id} onClick={() => setSelectedId(item.id)}>
          {item.fullName} — {item.phone}
        </button>)}
      </article>
      {selected && <article className="panel detail-panel"><h3>{selected.fullName}</h3>
        <dl className="details-list compact"><div><dt>Patient profile ID</dt><dd>{selected.id}</dd></div>
          <div><dt>Phone</dt><dd>{selected.phone}</dd></div>
          <div><dt>Birth date</dt><dd>{formatDate(selected.dob)}</dd></div>
          <div><dt>Gender</dt><dd>{selected.gender || 'Not supplied'}</dd></div>
        </dl>
        <p>Medical records are not available to reception staff.</p>
      </article>}
    </section>}
  </>;
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Patient request failed';
}