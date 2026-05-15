import { CalendarDays, Edit3, Star } from 'lucide-react';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import PageHeader from '../components/PageHeader';
import { demoDoctors } from '../data/demoClinicData';
import { formatMoney } from '../utils/format';

export default function DoctorProfilePage() {
  const doctor = demoDoctors[0];

  return (
    <>
      <PageHeader
        title="Doctor Profile"
        subtitle="Review doctor profile, schedule, appointments, and statistics."
        actions={<button type="button"><Edit3 size={17} />Edit Profile</button>}
      />

      <section className="doctor-profile-grid">
        <article className="panel profile-card">
          <div className="profile-hero">
            <Avatar label={doctor.avatar} size="lg" />
            <h3>{doctor.name}</h3>
            <p>{doctor.specialtyName}</p>
            <Badge tone={doctor.status}>{doctor.status}</Badge>
          </div>
          <dl className="details-list compact">
            <div><dt>Email</dt><dd>{doctor.email}</dd></div>
            <div><dt>Phone</dt><dd>{doctor.phone}</dd></div>
            <div><dt>Fee</dt><dd>{formatMoney(doctor.consultationFee)}</dd></div>
            <div><dt>Education</dt><dd>{doctor.education}</dd></div>
          </dl>
        </article>

        <article className="panel profile-overview">
          <div className="tabs">
            {['Overview', 'Schedule', 'Appointments', 'Statistics'].map((tab, index) => (
              <button className={index === 0 ? 'active' : undefined} type="button" key={tab}>{tab}</button>
            ))}
          </div>
          <h3>About</h3>
          <p>{doctor.biography}</p>
          <div className="tag-list">
            {['Cardiologist', 'Interventional Cardiology', 'Preventive Cardiology', 'Heart Failure'].map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
          <div className="profile-stats">
            <div><CalendarDays size={20} /><span>Working Hours</span><strong>{doctor.workingHours}</strong></div>
            <div><Star size={20} /><span>Rating</span><strong>{doctor.rating} / 5</strong></div>
            <div><span>Total Patients</span><strong>{doctor.totalPatients.toLocaleString()}</strong></div>
            <div><span>Languages</span><strong>{doctor.languages.join(', ')}</strong></div>
          </div>
        </article>
      </section>
    </>
  );
}
