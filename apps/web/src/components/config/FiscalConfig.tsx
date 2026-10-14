import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  ShieldCheck,
  Key,
  Server,
  AlertCircle,
  HelpCircle,
  Zap,
  ExternalLink,
  RefreshCw,
  Save,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Globe,
} from 'lucide-react';
import { useEmpresaStore } from '@/stores/empresaStore';
import { apiClient } from '@/lib/apiClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';

interface FiscalConfigData {
  flowboxUrl: string;
  flowboxApiKey: string;
  flowboxWebUrl: string;
  flowboxCertificadoId?: number | null;
  inscricaoEstadual?: string | null;
  csc?: string | null;
  cscId?: string | null;
  codigoMunicipio?: string | null;
  crt?: string | null;
  fiscalAmbiente?: string | null;
  fiscalProvider: string;
  active: boolean;
}

interface TestarConexaoResponse {
  sucesso: boolean;
  statusHttp: number;
  latenciaMs: number;
  mensagem: string;
  urlTestada: string;
}

/**
 * FiscalConfig — Painel de Gestão e Conexão do Gateway Fiscal Flowbox (TECHBOXBR).
 * Permite configurar dinamicamente URL, Chave de API, testar a conectividade e acessar o painel do Flowbox.
 */
export function FiscalConfig() {
  const empresa = useEmpresaStore((s) => s.empresa);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [flowboxUrl, setFlowboxUrl] = React.useState('');
  const [flowboxApiKey, setFlowboxApiKey] = React.useState('');
  const [flowboxWebUrl, setFlowboxWebUrl] = React.useState('');
  const [certificadoId, setCertificadoId] = React.useState('');
  const [showApiKey, setShowApiKey] = React.useState(false);

  // Cadastro fiscal do emitente (V47) — sem ele a SEFAZ responde cStat 209.
  const [inscricaoEstadual, setInscricaoEstadual] = React.useState('');
  const [csc, setCsc] = React.useState('');
  const [cscId, setCscId] = React.useState('');
  const [codigoMunicipio, setCodigoMunicipio] = React.useState('');
  const [crt, setCrt] = React.useState('1');
  const [fiscalAmbiente, setFiscalAmbiente] = React.useState('HOMOLOGACAO');
  const [showCsc, setShowCsc] = React.useState(false);
  const [testResult, setTestResult] = React.useState<TestarConexaoResponse | null>(null);

  // Consulta configuração atual do backend
  const { data: config, isLoading: isLoadingConfig } = useQuery<FiscalConfigData>({
    queryKey: ['fiscal-config'],
    queryFn: async () => {
      const res = await apiClient.get<FiscalConfigData>('/v1/fiscal/config');
      return res.data;
    },
    staleTime: 30_000,
  });

  // Atualiza estados locais ao carregar os dados
  React.useEffect(() => {
    if (config) {
      setFlowboxUrl(config.flowboxUrl || '');
      setFlowboxApiKey(config.flowboxApiKey || '');
      setFlowboxWebUrl(config.flowboxWebUrl || '');
      setCertificadoId(
        config.flowboxCertificadoId === null || config.flowboxCertificadoId === undefined
          ? ''
          : String(config.flowboxCertificadoId)
      );
      setInscricaoEstadual(config.inscricaoEstadual || '');
      setCsc(config.csc || '');
      setCscId(config.cscId || '');
      setCodigoMunicipio(config.codigoMunicipio || '');
      setCrt(config.crt || '1');
      setFiscalAmbiente(config.fiscalAmbiente || 'HOMOLOGACAO');
    }
  }, [config]);

  // Mutation de salvar configuração
  const salvarMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.put<FiscalConfigData>('/v1/fiscal/config', {
        flowboxUrl,
        flowboxApiKey,
        flowboxWebUrl,
        // vazio = preserva o valor atual; 0 = limpa e volta ao certificado padrão da aplicação
        ...(certificadoId.trim() === '' ? {} : { flowboxCertificadoId: Number(certificadoId.trim()) }),
        // Cadastro fiscal: string vazia limpa o campo no backend
        inscricaoEstadual,
        csc,
        cscId,
        codigoMunicipio,
        crt,
        fiscalAmbiente,
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Configurações Fiscais Salvas',
        description: 'Conexão com o Flowbox e cadastro do emitente atualizados.',
      });
      queryClient.invalidateQueries({ queryKey: ['fiscal-config'] });
      queryClient.invalidateQueries({ queryKey: ['dev-info-fiscal'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Erro ao Salvar',
        description: err?.response?.data?.detail || 'Não foi possível salvar as configurações fiscais.',
        variant: 'destructive',
      });
    },
  });

  // Mutation de testar conexão (Ping)
  const testarMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<TestarConexaoResponse>('/v1/fiscal/config/testar-conexao', {
        url: flowboxUrl,
        apiKey: flowboxApiKey,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setTestResult(data);
      if (data.sucesso) {
        toast({
          title: 'Conexão Bem-Sucedida!',
          description: `Flowbox respondeu em ${data.latenciaMs}ms.`,
        });
      } else {
        toast({
          title: 'Falha no Teste de Conexão',
          description: data.mensagem,
          variant: 'destructive',
        });
      }
    },
    onError: (err: any) => {
      const failResp: TestarConexaoResponse = {
        sucesso: false,
        statusHttp: 503,
        latenciaMs: 0,
        mensagem: err?.response?.data?.detail || 'Erro de rede ao disparar teste de conexão.',
        urlTestada: flowboxUrl,
      };
      setTestResult(failResp);
      toast({
        title: 'Erro de Comunicação',
        description: failResp.mensagem,
        variant: 'destructive',
      });
    },
  });

  const isFlowboxActive = config?.active ?? false;
  const targetWebUrl = flowboxWebUrl || (flowboxUrl ? flowboxUrl.replace(':8085', ':5174') : 'http://localhost:5174');

  return (
    <section className="space-y-4 text-xs">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-primary">Painel Módulo Fiscal & Flowbox</h3>
            <p className="text-[11px] text-muted">
              Gerencie a conexão com o Gateway Fiscal e acesse o painel de gestão centralizado
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isFlowboxActive ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="h-3.5 w-3.5" />
              Provedor Flowbox Ativo
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <AlertCircle className="h-3.5 w-3.5" />
              Modo Emulação / Mock
            </span>
          )}

          {targetWebUrl && (
            <a
              href={targetWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-page px-3 py-1.5 text-[11px] font-medium text-primary hover:bg-card transition-colors shadow-sm"
            >
              <ExternalLink className="h-3.5 w-3.5 text-accent" />
              Abrir Painel Flowbox
            </a>
          )}
        </div>
      </div>

      {/* Formulário Interativo de Conexão */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3.5 shadow-sm">
        <div className="flex items-center justify-between border-b border-border/60 pb-2">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <Server className="h-4 w-4 text-accent" />
            <span>Configurações de Conexão com o Microsserviço Flowbox</span>
          </div>
          <span className="text-[10px] text-muted uppercase font-medium">Persistência Dinâmica</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {/* URL da API Flowbox */}
          <div className="space-y-1 sm:col-span-2">
            <label className="text-[11px] font-medium text-primary flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-muted" />
              URL da API Fiscal Flowbox (Backend)
            </label>
            <input
              type="text"
              value={flowboxUrl}
              onChange={(e) => setFlowboxUrl(e.target.value)}
              placeholder="Ex: http://localhost:8085 ou https://api-fiscal.techboxbr.app.br"
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-xs text-primary font-mono placeholder:text-muted/60 focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <p className="text-[10px] text-muted">
              Endereço onde a API Spring Boot do Flowbox processa as assinaturas e autorizações de NFC-e 65 / NF-e 55.
            </p>
          </div>

          {/* Chave de API / Token */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-primary flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5 text-muted" />
              Chave de API (X-Flowbox-Api-Key)
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={flowboxApiKey}
                onChange={(e) => setFlowboxApiKey(e.target.value)}
                placeholder="Insira o token de autenticação da API Flowbox"
                className="w-full rounded-md border border-border bg-input pl-3 pr-9 py-2 text-xs text-primary font-mono placeholder:text-muted/60 focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2.5 top-2.5 text-muted hover:text-primary transition-colors"
                title={showApiKey ? 'Ocultar chave' : 'Exibir chave'}
              >
                {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="text-[10px] text-muted">Token de autorização configurado nos usuários da API Flowbox.</p>
          </div>

          {/* URL do Painel Web do Flowbox */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-primary flex items-center gap-1.5">
              <ExternalLink className="h-3.5 w-3.5 text-muted" />
              URL do Painel Web do Flowbox (Frontend)
            </label>
            <input
              type="text"
              value={flowboxWebUrl}
              onChange={(e) => setFlowboxWebUrl(e.target.value)}
              placeholder="Ex: http://localhost:5174 ou https://flowbox.techboxbr.app.br"
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-xs text-primary font-mono placeholder:text-muted/60 focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <p className="text-[10px] text-muted">Endereço da interface administrativa que você criou para o Flowbox.</p>
          </div>

          {/* Certificado A1 (referência no Flowbox) */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-primary flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-muted" />
              Certificado A1 (ID no Flowbox)
            </label>
            <input
              type="number"
              min={0}
              value={certificadoId}
              onChange={(e) => setCertificadoId(e.target.value)}
              placeholder="Ex: 1"
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-xs text-primary font-mono placeholder:text-muted/60 focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <p className="text-[10px] text-muted">
              Referência do certificado cadastrado no painel do Flowbox — o arquivo A1 e a senha nunca saem de lá.
              Deixe vazio para manter o valor atual ou digite <span className="font-mono">0</span> para voltar ao padrão.
            </p>
          </div>
        </div>

        {/* Feedback do Teste de Conexão */}
        {testResult && (
          <div
            className={`flex items-start gap-2.5 rounded-lg border p-3 ${
              testResult.sucesso
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                : 'border-destructive/30 bg-destructive/10 text-destructive'
            }`}
          >
            {testResult.sucesso ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <XCircle className="h-4 w-4 shrink-0 mt-0.5 text-destructive" />
            )}
            <div className="text-[11px] space-y-0.5 flex-1">
              <div className="flex items-center justify-between font-semibold">
                <span>{testResult.sucesso ? 'Flowbox Online e Respondendo' : 'Falha na Comunicação com Flowbox'}</span>
                {testResult.latenciaMs > 0 && (
                  <span className="font-mono text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded">
                    ⚡ {testResult.latenciaMs}ms
                  </span>
                )}
              </div>
              <p className="text-secondary leading-relaxed">{testResult.mensagem}</p>
              <p className="text-[10px] font-mono text-muted truncate">URL testada: {testResult.urlTestada}</p>
            </div>
          </div>
        )}

        {/* Botões de Ação do Painel */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/50">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => testarMutation.mutate()}
            disabled={testarMutation.isPending || !flowboxUrl}
            className="gap-1.5 text-xs font-medium"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-accent ${testarMutation.isPending ? 'animate-spin' : ''}`} />
            {testarMutation.isPending ? 'Testando Conexão...' : 'Testar Conexão (Ping)'}
          </Button>

          <div className="flex items-center gap-2">
            {targetWebUrl && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => window.open(targetWebUrl, '_blank')}
                className="gap-1.5 text-xs font-medium"
              >
                <ExternalLink className="h-3.5 w-3.5 text-muted" />
                Acessar Flowbox
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              onClick={() => salvarMutation.mutate()}
              disabled={salvarMutation.isPending}
              className="gap-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Save className="h-3.5 w-3.5" />
              {salvarMutation.isPending ? 'Salvando...' : 'Salvar Configurações'}
            </Button>
          </div>
        </div>
      </div>

      {/* Cadastro fiscal do emitente (V47) */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3.5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>Cadastro Fiscal do Emitente</span>
          </div>
          <span className="text-[10px] text-muted uppercase font-medium">Obrigatório para autorizar</span>
        </div>

        {!inscricaoEstadual.trim() && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-700 dark:text-amber-400">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              Inscrição Estadual ainda não cadastrada. Sem ela a SEFAZ rejeita a emissão com{' '}
              <strong>cStat 209 — IE do emitente inválida</strong>.
            </span>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {/* Inscrição Estadual */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-primary flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-muted" />
              Inscrição Estadual
            </label>
            <input
              type="text"
              value={inscricaoEstadual}
              onChange={(e) => setInscricaoEstadual(e.target.value)}
              placeholder="Ex: 11222333444"
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-xs text-primary font-mono placeholder:text-muted/60 focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <p className="text-[10px] text-muted">
              IE real do CNPJ na SEFAZ da UF. A cadeia não vale um valor inventado: a SEFAZ confere contra o cadastro.
            </p>
          </div>

          {/* CRT */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-primary flex items-center gap-1.5">
              <Server className="h-3.5 w-3.5 text-muted" />
              Regime Tributário (CRT)
            </label>
            <select
              value={crt}
              onChange={(e) => setCrt(e.target.value)}
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-xs text-primary focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="1">1 — Simples Nacional</option>
              <option value="2">2 — Lucro Presumido</option>
              <option value="3">3 — Lucro Real</option>
            </select>
            <p className="text-[10px] text-muted">Define o grupo de ICMS (CSOSN para 1, CST para 2/3).</p>
          </div>

          {/* Código do Município */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-primary flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-muted" />
              Código do Município (IBGE)
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={7}
              value={codigoMunicipio}
              onChange={(e) => setCodigoMunicipio(e.target.value.replace(/\D/g, ''))}
              placeholder="Ex: 3550308 (São Paulo)"
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-xs text-primary font-mono placeholder:text-muted/60 focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <p className="text-[10px] text-muted">7 dígitos do município gerador do cMunFG.</p>
          </div>

          {/* Ambiente da SEFAZ */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-primary flex items-center gap-1.5">
              <Server className="h-3.5 w-3.5 text-muted" />
              Ambiente da SEFAZ
            </label>
            <select
              value={fiscalAmbiente}
              onChange={(e) => setFiscalAmbiente(e.target.value)}
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-xs text-primary focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="HOMOLOGACAO">HOMOLOGACAO (testes)</option>
              <option value="PRODUCAO">PRODUCAO (nota válida)</option>
            </select>
            <p className="text-[10px] text-muted">
              Só troque para PRODUCAO com certificado A1 válido e cadastro conferido na SEFAZ.
            </p>
          </div>

          {/* CSC */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-primary flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5 text-muted" />
              CSC — Código de Segurança (NFC-e)
            </label>
            <div className="relative">
              <input
                type={showCsc ? 'text' : 'password'}
                value={csc}
                onChange={(e) => setCsc(e.target.value)}
                placeholder="CSC emitido no portal da NF-e da UF"
                className="w-full rounded-md border border-border bg-input pl-3 pr-9 py-2 text-xs text-primary font-mono placeholder:text-muted/60 focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <button
                type="button"
                onClick={() => setShowCsc(!showCsc)}
                className="absolute right-2.5 top-2.5 text-muted hover:text-primary transition-colors"
                title={showCsc ? 'Ocultar CSC' : 'Exibir CSC'}
              >
                {showCsc ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="text-[10px] text-muted">Entra no hash do QR Code; um CSC errado rejeita a nota.</p>
          </div>

          {/* CSC ID */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-primary flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5 text-muted" />
              CSC ID
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={cscId}
              onChange={(e) => setCscId(e.target.value.replace(/\D/g, ''))}
              placeholder="Ex: 1"
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-xs text-primary font-mono placeholder:text-muted/60 focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <p className="text-[10px] text-muted">
              Número do CSC no portal. Vai para o XML <span className="font-mono">sem zero à esquerda</span>.
            </p>
          </div>
        </div>
      </div>

      {/* Como funciona o Certificado A1 */}
      <div className="rounded-xl border border-border bg-page p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <Key className="h-4 w-4 text-amber-500" />
            <span>Gestão do Certificado Digital A1 (.pfx)</span>
          </div>
          {targetWebUrl && (
            <a
              href={targetWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-accent hover:underline inline-flex items-center gap-1 font-medium"
            >
              Configurar no Flowbox <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <p className="text-secondary leading-relaxed">
          Na arquitetura do ecossistema <strong className="text-primary">TECHBOXBR</strong>, os certificados digitais A1 são gerenciados centralizadamente no microsserviço <strong className="text-primary">Flowbox</strong>.
        </p>
        <div className="grid gap-2 sm:grid-cols-2 pt-1">
          <div className="rounded-lg border border-border bg-card p-2.5">
            <span className="font-semibold text-primary flex items-center gap-1.5 mb-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Isolamento do Certificado
            </span>
            <p className="text-[11px] text-muted">
              O arquivo <code className="text-primary font-mono">.pfx</code> e sua senha nunca ficam expostos no navegador ou nos caixas locais, prevenindo clonagem e vazamento.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-2.5">
            <span className="font-semibold text-primary flex items-center gap-1.5 mb-1">
              <Zap className="h-3.5 w-3.5 text-amber-500" /> Assinatura e Autorização
            </span>
            <p className="text-[11px] text-muted">
              O Flowbox assina o XML, autoriza na SEFAZ e devolve o protocolo com DANFE e QR-Code para impressão térmica instantânea no PDV do VisionBox.
            </p>
          </div>
        </div>
      </div>

      {/* Dados Fiscais da Empresa Atual */}
      <div className="space-y-2">
        <h4 className="font-semibold text-primary flex items-center gap-1.5">
          <Server className="h-3.5 w-3.5 text-muted" />
          Parâmetros Fiscais da Loja Atual (Banco de Dados)
        </h4>
        <dl className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-2.5">
            <dt className="text-[10px] text-muted uppercase font-medium">Razão Social</dt>
            <dd className="text-xs font-semibold text-primary mt-0.5 truncate">
              {empresa?.nome || 'Não cadastrada'}
            </dd>
          </div>
          <div className="rounded-lg border border-border bg-card p-2.5">
            <dt className="text-[10px] text-muted uppercase font-medium">CNPJ Emitente</dt>
            <dd className="font-mono text-xs font-semibold text-primary mt-0.5">
              {empresa?.cnpj
                ? empresa.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
                : 'Pendente de cadastro'}
            </dd>
          </div>
          <div className="rounded-lg border border-border bg-card p-2.5">
            <dt className="text-[10px] text-muted uppercase font-medium">Provedor Ativo no Boot</dt>
            <dd className="text-xs font-semibold text-primary mt-0.5">
              {isFlowboxActive ? 'FlowboxFiscalProvider (Ativo)' : 'MockFiscalProvider (Emulação)'}
            </dd>
          </div>
        </dl>
      </div>

      {/* NCMs e Regras Óticas */}
      <div className="rounded-xl border border-border bg-card p-3 space-y-2 shadow-sm">
        <h4 className="font-semibold text-primary flex items-center gap-1.5">
          <HelpCircle className="h-3.5 w-3.5 text-blue-500" />
          Regras de Tributação e NCMs do Setor Óptico (Referência)
        </h4>
        <div className="space-y-1.5 text-[11px] text-secondary">
          <div className="flex justify-between border-b border-border/50 pb-1">
            <span>
              <strong>Armações para Óculos:</strong> NCM{' '}
              <code className="font-mono text-primary font-semibold">9003.11.00</code> /{' '}
              <code className="font-mono text-primary font-semibold">9003.19.00</code>
            </span>
            <span className="text-muted">CFOP 5.102 / 5.405</span>
          </div>
          <div className="flex justify-between border-b border-border/50 pb-1">
            <span>
              <strong>Óculos de Sol:</strong> NCM{' '}
              <code className="font-mono text-primary font-semibold">9004.10.00</code>
            </span>
            <span className="text-muted">CFOP 5.102</span>
          </div>
          <div className="flex justify-between">
            <span>
              <strong>Lentes Oftálmicas de Contato/Visão:</strong> NCM{' '}
              <code className="font-mono text-primary font-semibold">9001.40.00</code> /{' '}
              <code className="font-mono text-primary font-semibold">9001.50.00</code>
            </span>
            <span className="text-muted">CFOP 5.102</span>
          </div>
        </div>
      </div>

      {/* Contingência Offline */}
      <div className="flex items-start gap-2.5 rounded-xl border border-border bg-card p-3 text-secondary shadow-sm">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-muted" />
        <div className="text-[11px] space-y-0.5">
          <p className="font-semibold text-primary">Contingência Offline no PDV</p>
          <p className="text-muted">
            Se a internet ou o serviço fiscal estiver indisponível, o PDV do VisionBox permite concluir vendas normalmente.
            As notas são enfileiradas no outbox para transmissão assim que o serviço for restabelecido.
          </p>
        </div>
      </div>
    </section>
  );
}
