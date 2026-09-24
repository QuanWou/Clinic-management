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
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(max-width: 900px)').matches);
  const mainContent = useRef<HTMLDivElement>(null);
  const lastView = useRef(activeItemId);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mediaQuery = window.matchMedia('(max-width: 900px)');
    const update = () => setIsMobile(mediaQuery.matches);
    update();
    mediaQuery.addEventListener?.('change', update);
    return () => mediaQuery.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    if (activeItemId !== lastView.current) {
      lastView.current = activeItemId;
      mainContent.current?.focus();
    }
  }, [activeItemId]);

  useEffect(() => {
    if (!menuOpen) return;
    function dismiss(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.mobile-menu-button')?.focus());
      }
    }
    document.addEventListener('keydown', dismiss);
    return () => document.removeEventListener('keydown', dismiss);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen || !isMobile) return;
    const navigation = document.getElementById('app-navigation');
    if (!navigation) return;
    const getFocusable = () => Array.from(navigation.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((element) => element.offsetParent !== null);
    requestAnimationFrame(() => getFocusable()[0]?.focus());
    function cycleFocus(event: KeyboardEvent) {
      if (event.key !== 'Tab') return;
      const focusable = getFocusable();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', cycleFocus);
    return () => document.removeEventListener('keydown', cycleFocus);
  }, [isMobile, menuOpen]);

  function closeMenuWithFocus() {
    setMenuOpen(false);
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.mobile-menu-button')?.focus());
  }

  function navigate(view: AppView) {
    onNavigate(view);
    setMenuOpen(false);
    if (isMobile && menuOpen && view === activeItemId) {
      requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.mobile-menu-button')?.focus());
    }
  }

  return (
    <main className="app-shell">
      <a className="skip-link" href="#main-content">Bỏ qua điều hướng, đến nội dung chính</a>
      {menuOpen && <button className="sidebar-backdrop" type="button" aria-label="Đóng điều hướng" onClick={closeMenuWithFocus} />}
      <div className={`sidebar-container ${menuOpen ? 'is-open' : ''}`} id="app-navigation"
        aria-hidden={isMobile && !menuOpen ? true : undefined} inert={isMobile && !menuOpen ? true : undefined}>
        <Sidebar activeItemId={activeItemId} user={user} onNavigate={navigate} onLogout={onLogout} onClose={closeMenuWithFocus} />
      </div>
      <section className="content" inert={isMobile && menuOpen ? true : undefined}>
        <Topbar activeView={activeItemId} loading={loading} primaryRole={primaryRole} user={user} onRefresh={onRefresh}
          menuButton={<button className="icon-button mobile-menu-button" type="button" aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'} aria-expanded={menuOpen} aria-controls="app-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>} />
        <div className="page-content" id="main-content" ref={mainContent} tabIndex={-1}>{children}</div>
      </section>
    </main>
  );
}
