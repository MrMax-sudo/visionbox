import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { TextField } from '@/components/ui/field';
import {
  FAIXAS_TAXA,
  type MaquininhaDTO,
  type MaquininhaPayload,
} from '@/lib/maquininhaService';

/** Formulário — 8 campos de taxa: % e R$ fixo para 4 faixas. */
export type MaquininhaForm = {
  nome: string;
  adquirente: string;
  ativo: boolean;
  taxas: Record<(typeof FAIXAS_TAXA)[number]['chave'], { percentual: number; fixa: number }>;
};

export const maquininhaFormVazio: MaquininhaForm = {
  nome: '',
  adquirente: '',
  ativo: true,
  taxas: {
    debito: { percentual: 0, fixa: 0 },
    credito1x: { percentual: 0, fixa: 0 },
    credito2a6: { percentual: 0, fixa: 0 },
    credito7a12: { percentual: 0, fixa: 0 },
  },
};

export function formDaMaquininha(m: MaquininhaDTO): MaquininhaForm {
  return {
    nome: m.nome ?? '',
    adquirente: m.adquirente ?? '',
    ativo: m.ativo ?? true,
    taxas: {
      debito: { percentual: Number(m.debitoTaxaPercentual ?? 0), fixa: Number(m.debitoTaxaFixa ?? 0) },
      credito1x: { percentual: Number(m.credito1xTaxaPercentual ?? 0), fixa: Number(m.credito1xTaxaFixa ?? 0) },
      credito2a6: { percentual: Number(m.credito2a6TaxaPercentual ?? 0), fixa: Number(m.credito2a6TaxaFixa ?? 0) },
      credito7a12: { percentual: Number(m.credito7a12TaxaPercentual ?? 0), fixa: Number(m.credito7a12TaxaFixa ?? 0) },
    },
  };
}

export function payloadDoForm(form: MaquininhaForm): MaquininhaPayload {
  return {
    nome: form.nome.trim(),
    adquirente: form.adquirente.trim(),
    ativo: form.ativo,
    debitoTaxaPercentual: form.taxas.debito.percentual,
    debitoTaxaFixa: form.taxas.debito.fixa,
    credito1xTaxaPercentual: form.taxas.credito1x.percentual,
    credito1xTaxaFixa: form.taxas.credito1x.fixa,
    credito2a6TaxaPercentual: form.taxas.credito2a6.percentual,
    credito2a6TaxaFixa: form.taxas.credito2a6.fixa,
    credito7a12TaxaPercentual: form.taxas.credito7a12.percentual,
    credito7a12TaxaFixa: form.taxas.credito7a12.fixa,
  };
}

/** Validação de front (UX): omissões/limites também são barradas no backend. */
export function validarForm(form: MaquininhaForm): string | null {
  if (!form.nome.trim()) return 'Informe o nome da maquininha.';
  if (!form.adquirente.trim()) return 'Informe a adquirente (Cielo, Stone, Rede…).';
  for (const faixa of FAIXAS_TAXA) {
    if (form.taxas[faixa.chave].percentual < 0) return `Taxa % de "${faixa.rotulo}" não pode ser negativa.`;
    if (form.taxas[faixa.chave].fixa < 0) return `Taxa fixa de "${faixa.rotulo}" não pode ser negativa.`;
  }
  return null;
}

/**
 * MaquininhaFormDialog — criar/editar maquininha com taxas MDR (§3.5):
 * % + R$ fixo para débito, crédito 1x, 2–6x e 7–12x.
 */
export function MaquininhaFormDialog({
  editando,
  form,
  onChange,
  erro,
  isPending,
  onCancel,
  onSalvar,
}: {
  editando: MaquininhaDTO | null;
  form: MaquininhaForm;
  onChange: (f: MaquininhaForm) => void;
  erro: string | null;
  isPending: boolean;
  onCancel: () => void;
  onSalvar: () => void;
}) {
  return (
    <Dialog
      open
      onClose={onCancel}
      title={editando ? `Editar ${editando.nome}` : 'Nova maquininha'}
      description="Taxas percentuais (%) e fixas (R$) por faixa de pagamento — usadas no cálculo do líquido."
      className="max-w-[640px]"
    >
      <div className="space-y-4 py-1">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Nome"
            required
            value={form.nome}
            maxLength={80}
            placeholder="Ex.: Maquininha balcão"
            onChange={(e) => onChange({ ...form, nome: e.target.value })}
          />
          <TextField
            label="Adquirente"
            required
            value={form.adquirente}
            maxLength={80}
            placeholder="Ex.: Cielo, Stone, Rede, PagBank"
            onChange={(e) => onChange({ ...form, adquirente: e.target.value })}
          />
        </div>

        <div className="space-y-3">
          {FAIXAS_TAXA.map((faixa) => (
            <fieldset key={faixa.chave} className="rounded border border-border bg-page px-3 py-2.5">
              <legend className="px-1 text-xs font-semibold text-primary">
                {faixa.rotulo}
                <span className="ml-1 font-normal text-muted">— {faixa.hint}</span>
              </legend>
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  label="Taxa %"
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={form.taxas[faixa.chave].percentual}
                  onChange={(e) =>
                    onChange({
                      ...form,
                      taxas: {
                        ...form.taxas,
                        [faixa.chave]: {
                          ...form.taxas[faixa.chave],
                          percentual: Number(e.target.value) || 0,
                        },
                      },
                    })
                  }
                />
                <TextField
                  label="Taxa fixa R$"
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={form.taxas[faixa.chave].fixa}
                  onChange={(e) =>
                    onChange({
                      ...form,
                      taxas: {
                        ...form.taxas,
                        [faixa.chave]: {
                          ...form.taxas[faixa.chave],
                          fixa: Number(e.target.value) || 0,
                        },
                      },
                    })
                  }
                />
              </div>
            </fieldset>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 rounded border border-border bg-page px-3 py-2">
          <span className="text-xs font-medium text-primary">Ativa no cálculo do líquido</span>
          <Switch
            checked={form.ativo}
            onCheckedChange={(v) => onChange({ ...form, ativo: v })}
            aria-label="Maquininha ativa"
          />
        </div>

        {erro && (
          <p role="alert" className="rounded border border-danger-light bg-danger-light px-3 py-2 text-xs text-danger-dark">
            {erro}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button variant="outline" onClick={onCancel} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={onSalvar} disabled={isPending} aria-busy={isPending}>
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Check className="mr-2 h-4 w-4" aria-hidden />
            )}
            {editando ? 'Salvar' : 'Cadastrar'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
