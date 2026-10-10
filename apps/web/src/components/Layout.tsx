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
  LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useEmpresaStore, whatsappSuporteUrl } from '@/stores/empresaStore';
import { apiClient } from '@/lib/apiClient';
import { FormasPagamentoConfig } from '@/components/config/FormasPagamentoConfig';
import { EmpresaConfig } from '@/components/config/EmpresaConfig';

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
  { label: 'PDV', to: '/pdv', icon: ShoppingCart },
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

function NotificationBell() {
  const [open, setOpen] = React.useState(false);
  const [pendentes, setPendentes] = React.useState<Array<{ _ts?: number }>>([]);
  const boxRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem('visionbox-outbox');
        const data = raw ? JSON.parse(raw) : [];
        setPendentes(Array.isArray(data) ? data : []);
      } catch {
        setPendentes([]);
      }
    };
    read();
    const id = window.setInterval(read, 3000);
    window.addEventListener('storage', read);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('storage', read);
    };
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={boxRef}>
      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9"
        aria-label={open ? 'Fechar notificações' : 'Notificações'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-4 w-4" />
        {pendentes.length > 0 && (
          <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-danger)] px-1 text-[11px] font-bold leading-none text-[var(--color-text-on-danger)]">
            {pendentes.length}
          </span>
        )}
      </Button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-2 w-72 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 shadow-[var(--shadow-panel)]"
        >
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">Notificações</p>

          {pendentes.length > 0 ? (
            <>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                {pendentes.length} venda(s) aguardando sincronização com o servidor.
              </p>
              <ul className="mt-3 space-y-2">
                {pendentes.slice(-5).map((item, idx) => (
                  <li
                    key={`${item._ts ?? idx}`}
                    className="rounded-[var(--radius)] border border-[var(--color-warning-light)] bg-[var(--color-warning-light)] px-3 py-2 text-xs text-[var(--color-warning-dark)]"
                  >
                    Venda offline pendente
                    {item._ts ? ` • ${new Date(item._ts).toLocaleString('pt-BR')}` : ''}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-page)] px-3 py-4 text-center text-xs text-[var(--color-text-muted)]">
              Nenhuma notificação no momento.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Header({ theme, onToggleTheme }: { theme: 'light' | 'dark'; onToggleTheme: () => void }) {
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
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[var(--color-pdv-border-soft)] bg-[var(--color-pdv-surface)]/95 px-5 backdrop-blur">
      <div className="flex min-w-0 flex-1 items-center" />
      {title && (
        <h1 className="pointer-events-none absolute left-1/2 -translate-x-1/2 font-[var(--font-sans)] text-[20px] font-bold tracking-normal text-[var(--color-pdv-text)]">
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
          onClick={onToggleTheme}
          className="h-8 w-8"
          aria-label={`Alternar para tema ${theme === 'light' ? 'escuro' : 'claro'}`}
          title="Alternar tema"
        >
          {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </Button>

        <NotificationBell />

        <div className="relative ml-1 flex items-center">
          <Button 
            variant="ghost" 
            size="icon" 
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-primary)] p-0"
            onClick={() => {}}
          >
            <span className="text-sm font-semibold text-[var(--color-text-on-primary)]">
              {user?.nome?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </Button>
          
          <div className="absolute right-0 top-full z-30 mt-2 w-56 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-2 shadow-[var(--shadow-panel)] opacity-0 pointer-events-none transition-opacity group-hover:opacity-100">
             {/* The trigger is simplified here, but I will implement a proper UserDropdown component next */}
          </div>
        </div>
      </div>
    </header>
  );
}

function Sidebar({ collapsed, onToggle, onOpenConfig }: { collapsed: boolean; onToggle: () => void; onOpenConfig: () => void }) {
  const { user } = useAuthStore();
  const isAdmin = user?.perfil === 'ADMIN' || user?.perfil === 'DESENVOLVEDOR';
  const whatsappUrl = whatsappSuporteUrl(useEmpresaStore((s) => s.empresa?.whatsapp));

  const adminItems: NavItem[] = [
    ...(isAdmin ? [{ label: 'Usuários', to: '/usuarios', icon: Users }] : []),
    ...(user?.perfil === 'DESENVOLVEDOR' || user?.perfil === 'ADMIN'
      ? [{ label: 'Painel Dev', to: '/desenvolvedor', icon: Settings }]
      : []),
  ];

  return (
    <aside className={cn(
      'hidden min-h-screen shrink-0 flex-col bg-[radial-gradient(circle_at_50%_18%,rgb(var(--color-pdv-sidebar-active-rgb)/0.14)_0%,transparent_31%),linear-gradient(180deg,var(--color-pdv-sidebar-top)_0%,var(--color-pdv-sidebar-mid)_55%,var(--color-pdv-sidebar-bottom)_100%)] text-[var(--color-sidebar-text)] transition-[width] duration-200 md:flex',
      collapsed ? 'w-[72px]' : 'w-[220px]',
    )}>
      <div className={cn('relative px-3 py-3 text-center', collapsed && 'px-1.5 py-2.5')}>
        <button
          type="button"
          onClick={onToggle}
          className="group mx-auto flex items-center justify-center rounded-xl p-1 transition-all duration-200 hover:bg-white/10 active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/20 cursor-pointer"
          aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
          title={collapsed ? 'Clique no logo para expandir o menu' : 'Clique no logo para recolher o menu'}
        >
          <img
            src={collapsed ? '/assets/visionbox-logo-icon.png' : '/assets/visionbox-logo.png'}
            alt="VisionBox"
            className={cn(
              'vision-sidebar-logo transition-transform duration-200 group-hover:scale-105',
              collapsed ? 'w-[38px]' : 'w-[145px]',
            )}
          />
        </button>
      </div>
      <nav className={cn('flex-1 space-y-1', collapsed ? 'px-2' : 'px-3')} aria-label="Navegação principal">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'vision-sidebar-link flex h-[40px] items-center gap-3 rounded-[8px] text-[14px] font-medium transition-colors',
                collapsed ? 'justify-center px-0' : 'px-3',
                isActive
                  ? 'vision-sidebar-link-active bg-[rgb(var(--color-pdv-sidebar-active-rgb)/0.42)]'
                  : 'hover:bg-white/10',
              )
            }
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
            {!collapsed && <span className="flex-1">{item.label}</span>}
            {item.shortcut && !collapsed && (
              <span className="vision-sidebar-shortcut rounded-[6px] bg-[var(--color-bg-panel)] px-2 py-1 text-xs font-semibold">
                {item.shortcut}
              </span>
            )}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <hr className={cn('my-4 border-white/20', collapsed ? 'mx-1' : 'mx-2')} />
            {!collapsed && <h4 className="px-2 pb-1.5 text-xs font-semibold uppercase tracking-wider text-white/80">Administrativo</h4>}
            {adminItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'vision-sidebar-link flex h-[40px] items-center gap-3 rounded-[8px] text-[14px] font-medium transition-colors',
                    collapsed ? 'justify-center px-0' : 'px-3',
                    isActive
                      ? 'vision-sidebar-link-active bg-[rgb(var(--color-pdv-sidebar-active-rgb)/0.42)]'
                      : 'hover:bg-white/10',
                  )
                }
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
                {!collapsed && <span className="flex-1">{item.label}</span>}
              </NavLink>
            ))}
            <button
              type="button"
              onClick={onOpenConfig}
              className={cn(
                'vision-sidebar-link flex h-[40px] w-full items-center gap-3 rounded-[8px] text-[14px] font-medium transition-colors hover:bg-white/10',
                collapsed ? 'justify-center px-0' : 'px-3',
              )}
              title="Configurações"
              aria-label="Configurações"
            >
              <Settings className="h-5 w-5 shrink-0" strokeWidth={1.8} aria-hidden />
              {!collapsed && <span>Configurações</span>}
            </button>
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
              href={whatsappUrl}
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

function ConfiguracoesDialog({
  open,
  onClose,
  theme,
  onToggleTheme,
}: {
  open: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    apiClient
      .post('/v1/auth/logout', undefined, { headers: { 'X-Skip-Idempotency-Key': 'true' } })
      .finally(() => {
        logout();
        navigate('/login', { replace: true });
      });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Configurações"
      description="Preferências desta estação e dados da conta."
    >
      <div className="space-y-5">
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Aparência</h3>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (theme !== 'light') onToggleTheme();
              }}
              aria-pressed={theme === 'light'}
              className={`h-9 flex-1 rounded-[var(--radius)] border px-3 text-sm font-medium transition ${
                theme === 'light'
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-text-on-primary)]'
                  : 'border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-page)]'
              }`}
            >
              Tema claro
            </button>
            <button
              type="button"
              onClick={() => {
                if (theme !== 'dark') onToggleTheme();
              }}
              aria-pressed={theme === 'dark'}
              className={`h-9 flex-1 rounded-[var(--radius)] border px-3 text-sm font-medium transition ${
                theme === 'dark'
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-text-on-primary)]'
                  : 'border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-page)]'
              }`}
            >
              Tema escuro
            </button>
          </div>
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Conta</h3>
          <dl className="mt-2 divide-y divide-[var(--color-border)] rounded-[var(--radius)] border border-[var(--color-border)]">
            <div className="flex items-center justify-between gap-3 px-3 py-2">
              <dt className="text-xs text-[var(--color-text-secondary)]">Nome</dt>
              <dd className="text-sm font-medium text-[var(--color-text-primary)]">{user?.nome || '—'}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-3 py-2">
              <dt className="text-xs text-[var(--color-text-secondary)]">Perfil</dt>
              <dd className="text-sm font-medium text-[var(--color-text-primary)]">{user?.perfil || '—'}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-3 py-2">
              <dt className="text-xs text-[var(--color-text-secondary)]">Loja</dt>
              <dd className="truncate font-mono text-sm text-[var(--color-text-primary)]">{user?.lojaId || '—'}</dd>
            </div>
          </dl>
        </section>

        <FormasPagamentoConfig />

        {user?.perfil === 'ADMIN' || user?.perfil === 'DESENVOLVEDOR' ? <EmpresaConfig /> : null}

        <div className="flex items-center justify-between gap-2 border-t border-[var(--color-border)] pt-4">
          <span className="text-xs text-[var(--color-text-muted)]">VisionBox v0.1.0</span>
          <Button variant="destructive" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" /> Sair da conta
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export default function Layout() {
  const location = useLocation();
  const isPdv = location.pathname === '/pdv';
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(() => localStorage.getItem('visionbox-sidebar-collapsed') === 'true');
  const [configOpen, setConfigOpen] = React.useState(false);
  const { theme, toggle } = useTheme();
  const carregarEmpresa = useEmpresaStore((s) => s.carregar);

  React.useEffect(() => {
    localStorage.setItem('visionbox-sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  React.useEffect(() => {
    carregarEmpresa().catch(() => undefined);
  }, [carregarEmpresa]);

  return (
    <div className={cn('bg-[var(--color-pdv-page)] text-[var(--color-text-primary)]', isPdv ? 'h-screen overflow-hidden' : 'min-h-screen')}>
      <div className={cn('flex', isPdv ? 'h-screen overflow-hidden' : 'min-h-screen')}>
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((value) => !value)}
          onOpenConfig={() => setConfigOpen(true)}
        />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Header theme={theme} onToggleTheme={toggle} />
          <main className={cn('flex-1', isPdv ? 'pdv-main-shell' : 'p-4 sm:p-6')}>
            <Outlet />
          </main>
          <MobileNav />
          <footer className="flex h-9 items-center justify-between border-t border-[var(--color-pdv-border-soft)] bg-[var(--color-pdv-surface)] px-5 text-xs text-[var(--color-pdv-footer)]">
            <span>VisionBox • Um novo olhar em gestão.</span>
            <span>Desenvolvido por TechboxBR 2026</span>
          </footer>
        </div>
      </div>

      <ConfiguracoesDialog
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        theme={theme}
        onToggleTheme={toggle}
      />
    </div>
  );
}
