import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  ChevronLeft,
  ChevronRight,
  Eye,
  Lock,
  Printer,
  RefreshCw,
  Unlock,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { AbrirCaixaModal } from '@/components/caixa/AbrirCaixaModal';
import { SangriaSuprimentoModal } from '@/components/caixa/SangriaSuprimentoModal';
import { FecharCaixaModal } from '@/components/caixa/FecharCaixaModal';
import { ExtratoCaixaModal } from '@/components/caixa/ExtratoCaixaModal';
import { useToast } from '@/components/ui/use-toast';
import {
  caixaQueryKeys,
  formatarBRL,
  formatarDataHora,
  historicoTurnos,
  mensagemErroCaixa,
  obterSessaoAtual,
  relatorioFechamento,
  type CaixaSessao,
  type ClassificacaoDiferenca,
} from '@/lib/caixaService';
import { imprimirFechamentoCaixa } from '@/lib/caixaPrint';
import { useEmpresaStore } from '@/stores/empresaStore';
import { useAuthStore } from '@/stores/authStore';

/**
 * CaixaTurnos — Gestão de Caixa & Turnos (Fase 2 Robustez ERP, `/caixas`).
 * Cards de resumo do turno atual, histórico paginado de turnos com diferença
 * classificada (SOBRA/QUEBRA/EXATO) e ações: Abrir, Sangria, Suprimento,
 * Fechamento cego, Extrato e impressão térmica 80mm. Apuração é 100% backend.
 */

type PeriodoPreset = 'hoje' | '7d' | '30d' | 'mes' | 'todos';

function badgeDiferenca(classificacao?: ClassificacaoDiferenca | null) {
  if (classificacao === 'SOBRA') return 'success' as const;
  if (classificacao === 'QUEBRA') return 'danger' as const;
  return 'secondary' as const;
}

export default function CaixaTurnos() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const empresa = useEmpresaStore((s) => s.empresa);
  const perfil = useAuthStore((s) => s.user?.perfil);
  /** RBAC fino (SecurityConfig): sangria/suprimento/fechar são ADMIN/GERENTE/FINANCEIRO. */
  const podeMovimentarGaveta =
    perfil === 'ADMIN' || perfil === 'GERENTE' || perfil === 'FINANCEIRO' || perfil === 'DESENVOLVEDOR';

  // ------------------------------------------------------------------ filtros
  const [periodoPreset, setPeriodoPreset] = React.useState<PeriodoPreset>('30d');
  const [dataInicio, setDataInicio] = React.useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dataFim, setDataFim] = React.useState<string>(() => new Date().toISOString().split('T')[0]);
  const [page, setPage] = React.useState(0);
  const pageSize = 10;

  // ------------------------------------------------------------------- modais
  const [modalAbrirOpen, setModalAbrirOpen] = React.useState(false);
  const [modalMovOpen, setModalMovOpen] = React.useState(false);
  const [modalMovTipo, setModalMovTipo] = React.useState<'SANGRIA' | 'SUPRIMENTO'>('SANGRIA');
  const [modalFecharOpen, setModalFecharOpen] = React.useState(false);
  const [sessaoExtrato, setSessaoExtrato] = React.useState<CaixaSessao | null>(null);
  const [imprimindoSessaoId, setImprimindoSessaoId] = React.useState<string | null>(null);

  function aplicarPreset(preset: PeriodoPreset) {
    setPeriodoPreset(preset);
    setPage(0);
    const hoje = new Date();
    const iso = (d: Date) => d.toISOString().split('T')[0];
    if (preset === 'hoje') {
      setDataInicio(iso(hoje));
      setDataFim(iso(hoje));
    } else if (preset === '7d') {
      const d = new Date();
      d.setDate(hoje.getDate() - 7);
      setDataInicio(iso(d));
      setDataFim(iso(hoje));
    } else if (preset === '30d') {
      const d = new Date();
      d.setDate(hoje.getDate() - 30);
      setDataInicio(iso(d));
      setDataFim(iso(hoje));
    } else if (preset === 'mes') {
      const primDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      setDataInicio(iso(primDia));
      setDataFim(iso(hoje));
    } else {
      setDataInicio('');
      setDataFim('');
    }
  }

  // ------------------------------------------------------------- turno atual
  const statusQuery = useQuery({
    queryKey: caixaQueryKeys.statusAtual,
    queryFn: obterSessaoAtual,
    staleTime: 10_000,
  });
  const sessaoAtual = statusQuery.data ?? null;
  const isAberto = sessaoAtual?.status === 'ABERTO';

  // ---------------------------------------------------------------- histórico
  const historicoQuery = useQuery({
    queryKey: caixaQueryKeys.historico({
      dataInicio: dataInicio || undefined,
      dataFim: dataFim || undefined,
      page,
      size: pageSize,
    }),
    queryFn: () =>
      historicoTurnos({
        dataInicio: dataInicio || undefined,
        dataFim: dataFim || undefined,
        page,
        size: pageSize,
      }),
    staleTime: 15_000,
  });

  const turnos = historicoQuery.data?.content ?? [];
  const totalPaginas = historicoQuery.data?.totalPages ?? 0;
  const totalRegistros = historicoQuery.data?.totalElements ?? 0;

  // ------------------------------------------------------------------ ações
  async function imprimirFechamentoDaSessao(sessaoId: string) {
    setImprimindoSessaoId(sessaoId);
    try {
      const rel = await relatorioFechamento(sessaoId);
      imprimirFechamentoCaixa(rel, empresa);
      toast({
        title: 'Impressão disparada',
        description: 'Fechamento de caixa 80mm enviado à impressora.',
      });
    } catch (err) {
      toast({
        title: 'Falha ao imprimir',
        description: mensagemErroCaixa(err, 'Não foi possível gerar o cupom de fechamento.'),
      });
    } finally {
      setImprimindoSessaoId(null);
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Gestão de Caixa & Turnos
          </h1>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Abertura com fundo de troco, sangria/suprimento auditados, fechamento cego e extrato
            térmico 80mm por turno
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: caixaQueryKeys.statusAtual })}
            disabled={statusQuery.isFetching || historicoQuery.isFetching}
            className="gap-1.5"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${statusQuery.isFetching || historicoQuery.isFetching ? 'animate-spin' : ''}`}
            />
            Atualizar
          </Button>

          {!isAberto && (
            <Button
              variant="default"
              size="sm"
              onClick={() => setModalAbrirOpen(true)}
              disabled={statusQuery.isLoading}
              className="gap-1.5 font-semibold"
            >
              <Unlock className="h-4 w-4" /> Abrir Caixa
            </Button>
          )}

          {isAberto && sessaoAtual && (
            <>
              {podeMovimentarGaveta && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setModalMovTipo('SUPRIMENTO');
                    setModalMovOpen(true);
                  }}
                  className="gap-1.5"
                >
                  <ArrowUpCircle className="h-4 w-4" /> Suprimento
                </Button>
              )}
              {podeMovimentarGaveta && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setModalMovTipo('SANGRIA');
                    setModalMovOpen(true);
                  }}
                  className="gap-1.5"
                >
                  <ArrowDownCircle className="h-4 w-4" /> Sangria
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSessaoExtrato(sessaoAtual)}
                className="gap-1.5"
              >
                <Eye className="h-4 w-4" /> Extrato
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => imprimirFechamentoDaSessao(sessaoAtual.id)}
                disabled={imprimindoSessaoId === sessaoAtual.id}
                className="gap-1.5"
              >
                <Printer className="h-4 w-4" /> Imprimir 80mm
              </Button>
              {podeMovimentarGaveta && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setModalFecharOpen(true)}
                  className="gap-1.5 font-semibold"
                >
                  <Lock className="h-4 w-4" /> Fechar Caixa
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Erro do turno atual — reprova silêncio: rede/5xx não pode virar "fechado" */}
      {statusQuery.isError && (
        <ErrorState
          error={statusQuery.error}
          onRetry={() => statusQuery.refetch()}
          compact
        />
      )}

      {/* KPI Cards — Turno Atual */}
      {statusQuery.isLoading ? (
        <LoadingState title="Carregando turno atual..." compact />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Turno Atual */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 shadow-sm">
            <div className="flex items-center justify-between text-[var(--color-text-muted)]">
              <span className="text-xs font-medium">Turno Atual</span>
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                  isAberto
                    ? 'bg-[var(--color-success-light)] text-[var(--color-success-dark)]'
                    : 'bg-[var(--color-danger-light)] text-[var(--color-danger-dark)]'
                }`}
              >
                {isAberto ? (
                  <Unlock className="h-4 w-4" aria-hidden />
                ) : (
                  <Lock className="h-4 w-4" aria-hidden />
                )}
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant={isAberto ? 'success' : 'danger'}>
                {isAberto ? 'ABERTO' : 'FECHADO'}
              </Badge>
              {isAberto && sessaoAtual && (
                <span className="truncate text-[11px] font-medium text-[var(--color-text-secondary)]">
                  {sessaoAtual.operadorNome || 'Operador'}
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
              {isAberto && sessaoAtual
                ? `Aberto em ${formatarDataHora(sessaoAtual.abertoEm)} • ${sessaoAtual.identificacaoCaixa}`
                : 'Nenhuma sessão em andamento — abra o caixa para vender.'}
            </p>
          </div>

          {/* Saldo em Gaveta */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 shadow-sm">
            <div className="flex items-center justify-between text-[var(--color-text-muted)]">
              <span className="text-xs font-medium">Saldo em Gaveta</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-[var(--color-text-primary)]">
              {isAberto && sessaoAtual ? formatarBRL(sessaoAtual.saldoEsperado) : formatarBRL(0)}
            </div>
            <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
              {isAberto ? 'Dinheiro esperado em gaveta' : 'Gaveta sem turno aberto'}
            </p>
          </div>

          {/* Total Entradas */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 shadow-sm">
            <div className="flex items-center justify-between text-[var(--color-text-muted)]">
              <span className="text-xs font-medium">Total Entradas</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-success-light)] text-[var(--color-success-dark)]">
                <ArrowDownCircle className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-[var(--color-success-dark)]">
              {isAberto && sessaoAtual ? formatarBRL(sessaoAtual.totalEntradas) : formatarBRL(0)}
            </div>
            <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
              Fundo, suprimentos e vendas
            </p>
          </div>

          {/* Total Saídas */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 shadow-sm">
            <div className="flex items-center justify-between text-[var(--color-text-muted)]">
              <span className="text-xs font-medium">Total Saídas</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-danger-light)] text-[var(--color-danger-dark)]">
                <ArrowUpCircle className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-[var(--color-danger-dark)]">
              {isAberto && sessaoAtual ? formatarBRL(sessaoAtual.totalSaidas) : formatarBRL(0)}
            </div>
            <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">Sangrias e retiradas</p>
          </div>
        </div>
      )}

      {/* Painel de Filtros — Histórico */}
      <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-semibold text-[var(--color-text-secondary)]">
              Período:
            </span>
            {(['hoje', '7d', '30d', 'mes', 'todos'] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => aplicarPreset(preset)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  periodoPreset === preset
                    ? 'bg-[var(--color-brand)] text-white'
                    : 'bg-[var(--color-bg-page)] text-[var(--color-text-secondary)] hover:bg-[var(--color-neutral-100)] dark:hover:bg-[var(--color-neutral-800)]'
                }`}
              >
                {preset === 'hoje'
                  ? 'Hoje'
                  : preset === '7d'
                    ? 'Últimos 7d'
                    : preset === '30d'
                      ? 'Últimos 30d'
                      : preset === 'mes'
                        ? 'Este Mês'
                        : 'Todos'}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-[var(--color-text-muted)]">
            {historicoQuery.data ? `${totalRegistros} turno(s) no período` : ''}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 border-t border-[var(--color-border)] pt-3 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <label
              htmlFor="caixa-historico-data-inicio"
              className="mb-1 block text-[11px] font-medium text-[var(--color-text-secondary)]"
            >
              Data Início
            </label>
            <Input
              id="caixa-historico-data-inicio"
              type="date"
              value={dataInicio}
              onChange={(e) => {
                setDataInicio(e.target.value);
                setPeriodoPreset('todos');
                setPage(0);
              }}
              className="text-xs"
            />
          </div>
          <div>
            <label
              htmlFor="caixa-historico-data-fim"
              className="mb-1 block text-[11px] font-medium text-[var(--color-text-secondary)]"
            >
              Data Fim
            </label>
            <Input
              id="caixa-historico-data-fim"
              type="date"
              value={dataFim}
              onChange={(e) => {
                setDataFim(e.target.value);
                setPeriodoPreset('todos');
                setPage(0);
              }}
              className="text-xs"
            />
          </div>
        </div>
      </div>

      {/* Tabela de Histórico de Turnos */}
      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-sm">
        {historicoQuery.isLoading ? (
          <div className="p-12">
            <LoadingState title="Carregando histórico de turnos..." />
          </div>
        ) : historicoQuery.isError ? (
          <div className="p-8 text-center">
            <ErrorState error={historicoQuery.error} onRetry={() => historicoQuery.refetch()} />
          </div>
        ) : turnos.length === 0 ? (
          <div className="p-12">
            <EmptyState
              icon={Banknote}
              title="Nenhum turno no período"
              description="Nenhuma abertura de caixa corresponde ao período selecionado. Ajuste as datas ou abra o primeiro turno."
              action={
                !isAberto ? (
                  <Button variant="outline" size="sm" onClick={() => setModalAbrirOpen(true)}>
                    Abrir Caixa Agora
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg-page)] text-[var(--color-text-muted)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Operador</th>
                  <th className="px-4 py-3 font-semibold">Caixa</th>
                  <th className="px-4 py-3 font-semibold">Abertura</th>
                  <th className="px-4 py-3 font-semibold">Fechamento</th>
                  <th className="px-4 py-3 text-right font-semibold">Informado</th>
                  <th className="px-4 py-3 text-center font-semibold">Diferença</th>
                  <th className="px-4 py-3 text-center font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {turnos.map((turno) => {
                  const aberto = turno.status === 'ABERTO';
                  return (
                    <tr
                      key={turno.id}
                      className="transition-colors hover:bg-[var(--color-neutral-50)] dark:hover:bg-[var(--color-neutral-900)]"
                    >
                      <td className="whitespace-nowrap px-4 py-3">
                        <p className="font-semibold text-[var(--color-text-primary)]">
                          {turno.operadorNome || 'Operador'}
                        </p>
                        <p className="text-[11px] text-[var(--color-text-muted)]">
                          Fundo {formatarBRL(turno.saldoInicial)}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-[var(--color-text-secondary)]">
                        {turno.identificacaoCaixa}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[var(--color-text-secondary)]">
                        {formatarDataHora(turno.abertoEm)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[var(--color-text-secondary)]">
                        {turno.fechadoEm ? formatarDataHora(turno.fechadoEm) : '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-semibold text-[var(--color-text-primary)]">
                        {turno.saldoInformadoFechamento != null
                          ? formatarBRL(turno.saldoInformadoFechamento)
                          : '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-center">
                        {turno.classificacaoDiferenca ? (
                          <Badge variant={badgeDiferenca(turno.classificacaoDiferenca)}>
                            {turno.classificacaoDiferenca}{' '}
                            {turno.diferencaFechamento != null
                              ? formatarBRL(turno.diferencaFechamento)
                              : ''}
                          </Badge>
                        ) : (
                          <span className="text-[var(--color-text-muted)]">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-center">
                        <Badge variant={aberto ? 'success' : 'secondary'}>
                          {aberto ? 'ABERTO' : 'FECHADO'}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setSessaoExtrato(turno)}
                            className="rounded p-1 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-neutral-100)] hover:text-[var(--color-brand)] dark:hover:bg-[var(--color-neutral-800)]"
                            title="Ver Extrato do Turno"
                            aria-label={`Ver extrato do turno de ${turno.operadorNome || 'operador'} aberto em ${formatarDataHora(turno.abertoEm)}`}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => imprimirFechamentoDaSessao(turno.id)}
                            disabled={imprimindoSessaoId === turno.id}
                            className="rounded p-1 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-neutral-100)] hover:text-[var(--color-text-primary)] disabled:opacity-50 dark:hover:bg-[var(--color-neutral-800)]"
                            title="Imprimir Fechamento (80mm)"
                            aria-label={`Imprimir fechamento do turno de ${turno.operadorNome || 'operador'} aberto em ${formatarDataHora(turno.abertoEm)}`}
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Rodapé: Paginação */}
        {totalPaginas > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--color-border)] px-4 py-3 text-xs text-[var(--color-text-secondary)]">
            <div>
              Mostrando {turnos.length} de {totalRegistros} turnos
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || historicoQuery.isFetching}
                className="h-7 w-7 p-0"
                aria-label="Página anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span>
                Página {page + 1} de {totalPaginas}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPaginas - 1, p + 1))}
                disabled={page >= totalPaginas - 1 || historicoQuery.isFetching}
                className="h-7 w-7 p-0"
                aria-label="Próxima página"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modais */}
      <AbrirCaixaModal open={modalAbrirOpen} onClose={() => setModalAbrirOpen(false)} />
      <SangriaSuprimentoModal
        open={modalMovOpen}
        onClose={() => setModalMovOpen(false)}
        tipo={modalMovTipo}
        sessao={sessaoAtual}
      />
      <FecharCaixaModal
        open={modalFecharOpen}
        onClose={() => setModalFecharOpen(false)}
        sessao={sessaoAtual}
      />
      <ExtratoCaixaModal
        open={!!sessaoExtrato}
        onClose={() => setSessaoExtrato(null)}
        sessao={sessaoExtrato}
      />
    </div>
  );
}
