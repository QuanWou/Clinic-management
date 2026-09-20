import type { CurrentUser } from '../types/domain';
import Avatar from '../components/Avatar';
import { RefreshCw } from 'lucide-react';

type TopbarProps = {
  loading: boolean;
  primaryRole: string;
  user: CurrentUser;
  onRefresh: () => void;
};

export default function Topbar({ loading, primaryRole, user, onRefresh }: TopbarProps) {
  return (
    <header className="topbar">
      <div className="topbar-search" aria-label="Clinic workspace">Clinic workspace</div>
      <div className="topbar-actions">
        <button className="icon-button" type="button" onClick={onRefresh} disabled={loading} aria-label="Refresh data">
          <RefreshCw size={18} className={loading ? 'spin' : undefined} />
        </button>
        <div className="user-menu">
          <Avatar label={user.fullName ?? user.email} />
          <div><strong>{user.fullName ?? user.email}</strong><span>{primaryRole}</span></div>
        </div>
      </div>
    </header>
  );
}
