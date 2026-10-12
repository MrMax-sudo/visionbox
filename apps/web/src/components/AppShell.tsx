import * as React from 'react';
import {
  NavLink,
  useLocation,
  useNavigate,
  useOutlet,
} from 'react-router-dom';
import {
  Bell,
  ClipboardList,
  Eye,
  Headphones,
  LayoutGrid,
  LogOut,
  Menu,
  Moon,
  Package,
  Settings,
  ShoppingCart,
  Sun,
  Users,
  Wallet,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ConfiguracoesDialog } from '@/components/config/ConfiguracoesDialog';
import { useOnline } from '@/hooks/useOnline';
import { apiClient } from '@/lib/apiClient';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useEmpresaStore, whatsappSuporteUrl } from '@/stores/empresaStore';

/* -------------------------------------------------------------------------
   Tipos / dados de navegação
   ------------------------------------------------------------------------- */

type NavItem = {
  label: string;
  to: string;
  icon: React.ElementType;
  end?: boolean;
  /** chip de atalho de teclado (ex.: F8 no PDV) */
  shortcut?: string;
};

const mainNav: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: LayoutGrid, end: true },
  { label: 'PDV', to: '/pdv', icon: ShoppingCart, shortcut: 'F8' },
  { label: 'Clientes', to: '/clientes', icon: Users },
  { label: 'Receitas', to: '/receitas', icon: Eye },
  { label: 'Catálogo', to: '/catalogo', icon: Package },
  { label: 'OS', to: '/os', icon: ClipboardList },
  { label: 'Financeiro', to: '/financeiro', icon: Wallet },
];

const routeTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/pdv': 'PDV — Frente de caixa',
  '/clientes': 'Clientes',
  '/receitas': 'Receitas',
  '/catalogo': 'Catálogo',
  '/os': 'Ordens de Serviço',
  '/financeiro': 'Financeiro',
  '/usuarios': 'Usuários',
  '/desenvolvedor': 'Painel do Desenvolvedor',
};

function titleForPath(pathname: string): string {
  if (routeTitles[pathname]) return routeTitles[pathname];
  const prefix = Object.keys(routeTitles)
    .filter((route) => route !== '/' && pathname.startsWith(`${route}/`))
    .sort((a, b) => b.length - a.length)[0];
  return prefix ? routeTitles[prefix] : 'VisionBox';
}

const THEME_KEY = 'visionbox-theme';
const SIDEBAR_KEY = 'visionbox-sidebar-collapsed';

/* -------------------------------------------------------------------------
   Tema claro/escuro — grava data-theme no <html> (mesma chave do Layout)
   ------------------------------------------------------------------------- */

function useTheme() {
  const [theme, setTheme] = React.useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem(THEME_KEY) as 'light' | 'dark' | null;
    if (saved) return saved;
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  });

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggle = React.useCallback(
    () => setTheme((t) => (t === 'light' ? 'dark' : 'light')),
    [],
  );

  return { theme, toggle };
}

/* -------------------------------------------------------------------------
   Indicador de sync / offline (outbox local do PDV)
   ------------------------------------------------------------------------- */

function useOutboxPending(): number {
  const [pending, setPending] = React.useState(0);

  React.useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem('visionbox-outbox');
        const data = raw ? JSON.parse(raw) : [];
        setPending(Array.isArray(data) ? data.length : 0);
      } catch {
        setPending(0);
      }
    };
    read();
    window.addEventListener('storage', read);
    const id = window.setInterval(read, 3000);
    return () => {
      window.removeEventListener('storage', read);
      window.clearInterval(id);
    };
  }, []);

  return pending;
}

export function SyncIndicator({ className }: { className?: string }) {
  const online = useOnline();
  const pending = useOutboxPending();

  if (!online) {
    return (
      <span
        role="status"
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full bg-danger-light px-3 py-1.5 text-xs font-medium text-danger-dark',
          className,
        )}
      >
        <WifiOff className="h-3.5 w-3.5" aria-hidden /> Offline • {pending} na fila
      </span>
    );
  }

  if (pending > 0) {
    return (
      <span
        role="status"
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full bg-warning-light px-3 py-1.5 text-xs font-medium text-warning-dark',
          className,
        )}
      >
        <Wifi className="h-3.5 w-3.5" aria-hidden /> Sincronizando • {pending} pendentes
      </span>
    );
  }

  return (
    <span
      role="status"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-success-light px-3 py-1.5 text-xs font-medium text-success-dark',
        className,
      )}
    >
      <span className="h-2 w-2 rounded-full bg-success" aria-hidden /> Online
    </span>
  );
}

/* -------------------------------------------------------------------------
   Sino de notificações (pendências do outbox)
   ------------------------------------------------------------------------- */

function NotificationBell() {
  const [open, setOpen] = React.useState(false);
  const pending = useOutboxPending();
  const boxRef = React.useRef<HTMLDivElement>(null);

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

  const itens = React.useMemo(() => {
    try {
      const raw = localStorage.getItem('visionbox-outbox');
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }, [open, pending]);

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
        <Bell className="h-4 w-4" aria-hidden />
        {pending > 0 && (
          <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold leading-none text-danger-foreground">
            {pending}
          </span>
        )}
      </Button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-sidebar mt-2 w-72 rounded-card border border-border bg-card p-4 shadow-panel"
        >
          <p className="text-sm font-semibold text-primary">Notificações</p>
          {pending > 0 ? (
            <>
              <p className="mt-1 text-xs text-secondary">
                {pending} venda(s) aguardando sincronização com o servidor.
              </p>
              <ul className="mt-3 space-y-2">
                {itens.slice(-5).map((item: { _ts?: number }, idx: number) => (
                  <li
                    key={`${item._ts ?? idx}`}
                    className="rounded border border-warning-light bg-warning-light px-3 py-2 text-xs text-warning-dark"
                  >
                    Venda offline pendente
                    {item._ts ? ` • ${new Date(item._ts).toLocaleString('pt-BR')}` : ''}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-3 rounded border border-border bg-page px-3 py-4 text-center text-xs text-muted">
              Nenhuma notificação no momento.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------
   Sidebar
   ------------------------------------------------------------------------- */

function SidebarNavLink({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'flex h-10 items-center gap-3 rounded text-sm font-medium transition-colors',
          collapsed ? 'justify-center px-0' : 'px-3',
          isActive
            ? 'bg-primary/15 text-primary font-semibold dark:bg-[rgb(var(--color-pdv-sidebar-active-rgb)/0.42)] dark:text-sidebar-text'
            : 'text-foreground/80 hover:bg-primary/10 hover:text-primary dark:text-sidebar-text/85 dark:hover:bg-[rgb(var(--color-pdv-sidebar-active-rgb)/0.24)] dark:hover:text-sidebar-text',
        )
      }
    >
      <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      {item.shortcut && !collapsed && (
        <span className="rounded-[6px] bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary dark:bg-[rgb(var(--color-pdv-sidebar-active-rgb)/0.42)] dark:text-sidebar-text">
          {item.shortcut}
        </span>
      )}
    </NavLink>
  );
}

function SidebarContent({
  collapsed,
  onToggleCollapse,
  onNavigate,
  onOpenConfig,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onNavigate?: () => void;
  onOpenConfig: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const isDev = user?.perfil === 'DESENVOLVEDOR';
  const isAdmin = user?.perfil === 'ADMIN' || isDev;
  const whatsappUrl = whatsappSuporteUrl(useEmpresaStore((s) => s.empresa?.whatsapp));

  const adminNav: NavItem[] = [
    { label: 'Usuários', to: '/usuarios', icon: Users },
    ...(isDev ? [{ label: 'Painel Dev', to: '/desenvolvedor', icon: Settings }] : []),
  ];

  return (
    <>
      {/* Marca / colapso */}
      <div className={cn('px-3 py-3 text-center', collapsed && 'px-1.5 py-2.5')}>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="group mx-auto flex items-center justify-center rounded-xl p-1 transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          <img
            src={collapsed ? '/assets/visionbox-logo-icon.png' : '/assets/visionbox-logo.png'}
            alt="VisionBox"
            className={cn(
              'transition-all duration-200',
              collapsed ? 'h-9 w-9 object-contain' : 'h-9 w-auto max-w-[150px] object-contain',
            )}
          />
        </button>
      </div>

      <nav
        className={cn('flex-1 space-y-1 overflow-y-auto', collapsed ? 'px-2' : 'px-3')}
        aria-label="Navegação principal"
      >
        {mainNav.map((item) => (
          <SidebarNavLink
            key={item.to}
            item={item}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ))}

        {isAdmin && (
          <>
            <hr
              className={cn('my-4 border-border dark:border-[rgb(var(--color-pdv-sidebar-active-rgb)/0.35)]', collapsed && 'mx-1')}
            />
            {!collapsed && (
              <h4 className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted dark:text-sidebar-text/80">
                Administrativo
              </h4>
            )}
            {adminNav.map((item) => (
              <SidebarNavLink
                key={item.to}
                item={item}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </>
        )}

        <button
          type="button"
          onClick={onOpenConfig}
          title="Configurações"
          aria-label="Configurações"
          className={cn(
            'flex h-10 w-full items-center gap-3 rounded text-sm font-medium transition-colors',
            'text-foreground/80 hover:bg-primary/10 hover:text-primary dark:text-sidebar-text/85 dark:hover:bg-[rgb(var(--color-pdv-sidebar-active-rgb)/0.24)] dark:hover:text-sidebar-text',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            collapsed ? 'justify-center px-0' : 'px-3',
          )}
        >
          <Settings className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
          {!collapsed && <span>Configurações</span>}
        </button>
      </nav>

      {/* Rodapé: suporte WhatsApp + sync/offline */}
      <div className={cn('space-y-3 p-3', collapsed && 'px-2')}>
        <div
          className={cn(
            'rounded-card bg-page border border-border dark:border-transparent dark:bg-[rgb(var(--color-pdv-sidebar-active-rgb)/0.24)] p-3',
            collapsed && 'flex justify-center p-2',
          )}
        >
          {collapsed ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              title="Suporte via WhatsApp"
              aria-label="Suporte via WhatsApp"
              className="text-primary dark:text-sidebar-text hover:opacity-80"
            >
              <Headphones className="h-5 w-5" strokeWidth={1.8} aria-hidden />
            </a>
          ) : (
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 dark:bg-[rgb(var(--color-pdv-sidebar-active-rgb)/0.42)] text-primary dark:text-sidebar-text">
                <Headphones className="h-5 w-5" strokeWidth={1.8} aria-hidden />
              </span>
              <p className="min-w-0 text-xs leading-snug text-foreground dark:text-sidebar-text">
                Precisa de ajuda?{' '}
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-primary dark:text-sidebar-text underline underline-offset-2 hover:opacity-80"
                >
                  Suporte via WhatsApp
                </a>
              </p>
            </div>
          )}
        </div>

        <SyncIndicator className="w-full justify-center" />

        {!collapsed && (
          <p className="px-1 text-[11px] text-muted dark:text-sidebar-text/70">
            VisionBox v0.1.0 • TechboxBR 2026
          </p>
        )}
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------
   AppShell
   ------------------------------------------------------------------------- */

export interface AppShellProps {
  /** Título da topbar; quando ausente, é derivado da rota atual. */
  title?: string;
  /** Slots de ação à direita da topbar (botões, filtros, etc.). */
  actions?: React.ReactNode;
  /** Classe extra da área de conteúdo (padding, bg…). */
  contentClassName?: string;
  /**
   * Conteúdo da área central. Por padrão renderiza o <Outlet/> da rota.
   * Passe `children` para sobrescrever (útil em testes/histórias).
   */
  children?: React.ReactNode;
}

/**
 * AppShell — layout de aplicação VisionBox (ONDA 1).
 *
 * • Grid CSS com altura 100dvh, overflow hidden; conteúdo com overflow-y auto.
 * • Nenhum `position: fixed` na estrutura, nenhum zoom, nenhum `!important`.
 * • Sidebar colapsável persistida em localStorage; abaixo de 1024px vira overlay.
 * • Tema claro/escuro via `data-theme` no <html> (mesma chave do Layout legado).
 * • Indicador de sync/offline + sino de pendências do outbox (PDV offline-first).
 */
export function AppShell({ title, actions, contentClassName, children }: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const outlet = useOutlet();
  const { theme, toggle: toggleTheme } = useTheme();
  const { user, logout } = useAuthStore();
  const carregarEmpresa = useEmpresaStore((s) => s.carregar);

  const [collapsed, setCollapsed] = React.useState(
    () => localStorage.getItem(SIDEBAR_KEY) === 'true',
  );
  const [isDesktop, setIsDesktop] = React.useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  );
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [configOpen, setConfigOpen] = React.useState(false);

  React.useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, String(collapsed));
  }, [collapsed]);

  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => {
      setIsDesktop(mq.matches);
      if (mq.matches) setMobileOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  React.useEffect(() => {
    carregarEmpresa().catch(() => undefined);
  }, [carregarEmpresa]);

  React.useEffect(() => {
    // fecha o overlay ao trocar de rota
    setMobileOpen(false);
  }, [location.pathname]);

  React.useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  const handleLogout = () => {
    apiClient
      .post('/v1/auth/logout', undefined, { headers: { 'X-Skip-Idempotency-Key': 'true' } })
      .finally(() => {
        logout();
        navigate('/login', { replace: true });
      });
  };

  const effectiveTitle = title ?? titleForPath(location.pathname);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="relative grid h-dvh w-full grid-rows-[100%] grid-cols-[minmax(0,1fr)] overflow-hidden bg-page text-primary lg:grid-cols-[auto_minmax(0,1fr)]">
        {/* Overlay de fundo (mobile) */}
        {!isDesktop && mobileOpen && (
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 z-backdrop bg-scrim backdrop-blur-[1px]"
          />
        )}

        {/* Sidebar */}
        <aside
          className={cn(
            'absolute inset-y-0 left-0 z-sidebar flex w-[264px] flex-col overflow-hidden border-r border-border',
            'bg-card dark:bg-[linear-gradient(180deg,var(--color-pdv-sidebar-top)_0%,var(--color-pdv-sidebar-mid)_55%,var(--color-pdv-sidebar-bottom)_100%)]',
            'transition-[transform,visibility,width] duration-200 ease-out',
            'lg:static lg:z-auto lg:translate-x-0 lg:opacity-100',
            mobileOpen
              ? 'max-lg:visible max-lg:translate-x-0 max-lg:opacity-100'
              : 'max-lg:invisible max-lg:-translate-x-full max-lg:opacity-0',
            isDesktop && (collapsed ? 'lg:w-[72px]' : 'lg:w-[236px]'),
          )}
        >
          {!isDesktop && (
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Fechar menu"
              className="absolute right-2 top-2 z-10 rounded p-1.5 text-sidebar-text hover:bg-[rgb(var(--color-pdv-sidebar-active-rgb)/0.24)] hover:text-sidebar-text lg:hidden"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}

          <SidebarContent
            collapsed={!isDesktop ? false : collapsed}
            onToggleCollapse={() => setCollapsed((v) => !v)}
            onNavigate={() => setMobileOpen(false)}
            onOpenConfig={() => setConfigOpen(true)}
          />
        </aside>

        {/* Coluna principal */}
        <div className="col-start-1 row-start-1 flex min-w-0 flex-col overflow-hidden lg:col-start-2">
          {/* Topbar */}
          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-3 sm:px-5">
            {!isDesktop && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                aria-label="Abrir menu de navegação"
                onClick={() => setMobileOpen(true)}
              >
                <Menu className="h-5 w-5" aria-hidden />
              </Button>
            )}

            <h1 className="min-w-0 truncate font-display text-lg font-bold text-primary sm:text-xl">
              {effectiveTitle}
            </h1>

            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
              {actions}

              <SyncIndicator className="hidden md:inline-flex" />

              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={toggleTheme}
                aria-label={`Alternar para tema ${theme === 'light' ? 'escuro' : 'claro'}`}
                title="Alternar tema"
              >
                {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </Button>

              <NotificationBell />

              <div className="mx-1 hidden h-6 w-px bg-border sm:block" />

              {/* Operador logado */}
              <div className="hidden items-center gap-2 sm:flex">
                <span
                  aria-hidden
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
                >
                  {user?.nome?.charAt(0)?.toUpperCase() || 'U'}
                </span>
                <span className="leading-tight">
                  <span className="block max-w-[140px] truncate text-xs font-semibold text-primary">
                    {user?.nome || 'Operador'}
                  </span>
                  <span className="block text-[11px] text-muted">
                    {user?.perfil || '—'}
                  </span>
                </span>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-danger hover:bg-danger-light"
                onClick={handleLogout}
                aria-label="Sair da conta"
                title="Sair da conta"
              >
                <LogOut className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </header>

          {/* Conteúdo */}
          <main
            className={cn('min-h-0 flex-1 overflow-y-auto p-4 sm:p-6', contentClassName)}
          >
            {children ?? outlet}
          </main>
        </div>

        {/* Toasts + configurações */}
        <Toaster />
        <ConfiguracoesDialog
          open={configOpen}
          onClose={() => setConfigOpen(false)}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      </div>
    </TooltipProvider>
  );
}

export default AppShell;
