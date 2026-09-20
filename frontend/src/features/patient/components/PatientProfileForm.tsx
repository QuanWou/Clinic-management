import { FormEvent, useState } from 'react';
import Alert from '../../../components/Alert';
import type {
  PatientGender,
  PatientProfileResponse,
  UpdatePatientProfileRequest
} from '../../../types/domain';

type PatientProfileFormProps = {
  profile?: PatientProfileResponse | null;
  error?: string | null;
  success?: string | null;
  loading: boolean;
  submitLabel: string;
  onSubmit: (request: UpdatePatientProfileRequest) => Promise<void> | void;
};

const genderOptions: Array<{ value: PatientGender; label: string }> = [
  { value: 'FEMALE', label: 'Female' },
  { value: 'MALE', label: 'Male' },
  { value: 'OTHER', label: 'Other' }
];

const bloodTypeOptions = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function PatientProfileForm({
  profile,
  error,
  success,
  loading,
  submitLabel,
  onSubmit
}: PatientProfileFormProps) {
  const [dob, setDob] = useState(profile?.dob ?? '');
  const [gender, setGender] = useState<PatientGender | ''>(normalizeGender(profile?.gender));
  const [address, setAddress] = useState(profile?.address ?? '');
  const [bloodType, setBloodType] = useState(profile?.bloodType ?? '');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!gender) {
      return;
    }

    await onSubmit({
      dob,
      gender,
      address: address.trim() || undefined,
      bloodType: bloodType || undefined
    });
  }

  return (
    <form className="form-stack patient-profile-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label>
          Date of birth
          <input
            type="date"
            value={dob}
            max={yesterdayDate()}
            onChange={(event) => setDob(event.target.value)}
            required
          />
        </label>

        <label>
          Gender
          <select
            value={gender}
            onChange={(event) => setGender(event.target.value as PatientGender | '')}
            required
          >
            <option value="">Select gender</option>
            {genderOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label>
          Blood type <span className="optional-label">Optional</span>
          <select value={bloodType} onChange={(event) => setBloodType(event.target.value)}>
            <option value="">Not specified</option>
            {bloodTypeOptions.map((bloodTypeOption) => (
              <option key={bloodTypeOption} value={bloodTypeOption}>{bloodTypeOption}</option>
            ))}
          </select>
        </label>

        <label className="form-span">
          Address <span className="optional-label">Optional</span>
          <textarea
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="Your current address"
            maxLength={500}
            rows={3}
          />
        </label>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {success && <Alert tone="info">{success}</Alert>}

      <button type="submit" disabled={loading}>
        {loading ? 'Saving profile...' : submitLabel}
      </button>
    </form>
  );
}

function normalizeGender(gender: PatientProfileResponse['gender']): PatientGender | '' {
  return gender === 'MALE' || gender === 'FEMALE' || gender === 'OTHER' ? gender : '';
}

function yesterdayDate(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}
