import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, AlertCircle, Plus, Trash2, Wallet } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { LoadingState } from '@/components/ui/loading-state';
import { apiClient } from '@/lib/apiClient';

export type FormaPagamentoDTO = {
  id: string;
  nome: string;
  tipo: 'DINHEIRO' | 'PIX' | 'DEBITO' | 'CREDITO' | 'CREDIARIO';
  ativo: boolean;
  padrao: boolean;
  taxaPercentual?: number;
  prazoDias?: number;
  permiteParcelar: boolean;
  maxParcelas?: number;
  tPagNfce?: string;
};

type PagamentoLinha = {
  formaId: string;
  formaNome: string;
  valor: number;
};

type CartItem = { sku: string; nome: string; qtd: number; preco: number };

interface FinalizarVendaModalProps {
  open: boolean;
  onClose: () => void;
  onConfirmar: (pagamentos: PagamentoLinha[]) => void;
  itens: CartItem[];
  subtotal: number;
  desconto: number;
  total: number;
  clienteNome: string;
  isPending?: boolean;
  tipoCupom?: import('@/components/pdv/pdvHelpers').TipoCupom;
  onTipoCupomChange?: (tipo: import('@/components/pdv/pdvHelpers').TipoCupom) => void;
}

function currency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Finalizar Venda (PDV) — ONDA 2A: só camada visual.
 * Rateio de pagamentos, validação de saldo e contrato `onConfirmar` inalterados.
 */
export function FinalizarVendaModal({
  open,
  onClose,
  onConfirmar,
  itens,
  subtotal,
  desconto,
  total,
  clienteNome,
  isPending,
  tipoCupom,
  onTipoCupomChange,
}: FinalizarVendaModalProps) {
  const [pagamentos, setPagamentos] = React.useState<PagamentoLinha[]>([]);
  const [erro, setErro] = React.useState<string | null>(null);

  const formasQuery = useQuery({
    queryKey: ['formas-pagamento'],
    queryFn: async () => {
      const res = await apiClient.get<FormaPagamentoDTO[]>('/v1/financeiro/formas-pagamento');
      return res.data;
    },
    staleTime: 60_000,
    enabled: open,
    retry: 1,
  });

  React.useEffect(() => {
    if (open) {
      setErro(null);
      const formas = formasQuery.data;
      if (formas && formas.length > 0) {
        const padrao = formas.find((f) => f.padrao) ?? formas[0];
        setPagamentos([{ formaId: padrao.id, formaNome: padrao.nome, valor: total }]);
      } else {
        setPagamentos([]);
      }
    }
  }, [open, formasQuery.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const somaPagamentos = pagamentos.reduce((sum, p) => sum + (p.valor || 0), 0);
  const restante = total - somaPagamentos;
  const saldoOk = Math.abs(restante) < 0.01;

  function adicionarForma() {
    const formas = formasQuery.data ?? [];
    const usados = new Set(pagamentos.map((p) => p.formaId));
    const disponivel = formas.find((f) => !usados.has(f.id));
    if (!disponivel) {
      setErro('Todas as formas de pagamento já foram adicionadas.');
      return;
    }
    setPagamentos((prev) => [
      ...prev,
      { formaId: disponivel.id, formaNome: disponivel.nome, valor: Math.max(0, restante) },
    ]);
    setErro(null);
  }

  function removerForma(index: number) {
    setPagamentos((prev) => prev.filter((_, i) => i !== index));
    setErro(null);
  }

  function atualizarValor(index: number, valor: number) {
    setPagamentos((prev) => prev.map((p, i) => (i === index ? { ...p, valor } : p)));
    setErro(null);
  }

  function trocarForma(index: number, formaId: string) {
    const forma = (formasQuery.data ?? []).find((f) => f.id === formaId);
    setPagamentos((prev) =>
      prev.map((p, i) => (i === index ? { ...p, formaId, formaNome: forma?.nome ?? p.formaNome } : p)),
    );
    setErro(null);
  }

  function handleConfirmar() {
    if (pagamentos.length === 0) {
      setErro('Adicione ao menos uma forma de pagamento.');
      return;
    }
    if (!saldoOk) {
      setErro(
        restante > 0
          ? `Falta distribuir ${currency(restante)} para completar o total.`
          : `Pagamentos excedem o total em ${currency(Math.abs(restante))}.`,
      );
      return;
    }
    if (pagamentos.some((p) => p.valor <= 0)) {
      setErro('Todos os pagamentos devem ter valor maior que zero.');
      return;
    }
    setErro(null);
    onConfirmar(pagamentos);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Finalizar Venda"
      description={`Cliente: ${clienteNome} — confirme as formas de pagamento antes de concluir.`}
      className="max-w-[620px]"
    >
      <div className="space-y-4">
        {/* Resumo da venda */}
        <div className="rounded-card border border-border bg-page p-3 text-sm">
          <div className="mb-2 flex items-center gap-2">
            <Wallet className="h-4 w-4 text-brand" aria-hidden />
            <span className="font-semibold text-primary">Resumo</span>
          </div>
          <div className="max-h-32 space-y-1 overflow-y-auto text-xs text-secondary">
            {itens.map((item) => (
              <div key={item.sku} className="flex justify-between gap-2">
                <span className="truncate">
                  {item.nome} × {item.qtd}
                </span>
                <span className="shrink-0">{currency(item.preco * item.qtd)}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 space-y-1 border-t border-border pt-2 text-xs">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{currency(subtotal)}</span>
            </div>
            {desconto > 0 && (
              <div className="flex justify-between text-danger-dark">
                <span>Desconto</span>
                <span>-{currency(desconto)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold text-primary">
              <span>Total</span>
              <span>{currency(total)}</span>
            </div>
          </div>
        </div>

        {/* Formas de pagamento */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span id="pdv-pagamentos-label" className="text-xs font-semibold text-primary">
              Formas de pagamento
            </span>
            <Button variant="outline" size="sm" className="gap-1" onClick={adicionarForma}>
              <Plus className="h-3.5 w-3.5" aria-hidden /> Adicionar
            </Button>
          </div>

          {formasQuery.isLoading ? (
            <LoadingState compact title="Carregando formas de pagamento…" />
          ) : formasQuery.isError ? (
            <div
              role="alert"
              className="rounded-card border border-danger-light bg-danger-light px-3 py-2 text-xs text-danger-dark"
            >
              Não foi possível carregar as formas de pagamento. Verifique a conexão e reabra o
              diálogo.
            </div>
          ) : pagamentos.length === 0 ? (
            <p className="rounded-card border border-dashed border-border px-3 py-3 text-center text-xs text-muted">
              Nenhuma forma de pagamento selecionada. Clique em “Adicionar”.
            </p>
          ) : (
            <div className="space-y-2">
              {pagamentos.map((pag, index) => (
                <div key={`${pag.formaId}-${index}`} className="flex items-center gap-2">
                  <Select
                    value={pag.formaId}
                    onChange={(e) => trocarForma(index, e.target.value)}
                    className="min-w-0 flex-1"
                    aria-label={`Forma de pagamento ${index + 1}`}
                  >
                    {(formasQuery.data ?? []).map((forma) => (
                      <option key={forma.id} value={forma.id}>
                        {forma.nome}
                      </option>
                    ))}
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={pag.valor}
                    onChange={(e) => atualizarValor(index, Number(e.target.value) || 0)}
                    className="w-32 text-right"
                    aria-label={`Valor ${pag.formaNome}`}
                  />
                  <button
                    type="button"
                    onClick={() => removerForma(index)}
                    className="rounded p-1.5 text-muted transition-colors hover:bg-danger-light hover:text-danger-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label={`Remover ${pag.formaNome}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Indicador de saldo */}
          {pagamentos.length > 0 && (
            <div
              role="status"
              aria-live="polite"
              className={`flex items-center justify-between rounded px-3 py-2 text-xs font-semibold ${
                saldoOk ? 'bg-success-light text-success-dark' : 'bg-warning-light text-warning-dark'
              }`}
            >
              <span>
                {saldoOk
                  ? 'Pagamento completo'
                  : restante > 0
                    ? 'Restante a distribuir'
                    : 'Excedente'}
              </span>
              <span>{currency(Math.abs(restante))}</span>
            </div>
          )}
        </div>

        {/* Erro */}
        {erro && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-card border border-danger-light bg-danger-light p-2.5 text-xs text-danger-dark"
          >
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
            <span>{erro}</span>
          </div>
        )}

        {/* Confirmação do Documento / Cupom */}
        {tipoCupom && onTipoCupomChange && (
          <div className="flex items-center justify-between rounded-card border border-border bg-page p-2.5 text-xs">
            <span className="font-semibold text-secondary">Documento / Emissão:</span>
            <div className="flex gap-1" role="group" aria-label="Tipo de documento">
              {(['CUPOM', 'NFCE', 'DANFE'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onTipoCupomChange(t)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                    tipoCupom === t
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-card border border-border text-secondary hover:text-primary'
                  }`}
                >
                  {t === 'CUPOM' ? 'Cupom' : t === 'NFCE' ? 'NFC-e' : 'DANFE'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Ações */}
        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmar} disabled={isPending} aria-busy={isPending}>
            <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden />
            {isPending ? 'Concluindo...' : 'Confirmar e Concluir'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
