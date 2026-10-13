import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  ChevronLeft,
  ChevronRight,
  Printer,
} from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { useToast } from '@/components/ui/use-toast';
import {
  caixaQueryKeys,
  extrato,
  formatarBRL,
  formatarDataHora,
  mensagemErroCaixa,
  relatorioFechamento,
  type CaixaSessao,
  type TipoMovimentoCaixa,
} from '@/lib/caixaService';
import { imprimirFechamentoCaixa } from '@/lib/caixaPrint';
import { useEmpresaStore } from '@/stores/empresaStore';

interface ExtratoCaixaModalProps {
  open: boolean;
  onClose: () => void;
  sessao: CaixaSessao | null;
}

const TIPOS_MOVIMENTO: Array<{ value: TipoMovimentoCaixa | 'TODOS'; label: string }> = [
  { value: 'TODOS', label: 'Todos os movimentos' },
  { value: 'ABERTURA', label: 'Abertura' },
  { value: 'SUPRIMENTO', label: 'Suprimento' },
  { value: 'SANGRIA', label: 'Sangria' },
  { value: 'VENDA_DINHEIRO', label: 'Venda (dinheiro)' },
  { value: 'VENDA_OUTROS', label: 'Venda (outras formas)' },
  { value: 'ESTORNO', label: 'Estorno' },
  { value: 'FECHAMENTO', label: 'Fechamento' },
];

function badgeTipo(tipo: TipoMovimentoCaixa) {
  switch (tipo) {
    case 'SANGRIA':
      return 'danger' as const;
    case 'ESTORNO':
      return 'warning' as const;
    case 'ABERTURA':
      return 'info' as const;
    case 'FECHAMENTO':
      return 'secondary' as const;
    default:
      return 'success' as const;
  }
}

function rotuloTipo(tipo: TipoMovimentoCaixa): string {
  const mapa: Record<TipoMovimentoCaixa, string> = {
    ABERTURA: 'Abertura',
    SUPRIMENTO: 'Suprimento',
    SANGRIA: 'Sangria',
    VENDA_DINHEIRO: 'Venda $',
    VENDA_OUTROS: 'Venda',
    ESTORNO: 'Estorno',
    FECHAMENTO: 'Fechamento',
  };
  return mapa[tipo] ?? tipo;
}

function ehEntrada(tipo: TipoMovimentoCaixa): boolean {
  return tipo === 'SUPRIMENTO' || tipo === 'ABERTURA' || tipo.startsWith('VENDA');
}

const abaTriggerCls =
  'rounded-none border-b-2 border-transparent bg-transparent px-3 py-2 text-xs font-semibold text-muted shadow-none transition-colors ' +
  'data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary ' +
  'data-[state=inactive]:hover:text-primary';

/**
 * Extrato & Fechamento do Turno — Fase 2 Robustez ERP.
 * Aba Extrato: movimentos paginados com filtro por tipo. Aba Fechamento: relatório
 * consolidado por modalidade (RelatorioFechamentoDTO) + impressão térmica 80mm.
 */
export function ExtratoCaixaModal({ open, onClose, sessao }: ExtratoCaixaModalProps) {
  const { toast } = useToast();
  const empresa = useEmpresaStore((s) => s.empresa);
  const [tab, setTab] = React.useState<'extrato' | 'fechamento'>('extrato');
  const [tipoFiltro, setTipoFiltro] = React.useState<TipoMovimentoCaixa | 'TODOS'>('TODOS');
  const [page, setPage] = React.useState(0);
  const size = 10;

  React.useEffect(() => {
    if (open) {
      setTab('extrato');
      setTipoFiltro('TODOS');
      setPage(0);
    }
  }, [open]);

  const sessaoId = sessao?.id ?? null;

  const extratoQuery = useQuery({
    queryKey: caixaQueryKeys.extrato(sessaoId ?? 'none', tipoFiltro === 'TODOS' ? null : tipoFiltro, page, size),
    queryFn: () =>
      extrato(sessaoId!, {
        tipo: tipoFiltro === 'TODOS' ? undefined : tipoFiltro,
        page,
        size,
      }),
    enabled: open && !!sessaoId,
    staleTime: 10_000,
  });

  const relatorioQuery = useQuery({
    queryKey: caixaQueryKeys.relatorio(sessaoId ?? 'none'),
    queryFn: () => relatorioFechamento(sessaoId!),
    enabled: open && !!sessaoId,
    staleTime: 10_000,
  });

  function handleImprimir() {
    if (!relatorioQuery.data) return;
    imprimirFechamentoCaixa(relatorioQuery.data, empresa);
    toast({ title: 'Impressão disparada', description: 'Cupom 80mm enviado à impressora.' });
  }

  if (!sessao) return null;

  const movimentos = extratoQuery.data?.content ?? [];
  const totalPaginas = extratoQuery.data?.totalPages ?? 0;
  const totalRegistros = extratoQuery.data?.totalElements ?? 0;
  const rel = relatorioQuery.data;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Extrato do Turno — ${sessao.identificacaoCaixa}`}
      description={`${sessao.operadorNome || 'Operador'} • Abertura ${formatarDataHora(sessao.abertoEm)}${
        sessao.fechadoEm ? ` • Fechamento ${formatarDataHora(sessao.fechadoEm)}` : ' • Em andamento'
      }`}
      className="max-w-[720px]"
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'extrato' | 'fechamento')}>
        <TabsList className="h-auto w-full justify-start gap-1 rounded-none border-b border-border bg-transparent p-0">
          <TabsTrigger value="extrato" className={abaTriggerCls}>
            Movimentos
          </TabsTrigger>
          <TabsTrigger value="fechamento" className={abaTriggerCls}>
            Fechamento & Modalidades
          </TabsTrigger>
        </TabsList>

        {/* ------------------------------- Aba Movimentos ------------------------------- */}
        <TabsContent value="extrato" className="mt-3">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="w-56">
                <label
                  htmlFor="caixa-extrato-filtro-tipo"
                  className="mb-1 block text-[11px] font-medium text-secondary"
                >
                  Filtrar por tipo
                </label>
                <Select
                  id="caixa-extrato-filtro-tipo"
                  value={tipoFiltro}
                  onChange={(e) => {
                    setTipoFiltro(e.target.value as TipoMovimentoCaixa | 'TODOS');
                    setPage(0);
                  }}
                  className="text-xs"
                >
                  {TIPOS_MOVIMENTO.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </div>
              <span className="text-[11px] text-muted">
                {extratoQuery.data ? `${totalRegistros} movimento(s)` : ''}
              </span>
            </div>

            <div className="overflow-hidden rounded border border-border">
              {extratoQuery.isLoading ? (
                <LoadingState title="Carregando extrato do turno..." compact />
              ) : extratoQuery.isError ? (
                <div className="p-4">
                  <ErrorState
                    error={extratoQuery.error}
                    onRetry={() => extratoQuery.refetch()}
                    compact
                  />
                </div>
              ) : movimentos.length === 0 ? (
                <p className="p-4 text-center text-xs text-muted">
                  Nenhum movimento registrado neste turno com o filtro selecionado.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {movimentos.map((m) => {
                    const entrada = ehEntrada(m.tipo);
                    const neutro = m.tipo === 'FECHAMENTO';
                    return (
                      <div key={m.id} className="flex items-center justify-between gap-2 p-2.5 text-xs">
                        <div className="flex min-w-0 items-center gap-2">
                          {neutro ? (
                            <Banknote className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                          ) : entrada ? (
                            <ArrowDownCircle className="h-4 w-4 shrink-0 text-success" aria-hidden />
                          ) : (
                            <ArrowUpCircle className="h-4 w-4 shrink-0 text-danger" aria-hidden />
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-medium text-primary">{m.motivo || rotuloTipo(m.tipo)}</p>
                            <p className="text-[10px] text-muted">
                              {formatarDataHora(m.criadoEm)} • {m.formaPagamento || 'DINHEIRO'}
                              {m.usuarioNome ? ` • ${m.usuarioNome}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge variant={badgeTipo(m.tipo)}>{rotuloTipo(m.tipo)}</Badge>
                          <span
                            className={`font-mono font-semibold ${
                              neutro ? 'text-secondary' : entrada ? 'text-success' : 'text-danger'
                            }`}
                          >
                            {neutro ? '' : entrada ? '+' : '-'}
                            {formatarBRL(m.valor)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {totalPaginas > 1 && (
              <div className="flex items-center justify-between text-xs text-secondary">
                <span>
                  Página {page + 1} de {totalPaginas}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0 || extratoQuery.isFetching}
                    className="h-7 w-7 p-0"
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPaginas - 1, p + 1))}
                    disabled={page >= totalPaginas - 1 || extratoQuery.isFetching}
                    className="h-7 w-7 p-0"
                    aria-label="Próxima página"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ---------------------------- Aba Fechamento/Modalidades ---------------------------- */}
        <TabsContent value="fechamento" className="mt-3">
          <div className="space-y-3">
            {sessao.status === 'ABERTO' && (
              <div className="rounded-card border border-warning bg-warning-light p-3 text-xs text-warning-dark">
                Turno em andamento — o relatório abaixo é <strong>parcial</strong> (contado e diferença
                só existem após o fechamento cego).
              </div>
            )}

            {relatorioQuery.isLoading ? (
              <LoadingState title="Apurando relatório de fechamento..." compact />
            ) : relatorioQuery.isError ? (
              <ErrorState error={relatorioQuery.error} onRetry={() => relatorioQuery.refetch()} compact />
            ) : !rel || rel.resumoPorModalidade.length === 0 ? (
              <EmptyState
                icon={Banknote}
                title="Sem apuração por modalidade"
                description="Nenhuma forma de pagamento movimentou vendas neste turno."
              />
            ) : (
              <>
                {/* Resumo por modalidade */}
                <div className="overflow-hidden rounded border border-border">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border bg-page text-muted">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Modalidade</th>
                        <th className="px-3 py-2 text-right font-semibold">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rel.resumoPorModalidade.map((m) => (
                        <tr key={m.formaPagamentoId ?? m.nome}>
                          <td className="px-3 py-2 font-medium text-primary">{m.nome}</td>
                          <td className="px-3 py-2 text-right font-mono font-semibold">
                            {formatarBRL(m.total)}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-border bg-page">
                        <td className="px-3 py-2 font-semibold text-secondary">Total de Vendas</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-primary">
                          {formatarBRL(rel.totalVendas)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Totais do turno */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded border border-border bg-page p-2 text-center">
                    <span className="text-[10px] uppercase text-muted">Fundo Inicial</span>
                    <p className="font-mono text-xs font-semibold">{formatarBRL(rel.saldoInicial)}</p>
                  </div>
                  <div className="rounded border border-border bg-page p-2 text-center">
                    <span className="text-[10px] uppercase text-muted">+ Entradas</span>
                    <p className="font-mono text-xs font-semibold text-success">
                      {formatarBRL(rel.totalEntradas)}
                    </p>
                  </div>
                  <div className="rounded border border-border bg-page p-2 text-center">
                    <span className="text-[10px] uppercase text-muted">- Saídas</span>
                    <p className="font-mono text-xs font-semibold text-danger">
                      {formatarBRL(rel.totalSaidas)}
                    </p>
                  </div>
                  <div className="rounded border border-border bg-page p-2 text-center">
                    <span className="text-[10px] uppercase text-muted">Sangrias / Suprimentos</span>
                    <p className="font-mono text-xs font-semibold">
                      {formatarBRL(rel.totalSangrias)} / {formatarBRL(rel.totalSuprimentos)}
                    </p>
                  </div>
                </div>

                {/* Conferência (turno fechado) */}
                {rel.status === 'FECHADO' && (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded border border-border bg-card p-2">
                      <span className="text-[10px] uppercase text-muted">Apurado (Sistema)</span>
                      <p className="font-mono text-xs font-semibold">
                        {formatarBRL(rel.valorFechamentoSistema)}
                      </p>
                    </div>
                    <div className="rounded border border-border bg-card p-2">
                      <span className="text-[10px] uppercase text-muted">Contado (Informado)</span>
                      <p className="font-mono text-xs font-semibold">
                        {formatarBRL(rel.valorFechamentoInformado)}
                      </p>
                    </div>
                    <div
                      className={`rounded border p-2 ${
                        rel.classificacaoDiferenca === 'QUEBRA'
                          ? 'border-danger-light bg-danger-light'
                          : rel.classificacaoDiferenca === 'SOBRA'
                            ? 'border-warning-light bg-warning-light'
                            : 'border-success-light bg-success-light'
                      }`}
                    >
                      <span className="text-[10px] uppercase text-muted">
                        Diferença ({rel.classificacaoDiferenca ?? '—'})
                      </span>
                      <p
                        className={`font-mono text-xs font-bold ${
                          rel.classificacaoDiferenca === 'QUEBRA'
                            ? 'text-danger-dark'
                            : rel.classificacaoDiferenca === 'SOBRA'
                              ? 'text-warning-dark'
                              : 'text-success-dark'
                        }`}
                      >
                        {formatarBRL(rel.diferencaFechamento)}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex justify-end border-t border-border pt-3">
                  <Button type="button" variant="outline" size="sm" onClick={handleImprimir} className="gap-1.5">
                    <Printer className="h-4 w-4" aria-hidden />
                    Imprimir Fechamento (80mm)
                  </Button>
                </div>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </Dialog>
  );
}
