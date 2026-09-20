import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { getDoctors, getSpecialties } from '../api/clinic';
import Alert from '../components/Alert';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import PageHeader from '../components/PageHeader';
import type { DoctorProfileResponse, SpecialtyResponse } from '../types/domain';
import { formatMoney, shortId } from '../utils/format';

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<DoctorProfileResponse[]>([]);
  const [specialties, setSpecialties] = useState<SpecialtyResponse[]>([]);
  const [specialtyId, setSpecialtyId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSpecialties() {
      try {
        const result = await getSpecialties();
        if (active) setSpecialties(result);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load specialties');
      }
    }

    void loadSpecialties();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    getDoctors(specialtyId || undefined)
      .then((result) => {
        if (active) setDoctors(result);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load doctors');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [specialtyId]);

  const visibleDoctors = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return doctors;
    return doctors.filter((doctor) => [
      doctor.specialtyName,
      doctor.biography,
      doctor.id,
      doctor.userId
    ].some((value) => value?.toLowerCase().includes(query)));
  }, [doctors, search]);

  return (
    <>
      <PageHeader
        title="Doctors"
        subtitle="Browse configured doctor profiles by specialty."
        actions={(
          <>
            <div className="inline-search">
              <Search size={16} />
              <input
                aria-label="Search doctors"
                placeholder="Search specialty or profile..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <select
              className="filter-select"
              aria-label="Filter by specialty"
              value={specialtyId}
              onChange={(event) => setSpecialtyId(event.target.value)}
            >
              <option value="">All specialties</option>
              {specialties.map((specialty) => (
                <option key={specialty.id} value={specialty.id}>{specialty.name}</option>
              ))}
            </select>
          </>
        )}
      />

      {error && <Alert tone="error">{error}</Alert>}

      <article className="panel table-panel">
        {loading ? (
          <p className="empty-state">Loading doctor directory...</p>
        ) : visibleDoctors.length === 0 ? (
          <p className="empty-state">No configured doctors match this filter.</p>
        ) : (
          <div className="data-table">
            <div className="table-row table-head doctors-grid">
              <span>Profile</span>
              <span>Specialty</span>
              <span>About</span>
              <span>Fee</span>
              <span>Identifier</span>
            </div>
            {visibleDoctors.map((doctor) => (
              <div className="table-row doctors-grid" key={doctor.id}>
                <span className="person-cell">
                  <Avatar label={doctor.specialtyName ?? 'DR'} size="sm" />
                  <span><strong>Doctor profile</strong><small>User {shortId(doctor.userId)}</small></span>
                </span>
                <span>{doctor.specialtyName ?? 'Not assigned'}</span>
                <span className="truncate-cell">{doctor.biography ?? 'Biography not provided'}</span>
                <span>{formatMoney(doctor.consultationFee)}</span>
                <span><Badge tone="Active">{`DR-${shortId(doctor.id)}`}</Badge></span>
              </div>
            ))}
          </div>
        )}
      </article>
    </>
  );
}
