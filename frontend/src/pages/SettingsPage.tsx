import Avatar from '../components/Avatar';
import PageHeader from '../components/PageHeader';
import type { CurrentUser } from '../types/domain';
import { normalizeRoles } from '../utils/roles';

type SettingsPageProps = {
  user: CurrentUser;
};

export default function SettingsPage({ user }: SettingsPageProps) {
  const roles = normalizeRoles(user.roles);

  return (
    <>
      <PageHeader title="Settings" subtitle="Manage your account and preferences." />

      <section className="settings-grid">
        <aside className="panel settings-menu">
          {['Profile', 'Account', 'Notifications', 'Security', 'Billing & Plan', 'System'].map((item, index) => (
            <button className={index === 0 ? 'active' : undefined} type="button" key={item}>{item}</button>
          ))}
        </aside>

        <article className="panel settings-form">
          <h3>Profile Information</h3>
          <div className="settings-profile">
            <Avatar label={user.fullName ?? user.email} size="lg" />
            <div>
              <strong>{user.fullName ?? 'Olivia Rhye'}</strong>
              <span>Administrator</span>
            </div>
          </div>
          <label>Full Name<input value={user.fullName ?? 'Olivia Rhye'} readOnly /></label>
          <label>Email<input value={user.email} readOnly /></label>
          <label>Phone<input value={user.phone ?? '+1 (555) 123-4567'} readOnly /></label>
          <label>Role<input value={roles.join(', ') || 'Administrator'} readOnly /></label>
          <button type="button">Save Changes</button>
        </article>
      </section>
    </>
  );
}
