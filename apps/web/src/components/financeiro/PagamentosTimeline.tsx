import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { History, Loader2, ReceiptText, Undo2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingRows } from '@/components/ui/loading-state';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { apiClient, apiGet } from '@/lib/apiClient';
import { invalidarQueriesCaixa, novoIdempotencyKey } from '@/lib/caixaService';
import { useAuthStore } from '@/stores/authStore';
import { FINANCEIRO_KEYS, useFormasPagamento } from './queries';
import {
  actionErrorMessage,
  dataHoraBR,
  money,
  type ContaReceberDTO,
  type PagamentoDTO,
} from './types';

/** Perfis que podem estornar uma baixa — espelha o @PreAuthorize do backend. */
const PERFIS_ESTORNO = ['ADMIN', 'GERENTE', 'FINANCEIRO'] as const;

/**
 * Histórico de baixas de uma Conta a Receber (§3.3) — timeline das linhas de
 * conta_receber_pagamento (GET /v1/financeiro/contas-receber/{id}/pagamentos).
 * Montada sob demanda na expansão da linha da tabela (query só roda com o
 * componente montado, cache por contaId).
 *
 * Estorno (pendência D-012): botão por linha para ADMIN/GERENTE/FINANCEIRO —
 * POST /{contaId}/pagamentos/{pagamentoId}/estornar reabre o título (soft-delete
 * da baixa, valor_aberto recalculado, status PENDENTE/PARCIAL) e lança movimento
 * ESTORNO no caixa aberto. Confirmação mostra valor+data da baixa; Idempotency-Key
 * é mantida entre retries do MESMO estorno (timeout/offline não estorna 2x).
 */
export function PagamentosTimeline({ contaId }: { contaId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const perfil = useAuthStore((s) => s.user?.perfil);
  const podeEstornar = PERFIS_ESTORNO.includes(perfil as (typeof PERFIS_ESTORNO)[number]);

  const [alvo, setAlvo] = React.useState<PagamentoDTO | null>(null);
  const [motivo, setMotivo] = React.useState('');

  // R4 — chave por estorno (nova quando muda o alvo), reutilizada entre retries.
  const idemKeyRef = React.useRef('');
  React.useEffect(() => {
    if (alvo) idemKeyRef.current = novoIdempotencyKey();
  }, [alvo]);

  const pagamentosQuery = useQuery({
    queryKey: FINANCEIRO_KEYS.pagamentos(contaId),
    queryFn: () => apiGet<PagamentoDTO[]>(`/v1/financeiro/contas-receber/${contaId}/pagamentos`),
    staleTime: 30_000,
    retry: 1,
  });

  const formasQuery = useFormasPagamento();

  const estornarMutation = useMutation({
    mutationFn: async (pagamento: PagamentoDTO) => {
      const body: Record<string, string> = {};
      if (motivo.trim()) body.observacao = motivo.trim();
      const res = await apiClient.post(
        `/v1/financeiro/contas-receber/${contaId}/pagamentos/${pagamento.id}/estornar`,
        body,
        { headers: { 'Idempotency-Key': idemKeyRef.current } },
      );
      return res.data as ContaReceberDTO;
    },
    onSuccess: (conta) => {
      // ['financeiro'] raiz em cascata: listas, DRE e a própria timeline do título.
      queryClient.invalidateQueries({ queryKey: FINANCEIRO_KEYS.raiz });
      // Movimento ESTORNO pode ter entrado no turno aberto.
      invalidarQueriesCaixa(queryClient);
      const reaberto = (conta?.status ?? '') === 'PENDENTE';
      toast({
        variant: 'success',
        title: reaberto ? 'Baixa estornada — título reaberto' : 'Baixa estornada — título parcial',
        description: reaberto
          ? 'Saldo integral reaberto (status Aberto).'
          : `Saldo em aberto: ${money(conta?.valorAberto ?? conta?.saldo ?? 0)}.`,
      });
      setAlvo(null);
      setMotivo('');
    },
    onError: (err) => {
      // Mesma Idempotency-Key no botão de novo — falha de rede não estorna 2x.
      toast({
        variant: 'destructive',
        title: 'Não foi possível estornar a baixa',
        description: actionErrorMessage(err),
      });
    },
  });

  const formaNome = (id?: string | null): string => {
    if (!id) return '—';
    const forma = formasQuery.data?.find((f) => f.id === id);
    return forma?.nome ?? '—';
  };

  if (pagamentosQuery.isLoading) {
    return (
      <div className="px-4 py-3">
        <LoadingRows rows={2} />
        <span className="sr-only">Carregando histórico de baixas…</span>
      </div>
    );
  }

  if (pagamentosQuery.isError) {
    return (
      <div className="px-4 py-3">
        <ErrorState
          compact
          error={pagamentosQuery.error}
          onRetry={() => pagamentosQuery.refetch()}
        />
      </div>
    );
  }

  const pagamentos = pagamentosQuery.data ?? [];
  const totalPago = pagamentos.reduce((sum, p) => sum + (p.valorPago ?? 0), 0);
  const totalDesconto = pagamentos.reduce((sum, p) => sum + (p.valorDesconto ?? 0), 0);
  const totalJuros = pagamentos.reduce((sum, p) => sum + (p.valorJuros ?? 0), 0);

  if (pagamentos.length === 0) {
    return (
      <div className="px-4 py-3">
        <EmptyState
          icon={History}
          title="Nenhuma baixa registrada"
          description="Este título ainda não recebeu pagamentos parciais ou totais."
        />
      </div>
    );
  }

  const estornando = estornarMutation.isPending && alvo !== null;

  return (
    <div className="px-4 py-3">
      <p className="mb-2 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-secondary">
        <History className="h-3.5 w-3.5" aria-hidden />
        Histórico de baixas
        <Badge variant="success" className="ml-1 tabular-nums">
          {pagamentos.length} · {money(totalPago)}
        </Badge>
        {totalDesconto > 0 && (
          <Badge variant="warning" className="tabular-nums">
            desconto {money(totalDesconto)}
          </Badge>
        )}
        {totalJuros > 0 && (
          <Badge variant="info" className="tabular-nums">
            juros {money(totalJuros)}
          </Badge>
        )}
      </p>

      <ol className="space-y-1.5">
        {pagamentos.map((p) => (
          <li
            key={p.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded border border-border bg-card px-3 py-2 text-xs"
          >
            <div className="flex min-w-0 items-center gap-2">
              <ReceiptText className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
              <div className="min-w-0">
                <p className="font-medium text-primary">
                  {dataHoraBR(p.dataPagamento ?? p.criadoEm)}
                  <span className="ml-2 font-normal text-muted">via {formaNome(p.formaPagamentoId)}</span>
                </p>
                {p.observacao && (
                  <p className="truncate text-muted">{p.observacao}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!p.caixaId && (
                <Badge variant="outline" className="text-[10px]">
                  sem caixa aberto
                </Badge>
              )}
              <span className="font-semibold tabular-nums text-success-dark">
                {money(p.valorPago)}
              </span>
              {(p.valorDesconto ?? 0) > 0 && (
                <Badge variant="warning" className="text-[10px] tabular-nums" title="Desconto: abateu o título sem entrar no caixa">
                  desc {money(p.valorDesconto)}
                </Badge>
              )}
              {(p.valorJuros ?? 0) > 0 && (
                <Badge variant="info" className="text-[10px] tabular-nums" title="Juros: receita extra, não abateu o título">
                  juros {money(p.valorJuros)}
                </Badge>
              )}
              {podeEstornar && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-danger hover:bg-danger-light"
                  aria-label={`Estornar baixa de ${money(p.valorPago)} de ${dataHoraBR(p.dataPagamento ?? p.criadoEm)}`}
                  title="Estornar baixa (reabre o título)"
                  disabled={estornando}
                  onClick={() => {
                    setMotivo('');
                    setAlvo(p);
                  }}
                >
                  <Undo2 className="h-3.5 w-3.5" aria-hidden />
                </Button>
              )}
            </div>
          </li>
        ))}
      </ol>

      {alvo && (
        <Dialog
          open
          onClose={() => {
            if (!estornando) {
              setAlvo(null);
              setMotivo('');
            }
          }}
          title="Estornar esta baixa?"
          description="O título é reaberto (valor volta ao saldo em aberto) e o valor sai do caixa aberto como movimento de estorno. A ação é auditada com o seu usuário."
          className="max-w-[460px]"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 rounded-card border border-border bg-page p-3 text-xs">
              <div>
                <p className="text-muted">Valor da baixa</p>
                <p className="font-semibold tabular-nums text-primary">{money(alvo.valorPago)}</p>
              </div>
              <div>
                <p className="text-muted">Data da baixa</p>
                <p className="font-medium text-primary">{dataHoraBR(alvo.dataPagamento ?? alvo.criadoEm)}</p>
              </div>
            </div>

            <Field
              label="Motivo do estorno (opcional)"
              id="estorno-motivo"
              hint="Vai para o movimento de caixa e para a auditoria — ex.: pagamento revertido pelo banco."
            >
              <Textarea
                id="estorno-motivo"
                rows={2}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                disabled={estornando}
                placeholder="Ex.: cliente pagou com cheque sem fundo"
                className="min-h-[48px]"
              />
            </Field>

            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button
                variant="outline"
                onClick={() => {
                  setAlvo(null);
                  setMotivo('');
                }}
                disabled={estornando}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => estornarMutation.mutate(alvo)}
                disabled={estornando}
              >
                {estornando ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Undo2 className="mr-2 h-4 w-4" aria-hidden />
                )}
                Estornar baixa
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
