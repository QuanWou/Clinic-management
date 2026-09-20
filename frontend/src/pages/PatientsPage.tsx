import { Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { updatePatientProfile } from '../api/clinic';
import Alert from '../components/Alert';
import Avatar from '../components/Avatar';
import PageHeader from '../components/PageHeader';
import type { CurrentUser, PatientProfileResponse } from '../types/domain';
import { formatDate, shortId } from '../utils/format';
import { normalizeRoles } from '../utils/roles';

type PatientsPageProps = {
  patients: PatientProfileResponse[] | null;
  user: CurrentUser;
  error?: string;
  loading: boolean;
  onChanged: () => Promise<void>;
};

function getAge(dateOfBirth?: string | null): string {
  if (!dateOfBirth) return 'Not provided';
  const birth = new Date(`${dateOfBirth}T00:00:00`);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
  return Number.isFinite(age) ? String(age) : 'Not provided';
}

export default function PatientsPage({ patients, user, error, loading, onChanged }: PatientsPageProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const visible = (patients ?? []).filter((patient) => {
    const label = patient.userId === user.id ? user.fullName ?? user.email : `Patient ${shortId(patient.id)}`;
    return `${label} ${patient.id}`.toLowerCase().includes(query.toLowerCase());
  });
  const selected = visible.find((patient) => patient.id === selectedId) ?? visible[0];
  const name = (patient: PatientProfileResponse) => patient.userId === user.id
    ? user.fullName ?? user.email
    : `Patient ${shortId(patient.id)}`;
  const canEditOwnProfile = normalizeRoles(user.roles).includes('ROLE_PATIENT');
  const ownProfile = patients?.find((patient) => patient.userId === user.id);

  return (
    <>
      <PageHeader
        title="Patients"
        subtitle="Patient profiles available to your account from the clinic API."
        actions={<div className="inline-search"><Search size={16} /><input aria-label="Search patient" placeholder="Search by name or ID" value={query} onChange={(event) => setQuery(event.target.value)} /></div>}
      />
      {error && <Alert tone="error">Unable to load patients: {error}</Alert>}
      {canEditOwnProfile && !loading && !ownProfile && <Alert>Your patient profile has not been created yet. Complete the form below to enable your appointment dashboard.</Alert>}
      {!loading && !error && patients === null && <Alert>Patient directory access is limited to administrators and receptionists. Patient accounts can see their own profile.</Alert>}
      {!loading && !error && patients !== null && visible.length === 0 && <Alert>{query ? 'No patients match your search.' : 'No patient profiles found.'}</Alert>}
      {selected && (
        <section className="split-page">
          <article className="panel table-panel">
            <div className="data-table">
              <div className="table-row table-head">
                <span>Patient</span><span>Age</span><span>Gender</span><span>Blood type</span><span>Updated</span><span>ID</span><span>Details</span>
              </div>
              {visible.map((patient) => (
                <button className="table-row" type="button" key={patient.id} onClick={() => setSelectedId(patient.id)} aria-pressed={selected.id === patient.id}>
                  <span className="person-cell"><Avatar label={name(patient)} size="sm" />{name(patient)}</span>
                  <span>{getAge(patient.dob)}</span>
                  <span>{patient.gender ?? 'Not provided'}</span>
                  <span>{patient.bloodType ?? 'Not provided'}</span>
                  <span>{formatDate(patient.updatedAt)}</span>
                  <span>{shortId(patient.id)}</span>
                  <span>View</span>
                </button>
              ))}
            </div>
          </article>
          <article className="panel profile-card">
            <div className="profile-hero">
              <Avatar label={name(selected)} size="lg" />
              <h3>{name(selected)}</h3>
              <p>{selected.dob ? `${getAge(selected.dob)} years old` : 'Age not provided'}</p>
            </div>
            <dl className="details-list compact">
              <div><dt>Patient ID</dt><dd>{selected.id}</dd></div>
              <div><dt>Gender</dt><dd>{selected.gender ?? 'Not provided'}</dd></div>
              <div><dt>Date of birth</dt><dd>{formatDate(selected.dob)}</dd></div>
              <div><dt>Address</dt><dd>{selected.address ?? 'Not provided'}</dd></div>
              <div><dt>Blood group</dt><dd>{selected.bloodType ?? 'Not provided'}</dd></div>
              {selected.userId === user.id && <>
                <div><dt>Phone</dt><dd>{user.phone ?? 'Not provided'}</dd></div>
                <div><dt>Email</dt><dd>{user.email}</dd></div>
              </>}
            </dl>
          </article>
        </section>
      )}
      {canEditOwnProfile && (
        <PatientProfileEditor key={ownProfile?.id ?? 'new-profile'} profile={ownProfile} onChanged={onChanged} />
      )}
    </>
  );
}

function PatientProfileEditor({ profile, onChanged }: { profile?: PatientProfileResponse; onChanged: () => Promise<void> }) {
  const [dob, setDob] = useState(profile?.dob ?? '');
  const [gender, setGender] = useState(profile?.gender ?? '');
  const [address, setAddress] = useState(profile?.address ?? '');
  const [bloodType, setBloodType] = useState(profile?.bloodType ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await updatePatientProfile({
        dob: dob || null,
        gender: gender.trim() || null,
        address: address.trim() || null,
        bloodType: bloodType.trim() || null
      });
      await onChanged();
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save patient profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel settings-form">
      <h3>{profile ? 'Update my patient profile' : 'Create my patient profile'}</h3>
      {error && <Alert tone="error">{error}</Alert>}
      {saved && <Alert>Profile saved successfully.</Alert>}
      <form onSubmit={(event) => void save(event)}>
        <label>Date of birth<input aria-label="Date of birth" type="date" value={dob} onChange={(event) => setDob(event.target.value)} max={new Date(Date.now() - 86400000).toISOString().slice(0, 10)} /></label>
        <label>Gender<input aria-label="Gender" value={gender} onChange={(event) => setGender(event.target.value)} maxLength={30} /></label>
        <label>Address<input aria-label="Address" value={address} onChange={(event) => setAddress(event.target.value)} maxLength={255} /></label>
        <label>Blood type<input aria-label="Blood type" value={bloodType} onChange={(event) => setBloodType(event.target.value)} maxLength={20} /></label>
        <button disabled={saving} type="submit">{saving ? 'Saving...' : 'Save patient profile'}</button>
      </form>
    </section>
  );
}
