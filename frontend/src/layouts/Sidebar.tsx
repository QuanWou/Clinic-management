import { appConfig } from '../config/app.config';
import { mainNavigation } from '../config/navigation.config';
import type { CurrentUser } from '../types/domain';
import type { AppView } from '../types/view';
import { canAccess, getPrimaryRole, normalizeRoles } from '../utils/roles';
import { ArrowRight, LogOut, X } from 'lucide-react';
import { roleLabel } from '../utils/locale';

type SidebarProps = {
  activeItemId: AppView;
  user: CurrentUser;
  onNavigate: (view: AppView) => void;
  onLogout: () => void;
  onClose?: () => void;
};

export default function Sidebar({ activeItemId, user, onNavigate, onLogout, onClose = () => undefined }: SidebarProps) {
  const roles = normalizeRoles(user.roles);
  const role = getPrimaryRole(roles);
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">+</span>
        <div><h2>{appConfig.shortName}</h2><p>Quản lý chăm sóc sức khỏe</p></div>
        <button className="icon-button sidebar-close" type="button" aria-label="Đóng menu" onClick={onClose}><X size={19} /></button>
      </div>
      <span className="nav-caption">KHÔNG GIAN LÀM VIỆC</span>
      <nav className="sidebar-nav" aria-label="Điều hướng chính">
        {mainNavigation.filter((item) => canAccess(item.id, role ? [role] : [])).map((item) => (
          <button key={item.id} className={item.id === activeItemId ? 'active' : undefined}
            type="button" aria-current={item.id === activeItemId ? 'page' : undefined}
            onClick={() => onNavigate(item.id)}>
            <item.icon size={18} strokeWidth={2.2} aria-hidden="true" />{item.label}
          </button>
        ))}
      </nav>
      <div className="sidebar-helper">
        <span>TRUY CẬP NHANH</span>
        <strong>Quản lý lịch hẹn</strong>
        <p>Xem lịch khám trong phạm vi tài khoản của bạn.</p>
        <button type="button" onClick={() => onNavigate('appointments')}>Xem lịch hẹn <ArrowRight size={16} aria-hidden="true" /></button>
      </div>
      <div className="sidebar-footer">
        <div><strong>{user.fullName ?? user.email}</strong><span>{roleLabel(role ?? 'USER')}</span></div>
        <button className="ghost-button logout-button" type="button" onClick={onLogout}><LogOut size={16} aria-hidden="true" /> Đăng xuất</button>
      </div>
    </aside>
  );
}
