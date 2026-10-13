import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Calculator, Check, Loader2, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, TextField } from '@/components/ui/field';
import { InlineLoading } from '@/components/ui/loading-state';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { money } from '@/components/financeiro/types';
import { ApiError } from '@/lib/apiClient';
import { useVendedores } from '@/components/financeiro/comissao/useVendedores';
import {
  apurarComissao,
  type ComissaoLancamentoDTO,
} from '@/lib/comissaoService';

type ItemForm = { categoria: string; subtotal: string };

type ApurarForm = {
  vendaNumero: string;
  vendaId: string;
  vendedorId: string;
  valorTotal: string;
  itens: ItemForm[];
};

const formVazio: ApurarForm = {
  vendaNumero: '',
  vendaId: '',
  vendedorId: '',
  valorTotal: '',
  itens: [],
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseValorBr(value: string): number {
  return Number(value.replace(/\./g, '').replace(',', '.')) || 0;
}

function mensagemErro(err: unknown): string {
  if (err instanceof ApiError) {
    return err.problem?.detail || err.problem?.message || err.message;
  }
  return 'Não foi possível apurar a comissão. Tente novamente.';
}

/**
 * ApurarComissaoDialog — apuração de comissão de uma venda (§3.6):
 * POST /v1/financeiro/comissoes/apurar.
 *
 * • itens por categoria são opcionais: sem itens, só a regra GERAL apura;
 * • idempotente por (vendaId, vendedorId) — informe o vendaId para reapurar
 *   com segurança;
 * • lista de vendedores vem de /v1/financeiro/comissoes/vendedores
 *   (VENDEDOR/OTICO ativos, liberado para ADMIN/GERENTE/FINANCEIRO) — o nome
 *   do vendedor é resolvido no backend a partir do vendedorId.
 */
export function ApurarComissaoDialog({
  open,
  onClose,
  categoriasSugeridas,
}: {
  open: boolean;
  onClose: () => void;
  /** Regras CATEGORIA ativas — sugestões de preenchimento (não obrigatórias). */
  categoriasSugeridas: string[];
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const vendedoresQuery = useVendedores();

  const [form, setForm] = React.useState<ApurarForm>(formVazio);
  const [erro, setErro] = React.useState<string | null>(null);
  const [resultado, setResultado] = React.useState<ComissaoLancamentoDTO[] | null>(null);

  React.useEffect(() => {
    if (open) {
      setForm(formVazio);
      setErro(null);
      setResultado(null);
    }
  }, [open]);

  const apurarMutation = useMutation({
    mutationFn: () => {
      const itens = form.itens
        .filter((it) => it.categoria.trim() && parseValorBr(it.subtotal) > 0)
        .map((it) => ({ categoria: it.categoria.trim(), subtotal: parseValorBr(it.subtotal) }));
      return apurarComissao({
        ...(form.vendaId.trim() ? { vendaId: form.vendaId.trim() } : {}),
        ...(form.vendaNumero.trim() ? { vendaNumero: form.vendaNumero.trim() } : {}),
        vendedorId: form.vendedorId.trim(),
        valorTotal: parseValorBr(form.valorTotal),
        ...(itens.length > 0 ? { itens } : {}),
      });
    },
    onSuccess: (lancamentos) => {
      queryClient.invalidateQueries({ queryKey: ['comissoes'] });
      setResultado(lancamentos);
      setErro(null);
      if (lancamentos.length === 0) {
        setErro(
          'Nenhuma regra se aplicou a esta venda — verifique as regras de comissão e as categorias informadas.',
        );
      } else {
        toast({
          variant: 'success',
          title: 'Comissão apurada',
          description: `${lancamentos.length} lançamento(s) gerado(s).`,
        });
      }
    },
    onError: (err: unknown) => setErro(mensagemErro(err)),
  });

  function validar(): string | null {
    if (!form.vendedorId.trim()) return 'Selecione o vendedor.';
    if (!UUID_RE.test(form.vendedorId.trim())) return 'vendedorId deve ser um UUID válido.';
    if (form.vendaId.trim() && !UUID_RE.test(form.vendaId.trim())) {
      return 'vendaId deve ser um UUID válido (ou deixe vazio).';
    }
    if (parseValorBr(form.valorTotal) <= 0) return 'Informe o valor total da venda (> 0).';
    const somaCategorias = form.itens.reduce(
      (sum, it) => sum + (it.categoria.trim() ? parseValorBr(it.subtotal) : 0),
      0,
    );
    if (somaCategorias > parseValorBr(form.valorTotal)) {
      return 'A soma dos subtotais por categoria excede o valor total da venda.';
    }
    return null;
  }

  function apurar() {
    const erroValidacao = validar();
    if (erroValidacao) {
      setErro(erroValidacao);
      return;
    }
    apurarMutation.mutate();
  }

  function addItem() {
    setForm((prev) => ({
      ...prev,
      itens: [...prev.itens, { categoria: '', subtotal: '' }],
    }));
  }

  function removeItem(index: number) {
    setForm((prev) => ({ ...prev, itens: prev.itens.filter((_, i) => i !== index) }));
  }

  if (!open) return null;

  return (
    <Dialog
      open
      onClose={onClose}
      title="Apurar comissão de venda"
      description="Lança a comissão do vendedor conforme as regras ativas — repetível sem duplicar quando o vendaId é informado."
      className="max-w-[560px]"
    >
      {resultado && resultado.length > 0 ? (
        <div className="space-y-4">
          <div className="rounded border border-success-light bg-success-light px-4 py-3">
            <p className="text-sm font-semibold text-success-dark">
              {resultado.length} lançamento(s) de comissão gerado(s)
            </p>
            <p className="text-xs text-success-dark">
              Lançamentos pendentes entram no fechamento por período.
            </p>
          </div>
          <ul className="divide-y divide-border rounded border border-border">
            {resultado.map((lanc) => (
              <li key={lanc.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs">
                <Badge variant={lanc.categoria ? 'secondary' : 'default'}>
                  {lanc.categoria ?? 'Geral'}
                </Badge>
                <span className="text-secondary">
                  Base <strong className="tabular-nums text-primary">{money(lanc.baseCalculo)}</strong>
                </span>
                <span className="text-secondary">
                  × <strong className="tabular-nums text-primary">{Number(lanc.percentualAplicado ?? 0).toFixed(2)}%</strong>
                </span>
                <span className="ml-auto font-semibold tabular-nums text-success-dark">
                  {money(lanc.valorComissao)}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="outline" onClick={() => { setResultado(null); setForm(formVazio); }}>
              Apurar outra venda
            </Button>
            <Button onClick={onClose}>
              <Check className="mr-2 h-4 w-4" aria-hidden />
              Concluir
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 py-1">
          {/* Vendedor */}
          {vendedoresQuery.isLoading ? (
            <InlineLoading label="Carregando vendedores…" />
          ) : vendedoresQuery.isError ? (
            <p role="alert" className="rounded border border-danger-light bg-danger-light px-3 py-2 text-xs text-danger-dark">
              Não foi possível carregar os vendedores — verifique a conexão e tente novamente.
            </p>
          ) : (
            <Field label="Vendedor" id="apur-vendedor" required hint="Somente perfis que apuram comissão (VENDEDOR, OTICO).">
              {(ctrl) => (
                <Select
                  id={ctrl.id}
                  value={form.vendedorId}
                  onChange={(e) => setForm((prev) => ({ ...prev, vendedorId: e.target.value }))}
                >
                  <option value="">Selecione…</option>
                  {(vendedoresQuery.data ?? []).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nome}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              label="Valor total da venda R$"
              required
              type="number"
              min={0.01}
              step="0.01"
              inputMode="decimal"
              placeholder="Ex.: 1500,00"
              value={form.valorTotal}
              onChange={(e) => setForm((prev) => ({ ...prev, valorTotal: e.target.value }))}
            />
            <TextField
              label="Nº da venda (referência)"
              placeholder="Ex.: OS-1042"
              value={form.vendaNumero}
              onChange={(e) => setForm((prev) => ({ ...prev, vendaNumero: e.target.value }))}
            />
          </div>

          <TextField
            label="vendaId (UUID, opcional)"
            placeholder="00000000-0000-…"
            hint="Informe para tornar a apuração idempotente — repetir não duplica o lançamento."
            value={form.vendaId}
            onChange={(e) => setForm((prev) => ({ ...prev, vendaId: e.target.value }))}
          />

          {/* Itens por categoria (opcional) */}
          <div className="rounded border border-border bg-page px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-primary">
                Itens por categoria{' '}
                <span className="font-normal text-muted">(opcional — habilita regras por categoria)</span>
              </p>
              <Button size="sm" variant="outline" className="h-7 gap-1" onClick={addItem}>
                <Plus className="h-3 w-3" aria-hidden />
                Item
              </Button>
            </div>

            {categoriasSugeridas.length > 0 && (
              <p className="mt-1 text-[11px] text-muted">
                Regras ativas para: {categoriasSugeridas.join(' · ')}
              </p>
            )}

            {form.itens.length === 0 ? (
              <p className="mt-2 text-[11px] text-secondary">
                Sem itens, apenas a regra GERAL apura sobre o valor total.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {form.itens.map((item, index) => (
                  <li key={index} className="flex items-end gap-2">
                    <div className="min-w-0 flex-1">
                      <TextField
                        label="Categoria"
                        placeholder={categoriasSugeridas[0] ?? 'Ex.: Lente'}
                        value={item.categoria}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            itens: prev.itens.map((it, i) =>
                              i === index ? { ...it, categoria: e.target.value } : it,
                            ),
                          }))
                        }
                      />
                    </div>
                    <div className="w-36">
                      <TextField
                        label="Subtotal R$"
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        value={item.subtotal}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            itens: prev.itens.map((it, i) =>
                              i === index ? { ...it, subtotal: e.target.value } : it,
                            ),
                          }))
                        }
                      />
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 shrink-0 text-muted hover:bg-danger-light hover:text-danger-dark"
                      onClick={() => removeItem(index)}
                      aria-label={`Remover item ${index + 1}`}
                      title="Remover item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {erro && (
            <p role="alert" className="rounded border border-danger-light bg-danger-light px-3 py-2 text-xs text-danger-dark">
              {erro}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="outline" onClick={onClose} disabled={apurarMutation.isPending}>
              Cancelar
            </Button>
            <Button onClick={apurar} disabled={apurarMutation.isPending} aria-busy={apurarMutation.isPending}>
              {apurarMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Calculator className="mr-2 h-4 w-4" aria-hidden />
              )}
              Apurar comissão
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
