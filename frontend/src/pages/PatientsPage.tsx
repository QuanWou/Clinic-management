import { useEffect, useState } from 'react';
import { getPatientProfile } from '../api/clinic';
import Alert from '../components/Alert';
import Avatar from '../components/Avatar';
import PageHeader from '../components/PageHeader';
import type { CurrentUser, PatientProfileResponse } from '../types/domain';
import type { ClinicRole } from '../utils/roles';
import { formatDate } from '../utils/format';
import ReceptionPatientsPage from './ReceptionPatientsPage';

export default function PatientsPage({ role, user }: { role: ClinicRole; user: CurrentUser }) {
  if (role !== 'PATIENT') return <ReceptionPatientsPage role={role} />;
  return <PatientSelfPage role={role} user={user} />;
}

function PatientSelfPage({ role, user }: { role: ClinicRole; user: CurrentUser }) {
  const [profile, setProfile] = useState<PatientProfileResponse | null>(null);
  const [loading, setLoading] = useState(role === 'PATIENT');
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (role !== 'PATIENT') return;
    let active = true;
    setLoading(true); setError(null);
    void getPatientProfile().then((result) => { if (active) setProfile(result); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Unable to load profile'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [role, revision]);

  return <>
    <PageHeader title="Patients" subtitle={role === 'PATIENT' ? 'Your patient profile.' : 'Patient directory is not yet available in the backend.'}
      actions={role === 'PATIENT' ? <button className="soft-button" type="button" onClick={() => setRevision((value) => value + 1)} disabled={loading}>Refresh profile</button> : undefined} />
    {role !== 'PATIENT' && <Alert tone="info">The current patient service exposes only /api/patients/profile for the signed-in patient. Staff cannot search or list patient profiles until a role-scoped API is implemented.</Alert>}
    {role === 'PATIENT' && <section className="split-page">
      {loading && <p role="status">Loading profile...</p>}
      {error && <Alert tone="error">{error} <button type="button" onClick={() => setRevision((value) => value + 1)}>Retry</button></Alert>}
      {profile && <article className="panel profile-card">
        <div className="profile-hero"><Avatar label={user.fullName ?? user.email} size="lg" /><h3>{user.fullName ?? user.email}</h3><p>{user.email}</p></div>
        <dl className="details-list compact">
          <div><dt>Patient ID</dt><dd>{profile.id}</dd></div>
          <div><dt>Birth date</dt><dd>{formatDate(profile.dob)}</dd></div>
          <div><dt>Gender</dt><dd>{profile.gender || 'Not provided'}</dd></div>
          <div><dt>Phone</dt><dd>{user.phone || 'Not provided'}</dd></div>
          <div><dt>Address</dt><dd>{profile.address || 'Not provided'}</dd></div>
          <div><dt>Blood group</dt><dd>{profile.bloodType || 'Not provided'}</dd></div>
        </dl>
      </article>}
      {!loading && !profile && !error && <p>No patient profile found. Complete your profile in Settings.</p>}
    </section>}
  </>;
}
