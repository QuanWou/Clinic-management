import { MoreHorizontal, Search, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import PageHeader from '../components/PageHeader';
import { demoPatients } from '../data/demoClinicData';
import { formatDate } from '../utils/format';

export default function PatientsPage() {
  const [selectedId, setSelectedId] = useState(demoPatients[0].id);
  const selected = demoPatients.find((patient) => patient.id === selectedId) ?? demoPatients[0];

  return (
    <>
      <PageHeader
        title="Patients"
        subtitle="Manage patient profiles."
        actions={(
          <>
            <div className="inline-search"><Search size={16} /><input aria-label="Search patient" placeholder="Search patient..." /></div>
            <button className="soft-button" type="button"><SlidersHorizontal size={17} />Filter</button>
          </>
        )}
      />

      <section className="split-page">
        <article className="panel table-panel">
          <div className="data-table">
            <div className="table-row table-head">
              <span>Patient</span>
              <span>Age</span>
              <span>Gender</span>
              <span>Phone</span>
              <span>Last Visit</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {demoPatients.map((patient) => (
              <button className="table-row" type="button" key={patient.id} onClick={() => setSelectedId(patient.id)}>
                <span className="person-cell"><Avatar label={patient.avatar} size="sm" />{patient.name}</span>
                <span>{patient.age}</span>
                <span>{patient.gender}</span>
                <span>{patient.phone}</span>
                <span>{formatDate(patient.lastVisit)}</span>
                <span><Badge tone={patient.status}>{patient.status}</Badge></span>
                <span><MoreHorizontal size={17} /></span>
              </button>
            ))}
          </div>
        </article>

        <article className="panel profile-card">
          <div className="profile-hero">
            <Avatar label={selected.avatar} size="lg" />
            <h3>{selected.name}</h3>
            <p>{selected.age} years old, {selected.gender}</p>
            <Badge tone={selected.status}>{selected.status}</Badge>
          </div>
          <dl className="details-list compact">
            <div><dt>Phone</dt><dd>{selected.phone}</dd></div>
            <div><dt>Email</dt><dd>{selected.email}</dd></div>
            <div><dt>Address</dt><dd>{selected.address}</dd></div>
            <div><dt>Blood Group</dt><dd>{selected.bloodType}</dd></div>
            <div><dt>Emergency</dt><dd>{selected.emergencyContact}</dd></div>
            <div><dt>Insurance</dt><dd>{selected.insuranceProvider}</dd></div>
          </dl>
        </article>
      </section>
    </>
  );
}
