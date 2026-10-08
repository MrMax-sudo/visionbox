import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Code2, Server, Database, Cpu, RefreshCw, ExternalLink } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { apiClient, ApiError } from '@/lib/apiClient';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type DevInfo = {
  app: string;
  version: string;
  profiles: string;
  fiscalProvider: string;
  outboxEnabled: string;
  timezone: string;
};

type EmpresaInfo = {
  id: string;
  nome: string;
  cnpj?: string;
  cidade?: string;
  uf?: string;
  logoUrl?: string;
};

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function Linha({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] py-2 text-sm last:border-0">
      <dt className="text-xs text-[var(--color-text-secondary)]">{label}</dt>
      <dd className="truncate font-mono text-[var(--color-text-primary)]">{valor || '—'}</dd>
    </div>
  );
}

function Chip({ children, ok }: { children: React.ReactNode; ok?: boolean }) {
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-1 text-xs font-semibold',
        ok ? 'bg-[var(--color-pdv-success-bg)] text-[var(--color-success-dark)]' : 'bg-[var(--color-warning-light)] text-[var(--color-warning-dark)]',
      )}
    >
      {children}
    </span>
  );
}

export default function PainelDesenvolvedor() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [devInfo, setDevInfo] = React.useState<DevInfo | null>(null);
  const [empresa, setEmpresa] = React.useState<EmpresaInfo | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const podeAcessar = user?.perfil === 'DESENVOLVEDOR' || user?.perfil === 'ADMIN';

  const carregar = React.useCallback(async () => {
    if (!podeAcessar) return;
    setLoading(true);
    setErro(null);
    try {
      const [info, emp] = await Promise.all([
        apiClient.get<DevInfo>('/v1/dev/info'),
        apiClient.get<EmpresaInfo>('/v1/empresa'),
      ]);
      setDevInfo(info.data);
      setEmpresa(emp.data);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Falha ao carregar informações de desenvolvimento.';
      setErro(msg);
    } finally {
      setLoading(false);
    }
  }, [podeAcessar]);

  React.useEffect(() => {
    if (!podeAcessar) {
      navigate('/', { replace: true });
      return;
    }
    carregar();
  }, [podeAcessar, carregar, navigate]);

  if (!podeAcessar) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-[var(--font-sans)] text-xl font-bold text-[var(--color-text-primary)]">
            <Code2 className="h-5 w-5" aria-hidden /> Painel do Desenvolvedor
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Diagnóstico técnico e configurações da empresa. Acesso exclusivo para{' '}
            <span className="font-semibold text-[var(--color-text-primary)]">DESENVOLVEDOR</span> e{' '}
            <span className="font-semibold text-[var(--color-text-primary)]">ADMIN</span>.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={carregar} disabled={loading}>
          <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} aria-hidden /> Recarregar
        </Button>
      </div>

      {erro && (
        <div className="rounded-[var(--radius)] border border-[var(--color-danger-light)] bg-[var(--color-danger-light)] px-4 py-3 text-sm text-[var(--color-danger-dark)]">
          {erro}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <Card title="Aplicação" icon={<Cpu className="h-4 w-4 text-[var(--color-primary)]" aria-hidden />}>
          {devInfo ? (
            <dl>
              <Linha label="App" valor={devInfo.app} />
              <Linha label="Versão" valor={devInfo.version} />
              <Linha label="Perfis ativos" valor={devInfo.profiles || '(padrão)'} />
              <Linha
                label="Provider fiscal"
                valor={
                  <span className="flex items-center gap-2">
                    {devInfo.fiscalProvider}
                    <Chip ok={devInfo.fiscalProvider === 'flowbox'}>ativo</Chip>
                  </span>
                }
              />
              <Linha label="Outbox (poll ms)" valor={devInfo.outboxEnabled} />
              <Linha label="Fuso JPA" valor={devInfo.timezone} />
            </dl>
          ) : (
            <p className="py-4 text-center text-xs text-[var(--color-text-muted)]">Carregando…</p>
          )}
        </Card>

        <Card title="Status" icon={<Server className="h-4 w-4 text-[var(--color-primary)]" aria-hidden />}>
          <dl>
            <Linha
              label="Sessão"
              valor={
                <span className="flex items-center gap-2">
                  Logado <Chip ok>JWT</Chip>
                </span>
              }
            />
            <Linha label="Usuário" valor={user?.nome} />
            <Linha label="Perfil" valor={user?.perfil} />
            <Linha label="Loja (ID)" valor={user?.lojaId} />
            <Linha
              label="API"
              valor={
                <span className="flex items-center gap-2">
                  {typeof window !== 'undefined' ? window.location.origin : ''}
                  <Chip ok>config</Chip>
                </span>
              }
            />
          </dl>
        </Card>

        <Card title="Empresa configurada" icon={<Database className="h-4 w-4 text-[var(--color-primary)]" aria-hidden />}>
          {empresa ? (
            <dl>
              <Linha label="Nome" valor={empresa.nome} />
              <Linha label="CNPJ" valor={empresa.cnpj} />
              <Linha label="Cidade / UF" valor={empresa.cidade && empresa.uf ? `${empresa.cidade} / ${empresa.uf}` : '—'} />
              <Linha
                label="Logo"
                valor={
                  empresa.logoUrl ? (
                    <a
                      href={empresa.logoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-[var(--color-primary)] hover:underline"
                    >
                      abrir <ExternalLink className="h-3 w-3" aria-hidden />
                    </a>
                  ) : (
                    '—'
                  )
                }
              />
            </dl>
          ) : (
            <p className="py-4 text-center text-xs text-[var(--color-text-muted)]">Carregando…</p>
          )}
        </Card>

        <Card title="Ações" icon={<RefreshCw className="h-4 w-4 text-[var(--color-primary)]" aria-hidden />}>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Configure logo, telefone e WhatsApp da empresa em{' '}
            <span className="font-semibold text-[var(--color-text-primary)]">Configurações</span> no menu lateral.
            Os links <span className="font-mono">wa.me</span> usam o WhatsApp cadastrado.
          </p>
        </Card>
      </div>
    </div>
  );
}