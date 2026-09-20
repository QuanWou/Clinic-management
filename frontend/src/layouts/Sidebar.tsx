import { appConfig } from '../config/app.config';
import { mainNavigation } from '../config/navigation.config';
import type { CurrentUser } from '../types/domain';
import type { AppView } from '../types/view';
import { canAccess, getPrimaryRole, normalizeRoles } from '../utils/roles';

type SidebarProps = {
  activeItemId: AppView;
  user: CurrentUser;
  onNavigate: (view: AppView) => void;
  onLogout: () => void;
};

export default function Sidebar({ activeItemId, user, onNavigate, onLogout }: SidebarProps) {
  const roles = normalizeRoles(user.roles);
  const role = getPrimaryRole(roles);
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">+</span>
        <div><h2>{appConfig.shortName}</h2><p>Medical dashboard</p></div>
      </div>
      <nav className="sidebar-nav" aria-label="Main navigation">
        {mainNavigation.filter((item) => canAccess(item.id, role ? [role] : [])).map((item) => (
          <button key={item.id} className={item.id === activeItemId ? 'active' : undefined}
            type="button" aria-current={item.id === activeItemId ? 'page' : undefined}
            onClick={() => onNavigate(item.id)}>
            <item.icon size={18} strokeWidth={2.2} />{item.label}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div><strong>{user.fullName ?? user.email}</strong><span>{role ?? 'USER'}</span></div>
        <button className="ghost-button" type="button" onClick={onLogout}>Logout</button>
      </div>
    </aside>
  );
}
