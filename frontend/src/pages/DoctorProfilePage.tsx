import { type FormEvent, useEffect, useState } from 'react';
import { getDoctorProfile, updateDoctorProfile } from '../api/clinic';
import { HttpApiError } from '../api/client';
import Alert from '../components/Alert';
import Avatar from '../components/Avatar';
import PageHeader from '../components/PageHeader';
import type { CurrentUser, DoctorProfileResponse } from '../types/domain';
import { formatMoney } from '../utils/format';
import { integrations } from '../config/integrations.config';

export default function DoctorProfilePage({ user }: { user: CurrentUser }) {
  const [doctor, setDoctor] = useState<DoctorProfileResponse | null>(null);
  const [form, setForm] = useState({ biography: '' });
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileNotFound, setProfileNotFound] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(null); setProfileNotFound(false);
    void getDoctorProfile().then((response) => {
      if (!active) return;
      setDoctor(response);
      setForm({ biography: response.biography ?? '' });
    }).catch((cause: unknown) => {
      if (!active) return;
      if (cause instanceof HttpApiError && cause.status === 404) {
        setProfileNotFound(true);
        setDoctor(null);
      } else setError(cause instanceof Error ? cause.message : 'Unable to load doctor profile');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!integrations.adminCatalog) { setError('Profile changes require the verified Task 02 backend.'); return; }
    setSaving(true); setError(null); setNotice(null);
    try {
      const result = await updateDoctorProfile(form);
      setDoctor(result); setEditing(false); setNotice('Profile saved.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save profile'); }
    finally { setSaving(false); }
  }

  return <>
    <PageHeader title="Doctor Profile" subtitle="Your profile returned by the clinic API."
      actions={<button type="button" className="soft-button" disabled={loading} onClick={() => setRevision((value) => value + 1)}>Refresh</button>} />
    {loading && <p role="status">Loading doctor profile...</p>}
    {error && <Alert tone="error">{error} <button type="button" disabled={loading} onClick={() => setRevision((value) => value + 1)}>Retry</button></Alert>}
    {notice && <Alert tone="info">{notice}</Alert>}
    {doctor && !editing && <section className="doctor-profile-grid">
      <article className="panel profile-card">
        <div className="profile-hero"><Avatar label={user.fullName ?? user.email} size="lg" /><h3>{user.fullName ?? user.email}</h3><p>{doctor.specialtyName || 'Specialty not provided'}</p></div>
        <dl className="details-list compact">
          <div><dt>Email</dt><dd>{user.email}</dd></div>
          <div><dt>Phone</dt><dd>{user.phone ?? 'Not provided'}</dd></div>
          <div><dt>Doctor ID</dt><dd>{doctor.id}</dd></div>
          <div><dt>Consultation fee (currency unspecified)</dt><dd>{doctor.consultationFee == null ? 'Not provided' : formatMoney(doctor.consultationFee)}</dd></div>
        </dl>
        {integrations.adminCatalog ? <button type="button" onClick={() => setEditing(true)}>Edit biography</button>
          : <Alert tone="info">Profile editing is unavailable until Task 02 is merged and verified.</Alert>}
      </article>
      <article className="panel profile-overview"><h3>About</h3><p>{doctor.biography || 'No biography provided.'}</p></article>
    </section>}
    {editing && <form className="panel settings-form" onSubmit={(event) => void save(event)}>
      <h3>Edit biography</h3>
      <p>Specialty and consultation fee are managed by the clinic administrator.</p>
      <label>Biography<textarea value={form.biography} onChange={(event) => setForm({ ...form, biography: event.target.value })} /></label>
      <button type="submit" disabled={saving}>Save profile</button>
      <button type="button" className="soft-button" onClick={() => setEditing(false)}>Cancel</button>
    </form>}
    {!doctor && !loading && !error && <Alert tone="info">{profileNotFound ? 'Doctor profile is not provisioned. Contact an administrator.' : 'No doctor profile was returned.'}</Alert>}
  </>;
}
