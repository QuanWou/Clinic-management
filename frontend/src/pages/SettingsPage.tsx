import { useState } from 'react';
import { updatePatientProfile } from '../api/clinic';
import Alert from '../components/Alert';
import Avatar from '../components/Avatar';
import PageHeader from '../components/PageHeader';
import PatientProfileForm from '../features/patient/components/PatientProfileForm';
import type {
  CurrentUser,
  PatientProfileResponse,
  UpdatePatientProfileRequest
} from '../types/domain';
import { normalizeRoles } from '../utils/roles';

type SettingsPageProps = {
  user: CurrentUser;
  patientProfile?: PatientProfileResponse | null;
  onPatientProfileSaved: (profile: PatientProfileResponse) => void;
};

export default function SettingsPage({ user, patientProfile, onPatientProfileSaved }: SettingsPageProps) {
  const roles = normalizeRoles(user.roles);
  const isPatient = roles.includes('ROLE_PATIENT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handlePatientProfileSubmit(request: UpdatePatientProfileRequest) {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const profile = await updatePatientProfile(request);
      onPatientProfileSaved(profile);
      setSuccess('Patient profile saved successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save patient profile');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="Manage your account and preferences." />

      <section className="settings-grid">
        <aside className="panel settings-menu">
          {['Profile', 'Account', 'Notifications', 'Security', 'Billing & Plan', 'System'].map((item, index) => (
            <button className={index === 0 ? 'active' : undefined} type="button" key={item}>{item}</button>
          ))}
        </aside>

        <article className="panel settings-form">
          <h3>Profile Information</h3>
          <div className="settings-profile">
            <Avatar label={user.fullName ?? user.email} size="lg" />
            <div>
              <strong>{user.fullName ?? 'Olivia Rhye'}</strong>
              <span>{roles.join(', ') || 'Clinic user'}</span>
            </div>
          </div>
          <label>Full Name<input value={user.fullName ?? ''} readOnly /></label>
          <label>Email<input value={user.email} readOnly /></label>
          <label>Phone<input value={user.phone ?? ''} placeholder="Not provided" readOnly /></label>
          <label>Role<input value={roles.join(', ') || 'Clinic user'} readOnly /></label>

          {isPatient && patientProfile && (
            <section className="settings-section">
              <div>
                <h3>Patient Information</h3>
                <p className="muted">Update the clinical profile associated with your account.</p>
              </div>
              {success && <Alert tone="info">{success}</Alert>}
              <PatientProfileForm
                profile={patientProfile}
                error={error}
                loading={loading}
                submitLabel="Save patient profile"
                onSubmit={handlePatientProfileSubmit}
              />
            </section>
          )}
        </article>
      </section>
    </>
  );
}
