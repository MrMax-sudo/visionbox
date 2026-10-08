import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Glasses,
  Hash,
  History,
  MapPin,
  Package,
  Printer,
  Search,
  ShieldCheck,
  Store,
  WifiOff,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { cn } from '@/lib/utils';
import { statusLabel, statusClass, type StatusOS } from '@/lib/osStatus';
import {
  buscarRastreioPorNumero,
  extrairTokenColado,
  fetchRastreioPorToken,
  mensagemRastreio,
  normalizarNumero,
  rastreioUrl,
  validarNumero,
  type RastreioOS,
} from '@/lib/rastreioApi';
import { registerPortalServiceWorker, syncThemeColorMeta, useInstallPrompt } from '@/lib/pwa';
import { sanitizeWhatsApp } from '@/stores/empresaStore';
import { useOnline } from '@/hooks/useOnline';
import { ApiError } from '@/lib/apiClient';

/**
 * Portal do Cliente (US17) — rastreio público da OS + 2ª via de garantia.
 *
 * Rota pública fora do layout autenticado (padrão /lab/:token), lazy-loaded no App.tsx.
 * Estados completos: idle/busca, loading, vazio (OS não encontrada), erro, offline.
 * Cores apenas via tokens (--color-*) / classes .status-* (R5).
 */

const FLUXO_OS = [
  'ORCAMENTO',
  'PEDIDO_CONFIRMADO',
  'ENVIADO_LABORATORIO',
  'EM_PRODUCAO',
  'LENTE_PRONTA',
  'MONTAGEM',
  'CONTROLE_QUALIDADE',
  'PRONTO_PARA_RETIRADA',
  'ENTREGUE',
] as const;

const STATUS_TERMINAIS = new Set<string>(['ENTREGUE', 'CANCELADO']);

function fmtData(value?: string | null, comHora = false): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR', comHora ? { dateStyle: 'short', timeStyle: 'short' } : { dateStyle: 'short' });
}

function labelStatus(status?: string): string {
  if (!status) return '—';
  return statusLabel[status as StatusOS] ?? status.replace(/_/g, ' ');
}

function classeStatus(status?: string): string {
  return statusClass[status as StatusOS] ?? 'status-orcamento';
}

function atrasada(dados: RastreioOS): boolean {
  if (!dados.previsaoEntrega || STATUS_TERMINAIS.has(dados.statusAtual ?? '')) return false;
  return new Date(dados.previsaoEntrega).getTime() < Date.now();
}

function tipoErro(err: unknown): 'nao-encontrada' | 'expirado' | 'outro' {
  const status = err instanceof ApiError ? err.status : undefined;
  if (status === 404) return 'nao-encontrada';
  if (status === 410) return 'expirado';
  return 'outro';
}

/* ────────────────────────────── shell / chrome ────────────────────────────── */

function PortalOffline() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--color-danger-light)] bg-[var(--color-danger-light)] px-3 py-2 text-sm text-[var(--color-danger-dark)]"
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
      <span className="font-medium">Sem conexão — exibindo a última atualização carregada.</span>
    </div>
  );
}

function PortalHeader({ numeroOs }: { numeroOs?: string }) {
  const { canInstall, instalando, install } = useInstallPrompt();
  return (
    <header className="border-b border-[var(--color-border)] bg-[var(--color-bg-card)]">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
        <Link to="/rastreio" className="flex min-w-0 items-center gap-3" aria-label="Portal do Cliente VisionBox — nova busca">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-light)] text-[var(--color-primary)]">
            <Glasses className="h-6 w-6" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-[var(--color-text-primary)]">Portal do Cliente</span>
            <span className="block truncate text-xs text-[var(--color-text-secondary)]">Rastreio da sua Ordem de Serviço</span>
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          {numeroOs && (
            <span className="hidden rounded-full border border-[var(--color-border)] px-2.5 py-1 font-mono text-xs text-[var(--color-text-secondary)] sm:inline-flex">
              OS {numeroOs}
            </span>
          )}
          {canInstall && (
            <Button variant="outline" size="sm" onClick={() => void install()} disabled={instalando} aria-label="Instalar aplicativo do portal">
              <Download className="mr-1.5 h-4 w-4" /> Instalar app
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

function PortalFooter() {
  return (
    <footer className="mx-auto max-w-4xl px-4 py-6 text-center text-xs text-[var(--color-text-muted)] sm:px-6">
      <img src="/assets/icons/icon-192.png" alt="" aria-hidden className="mx-auto mb-2 h-8 w-8 rounded-lg" />
      <p>Portal oficial de rastreio • dados atualizados pela ótica responsável pelo seu pedido.</p>
      <p className="mt-1">VisionBox — um novo olhar em gestão.</p>
    </footer>
  );
}

/* ────────────────────────────── blocos de status ────────────────────────────── */

function CardResumo({ label, children, icon: Icon }: { label: string; children: React.ReactNode; icon: React.ElementType }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-light)] text-[var(--color-primary)]">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <span className="block text-[11px] uppercase text-[var(--color-text-muted)]">{label}</span>
          <div className="mt-0.5 truncate text-sm font-semibold text-[var(--color-text-primary)]">{children}</div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Semáforo do status atual — mesma lógica de cor do painel interno (classes .status-*). */
function SemaforoStatus({ status }: { status?: string }) {
  return (
    <span className={`badge ${classeStatus(status)} inline-flex rounded-full px-2.5 py-1 text-xs font-semibold`}>
      {labelStatus(status)}
    </span>
  );
}

/** Etapas canônicas da OS (12 status da máquina) — concluída/atual/pendente. */
function EtapasPedido({ status }: { status?: string }) {
  if (status === 'CANCELADO') {
    return (
      <div
        role="status"
        className="flex items-start gap-2 rounded-[var(--radius)] border border-[var(--color-danger-light)] bg-[var(--color-danger-light)] px-3 py-2.5 text-sm text-[var(--color-danger-dark)]"
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>Esta OS foi cancelada. Fale com a ótica para mais informações.</span>
      </div>
    );
  }

  // Status fora do fluxo canônico (ex.: RETRABALHO vindo do painel interno):
  // não marcamos nenhuma etapa como "atual" para não mentir ao cliente — o semáforo
  // do resumo acima continua mostrando o status real.
  const idxAtual = FLUXO_OS.indexOf((status ?? 'ORCAMENTO') as (typeof FLUXO_OS)[number]);
  const foraDoFluxo = idxAtual === -1 && status !== undefined;
  const atualIdx = idxAtual;

  return (
    <div className="space-y-3">
      {foraDoFluxo && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--color-warning-light)] bg-[var(--color-warning-light)] px-3 py-2 text-xs font-medium text-[var(--color-warning-dark)]"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          Seu pedido está em etapa especial de reanálise. Fale com a ótica para detalhes.
        </p>
      )}
      <ol className="space-y-0">
      {FLUXO_OS.map((etapa, idx) => {
        const concluida = idx < atualIdx;
        const atual = idx === atualIdx;
        return (
          <li key={etapa} className="relative flex gap-3 pb-4 last:pb-0">
            {idx < FLUXO_OS.length - 1 && (
              <span
                aria-hidden
                className={`absolute left-[9px] top-5 h-[calc(100%-14px)] w-px ${concluida ? 'bg-[var(--color-success)]' : 'bg-[var(--color-border)]'}`}
              />
            )}
            <span
              aria-hidden
              className={[
                'relative z-10 mt-0.5 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border-2',
                concluida
                  ? 'border-[var(--color-success)] bg-[var(--color-success)] text-[var(--color-text-on-primary)]'
                  : atual
                    ? `border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)]`
                    : 'border-[var(--color-border)] bg-[var(--color-bg-card)]',
              ].join(' ')}
            >
              {concluida && <CheckCircle2 className="h-3 w-3" aria-hidden />}
              {atual && <span className="h-2 w-2 rounded-full bg-[var(--color-primary)]" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`text-sm ${atual ? 'font-semibold text-[var(--color-text-primary)]' : concluida ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-muted)]'}`}>
                {labelStatus(etapa)}
              </span>
              {atual && (
                <span className="mt-1 block">
                  <SemaforoStatus status={status} />
                </span>
              )}
            </span>
            {atual && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-primary)]" aria-label="Etapa atual" />}
          </li>
        );
      })}
      </ol>
    </div>
  );
}

function TimelineOs({ eventos }: { eventos: NonNullable<RastreioOS['timeline']> }) {
  if (eventos.length === 0) {
    return (
      <p className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
        Ainda não há movimentações registradas. A ótica atualiza esta timeline a cada etapa do pedido.
      </p>
    );
  }

  const ordenados = [...eventos].sort((a, b) => {
    const ta = a.dataHora ? new Date(a.dataHora).getTime() : 0;
    const tb = b.dataHora ? new Date(b.dataHora).getTime() : 0;
    return ta - tb;
  });

  return (
    <div className="relative pl-6">
      <span aria-hidden className="absolute left-[7px] top-2 h-[calc(100%-16px)] w-px bg-[var(--color-border)]" />
      {ordenados.map((ev, index) => {
        const ultimo = index === ordenados.length - 1;
        return (
          <div key={ev.id ?? `${ev.dataHora ?? ''}-${index}`} className="relative pb-5 last:pb-0">
            <span
              aria-hidden
              className={`absolute -left-1 top-1 h-3 w-3 rounded-full border-2 border-[var(--color-bg-card)] ${
                ultimo ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border-strong)]'
              }`}
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] text-[var(--color-text-muted)]">{fmtData(ev.dataHora, true)}</span>
              <span className={`badge ${classeStatus(ev.statusNovo)} rounded-full px-2 py-0.5 text-[11px]`}>
                {labelStatus(ev.statusNovo)}
              </span>
            </div>
            {ev.observacao && <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{ev.observacao}</p>}
          </div>
        );
      })}
    </div>
  );
}

function CardOptica({ optica }: { optica?: RastreioOS['optica'] }) {
  const whats = sanitizeWhatsApp(optica?.whatsapp ?? optica?.telefone);
  const nome = optica?.nome?.trim() || 'Ótica parceira VisionBox';
  const endereco = [optica?.endereco, optica?.cidade && optica?.uf ? `${optica.cidade}/${optica.uf}` : optica?.cidade]
    .filter(Boolean)
    .join(' — ');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Store className="h-4 w-4 text-[var(--color-primary)]" aria-hidden /> Ótica responsável
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-start gap-2">
          <Glasses className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-secondary)]" aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold text-[var(--color-text-primary)]">{nome}</p>
            {optica?.cnpj && <p className="font-mono text-xs text-[var(--color-text-muted)]">CNPJ {optica.cnpj}</p>}
          </div>
        </div>

        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-secondary)]" aria-hidden />
          <p className="min-w-0 text-xs text-[var(--color-text-secondary)]">
            {endereco || <span className="text-[var(--color-text-muted)]">Endereço não informado.</span>}
          </p>
        </div>

        <div className="flex items-start gap-2">
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-secondary)]" aria-hidden />
          <p className="min-w-0 text-xs text-[var(--color-text-secondary)]">
            {optica?.telefone || optica?.whatsapp ? (
              (optica?.whatsapp ?? optica?.telefone)
            ) : (
              <span className="text-[var(--color-text-muted)]">Telefone não informado.</span>
            )}
          </p>
        </div>

        {whats && (
          <a
            href={`https://wa.me/${whats}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Falar com a ótica ${nome} pelo WhatsApp`}
            className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'w-full')}
          >
            <ExternalLink className="mr-2 h-4 w-4" /> Falar com a ótica
          </a>
        )}
      </CardContent>
    </Card>
  );
}

function CardGarantia({ garantia }: { garantia?: RastreioOS['garantia'] }) {
  const itens = garantia?.itens ?? [];
  const temDados = Boolean(garantia?.dataCompra || garantia?.validadeMeses || itens.length > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <ShieldCheck className="h-4 w-4 text-[var(--color-success)]" aria-hidden /> 2ª via da garantia
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!temDados ? (
          <p className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] px-3 py-6 text-center text-xs text-[var(--color-text-muted)]">
            A 2ª via da garantia aparecerá aqui assim que a ótica registrar a compra deste pedido.
          </p>
        ) : (
          <>
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--color-text-secondary)]">Data da compra</dt>
                <dd className="font-semibold text-[var(--color-text-primary)]">{fmtData(garantia?.dataCompra)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--color-text-secondary)]">Garantia</dt>
                <dd className="font-semibold text-[var(--color-text-primary)]">
                  {garantia?.validadeMeses ? `${garantia.validadeMeses} meses` : 'conforme item'}
                </dd>
              </div>
            </dl>

            {itens.length > 0 && (
              <ul className="divide-y divide-[var(--color-border)] rounded-[var(--radius)] border border-[var(--color-border)]">
                {itens.map((item, idx) => (
                  <li key={idx} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
                    <span className="min-w-0 text-[var(--color-text-primary)]">
                      {item.descricao ?? 'Item do pedido'}
                      {item.quantidade && item.quantidade > 1 ? ` • ${item.quantidade}x` : ''}
                    </span>
                    <span className="shrink-0 text-[var(--color-text-muted)]">
                      {item.validade ? `válida até ${fmtData(item.validade)}` : item.garantiaMeses ? `${item.garantiaMeses} meses` : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <Button variant="outline" size="sm" className="w-full" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" /> Imprimir 2ª via
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ────────────────────────────── visão completa ────────────────────────────── */

function RastreioView({ dados }: { dados: RastreioOS }) {
  const [copiado, setCopiado] = React.useState(false);
  const numero = dados.numeroOs ?? '—';
  const atraso = atrasada(dados);
  const eventos = dados.timeline ?? [];
  const produto = dados.produtoResumo ?? [dados.armacaoNome, dados.lenteNome].filter(Boolean).join(' + ');

  async function copiarNumero() {
    try {
      await navigator.clipboard.writeText(numero);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* clipboard indisponível — o número já está visível na tela */
    }
  }

  return (
    <div className="space-y-4">
      {/* Resumo / semáforo */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <span className="block text-[11px] uppercase text-[var(--color-text-muted)]">Status atual</span>
            <div className="mt-1.5">
              <SemaforoStatus status={dados.statusAtual} />
            </div>
          </CardContent>
        </Card>

        <CardResumo label="Previsão de entrega" icon={CalendarDays}>
          {dados.previsaoEntrega ? (
            <span className={atraso ? 'text-[var(--color-danger-dark)]' : undefined}>{fmtData(dados.previsaoEntrega)}</span>
          ) : (
            <span className="text-[var(--color-text-muted)]">A definir</span>
          )}
          {atraso && <span className="ml-2 rounded bg-[var(--color-danger-light)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-danger-dark)]">atrasada</span>}
        </CardResumo>

        <CardResumo label="Abertura do pedido" icon={Clock3}>
          {fmtData(dados.dataAbertura)}
        </CardResumo>

        <CardResumo label="Número da OS" icon={Hash}>
          <span className="flex items-center gap-1.5">
            <span className="font-mono">{numero}</span>
            {dados.numeroOs && (
              <button
                type="button"
                onClick={() => void copiarNumero()}
                className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                aria-label="Copiar número da OS"
              >
                {copiado ? <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-success)]" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            )}
          </span>
        </CardResumo>
      </div>

      {(dados.clientePrimeiroNome || produto) && (
        <p className="text-xs text-[var(--color-text-secondary)]">
          {dados.clientePrimeiroNome && (
            <>
              Olá, <span className="font-semibold text-[var(--color-text-primary)]">{dados.clientePrimeiroNome}</span>
            </>
          )}
          {produto ? `${dados.clientePrimeiroNome ? ' — ' : ''}${produto}` : ''}. Acompanhe cada etapa abaixo.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Package className="h-4 w-4 text-[var(--color-primary)]" aria-hidden /> Etapas do pedido
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EtapasPedido status={dados.statusAtual} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <History className="h-4 w-4 text-[var(--color-secondary)]" aria-hidden /> Histórico de movimentações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TimelineOs eventos={eventos} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <CardOptica optica={dados.optica} />
          <CardGarantia garantia={dados.garantia} />
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────── estados ────────────────────────────── */

function RastreioSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando rastreio">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-20 w-full rounded-[var(--radius-card)]" />
        <Skeleton className="h-20 w-full rounded-[var(--radius-card)]" />
        <Skeleton className="h-20 w-full rounded-[var(--radius-card)]" />
        <Skeleton className="h-20 w-full rounded-[var(--radius-card)]" />
      </div>
      <Skeleton className="h-64 w-full rounded-[var(--radius-card)]" />
    </div>
  );
}

function RastreioErro({ error, onRetry, onNovaBusca }: { error: unknown; onRetry: () => void; onNovaBusca?: () => void }) {
  const tipo = tipoErro(error);

  if (tipo === 'nao-encontrada' || tipo === 'expirado') {
    return (
      <EmptyState
        icon={tipo === 'expirado' ? AlertTriangle : Search}
        title={tipo === 'expirado' ? 'Link de rastreio expirado' : 'OS não encontrada'}
        description={
          tipo === 'expirado'
            ? 'Este link expirou por segurança. Peça um novo na ótica ou informe o número da OS para gerar outra consulta.'
            : 'Confira o número informado ou fale com a ótica. Se você recebeu um link de rastreio, ele pode ter expirado.'
        }
        action={
          onNovaBusca ? (
            <Button variant="primary" size="sm" onClick={onNovaBusca}>
              <Search className="mr-2 h-4 w-4" /> Nova busca
            </Button>
          ) : undefined
        }
      />
    );
  }

  return <ErrorState error={new ApiError(mensagemRastreio(error), error instanceof ApiError ? error.status : undefined)} onRetry={onRetry} />;
}

/* ────────────────────────────── busca por número ────────────────────────────── */

function BuscaOS() {
  const navigate = useNavigate();
  const online = useOnline();
  const [valor, setValor] = React.useState('');
  const [erroCampo, setErroCampo] = React.useState<string | null>(null);
  const [consulta, setConsulta] = React.useState<string | null>(null);
  const [nonce, setNonce] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const busca = useQuery({
    queryKey: ['rastreio-busca', consulta, nonce],
    queryFn: () => buscarRastreioPorNumero(consulta!),
    enabled: !!consulta,
    retry: false,
    staleTime: 0,
  });

  React.useEffect(() => {
    const token = busca.data?.token;
    if (token) navigate(rastreioUrl(token), { replace: true });
  }, [busca.data, navigate]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const bruto = valor.trim();
    const colado = extrairTokenColado(bruto);
    if (colado) {
      navigate(rastreioUrl(colado));
      return;
    }
    // Token "solto" colado da URL (token opaco longo não é um número de OS válido)
    if (bruto.length > 40 && /^[A-Za-z0-9_.\-]+$/.test(bruto)) {
      navigate(rastreioUrl(bruto));
      return;
    }
    const erro = validarNumero(valor);
    setErroCampo(erro);
    if (erro) return;
    setNonce((n) => n + 1);
    setConsulta(normalizarNumero(valor));
  }

  const resultadoOrdem = consulta && !busca.data?.token ? busca.data?.ordem : undefined;
  const carregando = busca.isFetching && !resultadoOrdem;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-8 sm:px-6">
      <section className="space-y-2 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary-light)] text-[var(--color-primary)]">
          <Glasses className="h-8 w-8" aria-hidden />
        </span>
        <h1 className="text-xl font-bold text-[var(--color-text-primary)] sm:text-2xl">Acompanhe seu pedido</h1>
        <p className="mx-auto max-w-md text-sm text-[var(--color-text-secondary)]">
          Informe o número da OS (está no comprovante da sua compra) para ver as etapas, a previsão de entrega e a garantia.
        </p>
      </section>

      <Card>
        <CardContent className="p-5">
          <form onSubmit={handleSubmit} noValidate className="space-y-3">
            <label htmlFor="numero-os" className="block text-xs font-semibold text-[var(--color-text-secondary)]">
              Número da Ordem de Serviço
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="numero-os"
                ref={inputRef}
                name="numero-os"
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="Ex.: OS-2026-00123"
                value={valor}
                onChange={(e) => {
                  setValor(e.target.value);
                  if (erroCampo) setErroCampo(null);
                }}
                aria-invalid={!!erroCampo}
                aria-describedby={erroCampo ? 'numero-os-erro' : undefined}
                className={erroCampo ? 'border-[var(--color-danger)] focus-visible:border-[var(--color-danger)]' : undefined}
              />
              <Button type="submit" variant="primary" disabled={carregando} className="sm:w-auto">
                {carregando ? <Search className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Consultar
              </Button>
            </div>
            {erroCampo && (
              <p id="numero-os-erro" role="alert" className="text-xs font-medium text-[var(--color-danger-dark)]">
                {erroCampo}
              </p>
            )}
            {!online && (
              <p className="text-xs text-[var(--color-danger-dark)]">Sem conexão — a consulta será feita quando a rede voltar.</p>
            )}
          </form>
        </CardContent>
      </Card>

      {!consulta && !carregando && (
        <EmptyState
          icon={FileText}
          title="Pronto para consultar"
          description="Digite o número da OS acima. Você também pode colar o link de rastreio recebido pelo WhatsApp."
        />
      )}

      {carregando && <RastreioSkeleton />}

      {busca.isError && consulta && !carregando && (
        <RastreioErro
          error={busca.error}
          onRetry={() => void busca.refetch()}
          onNovaBusca={() => {
            setConsulta(null);
            setValor('');
            inputRef.current?.focus();
          }}
        />
      )}

      {resultadoOrdem && (
        <div className="space-y-3">
          <RastreioView dados={resultadoOrdem} />
          <div className="text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setConsulta(null);
                setValor('');
                inputRef.current?.focus();
              }}
            >
              Consultar outra OS
            </Button>
          </div>
        </div>
      )}

      {/* Resposta sem token e sem OS: contrato do backend não cumprido (ver rastreioApi.ts) */}
      {consulta && !busca.isFetching && !busca.isError && busca.data && !busca.data.token && !busca.data.ordem && (
        <ErrorState
          error={new ApiError('O servidor não devolveu dados de rastreio. Tente novamente em instantes.')}
          onRetry={() => void busca.refetch()}
        />
      )}
    </div>
  );
}

/* ────────────────────────────── rastreio por token ────────────────────────────── */

function RastreioPorToken({ token }: { token: string }) {
  const navigate = useNavigate();
  const online = useOnline();

  const query = useQuery({
    queryKey: ['rastreio-token', token],
    queryFn: () => fetchRastreioPorToken(token),
    retry: 1,
    staleTime: 15_000,
    refetchOnReconnect: true,
  });

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-6 sm:px-6">
      <PortalOffline />

      {query.isLoading && <RastreioSkeleton />}

      {!query.isLoading && query.isError && (
        <RastreioErro
          error={query.error}
          onRetry={() => void query.refetch()}
          onNovaBusca={() => navigate('/rastreio', { replace: true })}
        />
      )}

      {!query.isLoading && !query.isError && query.data && (
        <>
          <RastreioView dados={query.data} />
          {!online && (
            <p className="text-center text-xs text-[var(--color-text-muted)]">
              Sem conexão — dados da última atualização. Atualize quando a rede voltar.
            </p>
          )}
          <div className="text-center">
            <Button variant="ghost" size="sm" onClick={() => navigate('/rastreio', { replace: true })}>
              <Search className="mr-2 h-4 w-4" /> Consultar outra OS
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/* ────────────────────────────── página ────────────────────────────── */

export default function RastreioPortal() {
  const { token } = useParams<{ token: string }>();

  React.useEffect(() => {
    const prev = document.title;
    document.title = 'Rastreio de OS — Portal do Cliente VisionBox';
    const cleanupMeta = syncThemeColorMeta();
    registerPortalServiceWorker();
    return () => {
      document.title = prev;
      cleanupMeta();
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg-page)]">
      <PortalHeader />
      <main className="flex-1">
        {token ? <RastreioPorToken token={token} /> : <BuscaOS />}
      </main>
      <PortalFooter />
    </div>
  );
}
