import { Plus, Search, SlidersHorizontal } from 'lucide-react';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import PageHeader from '../components/PageHeader';
import { demoDoctors } from '../data/demoClinicData';
import { formatMoney } from '../utils/format';

export default function DoctorsPage() {
  return (
    <>
      <PageHeader
        title="Doctors"
        subtitle="Manage doctors and their information."
        actions={(
          <>
            <div className="inline-search"><Search size={16} /><input aria-label="Search doctor" placeholder="Search doctor..." /></div>
            <button className="soft-button" type="button"><SlidersHorizontal size={17} />Filter</button>
            <button type="button"><Plus size={17} />Add Doctor</button>
          </>
        )}
      />

      <article className="panel table-panel">
        <div className="data-table">
          <div className="table-row table-head doctors-grid">
            <span>Doctor</span>
            <span>Department</span>
            <span>Experience</span>
            <span>Phone</span>
            <span>Status</span>
            <span>Fee</span>
          </div>
          {demoDoctors.map((doctor) => (
            <div className="table-row doctors-grid" key={doctor.id}>
              <span className="person-cell"><Avatar label={doctor.avatar} size="sm" />{doctor.name}</span>
              <span>{doctor.specialtyName}</span>
              <span>{doctor.experience} years</span>
              <span>{doctor.phone}</span>
              <span><Badge tone={doctor.status}>{doctor.status}</Badge></span>
              <span>{formatMoney(doctor.consultationFee)}</span>
            </div>
          ))}
        </div>
      </article>
    </>
  );
}
