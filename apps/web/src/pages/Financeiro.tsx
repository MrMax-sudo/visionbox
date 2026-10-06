import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, RefreshCw, Wallet, TrendingUp, ReceiptText, Banknote, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient, type ApiError } from '@/lib/apiClient';
import type { PageResponse } from '@/lib/types';
import { unwrapPage } from '@/lib/types';
import { ControleCaixaModal } from '@/components/caixa/ControleCaixaModal';

type ContaReceberDTO = {
  id: string;
  descricao?: string;
  numeroDocumento?: string;
  valor?: number;
  valorPago?: number;
  saldo?: number;
  vencimento?: string;
  status?: string;
  vencida?: boolean;
  parcela?: number;
  totalParcelas?: number;
};

type ContaPagarDTO = ContaReceberDTO & {
  fornecedor?: string;
};

type DreDTO = {
  receita?: number;
  custo?: number;
  comissao?: number;
  dre?: number;
  margemPercentual?: number;
  totalContasReceber?: number;
  totalContasPagar?: number;
};

function money(value?: number) {
  return (value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function MetricCard({ label, value, sub, icon: Icon, tone }: { label: string; value: string; sub: string; icon: React.ElementType; tone: 'info' | 'success' | 'warning' | 'danger' }) {
  const toneClass = {
    info: 'bg-[var(--color-primary-light)] text-[var(--color-primary)]',
    success: 'bg-[var(--color-success-light)] text-[var(--color-success-dark)]',
    warning: 'bg-[var(--color-warning-light)] text-[var(--color-warning-dark)]',
    danger: 'bg-[var(--color-danger-light)] text-[var(--color-danger-dark)]',
  }[tone];

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <span className={`flex h-10 w-10 items-center justify-center rounded-[var(--radius)] ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-[var(--color-text-secondary)]">{label}</p>
          <p className="text-xl font-semibold text-[var(--color-text-primary)]">{value}</p>
          <p className="text-xs text-[var(--color-text-muted)]">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Financeiro() {
  const queryClient = useQueryClient();
  const [tab, setTab] = React.useState<'receber' | 'pagar'>('receber');
  const [caixaOpen, setCaixaOpen] = React.useState(false);
  const contasQuery = useQuery({
    queryKey: ['financeiro-contas-receber'],
    queryFn: async () => {
      const res = await apiClient.get<PageResponse<ContaReceberDTO> | ContaReceberDTO[]>('/v1/financeiro/contas-receber', {
        params: { page: 0, size: 10 },
      });
      return res.data;
    },
    staleTime: 30_000,
    retry: 1,
  });

  const contasPagarQuery = useQuery({
    queryKey: ['financeiro-contas-pagar'],
    queryFn: async () => {
      const res = await apiClient.get<PageResponse<ContaPagarDTO> | ContaPagarDTO[]>('/v1/financeiro/contas-pagar', {
        params: { page: 0, size: 10 },
      });
      return res.data;
    },
    staleTime: 30_000,
    retry: 1,
  });

  const dreQuery = useQuery({
    queryKey: ['financeiro-dre-mes-atual'],
    queryFn: async () => {
      const res = await apiClient.get<DreDTO>('/v1/financeiro/dre/mes-atual');
      return res.data;
    },
    staleTime: 30_000,
    retry: 1,
  });

  const contas = React.useMemo(() => unwrapPage(contasQuery.data), [contasQuery.data]);
  const contasPagar = React.useMemo(() => unwrapPage(contasPagarQuery.data), [contasPagarQuery.data]);
  const dre = dreQuery.data;
  const vencidas = contas.filter((c) => c.vencida || c.status === 'VENCIDA');
  const pagarVencidas = contasPagar.filter((c) => c.vencida || c.status === 'VENCIDA');
  const aberto = contas.reduce((sum, c) => sum + (c.saldo ?? c.valor ?? 0), 0);
  const pagarAberto = contasPagar.reduce((sum, c) => sum + (c.saldo ?? c.valor ?? 0), 0);
  const crediario = contas.filter((c) => (c.totalParcelas ?? 1) > 1);
  const loading = contasQuery.isLoading || contasPagarQuery.isLoading || dreQuery.isLoading;
  const error = contasQuery.error ?? contasPagarQuery.error ?? dreQuery.error;

  const financeiroMutation = useMutation({
    mutationFn: async ({ tipo, id, action }: { tipo: 'receber' | 'pagar'; id: string; action: 'baixar' | 'cancelar' }) => {
      const base = tipo === 'receber' ? 'contas-receber' : 'contas-pagar';
      await apiClient.post(`/v1/financeiro/${base}/${id}/${action}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financeiro-contas-receber'] });
      queryClient.invalidateQueries({ queryKey: ['financeiro-contas-pagar'] });
      queryClient.invalidateQueries({ queryKey: ['financeiro-dre-mes-atual'] });
    },
  });

  const tableRows = tab === 'receber' ? contas : contasPagar;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Financeiro</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">Contas a receber, vencidos e resultado do mês.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCaixaOpen(true)}
            className="gap-2"
          >
            <Banknote className="h-4 w-4 text-emerald-600" />
            Controle de Caixa
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              contasQuery.refetch();
              contasPagarQuery.refetch();
              dreQuery.refetch();
            }}
            disabled={contasQuery.isFetching || contasPagarQuery.isFetching || dreQuery.isFetching}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${contasQuery.isFetching || contasPagarQuery.isFetching || dreQuery.isFetching ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : error ? (
        <ErrorState error={error as ApiError} onRetry={() => { contasQuery.refetch(); contasPagarQuery.refetch(); dreQuery.refetch(); }} />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard label="A receber" value={money(aberto)} sub={`${contas.length} títulos recentes`} icon={Wallet} tone="info" />
            <MetricCard label="Vencidos" value={money(vencidas.reduce((sum, c) => sum + (c.saldo ?? c.valor ?? 0), 0))} sub={`${vencidas.length} títulos`} icon={AlertTriangle} tone={vencidas.length > 0 ? 'danger' : 'success'} />
            <MetricCard label="A pagar" value={money(pagarAberto)} sub={`${contasPagar.length} títulos • ${pagarVencidas.length} vencidos`} icon={Banknote} tone={pagarVencidas.length > 0 ? 'warning' : 'info'} />
            <MetricCard label="Resultado do mês" value={money(dre?.dre)} sub={`Margem ${(dre?.margemPercentual ?? 0).toFixed(1)}%`} icon={TrendingUp} tone={(dre?.dre ?? 0) >= 0 ? 'success' : 'warning'} />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-[var(--color-text-secondary)]">Crediário</p>
                <p className="mt-1 text-xl font-semibold text-[var(--color-text-primary)]">{money(crediario.reduce((sum, c) => sum + (c.saldo ?? c.valor ?? 0), 0))}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{crediario.length} parcelas em carteira</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-[var(--color-text-secondary)]">Receita bruta</p>
                <p className="mt-1 text-xl font-semibold text-[var(--color-text-primary)]">{money(dre?.receita)}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{dre?.totalContasReceber ?? contas.length} contas consideradas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-[var(--color-text-secondary)]">Custos + comissão</p>
                <p className="mt-1 text-xl font-semibold text-[var(--color-text-primary)]">{money((dre?.custo ?? 0) + (dre?.comissao ?? 0))}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{dre?.totalContasPagar ?? contasPagar.length} contas a pagar no DRE</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ReceiptText className="h-4 w-4" /> Financeiro operacional
              </CardTitle>
              <div className="flex gap-1 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-page)] p-1">
                <button className={`rounded px-3 py-1 text-xs font-medium ${tab === 'receber' ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)]' : 'text-[var(--color-text-secondary)]'}`} onClick={() => setTab('receber')}>Receber</button>
                <button className={`rounded px-3 py-1 text-xs font-medium ${tab === 'pagar' ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)]' : 'text-[var(--color-text-secondary)]'}`} onClick={() => setTab('pagar')}>Pagar</button>
              </div>
            </CardHeader>
            <CardContent>
              {tableRows.length === 0 ? (
                <p className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
                  Nenhum título {tab === 'receber' ? 'a receber' : 'a pagar'} para esta loja.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-y border-[var(--color-border)] bg-[var(--color-bg-page)] text-xs text-[var(--color-text-secondary)]">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Descrição</th>
                        <th className="px-3 py-2 text-left font-medium">Vencimento</th>
                        <th className="px-3 py-2 text-right font-medium">Saldo</th>
                        <th className="px-3 py-2 text-left font-medium">Status</th>
                        <th className="px-3 py-2 text-right font-medium">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                      {tableRows.map((conta) => (
                        <tr key={conta.id}>
                          <td className="px-3 py-2.5 text-[var(--color-text-primary)]">
                            {(conta as ContaPagarDTO).fornecedor ? `${(conta as ContaPagarDTO).fornecedor} • ` : ''}{conta.descricao ?? conta.numeroDocumento ?? conta.id}
                            {(conta.totalParcelas ?? 1) > 1 && <span className="ml-2 text-xs text-[var(--color-text-muted)]">Parc. {conta.parcela}/{conta.totalParcelas}</span>}
                          </td>
                          <td className="px-3 py-2.5 text-[var(--color-text-secondary)]">{conta.vencimento ? new Date(conta.vencimento).toLocaleDateString('pt-BR') : '-'}</td>
                          <td className="px-3 py-2.5 text-right font-medium text-[var(--color-text-primary)]">{money(conta.saldo ?? conta.valor)}</td>
                          <td className="px-3 py-2.5">
                            <Badge variant={conta.vencida || conta.status === 'VENCIDA' ? 'danger' : 'outline'}>{conta.status ?? 'ABERTO'}</Badge>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-[var(--color-success-dark)]"
                                aria-label="Baixar título"
                                disabled={financeiroMutation.isPending || conta.status === 'PAGO'}
                                onClick={() => financeiroMutation.mutate({ tipo: tab, id: conta.id, action: 'baixar' })}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-[var(--color-danger)]"
                                aria-label="Cancelar título"
                                disabled={financeiroMutation.isPending || conta.status === 'CANCELADO'}
                                onClick={() => financeiroMutation.mutate({ tipo: tab, id: conta.id, action: 'cancelar' })}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Modal de Controle de Caixa */}
      <ControleCaixaModal
        open={caixaOpen}
        onClose={() => setCaixaOpen(false)}
      />
    </div>
  );
}
