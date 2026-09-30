import type { CurrentUser } from '../../../types/domain';

type UserProfilePanelProps = {
  roles: string[];
  user: CurrentUser;
};

export default function UserProfilePanel({ roles, user }: UserProfilePanelProps) {
  return (
    <article className="panel">
      <h3>User profile</h3>
      <dl className="details-list">
        <div><dt>Email</dt><dd>{user.email}</dd></div>
        <div><dt>Mã tài khoản</dt><dd>{user.accountCode ?? 'Chưa có'}</dd></div>
        <div><dt>Roles</dt><dd>{roles.join(', ') || 'Not available'}</dd></div>
      </dl>
    </article>
  );
}
