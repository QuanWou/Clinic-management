import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Menu, X } from 'lucide-react';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const mainContent = useRef<HTMLDivElement>(null);
  const lastView = useRef(activeItemId);

  useEffect(() => {
    if (activeItemId !== lastView.current) {
      lastView.current = activeItemId;
      mainContent.current?.focus();
    }
  }, [activeItemId]);

  useEffect(() => {
    if (!menuOpen) return;
    function dismiss(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('keydown', dismiss);
    return () => document.removeEventListener('keydown', dismiss);
  }, [menuOpen]);

  function navigate(view: AppView) {
    onNavigate(view);
    setMenuOpen(false);
  }

  return (
    <main className="app-shell">
      <a className="skip-link" href="#main-content">Bỏ qua điều hướng, đến nội dung chính</a>
      {menuOpen && <button className="sidebar-backdrop" type="button" aria-label="Đóng điều hướng" onClick={() => setMenuOpen(false)} />}
      <div className={`sidebar-container ${menuOpen ? 'is-open' : ''}`} id="app-navigation">
        <Sidebar activeItemId={activeItemId} user={user} onNavigate={navigate} onLogout={onLogout} onClose={() => setMenuOpen(false)} />
      </div>
      <section className="content">
        <Topbar activeView={activeItemId} loading={loading} primaryRole={primaryRole} user={user} onRefresh={onRefresh}
          menuButton={<button className="icon-button mobile-menu-button" type="button" aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'} aria-expanded={menuOpen} aria-controls="app-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>} />
        <div className="page-content" id="main-content" ref={mainContent} tabIndex={-1}>{children}</div>
      </section>
    </main>
  );
}
