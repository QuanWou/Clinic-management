import { type FormEvent, useEffect, useState } from 'react';
import { getPatientProfile, updatePatientProfile } from '../api/clinic';
import { HttpApiError } from '../api/client';
import Alert from '../components/Alert';
import Avatar from '../components/Avatar';
import PageHeader from '../components/PageHeader';
import type { CurrentUser } from '../types/domain';
import type { ClinicRole } from '../utils/roles';
import { normalizeRoles } from '../utils/roles';

const emptyForm = { dob: '', gender: '', address: '', bloodType: '' };

export default function SettingsPage({ user, role }: { user: CurrentUser; role: ClinicRole }) {
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(role === 'PATIENT');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const roles = normalizeRoles(user.roles);

  useEffect(() => {
    if (role !== 'PATIENT') return;
    let active = true;
    setLoading(true); setError(null);
    void getPatientProfile().then((result) => {
      if (active) setForm({ dob: result.dob ?? '', gender: result.gender ?? '', address: result.address ?? '', bloodType: result.bloodType ?? '' });
    }).catch((cause: unknown) => {
      if (!active) return;
      if (cause instanceof HttpApiError && cause.status === 404) {
        setForm(emptyForm);
        setNotice('No profile yet. Fill in the form to create one.');
      } else setError(cause instanceof Error ? cause.message : 'Unable to load profile');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [role, revision]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(null); setNotice(null);
    try {
      const today = new Date();
      const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      if (form.dob && form.dob >= todayKey) throw new Error('Date of birth must be in the past.');
      const result = await updatePatientProfile({ dob: form.dob || null, gender: form.gender || null, address: form.address || null, bloodType: form.bloodType || null });
      setForm({ dob: result.dob ?? '', gender: result.gender ?? '', address: result.address ?? '', bloodType: result.bloodType ?? '' });
      setNotice('Patient profile saved.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save profile'); }
    finally { setSaving(false); }
  }

  return <>
    <PageHeader title="Settings" subtitle="Account information and available profile preferences." />
    {error && <Alert tone="error">{error} <button type="button" onClick={() => setRevision((value) => value + 1)} disabled={loading}>Retry</button></Alert>}
    {notice && <Alert tone="info">{notice}</Alert>}
    <section className="settings-grid">
      <article className="panel settings-form">
        <h3>Account information</h3>
        <div className="settings-profile"><Avatar label={user.fullName ?? user.email} size="lg" />
          <div><strong>{user.fullName || user.email}</strong><span>{roles.join(', ') || 'No role'}</span></div>
        </div>
        <label>Full Name<input value={user.fullName ?? ''} readOnly /></label>
        <label>Email<input value={user.email} readOnly /></label>
        <label>Phone<input value={user.phone ?? ''} readOnly /></label>
        <label>Role<input value={roles.join(', ')} readOnly /></label>
        <p>Account edits are unavailable because the identity service exposes no account update endpoint.</p>
      </article>
      {role === 'PATIENT' && <form className="panel settings-form" onSubmit={(event) => void save(event)}>
        <h3>Patient profile</h3>
        {loading && <p role="status">Loading patient profile...</p>}
        <label>Date of birth<input type="date" value={form.dob} disabled={loading} onChange={(event) => setForm({ ...form, dob: event.target.value })} /></label>
        <label>Gender<input value={form.gender} disabled={loading} onChange={(event) => setForm({ ...form, gender: event.target.value })} /></label>
        <label>Address<input value={form.address} disabled={loading} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
        <label>Blood group<input value={form.bloodType} disabled={loading} onChange={(event) => setForm({ ...form, bloodType: event.target.value })} /></label>
        <button type="submit" disabled={saving || loading}>{saving ? 'Saving...' : 'Save patient profile'}</button>
      </form>}
    </section>
  </>;
}
