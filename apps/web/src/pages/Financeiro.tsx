import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Banknote,
  CreditCard,
  ReceiptText,
  RefreshCw,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { ControleCaixaModal } from '@/components/caixa/ControleCaixaModal';
import { ContasTable } from '@/components/financeiro/ContasTable';
import { DrePanel } from '@/components/financeiro/DrePanel';
import { FinanceiroFilters } from '@/components/financeiro/FinanceiroFilters';
import { MetricCard } from '@/components/financeiro/MetricCard';
import {
  actionErrorMessage,
  dataBR,
  isVencida,
  money,
  noPeriodo,
  somarSaldo,
  type AbaFinanceiro,
  type AcaoConta,
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
 * Financeiro — ONDA 2D.
 *
 * Mesma lógica da tela legada (contas a receber/pagar, DRE, crediário, baixa e
 * cancelamento), reescrita com o UI kit + tokens. Endpoints inalterados:
 *   GET  /v1/financeiro/contas-{receber|pagar}  (page/size/status)
 *   GET  /v1/financeiro/dre/mes-atual           (métricas)
 *   GET  /v1/financeiro/dre?inicio&fim          (aba DRE por período)
 *   POST /v1/financeiro/contas-{receber|pagar}/{id}/{baixar|cancelar}
 */
export default function Financeiro() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [tab, setTab] = React.useState<AbaFinanceiro>('receber');
  const [caixaOpen, setCaixaOpen] = React.useState(false);
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

  const vencidas = receberVisiveis.filter(isVencida);
  const pagarVencidas = pagarVisiveis.filter(isVencida);
  const crediarioVisiveis = receberVisiveis.filter((c) => (c.totalParcelas ?? 1) > 1);

  const aberto = somarSaldo(receberVisiveis);
  const pagarAberto = somarSaldo(pagarVisiveis);
  const dre = dreQuery.data;

  const loading = contasQuery.isLoading || contasPagarQuery.isLoading || dreQuery.isLoading;
  const error = contasQuery.error ?? contasPagarQuery.error ?? dreQuery.error;

  const buscando =
    contasQuery.isFetching ||
    contasPagarQuery.isFetching ||
    dreQuery.isFetching ||
    drePeriodoQuery.isFetching;

  const periodoLabel = periodoOk ? `${dataBR(de)} a ${dataBR(ate)}` : 'Mês atual';
  const dreEfetivo = periodoOk ? (drePeriodoQuery.data ?? undefined) : dre;

  /* ---------------------------- Ações -------------------------------- */

  const atualizar = () => {
    contasQuery.refetch();
    contasPagarQuery.refetch();
    dreQuery.refetch();
    if (periodoOk) drePeriodoQuery.refetch();
  };

  const financeiroMutation = useMutation({
    mutationFn: async ({
      tipo,
      id,
      action,
    }: {
      tipo: TipoConta;
      id: string;
      action: AcaoConta;
    }) => {
      // POST /v1/financeiro/contas-{receber|pagar}/{id}/{baixar|cancelar}
      const base = tipo === 'receber' ? 'contas-receber' : 'contas-pagar';
      await apiClient.post(`/v1/financeiro/${base}/${id}/${action}`);
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['financeiro'] });
      toast({
        variant: 'success',
        title: vars.action === 'baixar' ? 'Título baixado' : 'Título cancelado',
        description:
          vars.action === 'baixar'
            ? 'A baixa foi registrada e os totais foram atualizados.'
            : 'O título foi cancelado e saiu dos totais em aberto.',
      });
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Não foi possível concluir',
        description: actionErrorMessage(err),
      });
    },
  });

  const executarAcao = (tipo: TipoConta) => (id: string, action: AcaoConta) =>
    financeiroMutation.mutate({ tipo, id, action });

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
          Contas a receber e a pagar, crediário e DRE da loja — com baixa e cancelamento de
          título direto na linha.
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

      {financeiroMutation.isPending && (
        <InlineLoading label="Processando título…" />
      )}

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
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="A receber"
              value={money(aberto)}
              sub={`${receberVisiveis.length} títulos em aberto`}
              icon={Wallet}
              tone="info"
            />
            <MetricCard
              label="Vencidos"
              value={money(somarSaldo(vencidas))}
              sub={`${vencidas.length} título${vencidas.length === 1 ? '' : 's'}`}
              icon={AlertTriangle}
              tone={vencidas.length > 0 ? 'danger' : 'success'}
            />
            <MetricCard
              label="A pagar"
              value={money(pagarAberto)}
              sub={`${pagarVisiveis.length} títulos • ${pagarVencidas.length} vencidos`}
              icon={Banknote}
              tone={pagarVencidas.length > 0 ? 'warning' : 'info'}
            />
            <MetricCard
              label="Resultado do mês"
              value={money(dre?.dre)}
              sub={`Margem ${(dre?.margemPercentual ?? 0).toFixed(1)}%`}
              icon={TrendingUp}
              tone={(dre?.dre ?? 0) >= 0 ? 'success' : 'warning'}
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
                    Receber<Chip>{receberVisiveis.length}</Chip>
                  </TabsTrigger>
                  <TabsTrigger value="pagar">
                    Pagar<Chip>{pagarVisiveis.length}</Chip>
                  </TabsTrigger>
                  <TabsTrigger value="crediario">
                    Crediário<Chip>{crediarioVisiveis.length}</Chip>
                  </TabsTrigger>
                  <TabsTrigger value="dre">DRE</TabsTrigger>
                </TabsList>

                <TabsContent value="receber" className="mt-0">
                  <ContasTable
                    contas={receberVisiveis}
                    tipo="receber"
                    ocupado={financeiroMutation.isPending}
                    onAcao={executarAcao('receber')}
                    emptyDescription="Nenhum título a receber com os filtros atuais. Ajuste o período ou o status."
                  />
                </TabsContent>

                <TabsContent value="pagar" className="mt-0">
                  <ContasTable
                    contas={pagarVisiveis}
                    tipo="pagar"
                    ocupado={financeiroMutation.isPending}
                    onAcao={executarAcao('pagar')}
                    emptyDescription="Nenhum título a pagar com os filtros atuais. Ajuste o período ou o status."
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
                      value={String(crediarioVisiveis.filter(isVencida).length)}
                      sub="Vencidas no período filtrado"
                      icon={AlertTriangle}
                      tone={
                        crediarioVisiveis.some(isVencida) ? 'danger' : 'success'
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
                    ocupado={financeiroMutation.isPending}
                    onAcao={executarAcao('receber')}
                    emptyDescription="Nenhuma parcela de crediário em carteira com os filtros atuais."
                  />
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
    </div>
  );
}
