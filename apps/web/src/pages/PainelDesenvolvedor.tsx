import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Code2, Cpu, Database, ExternalLink, RefreshCw, Server, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingRows } from '@/components/ui/loading-state';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient, ApiError } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/authStore';

/**
 * Painel do Desenvolvedor (/desenvolvedor, dentro do AppShell).
 * ONDA 2E: UI com kit + tokens; contratos intocados:
 *  - GET /v1/dev/info
 *  - GET /v1/empresa
 * Acesso gated por perfil DESENVOLVEDOR/ADMIN (redireciona caso contrário).
 */

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

function InfoCard({
  title,
  icon,
  loading,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{loading ? <LoadingRows rows={4} /> : children}</CardContent>
    </Card>
  );
}

function Linha({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-2 text-sm last:border-0">
      <dt className="text-xs text-secondary">{label}</dt>
      <dd className="truncate font-mono text-primary">{valor || '—'}</dd>
    </div>
  );
}

function Chip({ children, ok }: { children: React.ReactNode; ok?: boolean }) {
  return (
    <Badge variant={ok ? 'success' : 'warning'} className="font-semibold">
      {children}
    </Badge>
  );
}

export default function PainelDesenvolvedor() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [devInfo, setDevInfo] = React.useState<DevInfo | null>(null);
  const [empresa, setEmpresa] = React.useState<EmpresaInfo | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [seedLoading, setSeedLoading] = React.useState(false);
  const [seedMsg, setSeedMsg] = React.useState<string | null>(null);

  const podeAcessar = user?.perfil === 'DESENVOLVEDOR' || user?.perfil === 'ADMIN';

  const executarSeed = async () => {
    setSeedLoading(true);
    setSeedMsg(null);
    try {
      const res = await apiClient.post<{ mensagem?: string }>('/v1/produtos/seed-demonstracao');
      setSeedMsg(res.data.mensagem || 'Carga de demonstração realizada com sucesso!');
      await carregar();
    } catch {
      setSeedMsg('Falha ao executar carga de demonstração.');
    } finally {
      setSeedLoading(false);
    }
  };

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-primary">
            <Code2 className="h-5 w-5 text-brand" aria-hidden /> Painel do Desenvolvedor
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Diagnóstico técnico e configurações da empresa. Acesso exclusivo para{' '}
            <span className="font-semibold text-primary">DESENVOLVEDOR</span> e{' '}
            <span className="font-semibold text-primary">ADMIN</span>.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={executarSeed}
            disabled={seedLoading}
            className="text-xs gap-1.5"
          >
            <Sparkles className={seedLoading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} aria-hidden />{' '}
            {seedLoading ? 'Carregando…' : 'Carga de Demonstração (Testes)'}
          </Button>
          <Button variant="outline" size="sm" onClick={carregar} disabled={loading}>
            <RefreshCw className={loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} aria-hidden />{' '}
            Recarregar
          </Button>
        </div>
      </div>

      {seedMsg && (
        <div className="rounded-card border border-primary/30 bg-primary/10 p-3 text-xs font-medium text-primary">
          {seedMsg}
        </div>
      )}

      {erro && <ErrorState error={new ApiError(erro)} onRetry={carregar} compact />}

      <div className="grid gap-5 md:grid-cols-2">
        <InfoCard
          title="Aplicação"
          loading={loading && !devInfo}
          icon={<Cpu className="h-4 w-4 text-brand" aria-hidden />}
        >
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
                    <Chip ok={devInfo.fiscalProvider === 'flowbox'}>
                      {devInfo.fiscalProvider === 'flowbox' ? 'ativo' : 'inativo / emulação'}
                    </Chip>
                  </span>
                }
              />
              <Linha label="Outbox (poll ms)" valor={devInfo.outboxEnabled} />
              <Linha label="Fuso JPA" valor={devInfo.timezone} />
            </dl>
          ) : (
            <Skeleton className="h-32 w-full rounded" />
          )}
        </InfoCard>

        <InfoCard
          title="Status"
          icon={<Server className="h-4 w-4 text-brand" aria-hidden />}
        >
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
        </InfoCard>

        <InfoCard
          title="Empresa configurada"
          loading={loading && !empresa}
          icon={<Database className="h-4 w-4 text-brand" aria-hidden />}
        >
          {empresa ? (
            <dl>
              <Linha label="Nome" valor={empresa.nome} />
              <Linha label="CNPJ" valor={empresa.cnpj} />
              <Linha
                label="Cidade / UF"
                valor={empresa.cidade && empresa.uf ? `${empresa.cidade} / ${empresa.uf}` : '—'}
              />
              <Linha
                label="Logo"
                valor={
                  empresa.logoUrl ? (
                    <a
                      href={empresa.logoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-brand hover:underline"
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
            <Skeleton className="h-24 w-full rounded" />
          )}
        </InfoCard>

        <InfoCard title="Ações" icon={<RefreshCw className="h-4 w-4 text-brand" aria-hidden />}>
          <p className="text-xs text-secondary">
            Configure logo, telefone e WhatsApp da empresa em{' '}
            <span className="font-semibold text-primary">Configurações</span> no menu lateral. Os
            links <span className="font-mono">wa.me</span> usam o WhatsApp cadastrado.
          </p>
        </InfoCard>
      </div>
    </div>
  );
}
