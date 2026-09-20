import type { ReactNode } from 'react';
import type { CurrentUser } from '../types/domain';
import type { AppView } from '../types/view';
import { mainNavigation } from '../config/navigation.config';
import Avatar from '../components/Avatar';
import { RefreshCw } from 'lucide-react';
import { roleLabel } from '../utils/locale';

type TopbarProps = {
  loading: boolean;
  primaryRole: string;
  user: CurrentUser;
  onRefresh: () => void;
  activeView: AppView;
  menuButton: ReactNode;
};

export default function Topbar({ activeView, loading, primaryRole, user, onRefresh, menuButton }: TopbarProps) {
  const page = mainNavigation.find((item) => item.id === activeView)?.label ?? 'Tổng quan';
  return (
    <header className="topbar">
      <div className="topbar-location">{menuButton}<div><span className="breadcrumb">Clinic / Không gian làm việc</span><strong>{page}</strong></div></div>
      <div className="topbar-actions">
        <button className="icon-button" type="button" onClick={onRefresh} disabled={loading} aria-label="Làm mới dữ liệu" title="Làm mới dữ liệu">
          <RefreshCw size={18} className={loading ? 'spin' : undefined} />
        </button>
        <div className="user-menu">
          <Avatar label={user.fullName ?? user.email} />
          <div><strong>{user.fullName ?? user.email}</strong><span>{roleLabel(primaryRole)}</span></div>
        </div>
      </div>
    </header>
  );
}
