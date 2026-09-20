import { Search } from 'lucide-react';
import { useState } from 'react';
import Alert from '../components/Alert';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import PageHeader from '../components/PageHeader';
import type { MedicalRecordResponse } from '../types/domain';
import { formatDate, shortId } from '../utils/format';
import { getUiMedicalRecords, type Lookup } from '../utils/uiData';

type MedicalRecordsPageProps = {
  records: MedicalRecordResponse[] | null | undefined;
  lookup: Lookup;
  error?: string;
  supported: boolean;
  loading: boolean;
};

export default function MedicalRecordsPage({ records, lookup, error, supported, loading }: MedicalRecordsPageProps) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rows = getUiMedicalRecords(records, lookup).filter((record) =>
    `${record.patientName} ${record.doctorName} ${record.diagnosis} ${record.id}`.toLowerCase().includes(query.toLowerCase())
  );
  const selected = rows.find((record) => record.id === selectedId) ?? rows[0];

  return (
    <>
      <PageHeader title="Medical Records" subtitle="Medical records you are authorized to view." actions={
        <div className="inline-search"><Search size={16} /><input aria-label="Search records" placeholder="Search records..." value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      } />
      {error && <Alert tone="error">Unable to load medical records: {error}</Alert>}
      {!supported && <Alert>The backend currently exposes a patient record list only. Staff record lists are not available yet.</Alert>}
      {supported && !loading && !error && rows.length === 0 && <Alert>{query ? 'No records match your search.' : 'No medical records found.'}</Alert>}
      {supported && rows.length > 0 && (
        <section className="split-page">
          <article className="panel table-panel">
            <div className="data-table">
              <div className="table-row table-head records-grid">
                <span>Patient</span><span>Record Type</span><span>Date</span><span>Doctor</span><span>Status</span>
              </div>
              {rows.map((record) => (
                <button className="table-row records-grid" type="button" key={record.id} aria-pressed={selected.id === record.id} onClick={() => setSelectedId(record.id)}>
                  <span className="person-cell"><Avatar label={record.patientName} size="sm" />{record.patientName}</span>
                  <span>{record.recordType}</span>
                  <span>{formatDate(record.createdAt)}</span>
                  <span>{record.doctorName}</span>
                  <span><Badge tone={record.status}>{record.status}</Badge></span>
                </button>
              ))}
            </div>
          </article>
          {selected && (
            <article className="panel detail-panel">
              <div className="panel-heading"><h3>{selected.patientName}</h3><Badge tone={selected.status}>{selected.status}</Badge></div>
              <p>Record ID: MR-{shortId(selected.id)}</p>
              <dl className="details-list compact">
                <div><dt>Diagnosis</dt><dd>{selected.diagnosis}</dd></div>
                <div><dt>Symptoms</dt><dd>{selected.symptoms ?? 'Not recorded'}</dd></div>
                <div><dt>Doctor Notes</dt><dd>{selected.notes ?? 'No notes'}</dd></div>
                <div><dt>Prescriptions</dt><dd>{selected.prescriptions?.length ?? 0}</dd></div>
              </dl>
              {selected.prescriptions?.map((prescription) => (
                <div key={prescription.id}>
                  <h4>Prescription {shortId(prescription.id)}</h4>
                  {prescription.items.map((item) => <p key={item.id}>{item.medicineName}: {item.dosage}, {item.frequency}, {item.duration}</p>)}
                </div>
              ))}
            </article>
          )}
        </section>
      )}
    </>
  );
}
