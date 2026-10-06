import * as React from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Users,
  Eye,
  Package,
  ShoppingCart,
  ClipboardList,
  Wallet,
  Sun,
  Moon,
  Wifi,
  WifiOff,
  Bell,
  LayoutGrid,
  Headphones,
  Settings,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/apiClient';

type NavItem = {
  label: string;
  to: string;
  icon: React.ElementType;
  shortcut?: string;
};

const navItems: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: LayoutGrid },
  { label: 'Clientes', to: '/clientes', icon: Users },
  { label: 'Receitas', to: '/receitas', icon: Eye },
  { label: 'Catálogo', to: '/catalogo', icon: Package },
  { label: 'PDV', to: '/pdv', icon: ShoppingCart, shortcut: 'F8' },
  { label: 'OS', to: '/os', icon: ClipboardList },
  { label: 'Financeiro', to: '/financeiro', icon: Wallet },
];

function useTheme() {
  const [theme, setTheme] = React.useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('visionbox-theme') as 'light' | 'dark' | null;
    if (saved) return saved;
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  });

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('visionbox-theme', theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  return { theme, toggle };
}

function SyncIndicator() {
  const [online, setOnline] = React.useState<boolean>(navigator.onLine);
  const [pending, setPending] = React.useState<number>(0);

  React.useEffect(() => {
    const readPending = () => {
      try {
        const raw = localStorage.getItem('visionbox-outbox');
        const data = raw ? JSON.parse(raw) : [];
        setPending(Array.isArray(data) ? data.length : 0);
      } catch {
        setPending(0);
      }
    };
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    readPending();
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    window.addEventListener('storage', readPending);
    const id = window.setInterval(readPending, 3000);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      window.removeEventListener('storage', readPending);
      window.clearInterval(id);
    };
  }, []);

  if (!online) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-danger-light)] px-3 py-1.5 text-sm font-medium text-[var(--color-danger-dark)]">
        <WifiOff className="h-3.5 w-3.5" aria-hidden /> Offline • {pending} na fila
      </span>
    );
  }
  if (pending > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-warning-light)] px-3 py-1.5 text-sm font-medium text-[var(--color-warning-dark)]">
        <Wifi className="h-3.5 w-3.5" aria-hidden /> Sincronizando • {pending} pendentes
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-pdv-success-bg)] px-3 py-1.5 text-sm font-medium text-[var(--color-success-dark)]">
      <span className="h-2 w-2 rounded-full bg-[var(--color-pdv-success)]" /> Online
    </span>
  );
}

function Header() {
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const title = location.pathname === '/pdv' ? 'PDV - Frente de caixa' : '';

  const handleLogout = () => {
    apiClient.post('/v1/auth/logout', undefined, { headers: { 'X-Skip-Idempotency-Key': 'true' } })
      .finally(() => {
        logout();
        navigate('/login', { replace: true });
      });
  };

  return (
    <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-[var(--color-pdv-border-soft)] bg-[var(--color-pdv-surface)]/95 px-7 backdrop-blur">
      <div className="flex min-w-0 flex-1 items-center" />
      {title && (
        <h1 className="pointer-events-none absolute left-1/2 -translate-x-1/2 font-[var(--font-sans)] text-[28px] font-bold tracking-normal text-[var(--color-pdv-text)]">
          {title}
        </h1>
      )}

      <div className="flex items-center gap-2">
        <div className="hidden sm:block">
          <SyncIndicator />
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          className="h-9 w-9"
          aria-label={`Alternar para tema ${theme === 'light' ? 'escuro' : 'claro'}`}
          title="Alternar tema"
        >
          {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </Button>

        <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label="Notificações">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-danger)] px-1 text-[11px] font-bold leading-none text-white">
            3
          </span>
        </Button>

        <div className="ml-2 flex items-center gap-3 pl-4">
          <div className="hidden text-right leading-tight sm:block">
            <p className="text-base font-bold text-[var(--color-pdv-text)]">{user?.nome || 'Usuário'}</p>
            <p className="text-sm text-[var(--color-text-secondary)]">Loja {user?.lojaId?.slice(0, 8) || '—'}</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary)]">
            <span className="text-base font-semibold text-[var(--color-text-on-primary)]">
              {user?.nome?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} className="h-8 w-8" aria-label="Sair">
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { user } = useAuthStore();
  const isAdmin = user?.perfil === 'ADMIN';

  const adminItems: NavItem[] = isAdmin ? [
    { label: 'Usuários', to: '/usuarios', icon: Users },
  ] : [];

  return (
    <aside className={cn(
      'hidden min-h-screen shrink-0 flex-col bg-[radial-gradient(circle_at_50%_18%,rgb(var(--color-pdv-sidebar-active-rgb)/0.14)_0%,transparent_31%),linear-gradient(180deg,var(--color-pdv-sidebar-top)_0%,var(--color-pdv-sidebar-mid)_55%,var(--color-pdv-sidebar-bottom)_100%)] text-[var(--color-text-on-primary)] transition-[width] duration-200 md:flex',
      collapsed ? 'w-[84px]' : 'w-[252px]',
    )}>
      <div className={cn('relative px-4 pb-7 pt-4 text-center', collapsed && 'px-3 pb-5')}>
        <img src="/assets/visionbox-logo.png" alt="VisionBox" className={cn('mx-auto brightness-0 invert', collapsed ? 'w-[48px]' : 'w-[165px]')} />
        <button
          type="button"
          onClick={onToggle}
          className="vision-sidebar-collapse absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-[8px] bg-white/10 text-white hover:bg-white/16"
          aria-label={collapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
          title={collapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" strokeWidth={1.8} /> : <PanelLeftClose className="h-4 w-4" strokeWidth={1.8} />}
        </button>
      </div>
      <nav className={cn('flex-1 space-y-1.5', collapsed ? 'px-3' : 'px-4')} aria-label="Navegação principal">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'vision-sidebar-link flex h-[50px] items-center gap-4 rounded-[10px] text-[16px] font-medium transition-colors',
                collapsed ? 'justify-center px-0' : 'px-4',
                isActive
                  ? 'vision-sidebar-link-active bg-[rgb(var(--color-pdv-sidebar-active-rgb)/0.42)]'
                  : 'hover:bg-white/10',
              )
            }
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="h-5 w-5 shrink-0" strokeWidth={1.8} aria-hidden />
            {!collapsed && <span className="flex-1">{item.label}</span>}
            {item.shortcut && !collapsed && (
              <span className="vision-sidebar-shortcut rounded-[8px] bg-[var(--color-bg-panel)] px-2.5 py-1.5 text-sm font-semibold">
                {item.shortcut}
              </span>
            )}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <hr className={cn('my-6 border-white/20', collapsed ? 'mx-1' : 'mx-3')} />
            {!collapsed && <h4 className="px-3 pb-2 text-sm font-semibold uppercase tracking-normal text-white/88">Administrativo</h4>}
            {adminItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'vision-sidebar-link flex h-[50px] items-center gap-4 rounded-[10px] text-[16px] font-medium transition-colors',
                    collapsed ? 'justify-center px-0' : 'px-4',
                    isActive
                      ? 'vision-sidebar-link-active bg-[rgb(var(--color-pdv-sidebar-active-rgb)/0.42)]'
                      : 'hover:bg-white/10',
                  )
                }
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="h-5 w-5 shrink-0" strokeWidth={1.8} aria-hidden />
                {!collapsed && <span className="flex-1">{item.label}</span>}
              </NavLink>
            ))}
            <div className={cn('vision-sidebar-link flex h-[50px] items-center gap-4 rounded-[10px] text-[16px] font-medium', collapsed ? 'justify-center px-0' : 'px-4')} title={collapsed ? 'Configurações' : undefined}>
              <Settings className="h-5 w-5 shrink-0" strokeWidth={1.8} aria-hidden />
              {!collapsed && <span>Configurações</span>}
            </div>
          </>
        )}

      </nav>

      <div className={cn('p-4', collapsed && 'px-3')}>
        <div className={cn('rounded-[10px] bg-white/14 p-4 text-white', collapsed && 'p-3')}>
          <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
            <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[var(--color-bg-panel)] text-white">
              <Headphones className="h-6 w-6" strokeWidth={1.8} />
            </span>
            {!collapsed && <p className="flex-1 text-sm font-semibold leading-snug">
              Precisa de ajuda?<br />
            <a
              href="https://wa.me/5511984987382"
              target="_blank"
              rel="noreferrer"
              className="text-white/80 underline-offset-2 hover:text-white hover:underline"
            >
              Suporte via WhatsApp
            </a>
          </p>}
            {!collapsed && <ChevronDown className="h-4 w-4 -rotate-90 text-white/85" strokeWidth={1.8} />}
          </div>
        </div>
        {!collapsed && <p className="mt-10 px-1 text-sm text-white/68">VisionBox v0.1.0</p>}
      </div>
    </aside>
  );
}

function MobileNav() {
  return (
    <nav className="flex gap-1 overflow-x-auto border-t border-[var(--color-border)] bg-[var(--color-bg-card)] p-2 md:hidden" aria-label="Navegação mobile">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium',
              isActive
                ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)]'
                : 'bg-[var(--color-bg-page)] text-[var(--color-text-secondary)]',
            )
          }
        >
          <item.icon className="h-3.5 w-3.5" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function Layout() {
  const location = useLocation();
  const isPdv = location.pathname === '/pdv';
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(() => localStorage.getItem('visionbox-sidebar-collapsed') === 'true');

  React.useEffect(() => {
    localStorage.setItem('visionbox-sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  return (
    <div className={cn('bg-[var(--color-pdv-page)] text-[var(--color-text-primary)]', isPdv ? 'h-screen overflow-hidden' : 'min-h-screen')}>
      <div className={cn('flex', isPdv ? 'h-screen overflow-hidden' : 'min-h-screen')}>
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((value) => !value)} />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Header />
          <main className={cn('flex-1', isPdv ? 'pdv-main-shell' : 'p-4 sm:p-6')}>
            <Outlet />
          </main>
          <MobileNav />
          <footer className="flex h-[55px] items-center justify-between border-t border-[var(--color-pdv-border-soft)] bg-[var(--color-pdv-surface)] px-7 text-sm text-[var(--color-pdv-footer)]">
            <span>VisionBox • Um novo olhar em gestão.</span>
            <span>Desenvolvido por TechboxBR 2026</span>
          </footer>
        </div>
      </div>
    </div>
  );
}
