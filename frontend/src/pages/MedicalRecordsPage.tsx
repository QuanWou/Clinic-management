import { Plus, Search, SlidersHorizontal } from 'lucide-react';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import PageHeader from '../components/PageHeader';
import type { MedicalRecordResponse } from '../types/domain';
import { formatDate, shortId } from '../utils/format';
import { getUiMedicalRecords } from '../utils/uiData';

type MedicalRecordsPageProps = {
  records: MedicalRecordResponse[] | null | undefined;
};

export default function MedicalRecordsPage({ records }: MedicalRecordsPageProps) {
  const rows = getUiMedicalRecords(records);
  const selected = rows[0];

  return (
    <>
      <PageHeader
        title="Medical Records"
        subtitle="Manage patient medical records."
        actions={(
          <>
            <div className="inline-search"><Search size={16} /><input aria-label="Search records" placeholder="Search records..." /></div>
            <button className="soft-button" type="button"><SlidersHorizontal size={17} />Filter</button>
            <button type="button"><Plus size={17} />New Record</button>
          </>
        )}
      />

      <section className="split-page">
        <article className="panel table-panel">
          <div className="data-table">
            <div className="table-row table-head records-grid">
              <span>Patient</span>
              <span>Record Type</span>
              <span>Date</span>
              <span>Doctor</span>
              <span>Status</span>
            </div>
            {rows.map((record) => (
              <div className="table-row records-grid" key={record.id}>
                <span className="person-cell"><Avatar label={record.patientName} size="sm" />{record.patientName}</span>
                <span>{record.recordType}</span>
                <span>{formatDate(record.createdAt)}</span>
                <span>{record.doctorName}</span>
                <span><Badge tone={record.status}>{record.status}</Badge></span>
              </div>
            ))}
          </div>
        </article>

        {selected && (
          <article className="panel detail-panel">
            <div className="panel-heading">
              <h3>{selected.patientName}</h3>
              <Badge tone={selected.status}>{selected.status}</Badge>
            </div>
            <p>Record ID: MR-{shortId(selected.id)}</p>
            <div className="record-tabs">
              {['Summary', 'Notes', 'Prescription'].map((tab, index) => (
                <button className={index === 0 ? 'active' : undefined} type="button" key={tab}>{tab}</button>
              ))}
            </div>
            <dl className="details-list compact">
              <div><dt>Diagnosis</dt><dd>{selected.diagnosis}</dd></div>
              <div><dt>Symptoms</dt><dd>{selected.symptoms ?? 'Not recorded'}</dd></div>
              <div><dt>Doctor Notes</dt><dd>{selected.notes ?? 'No notes'}</dd></div>
              <div><dt>Next Visit</dt><dd>December 26, 2024</dd></div>
            </dl>
          </article>
        )}
      </section>
    </>
  );
}
