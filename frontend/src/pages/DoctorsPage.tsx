import { useEffect, useState } from 'react';
import { getAdminDoctors } from '../api/clinic';
import Alert from '../components/Alert';
import PageHeader from '../components/PageHeader';
import { integrations } from '../config/integrations.config';
import type { AdminDoctorResponse } from '../types/domain';
import type { ClinicRole } from '../utils/roles';
import { formatMoney } from '../utils/format';

export default function DoctorsPage({ role }: { role: ClinicRole }) {
  if (role !== 'ADMIN') return <>
    <PageHeader title="Doctors" subtitle="Clinic doctor directory" />
    <Alert tone="info">Task 02's current doctor directory is administrator-only. A role-authorized directory for patients and receptionists is not yet available.</Alert>
  </>;
  if (!integrations.adminCatalog) return <>
    <PageHeader title="Doctors" subtitle="Administrator doctor directory" />
    <Alert tone="info">Doctor management requires the unmerged Task 02 backend and its gateway routes.</Alert>
  </>;
  return <AdminDoctorsPage />;
}

function AdminDoctorsPage() {
  const [doctors, setDoctors] = useState<AdminDoctorResponse[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(null); setDoctors(null);
    void getAdminDoctors().then((page) => {
      if (!active) return;
      if (!Array.isArray(page.content)) throw new Error('Invalid doctor directory response');
      setDoctors(page.content);
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Unable to load doctors'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);
  return <>
    <PageHeader title="Doctors" subtitle="Administrator-only doctor directory"
      actions={<button type="button" className="soft-button" disabled={loading} onClick={() => setRevision((value) => value + 1)}>Refresh</button>} />
    <article className="panel table-panel">
      {loading && <p role="status">Loading doctors...</p>}
      {error && <Alert tone="error">{error} <button type="button" onClick={() => setRevision((value) => value + 1)}>Retry</button></Alert>}
      {!loading && doctors?.length === 0 && <p>No doctors found.</p>}
      {doctors?.map((doctor) => <div key={doctor.id} className="person-row">
        <strong>{doctor.id}</strong> — {doctor.specialtyName || 'No specialty'} — {doctor.active ? 'Active' : 'Inactive'}
        <span>Fee: {formatMoney(doctor.consultationFee)} (currency unspecified)</span>
      </div>)}
      <p>The API returns a paginated directory; this screen requests the first page only. Doctor edits belong to administrator workflows.</p>
    </article>
  </>;
}
