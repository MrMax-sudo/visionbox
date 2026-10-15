import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, AlertCircle, Info, Plus, Trash2, Wallet, Calendar } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { LoadingState } from '@/components/ui/loading-state';
import { apiClient } from '@/lib/apiClient';
import { listarMaquininhas, type TipoCartao } from '@/lib/maquininhaService';
import { MdrPreview } from '@/components/pdv/MdrPreview';

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
  /** Só cartão (§3.5): maquininha que processou; vazio → MDR pendente (WARN backend). */
  maquininhaId?: string;
  /** Só crédito (§3.5): 1–12. Débito força 1 no payload. */
  parcelas?: number;
};

/** Linha pronta para o payload de finalizar (PDV monta o POST com estes campos). */
export type PagamentoConfirmado = {
  formaId: string;
  formaNome: string;
  valor: number;
  maquininhaId?: string;
  parcelas?: number;
};

type CartItem = { sku: string; nome: string; qtd: number; preco: number };

interface FinalizarVendaModalProps {
  open: boolean;
  onClose: () => void;
  onConfirmar: (pagamentos: PagamentoConfirmado[], previsaoEntrega?: string) => void;
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

  const [previsaoEntrega, setPrevisaoEntrega] = React.useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    d.setHours(17, 0, 0, 0);
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
  });

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

  // Mesma chave da tela Financeiro → invalidações de cadastro refletem aqui (§3.5).
  const maquininhasQuery = useQuery({
    queryKey: ['maquininhas'],
    queryFn: listarMaquininhas,
    staleTime: 60_000,
    enabled: open,
    retry: 1,
  });

  const formasAtivas = React.useMemo(
    () => (formasQuery.data ?? []).filter((f) => f.ativo),
    [formasQuery.data],
  );

  const maquininhasAtivas = React.useMemo(
    () => (maquininhasQuery.data ?? []).filter((m) => m.ativo !== false),
    [maquininhasQuery.data],
  );

  const formasById = React.useMemo(
    () => new Map(formasAtivas.map((f) => [f.id, f] as const)),
    [formasAtivas],
  );

  function tipoDaLinha(formaId: string): FormaPagamentoDTO['tipo'] | undefined {
    return formasById.get(formaId)?.tipo;
  }

  function ehCartao(tipo: FormaPagamentoDTO['tipo'] | undefined): boolean {
    return tipo === 'DEBITO' || tipo === 'CREDITO';
  }

  /** Defaults de linha de cartão: pré-seleciona a primeira maquininha ativa (teclado-first). */
  function defaultsDeCartao(tipo: FormaPagamentoDTO['tipo'] | undefined) {
    if (!ehCartao(tipo)) return {};
    return { maquininhaId: maquininhasAtivas[0]?.id ?? '', parcelas: 1 };
  }

  React.useEffect(() => {
    if (open) {
      setErro(null);
      if (formasAtivas.length > 0) {
        const padrao = formasAtivas.find((f) => f.padrao) ?? formasAtivas[0];
        setPagamentos([
          { formaId: padrao.id, formaNome: padrao.nome, valor: total, ...defaultsDeCartao(padrao.tipo) },
        ]);
      } else {
        setPagamentos([]);
      }
    }
  }, [open, formasAtivas]); // eslint-disable-line react-hooks/exhaustive-deps

  const somaPagamentos = pagamentos.reduce((sum, p) => sum + (p.valor || 0), 0);
  const restante = total - somaPagamentos;
  const saldoOk = Math.abs(restante) < 0.01;

  function adicionarForma() {
    const usados = new Set(pagamentos.map((p) => p.formaId));
    const disponivel = formasAtivas.find((f) => !usados.has(f.id));
    if (!disponivel) {
      setErro('Todas as formas de pagamento ativas já foram adicionadas.');
      return;
    }
    setPagamentos((prev) => [
      ...prev,
      {
        formaId: disponivel.id,
        formaNome: disponivel.nome,
        valor: Math.max(0, restante),
        ...defaultsDeCartao(disponivel.tipo),
      },
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
    const forma = formasAtivas.find((f) => f.id === formaId);
    const anterior = pagamentos[index];
    const eraCartao = anterior ? ehCartao(tipoDaLinha(anterior.formaId)) : false;
    setPagamentos((prev) =>
      prev.map((p, i) => {
        if (i !== index) return p;
        const tipo = forma?.tipo;
        if (!ehCartao(tipo)) {
          // forma não-cartão: nunca envia maquininhaId/parcelas
          return { ...p, formaId, formaNome: forma?.nome ?? p.formaNome, maquininhaId: undefined, parcelas: undefined };
        }
        return {
          ...p,
          formaId,
          formaNome: forma?.nome ?? p.formaNome,
          // preserva a maquininha se a linha já era cartão; senão pré-seleciona a primeira
          maquininhaId: eraCartao && p.maquininhaId ? p.maquininhaId : maquininhasAtivas[0]?.id ?? '',
          parcelas: tipo === 'DEBITO' ? 1 : eraCartao && p.parcelas ? p.parcelas : 1,
        };
      }),
    );
    setErro(null);
  }

  function atualizarMaquininha(index: number, maquininhaId: string) {
    setPagamentos((prev) => prev.map((p, i) => (i === index ? { ...p, maquininhaId } : p)));
    setErro(null);
  }

  function atualizarParcelas(index: number, parcelas: number) {
    setPagamentos((prev) => prev.map((p, i) => (i === index ? { ...p, parcelas } : p)));
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
    const linhas: PagamentoConfirmado[] = pagamentos.map((p) => {
      const tipo = tipoDaLinha(p.formaId);
      if (!ehCartao(tipo)) {
        return { formaId: p.formaId, formaNome: p.formaNome, valor: p.valor };
      }
      return {
        formaId: p.formaId,
        formaNome: p.formaNome,
        valor: p.valor,
        // sem seleção → envia sem maquininhaId: backend deixa MDR pendente (WARN) e concilia depois
        ...(p.maquininhaId ? { maquininhaId: p.maquininhaId } : {}),
        // débito força 1x (§3.5); crédito usa o selecionado (default 1)
        parcelas: tipo === 'DEBITO' ? 1 : (p.parcelas ?? 1),
      };
    });
    setErro(null);
    const dataIso = previsaoEntrega ? new Date(previsaoEntrega).toISOString() : undefined;
    onConfirmar(linhas, dataIso);
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
              {pagamentos.map((pag, index) => {
                const tipo = tipoDaLinha(pag.formaId);
                const isCartao = ehCartao(tipo);
                const isCredito = tipo === 'CREDITO';

                const linhaBasica = (
                  <>
                    <Select
                      value={pag.formaId}
                      onChange={(e) => trocarForma(index, e.target.value)}
                      className="min-w-0 flex-1"
                      aria-label={`Forma de pagamento ${index + 1}`}
                    >
                      {formasAtivas.map((forma) => (
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
                  </>
                );

                // Formas não-cartão: linha idêntica ao fluxo original (zero regressão)
                if (!isCartao) {
                  return (
                    <div key={`${pag.formaId}-${index}`} className="flex items-center gap-2">
                      {linhaBasica}
                    </div>
                  );
                }

                // Linha de cartão: maquininha + parcelas (crédito) + preview MDR
                return (
                  <div key={`${pag.formaId}-${index}`} className="rounded border border-border bg-page p-2">
                    <div className="flex items-center gap-2">{linhaBasica}</div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {maquininhasAtivas.length > 0 ? (
                        <Select
                          value={pag.maquininhaId ?? ''}
                          onChange={(e) => atualizarMaquininha(index, e.target.value)}
                          className="min-w-[150px] flex-1"
                          aria-label={`Maquininha da forma ${pag.formaNome}`}
                        >
                          <option value="">Sem maquininha — conciliar depois</option>
                          {maquininhasAtivas.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.nome ?? 'Maquininha'}{m.adquirente ? ` (${m.adquirente})` : ''}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <span className="min-w-0 flex-1 truncate text-[11px] text-muted">
                          {maquininhasQuery.isError
                            ? 'Maquininhas indisponíveis.'
                            : 'Loja sem maquininha cadastrada.'}
                        </span>
                      )}
                      {isCredito && (
                        <Select
                          value={String(pag.parcelas ?? 1)}
                          onChange={(e) => atualizarParcelas(index, Number(e.target.value))}
                          className="w-28"
                          aria-label={`Parcelas da forma ${pag.formaNome}`}
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                            <option key={n} value={n}>
                              {n}x{n === 1 ? ' (à vista)' : ''}
                            </option>
                          ))}
                        </Select>
                      )}
                    </div>

                    {/* Preview de taxa/líquido — só exibição; o backend é a verdade (§3.5) */}
                    {pag.maquininhaId ? (
                      <div className="mt-1">
                        <MdrPreview
                          maquininhaId={pag.maquininhaId}
                          valor={pag.valor}
                          tipo={tipo as TipoCartao}
                          parcelas={pag.parcelas ?? 1}
                        />
                      </div>
                    ) : (
                      <p
                        className="mt-1 flex items-center justify-end gap-1 text-[11px] text-warning-dark"
                        title="Pagamento sem maquininha: o MDR fica pendente e a taxa será conciliada depois (o backend registra WARN)."
                      >
                        <Info className="h-3 w-3 shrink-0" aria-hidden /> Taxa será conciliada depois
                      </p>
                    )}
                  </div>
                );
              })}
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

        {/* Prazo de Entrega prometido ao Cliente */}
        <div className="rounded-card border border-border bg-page p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-primary flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-brand" /> Prazo de Entrega dos Óculos (Prometido ao Cliente):
            </label>
            <span className="text-[10px] text-muted">Data e hora exatas</span>
          </div>
          <Input
            type="datetime-local"
            value={previsaoEntrega}
            onChange={(e) => setPrevisaoEntrega(e.target.value)}
            className="h-8 bg-card text-xs font-medium"
          />
          <p className="text-[11px] text-secondary">
            Este prazo com exatidão constará na OS, no cupom e no Portal de Rastreio do cliente.
          </p>
        </div>

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
