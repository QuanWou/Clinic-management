import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import type { CurrentUser } from '../types/domain';
import type { AppView } from '../types/view';

type AppShellProps = {
  activeItemId: AppView;
  children: ReactNode;
  loading: boolean;
  primaryRole: string;
  user: CurrentUser;
  onNavigate: (view: AppView) => void;
  onRefresh: () => void;
  onLogout: () => void;
};

export default function AppShell({
  activeItemId,
  children,
  loading,
  primaryRole,
  user,
  onNavigate,
  onRefresh,
  onLogout
}: AppShellProps) {
  return (
    <main className="app-shell">
      <Sidebar activeItemId={activeItemId} user={user} onNavigate={onNavigate} onLogout={onLogout} />
      <section className="content">
        <Topbar loading={loading} primaryRole={primaryRole} user={user} onRefresh={onRefresh} />
        {children}
      </section>
    </main>
  );
}
