import type { ReactNode } from 'react';
import type { CurrentUser } from '../types/domain';
import type { AppView } from '../types/view';
import { mainNavigation } from '../config/navigation.config';
import Avatar from '../components/Avatar';
import { RefreshCw } from 'lucide-react';
import { roleLabel } from '../utils/locale';
import { patientNavigationLabels } from './Sidebar';

type TopbarProps = {
  loading: boolean;
  primaryRole: string;
  user: CurrentUser;
  onRefresh: () => void;
  activeView: AppView;
  menuButton: ReactNode;
};

export default function Topbar({ activeView, loading, primaryRole, user, onRefresh, menuButton }: TopbarProps) {
  const page = primaryRole === 'PATIENT' ? patientNavigationLabels[activeView] ?? 'Tổng quan của tôi'
    : mainNavigation.find((item) => item.id === activeView)?.label ?? 'Tổng quan';
  return (
    <header className="topbar" aria-label="Thanh công cụ phòng khám">
      <div className="topbar-location">{menuButton}<div><span className="breadcrumb">{primaryRole === 'PATIENT' ? 'Clinic / Bệnh nhân' : 'Clinic / Không gian làm việc'}</span><strong>{page}</strong></div></div>
      <div className="topbar-actions">
        <button className="icon-button" type="button" onClick={onRefresh} disabled={loading} aria-label="Làm mới dữ liệu" title="Làm mới dữ liệu">
          <RefreshCw size={18} className={loading ? 'spin' : undefined} />
        </button>
        <div className="user-menu" aria-label="Tài khoản hiện tại">
          <Avatar label={user.fullName ?? user.email} />
          <div className="user-menu-details"><strong title={user.fullName ?? user.email}>{user.fullName ?? user.email}</strong><span>{roleLabel(primaryRole)}</span></div>
        </div>
      </div>
    </header>
  );
}
