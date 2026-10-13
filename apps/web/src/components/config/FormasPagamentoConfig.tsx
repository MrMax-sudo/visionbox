import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Field, TextField } from '@/components/ui/field';
import { LoadingRows } from '@/components/ui/loading-state';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { apiClient, ApiError } from '@/lib/apiClient';

type TipoForma = 'DINHEIRO' | 'PIX' | 'DEBITO' | 'CREDITO' | 'CREDIARIO';

type FormaPagamentoDTO = {
  id: string;
  nome: string;
  tipo: TipoForma;
  ativo: boolean;
  padrao: boolean;
  taxaPercentual?: number;
  prazoDias?: number;
  permiteParcelar: boolean;
  maxParcelas?: number;
  tPagNfce?: string;
};

type FormaForm = {
  nome: string;
  tipo: TipoForma;
  ativo: boolean;
  padrao: boolean;
  taxaPercentual: number;
  prazoDias: number;
  permiteParcelar: boolean;
  maxParcelas: number;
  tPagNfce: string;
};

const TIPOS_MAP: Record<TipoForma, string> = {
  DINHEIRO: 'Dinheiro',
  PIX: 'Pix',
  DEBITO: 'Débito',
  CREDITO: 'Crédito',
  CREDIARIO: 'Crediário',
};

// Alias: backend recebe tPagNfce via getTPagNfce() — contrato inalterado
const TPAG_PADRAO: Record<TipoForma, string> = {
  DINHEIRO: '01',
  PIX: '17',
  DEBITO: '04',
  CREDITO: '03',
  CREDIARIO: '99',
};

const vazio: FormaForm = {
  nome: '',
  tipo: 'PIX',
  ativo: true,
  padrao: false,
  taxaPercentual: 0,
  prazoDias: 0,
  permiteParcelar: false,
  maxParcelas: 1,
  tPagNfce: TPAG_PADRAO.PIX,
};

function mensagemErro(err: unknown): string {
  if (err instanceof ApiError) {
    return err.problem?.detail || err.problem?.message || err.message;
  }
  return 'Não foi possível concluir. Tente novamente.';
}

function detalhes(fp: FormaPagamentoDTO): string {
  const partes: string[] = [];
  if ((fp.taxaPercentual ?? 0) > 0) partes.push(`Taxa ${fp.taxaPercentual}%`);
  if ((fp.prazoDias ?? 0) > 0) partes.push(`Recebimento em ${fp.prazoDias}d`);
  if (fp.permiteParcelar) partes.push(`Até ${fp.maxParcelas ?? 1}x`);
  return partes.length > 0 ? partes.join(' · ') : 'Sem taxas ou prazos';
}

/**
 * Seção Formas de pagamento do diálogo de Configurações (ONDA 2D).
 * CRUD em /v1/financeiro/formas-pagamento (exclusão = soft-delete no backend).
 */
export function FormasPagamentoConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [aberto, setAberto] = React.useState(false);
  const [editando, setEditando] = React.useState<FormaPagamentoDTO | null>(null);
  const [form, setForm] = React.useState<FormaForm>(vazio);
  const [erro, setErro] = React.useState<string | null>(null);
  const [excluindo, setExcluindo] = React.useState<FormaPagamentoDTO | null>(null);

  const formasQuery = useQuery({
    queryKey: ['formas-pagamento-config'],
    queryFn: async () => {
      const res = await apiClient.get<FormaPagamentoDTO[]>('/v1/financeiro/formas-pagamento');
      return res.data;
    },
  });

  const salvarMutation = useMutation({
    mutationFn: async (payload: FormaForm) => {
      if (editando) {
        await apiClient.put(`/v1/financeiro/formas-pagamento/${editando.id}`, payload);
      } else {
        await apiClient.post('/v1/financeiro/formas-pagamento', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formas-pagamento-config'] });
      queryClient.invalidateQueries({ queryKey: ['formas-pagamento'] });
      toast({
        variant: 'success',
        title: editando ? 'Forma de pagamento atualizada' : 'Forma de pagamento criada',
        description: `${form.nome} já está disponível no PDV.`,
      });
      setAberto(false);
      setEditando(null);
      setForm(vazio);
      setErro(null);
    },
    onError: (err: unknown) => setErro(mensagemErro(err)),
  });

  const removerMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/v1/financeiro/formas-pagamento/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formas-pagamento-config'] });
      queryClient.invalidateQueries({ queryKey: ['formas-pagamento'] });
      toast({
        variant: 'success',
        title: 'Forma de pagamento removida',
        description: 'Ela saiu da lista ativa do PDV.',
      });
      setExcluindo(null);
      setErro(null);
    },
    onError: (err: unknown) => {
      setErro(mensagemErro(err));
      setExcluindo(null);
    },
  });

  const abrirNovo = () => {
    setEditando(null);
    setForm(vazio);
    setErro(null);
    setAberto(true);
  };

  const abrirEdicao = (fp: FormaPagamentoDTO) => {
    setEditando(fp);
    setForm({
      nome: fp.nome,
      tipo: fp.tipo,
      ativo: fp.ativo,
      padrao: fp.padrao,
      taxaPercentual: Number(fp.taxaPercentual ?? 0),
      prazoDias: Number(fp.prazoDias ?? 0),
      permiteParcelar: fp.permiteParcelar,
      maxParcelas: Number(fp.maxParcelas ?? 1),
      tPagNfce: fp.tPagNfce ?? TPAG_PADRAO[fp.tipo],
    });
    setErro(null);
    setAberto(true);
  };

  const mudarTipo = (tipo: TipoForma) => {
    setForm((prev) => ({ ...prev, tipo, tPagNfce: TPAG_PADRAO[tipo] }));
  };

  return (
    <section>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Formas de pagamento
        </h3>
        <Button size="sm" variant="outline" className="gap-1" onClick={abrirNovo}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Nova
        </Button>
      </div>

      <div className="mt-3">
        {formasQuery.isLoading ? (
          <LoadingRows rows={4} />
        ) : formasQuery.isError ? (
          <ErrorState
            error={formasQuery.error}
            compact
            onRetry={() => formasQuery.refetch()}
          />
        ) : (formasQuery.data ?? []).length === 0 ? (
          <EmptyState
            title="Nenhuma forma de pagamento"
            description="Cadastre dinheiro, Pix, cartão ou crediário para liberar o fluxo de pagamento do PDV."
            action={
              <Button size="sm" onClick={abrirNovo}>
                <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Cadastrar primeira
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-border rounded-card border border-border bg-card">
            {(formasQuery.data ?? []).map((fp) => (
              <div key={fp.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-primary">
                  {fp.nome}
                </span>

                <span className="rounded-full bg-secondary-light px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-secondary-dark">
                  {TIPOS_MAP[fp.tipo] ?? fp.tipo}
                </span>

                {fp.padrao && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-warning-light px-2 py-0.5 text-[11px] font-semibold text-warning-dark">
                    <Star className="h-3 w-3 fill-current" aria-hidden />
                    Padrão
                  </span>
                )}

                <span className="text-xs text-muted">{detalhes(fp)}</span>

                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => abrirEdicao(fp)}
                    aria-label={`Editar ${fp.nome}`}
                    title="Editar"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted hover:bg-danger-light hover:text-danger-dark"
                    onClick={() => {
                      setErro(null);
                      setExcluindo(fp);
                    }}
                    aria-label={`Excluir ${fp.nome}`}
                    title="Excluir"
                    disabled={removerMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {erro && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded border border-danger-light bg-danger-light px-3 py-2 text-xs text-danger-dark"
        >
          <span className="min-w-0 flex-1">{erro}</span>
          <button
            type="button"
            onClick={() => setErro(null)}
            className="shrink-0 text-[11px] font-semibold underline underline-offset-2"
          >
            fechar
          </button>
        </div>
      )}

      {aberto && (
        <FormaPagamentoDialog
          editando={editando}
          form={form}
          erro={salvarMutation.isError ? erro : null}
          onChange={setForm}
          onTipoChange={mudarTipo}
          isPending={salvarMutation.isPending}
          onCancel={() => setAberto(false)}
          onSalvar={() => salvarMutation.mutate(form)}
        />
      )}

      {excluindo && (
        <Dialog
          open
          onClose={() => setExcluindo(null)}
          title="Excluir forma de pagamento"
          description="Ela deixará de aparecer no PDV desta loja."
        >
          <p className="py-2 text-sm text-secondary">
            Confirmar a exclusão de{' '}
            <span className="font-semibold text-primary">{excluindo.nome}</span>?
          </p>
          <div className="mt-4 flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="outline" onClick={() => setExcluindo(null)} disabled={removerMutation.isPending}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => removerMutation.mutate(excluindo.id)}
              disabled={removerMutation.isPending}
              aria-busy={removerMutation.isPending}
            >
              {removerMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" aria-hidden />
              )}
              Excluir
            </Button>
          </div>
        </Dialog>
      )}
    </section>
  );
}

/* --------------------------- Dialog criar/editar ------------------------ */

function FormaPagamentoDialog({
  editando,
  form,
  erro,
  onChange,
  onTipoChange,
  isPending,
  onCancel,
  onSalvar,
}: {
  editando: FormaPagamentoDTO | null;
  form: FormaForm;
  erro: string | null;
  onChange: (f: FormaForm) => void;
  onTipoChange: (t: TipoForma) => void;
  isPending: boolean;
  onCancel: () => void;
  onSalvar: () => void;
}) {
  return (
    <Dialog
      open
      onClose={onCancel}
      title={editando ? 'Editar forma de pagamento' : 'Nova forma de pagamento'}
      description={
        editando
          ? 'Atualize taxas, prazos e opções de parcelamento.'
          : 'Cadastre uma nova forma aceita no PDV.'
      }
      className="max-w-[520px]"
    >
      <div className="space-y-3 py-1">
        <TextField
          label="Nome"
          value={form.nome}
          onChange={(e) => onChange({ ...form, nome: e.target.value })}
          placeholder="Ex.: Crédito 3x"
          maxLength={60}
        />

        <Field label="Tipo">
          <Select
            value={form.tipo}
            onChange={(e) => onTipoChange(e.target.value as TipoForma)}
          >
            {(Object.keys(TIPOS_MAP) as TipoForma[]).map((t) => (
              <option key={t} value={t}>
                {TIPOS_MAP[t]}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Taxa %"
            type="number"
            min={0}
            step="0.01"
            value={form.taxaPercentual}
            onChange={(e) => onChange({ ...form, taxaPercentual: Number(e.target.value) || 0 })}
          />
          <TextField
            label="Prazo (dias)"
            type="number"
            min={0}
            step="1"
            value={form.prazoDias}
            onChange={(e) => onChange({ ...form, prazoDias: Number(e.target.value) || 0 })}
          />
        </div>

        {form.permiteParcelar && (
          <TextField
            label="Máx. parcelas"
            type="number"
            min={1}
            step="1"
            value={form.maxParcelas}
            onChange={(e) =>
              onChange({ ...form, maxParcelas: Math.max(1, Number(e.target.value) || 1) })
            }
          />
        )}

        <div className="grid gap-2 sm:grid-cols-3">
          <SwitchRow
            label="Permite parcelar"
            checked={form.permiteParcelar}
            onCheckedChange={(v) => onChange({ ...form, permiteParcelar: v })}
          />
          <SwitchRow
            label="Padrão no PDV"
            checked={form.padrao}
            onCheckedChange={(v) => onChange({ ...form, padrao: v })}
          />
          <SwitchRow
            label="Ativa"
            checked={form.ativo}
            onCheckedChange={(v) => onChange({ ...form, ativo: v })}
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

function SwitchRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded border border-border bg-page px-3 py-2">
      <span className="text-xs font-medium text-primary">{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
    </div>
  );
}
