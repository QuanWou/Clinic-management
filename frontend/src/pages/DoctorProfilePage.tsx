import { FormEvent, useEffect, useState } from 'react';
import { CalendarDays, Plus, Save, Trash2 } from 'lucide-react';
import {
  getDoctorProfile,
  getMyDoctorSchedules,
  getSpecialties,
  updateDoctorProfile,
  updateMyDoctorSchedules
} from '../api/clinic';
import { ApiError } from '../api/client';
import Alert from '../components/Alert';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import PageHeader from '../components/PageHeader';
import type {
  CurrentUser,
  DoctorProfileResponse,
  DoctorSchedule,
  SpecialtyResponse
} from '../types/domain';
import { formatMoney, formatTime, shortId } from '../utils/format';

type DoctorProfilePageProps = {
  user: CurrentUser;
};

const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function DoctorProfilePage({ user }: DoctorProfilePageProps) {
  const [profile, setProfile] = useState<DoctorProfileResponse | null | undefined>(undefined);
  const [specialties, setSpecialties] = useState<SpecialtyResponse[]>([]);
  const [schedules, setSchedules] = useState<DoctorSchedule[]>([]);
  const [specialtyId, setSpecialtyId] = useState('');
  const [biography, setBiography] = useState('');
  const [consultationFee, setConsultationFee] = useState('0');
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSchedules, setSavingSchedules] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const specialtyResult = await getSpecialties();
        if (!active) return;
        setSpecialties(specialtyResult);

        try {
          const doctorProfile = await getDoctorProfile();
          const doctorSchedules = await getMyDoctorSchedules();
          if (!active) return;
          setProfile(doctorProfile);
          setSchedules(doctorSchedules);
          setSpecialtyId(doctorProfile.specialtyId ?? '');
          setBiography(doctorProfile.biography ?? '');
          setConsultationFee(String(doctorProfile.consultationFee ?? 0));
        } catch (err) {
          if (err instanceof ApiError && err.status === 404) {
            setProfile(null);
          } else {
            throw err;
          }
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load doctor profile');
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => { active = false; };
  }, []);

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const fee = Number(consultationFee);
    if (!specialtyId) {
      setError('Please select a specialty.');
      return;
    }
    if (!Number.isFinite(fee) || fee < 0) {
      setError('Consultation fee must be zero or greater.');
      return;
    }

    setSavingProfile(true);
    try {
      const saved = await updateDoctorProfile({ specialtyId, biography, consultationFee: fee });
      setProfile(saved);
      setMessage('Doctor profile saved successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save doctor profile');
    } finally {
      setSavingProfile(false);
    }
  }

  function updateSchedule(index: number, field: 'dayOfWeek' | 'startTime' | 'endTime', value: string) {
    setSchedules((current) => current.map((schedule, scheduleIndex) => (
      scheduleIndex === index
        ? { ...schedule, [field]: field === 'dayOfWeek' ? Number(value) : value }
        : schedule
    )));
  }

  function addSchedule() {
    setSchedules((current) => [
      ...current,
      { dayOfWeek: 1, startTime: '08:00', endTime: '12:00' }
    ]);
  }

  async function saveSchedules() {
    setError(null);
    setMessage(null);
    const invalid = schedules.some((schedule) => !schedule.startTime || !schedule.endTime || schedule.endTime <= schedule.startTime);
    if (invalid) {
      setError('Every schedule must end after it starts.');
      return;
    }

    setSavingSchedules(true);
    try {
      const saved = await updateMyDoctorSchedules({
        schedules: schedules.map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime }))
      });
      setSchedules(saved);
      setMessage('Weekly schedule saved successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save doctor schedules');
    } finally {
      setSavingSchedules(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Doctor Profile"
        subtitle="Maintain your clinical profile and recurring weekly schedule."
      />

      {error && <Alert tone="error">{error}</Alert>}
      {message && <Alert>{message}</Alert>}

      {loading ? (
        <article className="panel"><p className="empty-state">Loading doctor profile...</p></article>
      ) : (
        <section className="doctor-workspace">
          <div className="doctor-profile-grid">
            <article className="panel profile-card">
              <div className="profile-hero">
                <Avatar label={user.fullName ?? user.email} size="lg" />
                <h3>{user.fullName ?? user.email}</h3>
                <p>{profile?.specialtyName ?? 'Profile setup required'}</p>
                <Badge tone={profile ? 'Active' : 'Pending'}>{profile ? 'Configured' : 'Incomplete'}</Badge>
              </div>
              <dl className="details-list compact">
                <div><dt>Email</dt><dd>{user.email}</dd></div>
                <div><dt>Phone</dt><dd>{user.phone ?? 'Not provided'}</dd></div>
                <div><dt>Fee</dt><dd>{profile ? formatMoney(profile.consultationFee) : 'Not configured'}</dd></div>
                <div><dt>Profile ID</dt><dd>{profile ? `DR-${shortId(profile.id)}` : 'Created when saved'}</dd></div>
              </dl>
            </article>

            <article className="panel profile-overview">
              <div>
                <p className="eyebrow">Clinical details</p>
                <h3>{profile ? 'Edit profile' : 'Complete your doctor profile'}</h3>
                <p>Choose a seeded specialty and provide the information patients need before booking.</p>
              </div>
              <form className="form-stack doctor-profile-form" onSubmit={handleProfileSubmit}>
                <label>
                  Specialty
                  <select value={specialtyId} onChange={(event) => setSpecialtyId(event.target.value)} required>
                    <option value="">Select a specialty</option>
                    {specialties.map((specialty) => (
                      <option key={specialty.id} value={specialty.id}>{specialty.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Consultation fee
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={consultationFee}
                    onChange={(event) => setConsultationFee(event.target.value)}
                    required
                  />
                </label>
                <label>
                  Biography <span className="optional-label">Optional</span>
                  <textarea
                    rows={5}
                    maxLength={5000}
                    value={biography}
                    onChange={(event) => setBiography(event.target.value)}
                    placeholder="Clinical focus, qualifications, and care approach"
                  />
                </label>
                <button type="submit" disabled={savingProfile || specialties.length === 0}>
                  <Save size={17} />{savingProfile ? 'Saving profile...' : 'Save profile'}
                </button>
              </form>
            </article>
          </div>

          <article className="panel schedule-editor">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Availability</p>
                <h3>Weekly schedule</h3>
                <p>Add separate entries when a working day has a break.</p>
              </div>
              <button className="soft-button" type="button" onClick={addSchedule} disabled={!profile || schedules.length >= 28}>
                <Plus size={17} />Add hours
              </button>
            </div>

            {!profile ? (
              <p className="empty-state">Save your doctor profile before configuring working hours.</p>
            ) : (
              <>
                {schedules.length === 0 ? (
                  <p className="empty-state">No working hours configured yet.</p>
                ) : (
                  <div className="schedule-list">
                    {schedules.map((schedule, index) => (
                      <div className="schedule-row" key={schedule.id ?? `${schedule.dayOfWeek}-${index}`}>
                        <CalendarDays size={18} />
                        <select
                          aria-label={`Day for schedule ${index + 1}`}
                          value={schedule.dayOfWeek}
                          onChange={(event) => updateSchedule(index, 'dayOfWeek', event.target.value)}
                        >
                          {dayNames.map((day, dayIndex) => (
                            <option key={day} value={dayIndex + 1}>{day}</option>
                          ))}
                        </select>
                        <input
                          aria-label={`Start time for schedule ${index + 1}`}
                          type="time"
                          value={schedule.startTime.slice(0, 5)}
                          onChange={(event) => updateSchedule(index, 'startTime', event.target.value)}
                        />
                        <span>to</span>
                        <input
                          aria-label={`End time for schedule ${index + 1}`}
                          type="time"
                          value={schedule.endTime.slice(0, 5)}
                          onChange={(event) => updateSchedule(index, 'endTime', event.target.value)}
                        />
                        <span className="schedule-summary">
                          {formatTime(schedule.startTime)}–{formatTime(schedule.endTime)}
                        </span>
                        <button
                          className="icon-button danger-icon"
                          type="button"
                          aria-label={`Remove schedule ${index + 1}`}
                          onClick={() => setSchedules((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button type="button" onClick={saveSchedules} disabled={savingSchedules}>
                  <Save size={17} />{savingSchedules ? 'Saving schedule...' : 'Save weekly schedule'}
                </button>
              </>
            )}
          </article>
        </section>
      )}
    </>
  );
}
