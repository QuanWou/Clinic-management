import { useEffect, useState } from 'react';
import { getAdminDoctors, getDoctors } from '../api/clinic';
import Alert from '../components/Alert';
import PageHeader from '../components/PageHeader';
import { integrations } from '../config/integrations.config';
import type { AdminDoctorResponse, DoctorProfileResponse } from '../types/domain';
import type { ClinicRole } from '../utils/roles';
import { formatMoney } from '../utils/format';

export default function DoctorsPage({ role }: { role: ClinicRole }) {
  if (role === 'RECEPTIONIST' || role === 'PATIENT') return <PublicDoctorsPage />;
  if (role !== 'ADMIN') return <Alert tone="error">Doctor directory is not available for this role.</Alert>;
  if (!integrations.adminCatalog) return <>
    <PageHeader title="Doctors" subtitle="Administrator doctor directory" />
    <Alert tone="info">Administrator doctor management is not enabled in this deployment.</Alert>
  </>;
  return <AdminDoctorsPage />;
}

function PublicDoctorsPage() {
  const [doctors, setDoctors] = useState<DoctorProfileResponse[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(null); setDoctors(null);
    void getDoctors().then((result) => {
      if (!active) return;
      if (!Array.isArray(result)) throw new Error('Invalid doctor directory response');
      setDoctors(result);
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Unable to load doctors'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);
  return <>
    <PageHeader title="Doctors" subtitle="Available clinic doctors"
      actions={<button type="button" className="soft-button" disabled={loading} onClick={() => setRevision((value) => value + 1)}>Refresh</button>} />
    <article className="panel table-panel">
      {loading && <p role="status">Loading doctors...</p>}
      {error && <Alert tone="error">{error} <button type="button" onClick={() => setRevision((value) => value + 1)}>Retry</button></Alert>}
      {!loading && doctors?.length === 0 && <p>No active doctors available.</p>}
      {doctors?.map((doctor) => <div key={doctor.id} className="person-row">
        <strong>{doctor.specialtyName || 'Doctor'}</strong> — {doctor.id}
        <span>Consultation fee: {formatMoney(doctor.consultationFee)} (currency unspecified)</span>
      </div>)}
    </article>
  </>;
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
