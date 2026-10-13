import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Banknote,
  CreditCard,
  HandCoins,
  Plus,
  ReceiptText,
  RefreshCw,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { ControleCaixaModal } from '@/components/caixa/ControleCaixaModal';
import { BaixaContaModal } from '@/components/financeiro/BaixaContaModal';
import { ContaPagarFormModal } from '@/components/financeiro/ContaPagarFormModal';
import { ContasTable } from '@/components/financeiro/ContasTable';
import { DrePanel } from '@/components/financeiro/DrePanel';
import { FinanceiroFilters } from '@/components/financeiro/FinanceiroFilters';
import { FornecedorPanel } from '@/components/financeiro/FornecedorPanel';
import { MetricCard } from '@/components/financeiro/MetricCard';
import { useFinanceiroTotais } from '@/components/financeiro/queries';
import {
  actionErrorMessage,
  dataBR,
  emAberto,
  isVencida,
  mesAtualRange,
  money,
  noPeriodo,
  somarSaldo,
  type AbaFinanceiro,
  type ContaPagarDTO,
  type ContaReceberDTO,
  type DreDTO,
  type TipoConta,
} from '@/components/financeiro/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { InlineLoading } from '@/components/ui/loading-state';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { apiClient } from '@/lib/apiClient';
import { unwrapPage, type PageResponse } from '@/lib/types';

/** Pageable do backend: página única ampla para totais e filtro de período. */
const PAGE_SIZE = 100;

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-1.5 rounded-full bg-page px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-secondary">
      {children}
    </span>
  );
}

/**
 * Financeiro — hub unificado de contas (Fase 3 Robustez §3.3).
 *
 * Toggle no topo [ A Receber ] vs [ A Pagar ] + crediário, fornecedores e DRE.
 * Métricas §3.3 (Total a Receber/Pagar no mês, Vencidos até hoje, Saldo
 * Projetado) calculadas do que a API retorna — sem dado inventado. Baixa
 * parcial com Idempotency-Key via modal (V41: campos Desconto/Juros — o que
 * quita é valorPago + desconto; juros entram no caixa sem abater o título);
 * histórico de baixas na expansão da linha (GET /{id}/pagamentos). Endpoints:
 *   GET  /v1/financeiro/contas-{receber|pagar}  (page/size/status)
 *   GET  /v1/financeiro/dre/mes-atual · GET /v1/financeiro/dre?inicio&fim
 *   GET  /v1/financeiro/totais?dataInicio&dataFim (V41 — métricas SUM no banco)
 *   POST /v1/financeiro/contas-{receber|pagar}/{id}/cancelar
 */
export default function Financeiro() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [tab, setTab] = React.useState<AbaFinanceiro>('receber');
  const [caixaOpen, setCaixaOpen] = React.useState(false);
  const [novaContaPagarOpen, setNovaContaPagarOpen] = React.useState(false);
  const [baixa, setBaixa] = React.useState<{
    tipo: TipoConta;
    conta: ContaReceberDTO;
  } | null>(null);
  const [status, setStatus] = React.useState('');
  const [de, setDe] = React.useState('');
  const [ate, setAte] = React.useState('');

  /* ----------------------------- Queries ----------------------------- */

  const contasQuery = useQuery({
    queryKey: ['financeiro', 'contas-receber', status],
    queryFn: async () => {
      const res = await apiClient.get<PageResponse<ContaReceberDTO> | ContaReceberDTO[]>(
        '/v1/financeiro/contas-receber',
        { params: { page: 0, size: PAGE_SIZE, ...(status ? { status } : {}) } },
      );
      return res.data;
    },
    staleTime: 30_000,
    retry: 1,
  });

  const contasPagarQuery = useQuery({
    queryKey: ['financeiro', 'contas-pagar', status],
    queryFn: async () => {
      const res = await apiClient.get<PageResponse<ContaPagarDTO> | ContaPagarDTO[]>(
        '/v1/financeiro/contas-pagar',
        { params: { page: 0, size: PAGE_SIZE, ...(status ? { status } : {}) } },
      );
      return res.data;
    },
    staleTime: 30_000,
    retry: 1,
  });

  const dreQuery = useQuery({
    queryKey: ['financeiro', 'dre', 'mes-atual'],
    queryFn: async () => {
      const res = await apiClient.get<DreDTO>('/v1/financeiro/dre/mes-atual');
      return res.data;
    },
    staleTime: 30_000,
    retry: 1,
  });

  const periodoOk = Boolean(de && ate && ate >= de);
  const periodoInvalido = Boolean(de && ate && ate < de);

  // DRE por período do filtro superior (contrato GET /dre?inicio=&fim=)
  const drePeriodoQuery = useQuery({
    queryKey: ['financeiro', 'dre', 'periodo', de, ate],
    queryFn: async () => {
      const res = await apiClient.get<DreDTO>('/v1/financeiro/dre', {
        params: { inicio: de, fim: ate },
      });
      return res.data;
    },
    enabled: tab === 'dre' && periodoOk,
    staleTime: 30_000,
    retry: 1,
  });

  /* --------------------------- Derivados ----------------------------- */

  const contas = React.useMemo(() => unwrapPage(contasQuery.data), [contasQuery.data]);
  const contasPagar = React.useMemo(() => unwrapPage(contasPagarQuery.data), [contasPagarQuery.data]);

  const receberVisiveis = React.useMemo(
    () => contas.filter((c) => noPeriodo(c.vencimento, de, ate)),
    [contas, de, ate],
  );
  const pagarVisiveis = React.useMemo(
    () => contasPagar.filter((c) => noPeriodo(c.vencimento, de, ate)),
    [contasPagar, de, ate],
  );

  // Range das métricas: período filtrado ou mês corrente (§3.3)
  const range = periodoOk ? { de, ate } : mesAtualRange();
  const rotuloPeriodo = periodoOk ? 'no período' : 'no mês';

  // V41 — métricas do topo agregadas no banco (GET /financeiro/totais, SUM nos
  // repositórios): fim da limitação de somar 1 página size=100. Chave acompanha
  // o range; invalidação ['financeiro'] em cascata após baixa/cancelamento.
  const totaisQuery = useFinanceiroTotais(range.de, range.ate);

  const receberRange = React.useMemo(
    () => contas.filter((c) => noPeriodo(c.vencimento, range.de, range.ate) && emAberto(c)),
    [contas, range.de, range.ate],
  );
  const pagarRange = React.useMemo(
    () => contasPagar.filter((c) => noPeriodo(c.vencimento, range.de, range.ate) && emAberto(c)),
    [contasPagar, range.de, range.ate],
  );

  const totalReceberMes = somarSaldo(receberRange);
  const totalPagarMes = somarSaldo(pagarRange);
  const saldoProjetado = totalReceberMes - totalPagarMes;

  const vencidas = receberVisiveis.filter((c) => isVencida(c) && emAberto(c));
  const pagarVencidas = pagarVisiveis.filter((c) => isVencida(c) && emAberto(c));
  const vencidasTotal = vencidas.length + pagarVencidas.length;
  const vencidasValor = somarSaldo(vencidas) + somarSaldo(pagarVencidas);

  // Totais do banco; fallback gracioso: se o endpoint falhar (offline/5xx), as
  // métricas continuam com o cálculo legado sobre a página carregada.
  const totais = totaisQuery.data;
  const totalReceber = totais?.totalAReceberPeriodo ?? totalReceberMes;
  const totalPagar = totais?.totalAPagarPeriodo ?? totalPagarMes;
  const vencidosValor = totais?.titulosVencidosAteHoje ?? vencidasValor;
  const saldoProjetadoTotais = totais?.saldoProjetado ?? saldoProjetado;
  const recebidoPeriodo =
    typeof totais?.totalRecebidoPeriodo === 'number' ? money(totais.totalRecebidoPeriodo) : '—';

  const crediarioVisiveis = receberVisiveis.filter((c) => (c.totalParcelas ?? 1) > 1);

  const dre = dreQuery.data;

  const loading = contasQuery.isLoading || contasPagarQuery.isLoading || dreQuery.isLoading;
  const error = contasQuery.error ?? contasPagarQuery.error ?? dreQuery.error;

  const buscando =
    contasQuery.isFetching ||
    contasPagarQuery.isFetching ||
    dreQuery.isFetching ||
    drePeriodoQuery.isFetching ||
    totaisQuery.isFetching;

  const periodoLabel = periodoOk ? `${dataBR(de)} a ${dataBR(ate)}` : 'Mês atual';
  const dreEfetivo = periodoOk ? (drePeriodoQuery.data ?? undefined) : dre;

  /* ---------------------------- Ações -------------------------------- */

  const atualizar = () => {
    contasQuery.refetch();
    contasPagarQuery.refetch();
    dreQuery.refetch();
    totaisQuery.refetch();
    if (periodoOk) drePeriodoQuery.refetch();
  };

  const cancelarMutation = useMutation({
    mutationFn: async ({ tipo, id }: { tipo: TipoConta; id: string }) => {
      // POST /v1/financeiro/contas-{receber|pagar}/{id}/cancelar
      const base = tipo === 'receber' ? 'contas-receber' : 'contas-pagar';
      await apiClient.post(`/v1/financeiro/${base}/${id}/cancelar`);
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['financeiro'] });
      toast({
        variant: 'success',
        title: 'Título cancelado',
        description:
          vars.tipo === 'receber'
            ? 'A conta a receber saiu dos totais em aberto.'
            : 'A conta a pagar saiu dos totais em aberto.',
      });
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Não foi possível cancelar',
        description: actionErrorMessage(err),
      });
    },
  });

  const abrirBaixa = (tipo: TipoConta) => (conta: ContaReceberDTO) => setBaixa({ tipo, conta });

  const cancelar = (tipo: TipoConta) => (id: string) =>
    cancelarMutation.mutate({ tipo, id });

  const limparFiltros = () => {
    setStatus('');
    setDe('');
    setAte('');
  };

  /* ---------------------------- Render ------------------------------- */

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-secondary">
          Hub de contas da loja: baixas parciais com histórico, contas a pagar com
          fornecedores, crediário e DRE — tudo calculado dos títulos reais.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {buscando && <InlineLoading label="Atualizando…" />}
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setCaixaOpen(true)}>
            <Banknote className="h-4 w-4 text-success" aria-hidden />
            Controle de Caixa
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={atualizar}
            disabled={buscando}
          >
            <RefreshCw className={`h-4 w-4 ${buscando ? 'animate-spin' : ''}`} aria-hidden />
            Atualizar
          </Button>
        </div>
      </div>

      <FinanceiroFilters
        status={status}
        onStatus={setStatus}
        de={de}
        ate={ate}
        onDe={setDe}
        onAte={setAte}
        onLimpar={limparFiltros}
      />

      <OfflineBanner />

      {cancelarMutation.isPending && <InlineLoading label="Cancelando título…" />}

      {loading ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <Skeleton className="h-72 w-full" />
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={atualizar} />
      ) : (
        <>
          {/* Métricas §3.3 (V41) — valores agregados no banco (GET /financeiro/totais);
              fallback: cálculo legado sobre a página carregada se o endpoint falhar */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              label={`Total a receber ${rotuloPeriodo}`}
              value={money(totalReceber)}
              sub={`${receberRange.length} título${receberRange.length === 1 ? '' : 's'} em aberto`}
              icon={Wallet}
              tone="info"
            />
            <MetricCard
              label={`Total a pagar ${rotuloPeriodo}`}
              value={money(totalPagar)}
              sub={`${pagarRange.length} título${pagarRange.length === 1 ? '' : 's'} em aberto`}
              icon={Banknote}
              tone={pagarVencidas.length > 0 ? 'warning' : 'info'}
            />
            <MetricCard
              label="Vencidos até hoje (R$)"
              value={money(vencidosValor)}
              sub={`${vencidasTotal} título${vencidasTotal === 1 ? '' : 's'} vencido${vencidasTotal === 1 ? '' : 's'} · ${vencidas.length} a receber · ${pagarVencidas.length} a pagar`}
              icon={AlertTriangle}
              tone={vencidosValor > 0 ? 'danger' : 'success'}
            />
            <MetricCard
              label={`Saldo projetado ${rotuloPeriodo}`}
              value={money(saldoProjetadoTotais)}
              sub="A receber menos a pagar"
              icon={TrendingUp}
              tone={saldoProjetadoTotais >= 0 ? 'success' : 'danger'}
            />
            <MetricCard
              label={`Recebido ${rotuloPeriodo}`}
              value={recebidoPeriodo}
              sub="Baixas registradas no período (contexto DRE)"
              icon={HandCoins}
              tone="info"
            />
          </div>

          <Card>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
              <CardTitle className="flex items-center gap-2">
                <ReceiptText className="h-4 w-4" aria-hidden />
                Títulos e resultado
              </CardTitle>
              {periodoInvalido && (
                <p role="alert" className="text-xs font-medium text-danger-dark">
                  Período inválido: “até” anterior a “de”.
                </p>
              )}
            </CardHeader>

            <CardContent>
              <Tabs value={tab} onValueChange={(v) => setTab(v as AbaFinanceiro)}>
                <TabsList className="mb-3 flex-wrap">
                  <TabsTrigger value="receber">
                    A Receber<Chip>{receberVisiveis.length}</Chip>
                  </TabsTrigger>
                  <TabsTrigger value="pagar">
                    A Pagar<Chip>{pagarVisiveis.length}</Chip>
                  </TabsTrigger>
                  <TabsTrigger value="crediario">
                    Crediário<Chip>{crediarioVisiveis.length}</Chip>
                  </TabsTrigger>
                  <TabsTrigger value="fornecedores">Fornecedores</TabsTrigger>
                  <TabsTrigger value="dre">DRE</TabsTrigger>
                </TabsList>

                <TabsContent value="receber" className="mt-0">
                  <ContasTable
                    contas={receberVisiveis}
                    tipo="receber"
                    ocupado={cancelarMutation.isPending}
                    onBaixar={abrirBaixa('receber')}
                    onCancelar={cancelar('receber')}
                    emptyDescription="Nenhum título a receber com os filtros atuais. Ajuste o período ou o status."
                  />
                </TabsContent>

                <TabsContent value="pagar" className="mt-0">
                  <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
                    <Button size="sm" className="gap-2" onClick={() => setNovaContaPagarOpen(true)}>
                      <Plus className="h-4 w-4" aria-hidden />
                      Nova conta a pagar
                    </Button>
                  </div>
                  <ContasTable
                    contas={pagarVisiveis}
                    tipo="pagar"
                    ocupado={cancelarMutation.isPending}
                    onBaixar={abrirBaixa('pagar')}
                    onCancelar={cancelar('pagar')}
                    emptyDescription="Nenhum título a pagar com os filtros atuais. Crie a primeira conta a pagar."
                  />
                </TabsContent>

                <TabsContent value="crediario" className="mt-0">
                  <div className="mb-3 grid gap-3 sm:grid-cols-3">
                    <MetricCard
                      label="Em carteira"
                      value={money(somarSaldo(crediarioVisiveis))}
                      sub={`${crediarioVisiveis.length} parcelas`}
                      icon={CreditCard}
                      tone="info"
                    />
                    <MetricCard
                      label="Parcelas vencidas"
                      value={String(crediarioVisiveis.filter((c) => isVencida(c) && emAberto(c)).length)}
                      sub="Vencidas no período filtrado"
                      icon={AlertTriangle}
                      tone={
                        crediarioVisiveis.some((c) => isVencida(c) && emAberto(c)) ? 'danger' : 'success'
                      }
                    />
                    <MetricCard
                      label="Títulos parcelados"
                      value={String(receberVisiveis.filter((c) => (c.totalParcelas ?? 1) > 1).length)}
                      sub="Considerando todos os títulos do filtro"
                      icon={ReceiptText}
                      tone="warning"
                    />
                  </div>
                  <ContasTable
                    contas={crediarioVisiveis}
                    tipo="receber"
                    ocupado={cancelarMutation.isPending}
                    onBaixar={abrirBaixa('receber')}
                    onCancelar={cancelar('receber')}
                    emptyDescription="Nenhuma parcela de crediário em carteira com os filtros atuais."
                  />
                </TabsContent>

                <TabsContent value="fornecedores" className="mt-0">
                  <FornecedorPanel />
                </TabsContent>

                <TabsContent value="dre" className="mt-0">
                  <DrePanel
                    dre={dreEfetivo}
                    periodoLabel={periodoLabel}
                    carregando={periodoOk ? drePeriodoQuery.isFetching : dreQuery.isLoading}
                    erro={periodoOk ? drePeriodoQuery.error : undefined}
                    onRetry={() => drePeriodoQuery.refetch()}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}

      <ControleCaixaModal open={caixaOpen} onClose={() => setCaixaOpen(false)} />

      <BaixaContaModal
        open={baixa !== null}
        onClose={() => setBaixa(null)}
        tipo={baixa?.tipo ?? 'receber'}
        conta={baixa?.conta ?? null}
      />

      <ContaPagarFormModal open={novaContaPagarOpen} onClose={() => setNovaContaPagarOpen(false)} />
    </div>
  );
}
