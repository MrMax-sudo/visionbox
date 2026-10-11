import { FilterX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { STATUS_CONTAS, rotuloStatus } from './types';

/**
 * Filtros da tela Financeiro.
 *  • Status → parâmetro `status` do GET /contas-{receber|pagar} (contrato existente);
 *  • Período (de/ate) → recorte por vencimento aplicado na listagem/totais/DRE.
 */
export function FinanceiroFilters({
  status,
  onStatus,
  de,
  ate,
  onDe,
  onAte,
  onLimpar,
}: {
  status: string;
  onStatus: (v: string) => void;
  de: string;
  ate: string;
  onDe: (v: string) => void;
  onAte: (v: string) => void;
  onLimpar: () => void;
}) {
  const temFiltro = Boolean(status || de || ate);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-44">
        <Field label="Status">
          <Select value={status} onChange={(e) => onStatus(e.target.value)}>
            <option value="">Todos</option>
            {STATUS_CONTAS.map((s) => (
              <option key={s} value={s}>
                {rotuloStatus[s]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="w-40">
        <Field label="Vencimento de">
          <Input type="date" value={de} onChange={(e) => onDe(e.target.value)} />
        </Field>
      </div>

      <div className="w-40">
        <Field label="Vencimento até">
          <Input type="date" value={ate} onChange={(e) => onAte(e.target.value)} />
        </Field>
      </div>

      {temFiltro && (
        <Button variant="ghost" size="sm" className="h-9 gap-1.5" onClick={onLimpar}>
          <FilterX className="h-3.5 w-3.5" aria-hidden />
          Limpar
        </Button>
      )}
    </div>
  );
}
