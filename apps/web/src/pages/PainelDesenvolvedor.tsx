import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Banknote,
  Bell,
  Building2,
  CheckCircle2,
  ClipboardList,
  Code2,
  Cpu,
  Database,
  Download,
  ExternalLink,
  Eye,
  FileText,
  FlaskConical,
  Gift,
  KeyRound,
  Lightbulb,
  ListOrdered,
  MapPin,
  MessageCircle,
  Package,
  Plus,
  Receipt,
  RefreshCw,
  Server,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Star,
  Store,
  Tag,
  Trash2,
  Pencil,
  Globe,
  Search,
  AlertTriangle,
  Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingRows } from '@/components/ui/loading-state';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { apiClient, ApiError } from '@/lib/apiClient';
import { fetchCnpj } from '@/lib/cnpj';
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

/* ===================== Fase 5 — Gestor SaaS de Módulos & Planos ===================== */

type LojaResumo = {
  id: string;
  nome: string;
  codigo?: string;
  subdominio?: string;
  cnpj?: string;
  telefone?: string;
  emailContato?: string;
  ativo?: boolean;
};

type ModuloStatusItem = {
  codigo: string;
  nome: string;
  descricao: string;
  rotas: string[];
  ativo: boolean;
  fonte: 'PADRAO' | 'REGISTRO';
};

type ModulosStatus = {
  lojaId: string;
  planoAtual: string;
  registrosExistem: boolean;
  modulos: ModuloStatusItem[];
};

type PlanoRapido = 'START' | 'PRO' | 'ENTERPRISE' | 'PERSONALIZADO';

const PLANOS_RAPIDOS: Array<{ valor: PlanoRapido; rotulo: string }> = [
  { valor: 'START', rotulo: 'Start' },
  { valor: 'PRO', rotulo: 'Pro' },
  { valor: 'ENTERPRISE', rotulo: 'Enterprise' },
  { valor: 'PERSONALIZADO', rotulo: 'Personalizado' },
];

/** Ícone por módulo (spec §4.1) — lucide + tokens, zero hex (R5). */
const ICONES_MODULO: Record<string, React.ElementType> = {
  PDV_BALCAO: ShoppingCart,
  ORDEM_SERVICO: ClipboardList,
  RECEITAS_CLINICAS: Eye,
  CENTRAL_VENDAS: Receipt,
  CAIXA_TURNOS: Wallet,
  FINANCEIRO_COMPLETO: Banknote,
  FISCAL_FLOWBOX: FileText,
  COMPRAS_XML: Download,
  ESTOQUE_LOTES: Package,
  ETIQUETAS: Tag,
  SUGESTAO_COMPRAS: Lightbulb,
  SCANNER_MOVEL: Smartphone,
  TABELAS_PRECO: ListOrdered,
  FIDELIDADE_PONTOS: Star,
  ORCAMENTO_ONLINE: MessageCircle,
  KITS_COMBOS: Gift,
  LAB_PORTAL: FlaskConical,
  RASTREIO_CLIENTE: MapPin,
  ALERTAS_TELEGRAM: Bell,
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

  /* ---------------- Fase 5: Gestor SaaS de Módulos & Planos ---------------- */
  const [lojas, setLojas] = React.useState<LojaResumo[]>([]);
  const [lojaSel, setLojaSel] = React.useState<string>(user?.lojaId ?? '');
  const [modulos, setModulos] = React.useState<ModulosStatus | null>(null);
  const [modulosLoading, setModulosLoading] = React.useState(false);
  const [modulosErro, setModulosErro] = React.useState<string | null>(null);
  const [salvando, setSalvando] = React.useState<string | null>(null);
  const [aviso, setAviso] = React.useState<string | null>(null);

  /* Modal de Provisionamento de Nova Loja (Multi-tenant) */
  const [modalNovaLoja, setModalNovaLoja] = React.useState(false);
  const [criandoLoja, setCriandoLoja] = React.useState(false);
  const [buscandoCnpjNova, setBuscandoCnpjNova] = React.useState(false);
  const [erroNovaLoja, setErroNovaLoja] = React.useState<string | null>(null);
  const [formNovaLoja, setFormNovaLoja] = React.useState({
    nome: '',
    cnpj: '',
    telefone: '',
    emailContato: '',
    subdominio: '',
    plano: 'PRO' as 'START' | 'PRO' | 'ENTERPRISE',
    adminNome: '',
    adminEmail: '',
    adminSenha: '',
  });

  /* Modal de Edição de Loja */
  const [modalEditarLoja, setModalEditarLoja] = React.useState(false);
  const [editandoLoja, setEditandoLoja] = React.useState(false);
  const [buscandoCnpjEditar, setBuscandoCnpjEditar] = React.useState(false);
  const [erroEditarLoja, setErroEditarLoja] = React.useState<string | null>(null);
  const [formEditarLoja, setFormEditarLoja] = React.useState({
    nome: '',
    cnpj: '',
    telefone: '',
    emailContato: '',
    subdominio: '',
    ativo: true,
  });

  /* Modal de Exclusão de Loja */
  const [modalExcluirLoja, setModalExcluirLoja] = React.useState(false);
  const [excluindoLoja, setExcluindoLoja] = React.useState(false);
  const [erroExcluirLoja, setErroExcluirLoja] = React.useState<string | null>(null);

  const slugify = (text: string) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 30);
  };

  const buscarCnpjParaNovaLoja = async (cnpjDigitado?: string) => {
    const valor = cnpjDigitado ?? formNovaLoja.cnpj;
    const digitos = valor.replace(/\D/g, '');
    if (digitos.length !== 14) {
      setErroNovaLoja('Informe o CNPJ com 14 dígitos para buscar na Receita.');
      return;
    }
    setBuscandoCnpjNova(true);
    setErroNovaLoja(null);
    try {
      const data = await fetchCnpj(digitos);
      const nomeEncontrado = data.nome_fantasia || data.razao_social;
      setFormNovaLoja((prev) => ({
        ...prev,
        cnpj: data.cnpj,
        nome: prev.nome || nomeEncontrado,
        telefone: prev.telefone || data.ddd_telefone_1 || '',
        emailContato: prev.emailContato || data.email || '',
        subdominio: prev.subdominio || slugify(nomeEncontrado),
      }));
    } catch (err) {
      setErroNovaLoja(err instanceof Error ? err.message : 'Falha ao consultar CNPJ na Receita Federal.');
    } finally {
      setBuscandoCnpjNova(false);
    }
  };

  const abrirModalNovaLoja = () => {
    setFormNovaLoja({
      nome: '',
      cnpj: '',
      telefone: '',
      emailContato: '',
      subdominio: '',
      plano: 'PRO',
      adminNome: '',
      adminEmail: '',
      adminSenha: '',
    });
    setErroNovaLoja(null);
    setModalNovaLoja(true);
  };

  const submeterNovaLoja = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNovaLoja.nome.trim()) {
      setErroNovaLoja('Informe o nome da empresa/loja.');
      return;
    }
    if (!formNovaLoja.adminNome.trim()) {
      setErroNovaLoja('Informe o nome do administrador inicial.');
      return;
    }
    if (!formNovaLoja.adminEmail.trim()) {
      setErroNovaLoja('Informe o e-mail de acesso do administrador.');
      return;
    }
    if (!formNovaLoja.adminSenha || formNovaLoja.adminSenha.length < 6) {
      setErroNovaLoja('A senha inicial deve ter no mínimo 6 caracteres.');
      return;
    }

    setCriandoLoja(true);
    setErroNovaLoja(null);
    try {
      const res = await apiClient.post<{
        id: string;
        nome: string;
        codigo?: string;
        subdominio?: string;
        cnpj?: string;
        adminEmail: string;
        plano: string;
      }>('/v1/dev/lojas', formNovaLoja);

      setModalNovaLoja(false);
      setAviso(
        `Empresa "${res.data.nome}" (${res.data.codigo || 'LJ-Novo'}) provisionada com sucesso (Plano ${res.data.plano})! Subdomínio: ${res.data.subdominio || 'loja'}.techboxbr.app.br. Administrador: ${res.data.adminEmail}`,
      );
      // Recarrega lista e seleciona a nova loja
      const listaRes = await apiClient.get<LojaResumo[]>('/v1/dev/lojas');
      setLojas(listaRes.data);
      setLojaSel(res.data.id);
    } catch (err) {
      setErroNovaLoja(
        err instanceof ApiError ? err.message : 'Falha ao provisionar a nova empresa/loja.',
      );
    } finally {
      setCriandoLoja(false);
    }
  };

  const abrirModalEditarLoja = () => {
    const lojaAtual = lojas.find((l) => l.id === lojaSel);
    if (!lojaAtual) return;
    setFormEditarLoja({
      nome: lojaAtual.nome || '',
      cnpj: lojaAtual.cnpj || '',
      telefone: lojaAtual.telefone || '',
      emailContato: lojaAtual.emailContato || '',
      subdominio: lojaAtual.subdominio || '',
      ativo: lojaAtual.ativo ?? true,
    });
    setErroEditarLoja(null);
    setModalEditarLoja(true);
  };

  const buscarCnpjParaEditarLoja = async () => {
    const digitos = formEditarLoja.cnpj.replace(/\D/g, '');
    if (digitos.length !== 14) {
      setErroEditarLoja('Informe o CNPJ com 14 dígitos para buscar na Receita.');
      return;
    }
    setBuscandoCnpjEditar(true);
    setErroEditarLoja(null);
    try {
      const data = await fetchCnpj(digitos);
      const nomeEncontrado = data.nome_fantasia || data.razao_social;
      setFormEditarLoja((prev) => ({
        ...prev,
        cnpj: data.cnpj,
        nome: prev.nome || nomeEncontrado,
        telefone: prev.telefone || data.ddd_telefone_1 || '',
        emailContato: prev.emailContato || data.email || '',
        subdominio: prev.subdominio || slugify(nomeEncontrado),
      }));
    } catch (err) {
      setErroEditarLoja(err instanceof Error ? err.message : 'Falha ao consultar CNPJ na Receita Federal.');
    } finally {
      setBuscandoCnpjEditar(false);
    }
  };

  const submeterEditarLoja = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEditarLoja.nome.trim()) {
      setErroEditarLoja('Informe o nome da empresa.');
      return;
    }
    setEditandoLoja(true);
    setErroEditarLoja(null);
    try {
      await apiClient.put<LojaResumo>(`/v1/dev/lojas/${lojaSel}`, formEditarLoja);
      setModalEditarLoja(false);
      setAviso(`Empresa "${formEditarLoja.nome}" atualizada com sucesso!`);
      const listaRes = await apiClient.get<LojaResumo[]>('/v1/dev/lojas');
      setLojas(listaRes.data);
    } catch (err) {
      setErroEditarLoja(
        err instanceof ApiError ? err.message : 'Falha ao atualizar dados da empresa.',
      );
    } finally {
      setEditandoLoja(false);
    }
  };

  const abrirModalExcluirLoja = () => {
    setErroExcluirLoja(null);
    setModalExcluirLoja(true);
  };

  const submeterExcluirLoja = async () => {
    setExcluindoLoja(true);
    setErroExcluirLoja(null);
    try {
      await apiClient.delete(`/v1/dev/lojas/${lojaSel}`);
      setModalExcluirLoja(false);
      setAviso('Empresa excluída com sucesso.');
      const listaRes = await apiClient.get<LojaResumo[]>('/v1/dev/lojas');
      setLojas(listaRes.data);
      if (listaRes.data.length > 0) {
        setLojaSel(listaRes.data[0].id);
      }
    } catch (err) {
      setErroExcluirLoja(
        err instanceof ApiError ? err.message : 'Falha ao excluir empresa.',
      );
    } finally {
      setExcluindoLoja(false);
    }
  };

  const carregarLojas = React.useCallback(async () => {
    if (!podeAcessar) return;
    try {
      const res = await apiClient.get<LojaResumo[]>('/v1/dev/lojas');
      setLojas(res.data);
      setLojaSel((atual) => atual || res.data[0]?.id || '');
    } catch {
      setLojas([]);
    }
  }, [podeAcessar]);

  const carregarModulos = React.useCallback(
    async (lojaId: string) => {
      if (!podeAcessar || !lojaId) return;
      setModulosLoading(true);
      setModulosErro(null);
      try {
        const res = await apiClient.get<ModulosStatus>(`/v1/dev/lojas/${lojaId}/modulos`);
        setModulos(res.data);
      } catch (e) {
        setModulos(null);
        setModulosErro(
          e instanceof ApiError ? e.message : 'Falha ao carregar os módulos da loja.',
        );
      } finally {
        setModulosLoading(false);
      }
    },
    [podeAcessar],
  );

  React.useEffect(() => {
    void carregarLojas();
  }, [carregarLojas]);

  React.useEffect(() => {
    if (lojaSel) void carregarModulos(lojaSel);
  }, [lojaSel, carregarModulos]);

  const alternarModulo = async (codigo: string, ativo: boolean) => {
    if (!lojaSel) return;
    setSalvando(codigo);
    setAviso(null);
    setModulosErro(null);
    try {
      const res = await apiClient.put<ModulosStatus>(`/v1/dev/lojas/${lojaSel}/modulos`, {
        modulos: [{ codigo, ativo }],
      });
      setModulos(res.data);
      setAviso(`Módulo ${codigo} ${ativo ? 'ativado' : 'desativado'} — alteração gravada com auditoria.`);
    } catch (e) {
      setModulosErro(
        e instanceof ApiError ? e.message : `Falha ao alterar o módulo ${codigo}.`,
      );
    } finally {
      setSalvando(null);
    }
  };

  const aplicarPlano = async (plano: PlanoRapido) => {
    if (!lojaSel) return;
    if (plano === 'PERSONALIZADO') {
      setAviso('Plano Personalizado: ligue/desligue cada módulo individualmente pelos switches abaixo.');
      return;
    }
    setSalvando('PLANO');
    setAviso(null);
    setModulosErro(null);
    try {
      const res = await apiClient.put<ModulosStatus>(`/v1/dev/lojas/${lojaSel}/modulos/plano`, {
        plano,
      });
      setModulos(res.data);
      setAviso(`Plano ${plano} aplicado — 19 módulos atualizados com auditoria.`);
    } catch (e) {
      setModulosErro(e instanceof ApiError ? e.message : `Falha ao aplicar o plano ${plano}.`);
    } finally {
      setSalvando(null);
    }
  };

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
        <div className="flex flex-wrap gap-2">
          {user?.perfil === 'DESENVOLVEDOR' && (
            <Button
              variant="outline"
              size="sm"
              onClick={abrirModalNovaLoja}
              className="gap-1.5 text-xs font-semibold border-brand/40 text-brand hover:bg-brand/10"
            >
              <Store className="h-3.5 w-3.5" aria-hidden /> + Nova Empresa / Loja
            </Button>
          )}
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

      {/* ===== Fase 5 — Gestor SaaS de Módulos & Planos (spec §4.3) ===== */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Package className="h-4 w-4 text-brand" aria-hidden />
            Módulos & Planos (SaaS)
          </CardTitle>
          <p className="text-xs text-secondary">
            Libere ou bloqueie recursos por loja (feature flagging). Toda alteração é gravada com
            auditoria (quem alterou, quando) e vale imediatamente para backend e navegação.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Barra de Seleção e Gestão de Empresas */}
          <div className="space-y-2 rounded-card border border-border bg-subtle p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="dev-loja-sel" className="text-xs font-bold uppercase tracking-wider text-primary">
                <Store className="inline-block mr-1.5 h-3.5 w-3.5 text-brand" /> Empresa Selecionada (Tenant)
              </Label>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={abrirModalEditarLoja}
                  disabled={!lojaSel}
                  className="h-7 gap-1 px-2.5 text-xs text-primary"
                >
                  <Pencil className="h-3 w-3 text-secondary" aria-hidden /> Editar Dados
                </Button>
                {user?.perfil === 'DESENVOLVEDOR' && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={abrirModalExcluirLoja}
                      disabled={!lojaSel || lojaSel === '00000000-0000-0000-0000-000000000001'}
                      className="h-7 gap-1 px-2.5 text-xs text-danger hover:bg-danger/10 border-danger/30"
                      title={lojaSel === '00000000-0000-0000-0000-000000000001' ? 'A Matriz LJ-001 não pode ser excluída' : 'Excluir esta empresa'}
                    >
                      <Trash2 className="h-3 w-3" aria-hidden /> Excluir
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={abrirModalNovaLoja}
                      className="h-7 gap-1 px-2.5 text-xs font-semibold"
                    >
                      <Plus className="h-3 w-3" aria-hidden /> Nova Empresa
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Select
                  id="dev-loja-sel"
                  value={lojaSel}
                  onChange={(e) => setLojaSel(e.target.value)}
                  disabled={lojas.length === 0}
                  className="font-medium"
                >
                  {lojas.length === 0 ? (
                    <option value={lojaSel || '—'}>Carregando lojas…</option>
                  ) : (
                    lojas.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.codigo ? `${l.codigo} • ` : ''}{l.nome} ({l.subdominio || 'loja'}.techboxbr.app.br){!l.ativo ? ' [INATIVA]' : ''}
                      </option>
                    ))
                  )}
                </Select>
              </div>

              {/* Badges de Identificação da Loja Atual */}
              {(() => {
                const atual = lojas.find((l) => l.id === lojaSel);
                return (
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <Badge variant="outline" className="font-mono font-bold text-brand">
                      {atual?.codigo || 'LJ-???'}
                    </Badge>
                    <Badge variant={atual?.ativo !== false ? 'success' : 'warning'}>
                      {atual?.ativo !== false ? 'Ativa' : 'Inativa'}
                    </Badge>
                    {atual?.subdominio && (
                      <span className="flex items-center gap-1 rounded bg-card px-2 py-1 font-mono text-[11px] text-secondary border border-border">
                        <Globe className="h-3 w-3 text-brand" />
                        {atual.subdominio}.techboxbr.app.br
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3 pt-1">

            <div className="space-y-1">
              <Label className="text-xs">Plano rápido</Label>
              <div className="flex flex-wrap gap-2">
                {PLANOS_RAPIDOS.map((p) => (
                  <Button
                    key={p.valor}
                    size="sm"
                    variant={modulos?.planoAtual === p.valor ? 'primary' : 'outline'}
                    onClick={() => void aplicarPlano(p.valor)}
                    disabled={salvando !== null || !lojaSel}
                    className="text-xs"
                  >
                    {salvando === 'PLANO' && modulos?.planoAtual !== p.valor ? 'Aplicando…' : p.rotulo}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant={modulos?.planoAtual === 'PADRAO' ? 'info' : 'success'}>
                Plano atual: {modulos?.planoAtual ?? '—'}
              </Badge>
              <Badge variant="outline">
                {modulos?.registrosExistem
                  ? 'configuração materializada'
                  : 'sem registro — padrão todos ativos'}
              </Badge>
            </div>
          </div>

          {modulosErro && (
            <div className="rounded-card border border-danger-light bg-danger-light p-3 text-xs font-medium text-danger-dark">
              {modulosErro}
            </div>
          )}
          {aviso && (
            <div className="rounded-card border border-success-light bg-success-light p-3 text-xs font-medium text-success-dark">
              {aviso}
            </div>
          )}

          {modulosLoading ? (
            <LoadingRows rows={4} />
          ) : modulos ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {modulos.modulos.map((m) => {
                const Icone = ICONES_MODULO[m.codigo] ?? Package;
                const ocupado = salvando !== null;
                return (
                  <div
                    key={m.codigo}
                    className="flex items-start justify-between gap-3 rounded-card border border-border bg-card p-3"
                  >
                    <div className="flex min-w-0 items-start gap-2">
                      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary/10">
                        <Icone className="h-4 w-4 text-brand" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-primary">{m.nome}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-secondary">{m.descricao}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <Badge variant={m.ativo ? 'success' : 'warning'} className="text-[10px]">
                            {m.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {m.codigo}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <Switch
                      checked={m.ativo}
                      disabled={ocupado}
                      onCheckedChange={(checked) => void alternarModulo(m.codigo, checked)}
                      aria-label={`${m.ativo ? 'Desativar' : 'Ativar'} módulo ${m.nome}`}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-secondary">
              Selecione uma loja para carregar os módulos contratados.
            </p>
          )}

          <p className="text-[11px] text-muted">
            Start = PDV + Central de Vendas + Caixa · Pro = núcleo ótico (OS, Receitas, Lab,
            Rastreio, Financeiro, Fiscal, Lotes) · Enterprise = todos os 19 módulos ·
            Personalizado = configure módulo a módulo (add-on avulso).
          </p>
        </CardContent>
      </Card>

      {/* Modal de Provisionamento de Nova Empresa / Loja (Multi-tenant) */}
      <Dialog
        open={modalNovaLoja}
        onClose={() => !criandoLoja && setModalNovaLoja(false)}
        title="Provisionar Nova Empresa / Loja"
        description="Cadastre um novo ambiente isolado (multi-tenant) com banco de dados seguro, plano de módulos e primeiro administrador."
        className="max-w-[620px]"
      >
        <form onSubmit={submeterNovaLoja} className="space-y-4 pt-2">
          {erroNovaLoja && (
            <div className="rounded-card border border-danger-light bg-danger-light p-3 text-xs font-medium text-danger-dark">
              {erroNovaLoja}
            </div>
          )}

          {/* Seção 1: Dados da Empresa */}
          <div className="space-y-3 rounded-card border border-border bg-subtle p-3.5">
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
              <Building2 className="h-4 w-4 text-brand" /> Dados da Empresa / Ótica
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="nova-loja-nome" className="text-xs font-medium">
                  Nome da Empresa / Fantasia <span className="text-danger">*</span>
                </Label>
                <Input
                  id="nova-loja-nome"
                  required
                  placeholder="Ex: Ótica Vista Linda Matriz"
                  value={formNovaLoja.nome}
                  onChange={(e) => {
                    const novoNome = e.target.value;
                    setFormNovaLoja((prev) => ({
                      ...prev,
                      nome: novoNome,
                      subdominio: prev.subdominio || slugify(novoNome),
                    }));
                  }}
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="nova-loja-cnpj" className="text-xs font-medium">
                  CNPJ (opcional — preenche nome, telefone, email e subdomínio)
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="nova-loja-cnpj"
                    placeholder="00.000.000/0000-00"
                    value={formNovaLoja.cnpj}
                    onChange={(e) => setFormNovaLoja((prev) => ({ ...prev, cnpj: e.target.value }))}
                    onBlur={() => {
                      if (formNovaLoja.cnpj.replace(/\D/g, '').length === 14 && !formNovaLoja.nome) {
                        void buscarCnpjParaNovaLoja();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void buscarCnpjParaNovaLoja()}
                    disabled={buscandoCnpjNova}
                    className="shrink-0 gap-1 text-xs"
                    title="Consultar dados na Receita Federal via BrasilAPI"
                  >
                    <Search className={buscandoCnpjNova ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
                    {buscandoCnpjNova ? 'Consultando…' : 'Buscar Receita'}
                  </Button>
                </div>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="nova-loja-subdominio" className="text-xs font-medium">
                  Subdomínio de Acesso (URL dedicada)
                </Label>
                <div className="flex items-center rounded border border-border bg-card px-2.5">
                  <Globe className="h-3.5 w-3.5 text-brand shrink-0 mr-1.5" />
                  <input
                    id="nova-loja-subdominio"
                    className="w-full bg-transparent py-1.5 text-xs font-mono text-primary outline-none"
                    placeholder="ex: oticalinda"
                    value={formNovaLoja.subdominio}
                    onChange={(e) => setFormNovaLoja((prev) => ({ ...prev, subdominio: slugify(e.target.value) }))}
                  />
                  <span className="text-xs font-mono text-muted shrink-0">.techboxbr.app.br</span>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="nova-loja-telefone" className="text-xs font-medium">
                  Telefone / WhatsApp (opcional)
                </Label>
                <Input
                  id="nova-loja-telefone"
                  placeholder="(11) 99999-9999"
                  value={formNovaLoja.telefone}
                  onChange={(e) => setFormNovaLoja((prev) => ({ ...prev, telefone: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="nova-loja-email-contato" className="text-xs font-medium">
                  E-mail de Contato da Empresa (opcional)
                </Label>
                <Input
                  id="nova-loja-email-contato"
                  type="email"
                  placeholder="contato@oticalinda.com.br"
                  value={formNovaLoja.emailContato}
                  onChange={(e) => setFormNovaLoja((prev) => ({ ...prev, emailContato: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Seção 2: Plano SaaS */}
          <div className="space-y-2 rounded-card border border-border bg-subtle p-3.5">
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
              <Package className="h-4 w-4 text-brand" /> Plano Contratado
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {(['START', 'PRO', 'ENTERPRISE'] as const).map((plano) => {
                const selecionado = formNovaLoja.plano === plano;
                return (
                  <button
                    key={plano}
                    type="button"
                    onClick={() => setFormNovaLoja((prev) => ({ ...prev, plano }))}
                    className={`flex flex-col items-center justify-center rounded-card border p-2.5 text-center transition-all ${
                      selecionado
                        ? 'border-brand bg-brand/10 text-primary shadow-sm ring-1 ring-brand'
                        : 'border-border bg-card text-secondary hover:border-brand/40'
                    }`}
                  >
                    <span className="text-xs font-bold">{plano}</span>
                    <span className="mt-1 text-[10px] text-muted">
                      {plano === 'START'
                        ? 'PDV & Vendas'
                        : plano === 'PRO'
                          ? 'Núcleo Ótico'
                          : '19 Módulos'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Seção 3: Primeiro Usuário Administrador */}
          <div className="space-y-3 rounded-card border border-border bg-subtle p-3.5">
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
              <KeyRound className="h-4 w-4 text-brand" /> Administrador Inicial da Loja
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="nova-loja-admin-nome" className="text-xs font-medium">
                  Nome do Administrador <span className="text-danger">*</span>
                </Label>
                <Input
                  id="nova-loja-admin-nome"
                  required
                  placeholder="Ex: Carlos Silva"
                  value={formNovaLoja.adminNome}
                  onChange={(e) => setFormNovaLoja((prev) => ({ ...prev, adminNome: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="nova-loja-admin-email" className="text-xs font-medium">
                  E-mail de Login <span className="text-danger">*</span>
                </Label>
                <Input
                  id="nova-loja-admin-email"
                  type="email"
                  required
                  placeholder="carlos@oticalinda.com.br"
                  value={formNovaLoja.adminEmail}
                  onChange={(e) => setFormNovaLoja((prev) => ({ ...prev, adminEmail: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="nova-loja-admin-senha" className="text-xs font-medium">
                  Senha Inicial (mín. 6) <span className="text-danger">*</span>
                </Label>
                <Input
                  id="nova-loja-admin-senha"
                  type="password"
                  required
                  minLength={6}
                  placeholder="******"
                  value={formNovaLoja.adminSenha}
                  onChange={(e) => setFormNovaLoja((prev) => ({ ...prev, adminSenha: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={criandoLoja}
              onClick={() => setModalNovaLoja(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={criandoLoja}
              className="gap-1.5"
            >
              <ShieldCheck className={criandoLoja ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              {criandoLoja ? 'Provisionando Loja…' : 'Criar e Ativar Empresa'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Modal de Edição de Empresa / Loja */}
      <Dialog
        open={modalEditarLoja}
        onClose={() => !editandoLoja && setModalEditarLoja(false)}
        title="Editar Dados da Empresa / Loja"
        description="Atualize a identificação, subdomínio e dados de contato do ambiente."
        className="max-w-[560px]"
      >
        <form onSubmit={submeterEditarLoja} className="space-y-4 pt-2">
          {erroEditarLoja && (
            <div className="rounded-card border border-danger-light bg-danger-light p-3 text-xs font-medium text-danger-dark">
              {erroEditarLoja}
            </div>
          )}

          <div className="space-y-3 rounded-card border border-border bg-subtle p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-brand">
                Código: {lojas.find((l) => l.id === lojaSel)?.codigo || 'LJ-???'}
              </span>
              <div className="flex items-center gap-2">
                <Label htmlFor="editar-loja-ativo" className="text-xs font-medium">
                  Ambiente Ativo:
                </Label>
                <Switch
                  id="editar-loja-ativo"
                  checked={formEditarLoja.ativo}
                  onCheckedChange={(checked) => setFormEditarLoja((prev) => ({ ...prev, ativo: checked }))}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="editar-loja-nome" className="text-xs font-medium">
                Nome da Empresa / Fantasia <span className="text-danger">*</span>
              </Label>
              <Input
                id="editar-loja-nome"
                required
                value={formEditarLoja.nome}
                onChange={(e) => setFormEditarLoja((prev) => ({ ...prev, nome: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="editar-loja-cnpj" className="text-xs font-medium">
                CNPJ
              </Label>
              <div className="flex gap-2">
                <Input
                  id="editar-loja-cnpj"
                  placeholder="00.000.000/0000-00"
                  value={formEditarLoja.cnpj}
                  onChange={(e) => setFormEditarLoja((prev) => ({ ...prev, cnpj: e.target.value }))}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void buscarCnpjParaEditarLoja()}
                  disabled={buscandoCnpjEditar}
                  className="shrink-0 gap-1 text-xs"
                  title="Atualizar dados cadastrais via Receita Federal"
                >
                  <Search className={buscandoCnpjEditar ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
                  {buscandoCnpjEditar ? 'Buscando…' : 'Buscar Receita'}
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="editar-loja-subdominio" className="text-xs font-medium">
                Subdomínio (URL única)
              </Label>
              <div className="flex items-center rounded border border-border bg-card px-2.5">
                <Globe className="h-3.5 w-3.5 text-brand shrink-0 mr-1.5" />
                <input
                  id="editar-loja-subdominio"
                  className="w-full bg-transparent py-1.5 text-xs font-mono text-primary outline-none"
                  placeholder="ex: oticanacional"
                  value={formEditarLoja.subdominio}
                  onChange={(e) => setFormEditarLoja((prev) => ({ ...prev, subdominio: slugify(e.target.value) }))}
                />
                <span className="text-xs font-mono text-muted shrink-0">.techboxbr.app.br</span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="editar-loja-telefone" className="text-xs font-medium">
                  Telefone / WhatsApp
                </Label>
                <Input
                  id="editar-loja-telefone"
                  placeholder="(11) 99999-9999"
                  value={formEditarLoja.telefone}
                  onChange={(e) => setFormEditarLoja((prev) => ({ ...prev, telefone: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="editar-loja-email" className="text-xs font-medium">
                  E-mail de Contato
                </Label>
                <Input
                  id="editar-loja-email"
                  type="email"
                  placeholder="contato@empresa.com.br"
                  value={formEditarLoja.emailContato}
                  onChange={(e) => setFormEditarLoja((prev) => ({ ...prev, emailContato: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={editandoLoja}
              onClick={() => setModalEditarLoja(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={editandoLoja}
            >
              {editandoLoja ? 'Salvando…' : 'Salvar Alterações'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Modal de Exclusão de Empresa / Loja */}
      <Dialog
        open={modalExcluirLoja}
        onClose={() => !excluindoLoja && setModalExcluirLoja(false)}
        title="Excluir Empresa / Loja"
        description="Atenção: esta ação remove ou inativa o ambiente multi-tenant selecionado."
        className="max-w-[480px]"
      >
        <div className="space-y-4 pt-2">
          {erroExcluirLoja && (
            <div className="rounded-card border border-danger-light bg-danger-light p-3 text-xs font-medium text-danger-dark">
              {erroExcluirLoja}
            </div>
          )}

          {lojaSel === '00000000-0000-0000-0000-000000000001' ? (
            <div className="rounded-card border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-600 dark:text-amber-400">
              <p className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" /> Loja Matriz Protegida (LJ-001)
              </p>
              <p className="mt-1">
                Esta é a loja principal do sistema. Ela não pode ser excluída para preservar a integridade das configurações mestres.
              </p>
            </div>
          ) : (
            <div className="space-y-2 text-xs text-secondary">
              <p>
                Você tem certeza que deseja excluir a empresa{' '}
                <span className="font-bold text-primary">
                  {lojas.find((l) => l.id === lojaSel)?.nome} (
                  {lojas.find((l) => l.id === lojaSel)?.codigo || 'LJ-???'}
                </span>
                ?
              </p>
              <div className="rounded-card border border-danger/30 bg-danger/10 p-3 text-xs text-danger font-medium">
                Se a empresa já tiver transações registradas (vendas, caixa ou ordens de serviço), ela será inativada com segurança para preservar o histórico fiscal. Se não houver vínculos, o tenant será excluído permanentemente.
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={excluindoLoja}
              onClick={() => setModalExcluirLoja(false)}
            >
              Cancelar
            </Button>
            {lojaSel !== '00000000-0000-0000-0000-000000000001' && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={excluindoLoja}
                onClick={submeterExcluirLoja}
                className="gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {excluindoLoja ? 'Excluindo…' : 'Confirmar Exclusão'}
              </Button>
            )}
          </div>
        </div>
      </Dialog>
    </div>
  );
}
