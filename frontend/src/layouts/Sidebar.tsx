import { appConfig } from '../config/app.config';
import { mainNavigation } from '../config/navigation.config';
import type { CurrentUser } from '../types/domain';
import type { AppView } from '../types/view';
import { normalizeRoles } from '../utils/roles';

type SidebarProps = {
  activeItemId: AppView;
  user: CurrentUser;
  onNavigate: (view: AppView) => void;
  onLogout: () => void;
};

export default function Sidebar({ activeItemId, user, onNavigate, onLogout }: SidebarProps) {
  const roles = normalizeRoles(user.roles);
  const role = roles[0] ?? 'USER';
  const visibleNavigation = mainNavigation.filter(
    (item) => !item.roles || item.roles.some((allowedRole) => roles.includes(allowedRole))
  );

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">+</span>
        <div>
          <h2>{appConfig.shortName}</h2>
          <p>Medical dashboard</p>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {visibleNavigation.map((item) => (
          <button
            key={item.id}
            className={item.id === activeItemId ? 'active' : undefined}
            type="button"
            onClick={() => onNavigate(item.id)}
          >
            <item.icon size={18} strokeWidth={2.2} />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="upgrade-card">
        <span>PRO</span>
        <strong>Upgrade to Pro</strong>
        <p>Unlock reports, patient analytics, and advanced scheduling.</p>
        <button type="button">Upgrade Now</button>
      </div>

      <div className="sidebar-footer">
        <div>
          <strong>{user.fullName ?? user.email}</strong>
          <span>{role.replace('ROLE_', '')}</span>
        </div>
        <button className="ghost-button" type="button" onClick={onLogout}>Logout</button>
      </div>
    </aside>
  );
}
