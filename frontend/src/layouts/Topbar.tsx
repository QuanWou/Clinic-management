import type { CurrentUser } from '../types/domain';
import Avatar from '../components/Avatar';
import { Bell, ChevronDown, MessageSquare, RefreshCw, Search } from 'lucide-react';

type TopbarProps = {
  loading: boolean;
  primaryRole: string;
  user: CurrentUser;
  onRefresh: () => void;
};

export default function Topbar({ loading, primaryRole, user, onRefresh }: TopbarProps) {
  return (
    <header className="topbar">
      <div className="topbar-search">
        <Search size={18} />
        <input aria-label="Search" placeholder="Search anything..." />
      </div>

      <div className="topbar-actions">
        <button className="icon-button" type="button" onClick={onRefresh} disabled={loading} aria-label="Refresh dashboard">
          <RefreshCw size={18} className={loading ? 'spin' : undefined} />
        </button>
        <button className="icon-button has-dot" type="button" aria-label="Notifications">
          <Bell size={18} />
        </button>
        <button className="icon-button has-dot" type="button" aria-label="Messages">
          <MessageSquare size={18} />
        </button>
        <div className="user-menu">
          <Avatar label={user.fullName ?? user.email} />
          <div>
            <strong>{user.fullName ?? user.email}</strong>
            <span>{primaryRole.replace('ROLE_', '')}</span>
          </div>
          <ChevronDown size={16} />
        </div>
      </div>
    </header>
  );
}
