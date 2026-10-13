import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarRange, RefreshCw, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MetricCard } from '@/components/financeiro/MetricCard';
import { money, dataHoraBR } from '@/components/financeiro/types';
import { useVendedores } from '@/components/financeiro/comissao/useVendedores';
import { fechamentoComissoes } from '@/lib/comissaoService';

function hojeISO(): string {
  return new Date().toISOString().split('T')[0];
}

function inicioDoMesISO(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
}

/** % efetivo do período por vendedor — exibição derivada (valorComissao/base). */
function percentualEfetivo(base?: number, valor?: number): string {
  const b = Number(base ?? 0);
  const v = Number(valor ?? 0);
  if (b <= 0) return '—';
  return `${((v / b) * 100).toFixed(2)}%`;
}

/** StatusComissao (PENDENTE | PAGO | CANCELADO) → rótulo + tom do badge. */
function statusLancamento(
  status?: string,
): { rotulo: string; variant: 'warning' | 'success' | 'danger' } {
  if (status === 'PAGO') return { rotulo: 'Pago', variant: 'success' };
  if (status === 'CANCELADO') return { rotulo: 'Cancelado', variant: 'danger' };
  return { rotulo: 'Pendente', variant: 'warning' };
}

/**
 * FechamentoComissoesPanel — relatório por período (§3.6):
 * GET /v1/financeiro/comissoes/fechamento?dataInicio&dataFim&vendedorId.
 *
 * Contrato do backend: agregação por vendedor (porVendedor) + linhas por
 * venda (lancamentos) — mesmos filtros; lançamentos cancelados/inativos não
 * entram (filtrados no backend) e os totais derivam das mesmas linhas.
 */
export function FechamentoComissoesPanel() {
  const [dataInicio, setDataInicio] = React.useState(inicioDoMesISO);
  const [dataFim, setDataFim] = React.useState(hojeISO);
  const [vendedorId, setVendedorId] = React.useState('');
  const vendedoresQuery = useVendedores();

  const periodoValido =
    Boolean(dataInicio) && Boolean(dataFim) && dataInicio <= dataFim;

  const fechamentoQuery = useQuery({
    queryKey: ['comissoes', 'fechamento', dataInicio, dataFim, vendedorId || null],
    queryFn: () => fechamentoComissoes(dataInicio, dataFim, vendedorId || undefined),
    enabled: periodoValido,
    staleTime: 30_000,
  });

  const fechamento = fechamentoQuery.data;
  const porVendedor = fechamento?.porVendedor ?? [];
  const lancamentos = fechamento?.lancamentos ?? [];

  return (
    <section aria-label="Fechamento de comissões por período" className="space-y-4">
      {/* Filtros */}
      <div className="grid grid-cols-1 gap-3 rounded-card border border-border bg-card p-4 shadow-soft sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Data início" id="fech-inicio">
          {(ctrl) => (
            <Input
              id={ctrl.id}
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
            />
          )}
        </Field>
        <Field label="Data fim" id="fech-fim">
          {(ctrl) => (
            <Input
              id={ctrl.id}
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
            />
          )}
        </Field>
        {vendedoresQuery.isError ? (
          <p role="alert" className="self-end text-[11px] text-danger-dark">
            Falha ao carregar vendedores — o período continua funcionando sem o filtro.
          </p>
        ) : (
          <Field label="Vendedor" id="fech-vendedor" hint="Todos quando vazio.">
            {(ctrl) => (
              <Select
                id={ctrl.id}
                value={vendedorId}
                onChange={(e) => setVendedorId(e.target.value)}
                disabled={vendedoresQuery.isLoading}
              >
                <option value="">Todos os vendedores</option>
                {(vendedoresQuery.data ?? []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nome}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <div className="flex items-end justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fechamentoQuery.refetch()}
            disabled={fechamentoQuery.isFetching || !periodoValido}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${fechamentoQuery.isFetching ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {!periodoValido && (
        <p role="alert" className="text-xs text-danger-dark">
          Ajuste o período: a data inicial não pode ser posterior à final.
        </p>
      )}

      {/* Métricas do período */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricCard
          label="Base de cálculo"
          value={money(fechamento?.totalBase)}
          sub={`${fechamento?.quantidadeLancamentos ?? 0} lançamento(s)`}
          icon={CalendarRange}
          tone="info"
        />
        <MetricCard
          label="Comissão do período"
          value={money(fechamento?.totalComissao)}
          sub="Base × percentual das regras"
          icon={Users}
          tone="success"
        />
        <MetricCard
          label="Vendedores no período"
          value={String(porVendedor.length)}
          sub="Com lançamentos ativos"
          icon={Users}
          tone="warning"
        />
      </div>

      {/* Tabela por vendedor */}
      <div className="overflow-hidden rounded-card border border-border bg-card shadow-soft">
        {fechamentoQuery.isLoading ? (
          <LoadingState title="Calculando fechamento…" />
        ) : fechamentoQuery.isError ? (
          <div className="p-4">
            <ErrorState error={fechamentoQuery.error} onRetry={() => fechamentoQuery.refetch()} />
          </div>
        ) : porVendedor.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Users}
              title="Sem comissões no período"
              description="Nenhum lançamento de comissão encontrado entre as datas — apure vendas na aba Apuração."
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-page hover:bg-page">
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-right">Lançamentos</TableHead>
                <TableHead className="text-right">Base de cálculo</TableHead>
                <TableHead className="text-right">Comissão</TableHead>
                <TableHead className="text-right">% efetivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {porVendedor.map((v) => (
                <TableRow key={v.vendedorId ?? v.vendedorNome ?? 'desconhecido'}>
                  <TableCell className="font-medium">{v.vendedorNome ?? 'Vendedor sem nome'}</TableCell>
                  <TableCell className="text-right tabular-nums text-secondary">
                    {v.quantidadeLancamentos ?? 0}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{money(v.baseCalculo)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-success-dark">
                    {money(v.valorComissao)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-secondary">
                    {percentualEfetivo(v.baseCalculo, v.valorComissao)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="bg-page hover:bg-page">
                <TableCell className="font-semibold">Total do período</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {fechamento?.quantidadeLancamentos ?? 0}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {money(fechamento?.totalBase)}
                </TableCell>
                <TableCell className="text-right font-bold tabular-nums text-success-dark">
                  {money(fechamento?.totalComissao)}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {percentualEfetivo(fechamento?.totalBase, fechamento?.totalComissao)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </div>

      {/* Lançamentos por venda (mesmo período/filtros do agregado) */}
      {lancamentos.length > 0 && (
        <div className="overflow-hidden rounded-card border border-border bg-card shadow-soft">
          <div className="flex items-center justify-between gap-2 border-b border-border bg-page px-4 py-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-secondary">
              Lançamentos do período
            </h3>
            <span className="text-[11px] text-muted">
              {lancamentos.length} linha(s) — soma confere com o agregado acima
            </span>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-page hover:bg-page">
                <TableHead>Venda</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lancamentos.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">
                    {l.vendaNumero
                      ? l.vendaNumero
                      : l.vendaId
                        ? <span title={l.vendaId}>#{l.vendaId.slice(0, 8)}</span>
                        : '—'}
                  </TableCell>
                  <TableCell>{l.vendedorNome ?? 'Vendedor sem nome'}</TableCell>
                  <TableCell>
                    <Badge variant={l.categoria ? 'secondary' : 'outline'}>
                      {l.categoria ?? 'Geral'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{money(l.baseCalculo)}</TableCell>
                  <TableCell className="text-right tabular-nums text-secondary">
                    {Number(l.percentualAplicado ?? 0).toFixed(2)}%
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-success-dark">
                    {money(l.valorComissao)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusLancamento(l.status).variant}>
                      {statusLancamento(l.status).rotulo}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-secondary">
                    {dataHoraBR(l.dataLancamento)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-[11px] text-muted">
        Fechamento para pagamento na folha/vale — lançamentos cancelados não entram no cálculo
        (critério do backend). Status individual fica no lançamento (PENDENTE/PAGO).
      </p>
    </section>
  );
}
