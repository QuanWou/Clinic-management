import { useState } from 'react';
import { updatePatientProfile } from '../api/clinic';
import PatientProfileForm from '../features/patient/components/PatientProfileForm';
import type {
  CurrentUser,
  PatientProfileResponse,
  UpdatePatientProfileRequest
} from '../types/domain';

type PatientOnboardingPageProps = {
  user: CurrentUser;
  onComplete: (profile: PatientProfileResponse) => Promise<void> | void;
  onLogout: () => void;
};

export default function PatientOnboardingPage({ user, onComplete, onLogout }: PatientOnboardingPageProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(request: UpdatePatientProfileRequest) {
    setLoading(true);
    setError(null);

    try {
      const profile = await updatePatientProfile(request);
      await onComplete(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save patient profile');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell onboarding-shell">
      <section className="auth-card onboarding-card">
        <div className="onboarding-heading">
          <div>
            <p className="eyebrow">One final step</p>
            <h1>Complete your patient profile</h1>
            <p className="muted">
              Welcome, {user.fullName ?? user.email}. We need these details before you use patient services.
            </p>
          </div>
          <button className="ghost-button" type="button" onClick={onLogout}>Sign out</button>
        </div>

        <PatientProfileForm
          error={error}
          loading={loading}
          submitLabel="Complete profile"
          onSubmit={handleSubmit}
        />
      </section>
    </main>
  );
}
