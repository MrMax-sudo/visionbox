import * as React from 'react';
import { useMutation } from '@tanstack/react-query';
import { Calculator, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, TextField } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { money } from '@/components/financeiro/types';
import { ApiError } from '@/lib/apiClient';
import {
  calcularLiquido,
  type MaquininhaDTO,
  type ResultadoMdrDTO,
  type TipoCartao,
} from '@/lib/maquininhaService';

/**
 * SimuladorMdrCard — simulação de líquido (§3.5): valor bruto + tipo/parcelas
 * → POST /v1/financeiro/maquininhas/{id}/calcular-liquido. O cálculo de moeda e
 * arredondamento fica SEMPRE no backend (HALF_EVEN 2 casas) — o front só exibe.
 */
export function SimuladorMdrCard({ maquininhas }: { maquininhas: MaquininhaDTO[] }) {
  const [maquininhaId, setMaquininhaId] = React.useState<string>('');
  const [valor, setValor] = React.useState<string>('');
  const [tipo, setTipo] = React.useState<TipoCartao>('CREDITO');
  const [parcelas, setParcelas] = React.useState<number>(1);
  const [erro, setErro] = React.useState<string | null>(null);
  const [resultado, setResultado] = React.useState<ResultadoMdrDTO | null>(null);

  React.useEffect(() => {
    // pré-seleciona a primeira maquininha quando a lista chega
    setMaquininhaId((atual) => atual || maquininhas[0]?.id || '');
  }, [maquininhas]);

  const simulacao = useMutation({
    mutationFn: () =>
      calcularLiquido(maquininhaId, {
        valor: Number(valor.replace(',', '.')),
        tipo,
        parcelas: tipo === 'DEBITO' ? 1 : parcelas,
      }),
    onSuccess: (res) => {
      setResultado(res);
      setErro(null);
    },
    onError: (err: unknown) => {
      setResultado(null);
      setErro(
        err instanceof ApiError
          ? err.problem?.detail || err.problem?.message || err.message
          : 'Falha ao calcular o líquido. Tente novamente.',
      );
    },
  });

  function calcular() {
    setErro(null);
    const valorNum = Number(valor.replace(',', '.'));
    if (!maquininhaId) {
      setErro('Selecione uma maquininha.');
      return;
    }
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      setErro('Informe um valor bruto maior que zero.');
      return;
    }
    simulacao.mutate();
  }

  const semMaquininhas = maquininhas.length === 0;

  return (
    <section
      aria-label="Simulador de valor líquido"
      className="rounded-card border border-border bg-card p-5 shadow-soft"
    >
      <div className="flex items-center gap-2">
        <Calculator className="h-4 w-4 text-brand" aria-hidden />
        <h2 className="text-sm font-semibold text-primary">Simulador de líquido</h2>
      </div>
      <p className="mt-0.5 text-xs text-secondary">
        Estime o valor líquido de um pagamento: taxa aplicada conforme a faixa (débito, 1x, 2–6x ou 7–12x).
      </p>

      {semMaquininhas ? (
        <p className="mt-4 rounded border border-dashed border-border bg-page px-3 py-6 text-center text-xs text-secondary">
          Cadastre uma maquininha para simular o líquido.
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Maquininha" id="sim-maquininha">
              {(ctrl) => (
                <Select
                  id={ctrl.id}
                  value={maquininhaId}
                  onChange={(e) => setMaquininhaId(e.target.value)}
                >
                  {maquininhas.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome} ({m.adquirente})
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <TextField
              label="Valor bruto R$"
              id="sim-valor"
              type="number"
              min={0.01}
              step="0.01"
              inputMode="decimal"
              placeholder="Ex.: 1500,00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />

            <Field label="Tipo" id="sim-tipo">
              {(ctrl) => (
                <Select
                  id={ctrl.id}
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as TipoCartao)}
                >
                  <option value="DEBITO">Débito (à vista)</option>
                  <option value="CREDITO">Crédito</option>
                </Select>
              )}
            </Field>

            <Field
              label="Parcelas"
              id="sim-parcelas"
              hint={tipo === 'DEBITO' ? 'Débito é sempre à vista (1x).' : undefined}
            >
              {(ctrl) => (
                <Select
                  id={ctrl.id}
                  value={String(tipo === 'DEBITO' ? 1 : parcelas)}
                  disabled={tipo === 'DEBITO'}
                  onChange={(e) => setParcelas(Number(e.target.value))}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}x{n === 1 ? ' (à vista)' : ''}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          <div className="mt-4 flex justify-end">
            <Button onClick={calcular} disabled={simulacao.isPending} aria-busy={simulacao.isPending}>
              {simulacao.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Calculator className="mr-2 h-4 w-4" aria-hidden />
              )}
              Calcular líquido
            </Button>
          </div>

          {erro && (
            <p role="alert" className="mt-3 rounded border border-danger-light bg-danger-light px-3 py-2 text-xs text-danger-dark">
              {erro}
            </p>
          )}

          {resultado && (
            <div
              aria-live="polite"
              className="mt-4 grid grid-cols-2 gap-3 rounded border border-primary-light bg-primary-light/50 p-4 sm:grid-cols-4"
            >
              <div>
                <p className="text-[11px] text-muted">Faixa aplicada</p>
                <p className="text-sm font-semibold text-primary">{resultado.faixa ?? '—'}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted">Taxa</p>
                <p className="text-sm font-semibold tabular-nums text-danger-dark">
                  −{money(resultado.taxaValor)}
                </p>
                <p className="text-[11px] text-muted">
                  {Number(resultado.taxaPercentual ?? 0).toFixed(2)}% + {money(resultado.taxaFixa)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted">Valor bruto</p>
                <p className="text-sm font-semibold tabular-nums text-secondary">
                  {money(resultado.valorBruto)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted">Valor líquido</p>
                <p className="text-lg font-bold tabular-nums text-success-dark">
                  {money(resultado.valorLiquido)}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
