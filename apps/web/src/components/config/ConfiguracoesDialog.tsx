import * as React from 'react';
import { Building2, CreditCard, LogOut, Moon, Sun, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { EmpresaConfig } from '@/components/config/EmpresaConfig';
import { FormasPagamentoConfig } from '@/components/config/FormasPagamentoConfig';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiClient } from '@/lib/apiClient';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';

const THEME_KEY = 'visionbox-theme';
type Tema = 'light' | 'dark';

function lerTema(): Tema {
  const saved = localStorage.getItem(THEME_KEY) as Tema | null;
  if (saved === 'light' || saved === 'dark') return saved;
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function TemaButton({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        'flex h-10 flex-1 items-center justify-center gap-2 rounded border px-3 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        ativo
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-primary hover:bg-page',
      )}
    >
      {children}
    </button>
  );
}

/**
 * ConfiguracoesDialog — ONDA 2D.
 *
 * Diálogo único de configurações da estação: Preferências (tema claro/escuro +
 * conta), Formas de pagamento e Empresa. Substitui o diálogo enxuto que o
 * AppShell renderizava internamente (Aparência + Conta).
 *
 * Plugue no AppShell trocando o `SettingsDialog` interno por:
 *   <ConfiguracoesDialog
 *     open={configOpen}
 *     onClose={() => setConfigOpen(false)}
 *     theme={theme}
 *     onToggleTheme={toggleTheme}
 *   />
 * (`theme`/`onToggleTheme` são opcionais: sem eles o dialog aplica o tema sozinho.)
 */
export function ConfiguracoesDialog({
  open,
  onClose,
  theme,
  onToggleTheme,
}: {
  open: boolean;
  onClose: () => void;
  theme?: Tema;
  onToggleTheme?: () => void;
}) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [temaInterno, setTemaInterno] = React.useState<Tema>(lerTema);

  const isAdmin = user?.perfil === 'ADMIN' || user?.perfil === 'DESENVOLVEDOR';
  const temaAtual = theme ?? temaInterno;

  const escolherTema = (t: Tema) => {
    if (t === temaAtual) return;
    if (theme !== undefined && onToggleTheme) {
      onToggleTheme();
      return;
    }
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem(THEME_KEY, t);
    setTemaInterno(t);
  };

  const sair = () => {
    apiClient
      .post('/v1/auth/logout', undefined, { headers: { 'X-Skip-Idempotency-Key': 'true' } })
      .finally(() => {
        logout();
        navigate('/login', { replace: true });
        onClose();
      });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Configurações"
      description="Preferências desta estação, formas de pagamento e dados da empresa."
      className="max-w-[860px]"
    >
      <Tabs defaultValue="preferencias" className="mt-1">
        <TabsList className="flex-wrap">
          <TabsTrigger value="preferencias">
            <Sun className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Preferências
          </TabsTrigger>
          <TabsTrigger value="formas">
            <CreditCard className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Formas de pagamento
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="empresa">
              <Building2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Empresa
            </TabsTrigger>
          )}
        </TabsList>

        <div className="mt-3 max-h-[62vh] overflow-y-auto pr-1">
          <TabsContent value="preferencias" className="mt-0 space-y-5">
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Tema</h3>
              <div className="mt-2 flex gap-2">
                <TemaButton ativo={temaAtual === 'light'} onClick={() => escolherTema('light')}>
                  <Sun className="h-4 w-4" aria-hidden />
                  Tema claro
                </TemaButton>
                <TemaButton ativo={temaAtual === 'dark'} onClick={() => escolherTema('dark')}>
                  <Moon className="h-4 w-4" aria-hidden />
                  Tema escuro
                </TemaButton>
              </div>
            </section>

            <Separator />

            <section>
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                <UserRound className="h-3.5 w-3.5" aria-hidden /> Conta
              </h3>
              <dl className="mt-2 divide-y divide-border rounded border border-border">
                <div className="flex items-center justify-between gap-3 px-3 py-2">
                  <dt className="text-xs text-secondary">Nome</dt>
                  <dd className="truncate text-sm font-medium text-primary">
                    {user?.nome || '—'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 px-3 py-2">
                  <dt className="text-xs text-secondary">Perfil</dt>
                  <dd className="text-sm font-medium text-primary">{user?.perfil || '—'}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 px-3 py-2">
                  <dt className="text-xs text-secondary">Loja</dt>
                  <dd className="truncate font-mono text-sm text-primary">
                    {user?.lojaId || '—'}
                  </dd>
                </div>
              </dl>
            </section>

            <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
              <span className="text-xs text-muted">VisionBox v0.1.0 • TechboxBR 2026</span>
              <Button variant="destructive" size="sm" onClick={sair}>
                <LogOut className="mr-2 h-4 w-4" aria-hidden />
                Sair da conta
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="formas" className="mt-0">
            <FormasPagamentoConfig />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="empresa" className="mt-0">
              <EmpresaConfig />
            </TabsContent>
          )}
        </div>
      </Tabs>
    </Dialog>
  );
}

export default ConfiguracoesDialog;
