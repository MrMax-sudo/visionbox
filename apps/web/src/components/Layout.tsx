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
  Briefcase,
  Boxes,
  FileText,
  CreditCard,
  Coins,
  Receipt,
  FileSpreadsheet,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useEmpresaStore, whatsappSuporteUrl } from '@/stores/empresaStore';
import { useModulosStore } from '@/stores/modulosStore';
import { apiClient } from '@/lib/apiClient';
import { ConfiguracoesDialog } from '@/components/config/ConfiguracoesDialog';

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
  // Quando online sem pendências, não exibe badge redundante
  return null;
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
  const location = useLocation();
  const { user } = useAuthStore();
  const title = location.pathname === '/pdv' ? 'PDV - Frente de caixa' : '';

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
            title={user?.nome || 'Usuário'}
          >
            <span className="text-sm font-semibold text-[var(--color-text-on-primary)]">
              {user?.nome?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </Button>
        </div>
      </div>
    </header>
  );
}

interface SubmenuItem {
  label: string;
  to?: string;
  onClick?: () => void;
  icon: React.ElementType;
  modulo?: string;
  shortcut?: string;
}

function SidebarSubmenu({
  label,
  icon: Icon,
  items,
  collapsed,
  locationPathname,
}: {
  label: string;
  icon: React.ElementType;
  items: SubmenuItem[];
  collapsed: boolean;
  locationPathname: string;
}) {
  const isAnyActive = items.some((item) =>
    item.to ? (item.to === '/' ? locationPathname === '/' : locationPathname === item.to || locationPathname.startsWith(item.to + '/')) : false
  );
  const [open, setOpen] = React.useState(isAnyActive);

  React.useEffect(() => {
    if (isAnyActive) setOpen(true);
  }, [isAnyActive]);

  if (items.length === 0) return null;

  if (collapsed) {
    return (
      <div className="space-y-1">
        {items.map((item, idx) =>
          item.to ? (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'vision-sidebar-link flex h-[38px] items-center justify-center rounded-[8px] text-[13px] font-medium transition-colors',
                  isActive
                    ? 'bg-primary/15 text-primary font-semibold dark:bg-[rgb(var(--color-pdv-sidebar-active-rgb)/0.42)] dark:text-sidebar-text'
                    : 'text-foreground/80 hover:bg-primary/10 hover:text-primary dark:text-sidebar-text/85 dark:hover:bg-[rgb(var(--color-pdv-sidebar-active-rgb)/0.24)] dark:hover:text-sidebar-text',
                )
              }
              title={`${label}: ${item.label}`}
            >
              <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
            </NavLink>
          ) : (
            <button
              key={item.label || idx}
              type="button"
              onClick={item.onClick}
              className="vision-sidebar-link flex h-[38px] w-full items-center justify-center rounded-[8px] text-[13px] font-medium transition-colors text-foreground/80 hover:bg-primary/10 hover:text-primary dark:text-sidebar-text/85 dark:hover:bg-[rgb(var(--color-pdv-sidebar-active-rgb)/0.24)] dark:hover:text-sidebar-text cursor-pointer"
              title={`${label}: ${item.label}`}
            >
              <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
            </button>
          )
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'vision-sidebar-link flex h-[38px] w-full items-center gap-2.5 rounded-[8px] px-3 text-[13.5px] font-medium transition-colors cursor-pointer',
          isAnyActive
            ? 'bg-primary/10 text-primary font-semibold dark:bg-white/12 dark:text-white'
            : 'text-foreground/80 hover:bg-primary/10 hover:text-primary dark:text-sidebar-text/85 dark:hover:bg-[rgb(var(--color-pdv-sidebar-active-rgb)/0.24)] dark:hover:text-sidebar-text',
        )}
        aria-expanded={open}
      >
        <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 transition-transform duration-200 text-muted dark:text-white/70', open && 'rotate-180')}
          strokeWidth={2}
          aria-hidden
        />
      </button>

      {open && (
        <div className="ml-3.5 space-y-0.5 border-l border-border/60 dark:border-white/20 pl-2.5 py-0.5 animate-in fade-in-50 duration-150">
          {items.map((item, idx) =>
            item.to ? (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'vision-sidebar-link flex h-[34px] items-center gap-2.5 rounded-[6px] px-2.5 text-[13px] font-normal transition-colors',
                    isActive
                      ? 'bg-primary/15 text-primary font-semibold dark:bg-[rgb(var(--color-pdv-sidebar-active-rgb)/0.45)] dark:text-white'
                      : 'text-foreground/75 hover:bg-primary/10 hover:text-primary dark:text-sidebar-text/80 dark:hover:bg-white/10 dark:hover:text-white',
                  )
                }
              >
                <item.icon className="h-3.5 w-3.5 shrink-0 opacity-80" strokeWidth={1.8} aria-hidden />
                <span className="flex-1 truncate">{item.label}</span>
              </NavLink>
            ) : (
              <button
                key={item.label || idx}
                type="button"
                onClick={item.onClick}
                className="vision-sidebar-link flex h-[34px] w-full items-center gap-2.5 rounded-[6px] px-2.5 text-[13px] font-normal transition-colors text-foreground/75 hover:bg-primary/10 hover:text-primary dark:text-sidebar-text/80 dark:hover:bg-white/10 dark:hover:text-white cursor-pointer"
              >
                <item.icon className="h-3.5 w-3.5 shrink-0 opacity-80" strokeWidth={1.8} aria-hidden />
                <span className="flex-1 truncate text-left">{item.label}</span>
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

function Sidebar({ collapsed, onToggle, onOpenConfig }: { collapsed: boolean; onToggle: () => void; onOpenConfig: () => void }) {
  const location = useLocation();
  const { user } = useAuthStore();
  const temModulo = useModulosStore((s) => s.temModulo);
  const whatsappUrl = whatsappSuporteUrl(useEmpresaStore((s) => s.empresa?.whatsapp));

  const isAdmin = user?.perfil === 'ADMIN';
  const isDev = user?.perfil === 'DESENVOLVEDOR';
  const podeAdminOuDev = isAdmin || isDev;

  // Itens Operacionais
  const operacionalItems: SubmenuItem[] = [
    { label: 'Clientes', to: '/clientes', icon: Users },
    ...(temModulo('RECEITAS_CLINICAS') ? [{ label: 'Receitas', to: '/receitas', icon: Eye, modulo: 'RECEITAS_CLINICAS' }] : []),
    ...(temModulo('ORDEM_SERVICO') ? [{ label: 'OS', to: '/os', icon: ClipboardList, modulo: 'ORDEM_SERVICO' }] : []),
  ];

  // Itens Financeiros
  const financeiroItems: SubmenuItem[] = [
    ...(temModulo('CAIXA_TURNOS') ? [{ label: 'Caixas', to: '/caixas', icon: Coins, modulo: 'CAIXA_TURNOS' }] : []),
    ...(temModulo('CENTRAL_VENDAS') ? [{ label: 'Vendas', to: '/vendas', icon: Receipt, modulo: 'CENTRAL_VENDAS' }] : []),
    ...(temModulo('COMPRAS_XML') ? [{ label: 'Compras', to: '/compras', icon: FileSpreadsheet, modulo: 'COMPRAS_XML' }] : []),
    ...(temModulo('FINANCEIRO_COMPLETO')
      ? [
          { label: 'Maquininhas', to: '/maquininhas', icon: CreditCard, modulo: 'FINANCEIRO_COMPLETO' },
          { label: 'Comissões', to: '/comissoes', icon: Coins, modulo: 'FINANCEIRO_COMPLETO' },
        ]
      : []),
  ];

  // Itens Estoque
  const estoqueItems: SubmenuItem[] = [
    { label: 'Catálogo', to: '/catalogo', icon: Package },
  ];

  // Itens Administrativos (ADMIN e DESENVOLVEDOR)
  const adminItems: SubmenuItem[] = [
    ...(podeAdminOuDev ? [{ label: 'Usuários', to: '/usuarios', icon: Users }] : []),
    ...(podeAdminOuDev && temModulo('FISCAL_FLOWBOX') ? [{ label: 'Fiscal', to: '/fiscal', icon: FileText, modulo: 'FISCAL_FLOWBOX' }] : []),
    ...(isDev ? [{ label: 'Painel Dev', to: '/desenvolvedor', icon: Settings }] : []),
    { label: 'Configurações', onClick: onOpenConfig, icon: Settings },
  ];

  const exibePdv = temModulo('PDV_BALCAO');

  return (
    <aside className={cn(
      'hidden shrink-0 flex-col border-r border-border bg-card text-foreground transition-[width] duration-200 md:flex h-full min-h-screen',
      'dark:border-transparent dark:bg-[radial-gradient(circle_at_50%_18%,rgb(var(--color-pdv-sidebar-active-rgb)/0.14)_0%,transparent_31%),linear-gradient(180deg,var(--color-pdv-sidebar-top)_0%,var(--color-pdv-sidebar-mid)_55%,var(--color-pdv-sidebar-bottom)_100%)] dark:text-[var(--color-sidebar-text)]',
      collapsed ? 'w-[72px]' : 'w-[230px]',
    )}>
      <div className={cn('relative px-3 py-3.5 text-center', collapsed && 'px-1.5 py-2.5')}>
        <button
          type="button"
          onClick={onToggle}
          className="group mx-auto flex items-center justify-center rounded-xl p-1.5 transition-all duration-200 hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-white/20 cursor-pointer"
          aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
          title={collapsed ? 'Clique no logo para expandir o menu' : 'Clique no logo para recolher o menu'}
        >
          <img
            src={collapsed ? '/assets/visionbox-logo-icon.png' : '/assets/visionbox-logo.png'}
            alt="VisionBox"
            className={cn(
              'vision-sidebar-logo transition-transform duration-200 group-hover:scale-105',
              collapsed ? 'w-[44px]' : 'w-[175px]',
            )}
          />
        </button>
      </div>

      <nav
        className={cn('flex-1 space-y-1 overflow-y-auto px-3 py-1 scrollbar-none [&::-webkit-scrollbar]:hidden')}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        aria-label="Navegação principal"
      >
        {/* 1. Dashboard */}
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            cn(
              'vision-sidebar-link flex h-[38px] items-center gap-3 rounded-[8px] text-[13.5px] font-medium transition-colors',
              collapsed ? 'justify-center px-0' : 'px-3',
              isActive
                ? 'bg-primary/15 text-primary font-semibold dark:bg-[rgb(var(--color-pdv-sidebar-active-rgb)/0.42)] dark:text-sidebar-text'
                : 'text-foreground/80 hover:bg-primary/10 hover:text-primary dark:text-sidebar-text/85 dark:hover:bg-[rgb(var(--color-pdv-sidebar-active-rgb)/0.24)] dark:hover:text-sidebar-text',
            )
          }
          title={collapsed ? 'Dashboard' : undefined}
        >
          <LayoutGrid className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
          {!collapsed && <span className="flex-1">Dashboard</span>}
        </NavLink>

        {/* 2. PDV */}
        {exibePdv && (
          <NavLink
            to="/pdv"
            className={({ isActive }) =>
              cn(
                'vision-sidebar-link flex h-[38px] items-center gap-3 rounded-[8px] text-[13.5px] font-medium transition-colors',
                collapsed ? 'justify-center px-0' : 'px-3',
                isActive
                  ? 'bg-primary/15 text-primary font-semibold dark:bg-[rgb(var(--color-pdv-sidebar-active-rgb)/0.42)] dark:text-sidebar-text'
                  : 'text-foreground/80 hover:bg-primary/10 hover:text-primary dark:text-sidebar-text/85 dark:hover:bg-[rgb(var(--color-pdv-sidebar-active-rgb)/0.24)] dark:hover:text-sidebar-text',
              )
            }
            title={collapsed ? 'PDV' : undefined}
          >
            <ShoppingCart className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
            {!collapsed && <span className="flex-1">PDV</span>}
          </NavLink>
        )}

        {/* 3. Operacional (Receitas, OS, Clientes) */}
        <SidebarSubmenu
          label="Operacional"
          icon={Briefcase}
          items={operacionalItems}
          collapsed={collapsed}
          locationPathname={location.pathname}
        />

        {/* 4. Financeiro (Caixas, Vendas, Compras, Maquininhas, Comissões) */}
        <SidebarSubmenu
          label="Financeiro"
          icon={Wallet}
          items={financeiroItems}
          collapsed={collapsed}
          locationPathname={location.pathname}
        />

        {/* 5. Estoque (Catálogo) */}
        <SidebarSubmenu
          label="Estoque"
          icon={Boxes}
          items={estoqueItems}
          collapsed={collapsed}
          locationPathname={location.pathname}
        />

        {/* 6. Administrativo */}
        {podeAdminOuDev && (
          <SidebarSubmenu
            label="Administrativo"
            icon={ShieldCheck}
            items={adminItems}
            collapsed={collapsed}
            locationPathname={location.pathname}
          />
        )}
      </nav>

      <div className={cn('p-3', collapsed && 'px-2')}>
        <div className={cn(
          'rounded-[10px] p-3 transition-colors border border-border bg-page text-foreground dark:border-transparent dark:bg-white/14 dark:text-white',
          collapsed && 'p-2'
        )}>
          <div className={cn('flex items-center gap-2.5', collapsed && 'justify-center')}>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary dark:border-2 dark:border-[var(--color-bg-panel)] dark:bg-white/20 dark:text-white">
              <Headphones className="h-5 w-5" strokeWidth={1.8} />
            </span>
            {!collapsed && (
              <p className="flex-1 text-xs font-semibold leading-snug">
                Precisa de ajuda?<br />
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-primary dark:text-white/80 underline underline-offset-2 hover:opacity-80 text-[11px]"
                >
                  Suporte via WhatsApp
                </a>
              </p>
            )}
          </div>
        </div>
        {!collapsed && <p className="mt-3 px-1 text-xs text-muted dark:text-white/60">VisionBox v0.1.0</p>}
      </div>
    </aside>
  );
}

function MobileNav() {
  const mobileItems = [
    { label: 'Dashboard', to: '/', icon: LayoutGrid },
    { label: 'PDV', to: '/pdv', icon: ShoppingCart },
    { label: 'Clientes', to: '/clientes', icon: Users },
    { label: 'OS', to: '/os', icon: ClipboardList },
    { label: 'Catálogo', to: '/catalogo', icon: Package },
  ];

  return (
    <nav className="flex gap-1 overflow-x-auto border-t border-[var(--color-border)] bg-[var(--color-bg-card)] p-2 md:hidden" aria-label="Navegação mobile">
      {mobileItems.map((item) => (
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
  const [configOpen, setConfigOpen] = React.useState(false);
  const { theme, toggle } = useTheme();
  const carregarEmpresa = useEmpresaStore((s) => s.carregar);
  const carregarModulos = useModulosStore((s) => s.carregar);

  React.useEffect(() => {
    localStorage.setItem('visionbox-sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  React.useEffect(() => {
    carregarEmpresa().catch(() => undefined);
    carregarModulos().catch(() => undefined);
  }, [carregarEmpresa, carregarModulos]);

  return (
    <TooltipProvider>
      <div className={cn('bg-[var(--color-pdv-page)] text-[var(--color-text-primary)]', isPdv ? 'h-screen overflow-hidden' : 'min-h-screen')}>
        <div className={cn('flex', isPdv ? 'h-full overflow-hidden' : 'min-h-screen')}>
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed((value) => !value)}
            onOpenConfig={() => setConfigOpen(true)}
          />
          <div className={cn('flex min-w-0 flex-1 flex-col overflow-hidden', isPdv && 'h-full')}>
            <Header theme={theme} onToggleTheme={toggle} />
            <main className={cn('flex-1 min-h-0', isPdv ? 'pdv-main-shell' : 'overflow-y-auto p-4 sm:p-6')}>
              <Outlet />
            </main>
            <MobileNav />
            <footer className="shrink-0 flex h-9 items-center justify-between border-t border-[var(--color-pdv-border-soft)] bg-[var(--color-pdv-surface)] px-5 text-xs text-[var(--color-pdv-footer)]">
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
        <Toaster />
      </div>
    </TooltipProvider>
  );
}
