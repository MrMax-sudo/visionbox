import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Check, Loader2, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient, ApiError } from '@/lib/apiClient';
import { cn } from '@/lib/utils';

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

// Alias: backend recebe tPagNfce via getTPagNfce()
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
  if (err instanceof ApiError) return err.message;
  return 'Não foi possível concluir. Tente novamente.';
}

export function FormasPagamentoConfig() {
  const queryClient = useQueryClient();
  const [aberto, setAberto] = React.useState(false);
  const [editando, setEditando] = React.useState<FormaPagamentoDTO | null>(null);
  const [form, setForm] = React.useState<FormaForm>(vazio);
  const [erro, setErro] = React.useState<string | null>(null);

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
    },
    onError: (err: unknown) => setErro(mensagemErro(err)),
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
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Formas de pagamento</h3>
        <Button size="sm" variant="outline" className="gap-1" onClick={abrirNovo}>
          <Plus className="h-3.5 w-3.5" /> Nova
        </Button>
      </div>

      {formasQuery.isLoading ? (
        <div className="mt-2 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-page)] p-3 text-xs text-[var(--color-text-muted)]">
          Carregando formas de pagamento...
        </div>
      ) : formasQuery.isError ? (
        <div className="mt-2 flex items-center gap-2 rounded-[var(--radius)] bg-[var(--color-danger-light)] p-2.5 text-xs text-[var(--color-danger-dark)]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{mensagemErro(formasQuery.error)}</span>
        </div>
      ) : (formasQuery.data ?? []).length === 0 ? (
        <div className="mt-2 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-page)] p-3 text-xs text-[var(--color-text-muted)]">
          Nenhuma forma de pagamento cadastrada.
        </div>
      ) : (
        <div className="mt-2 divide-y divide-[var(--color-border)] rounded-[var(--radius)] border border-[var(--color-border)]">
          {(formasQuery.data ?? []).map((fp) => (
            <div key={fp.id} className="flex items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm text-[var(--color-text-primary)]">{fp.nome}</span>
              <span className="shrink-0 rounded-md bg-[var(--color-bg-page)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
                {TIPOS_MAP[fp.tipo] ?? fp.tipo}
              </span>
              {fp.padrao && <Star className="h-3.5 w-3.5 shrink-0 fill-[var(--color-warning-dark)] text-[var(--color-warning-dark)]" aria-label="Padrão" />}
              <div className="flex shrink-0 items-center gap-0.5">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => abrirEdicao(fp)} aria-label={`Editar ${fp.nome}`}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-[var(--color-text-muted)] hover:text-[var(--color-danger-dark)]"
                  onClick={() => {
                    if (window.confirm(`Excluir a forma de pagamento "${fp.nome}"?`)) {
                      setErro(null);
                      removerMutation.mutate(fp.id);
                    }
                  }}
                  aria-label={`Excluir ${fp.nome}`}
                  disabled={removerMutation.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {erro && (
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-[var(--color-danger-light)] p-2.5 text-xs text-[var(--color-danger-dark)]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {aberto && (
        <DialogForm
          editando={editando}
          form={form}
          onChange={setForm}
          onTipoChange={mudarTipo}
          isPending={salvarMutation.isPending}
          onCancel={() => setAberto(false)}
          onSalvar={() => salvarMutation.mutate(form)}
        />
      )}
    </section>
  );
}

function DialogForm({
  editando,
  form,
  onChange,
  onTipoChange,
  isPending,
  onCancel,
  onSalvar,
}: {
  editando: FormaPagamentoDTO | null;
  form: FormaForm;
  onChange: (f: FormaForm) => void;
  onTipoChange: (t: TipoForma) => void;
  isPending: boolean;
  onCancel: () => void;
  onSalvar: () => void;
}) {
  return (
    <DialogSmall
      open
      onClose={onCancel}
      title={editando ? 'Editar forma de pagamento' : 'Nova forma de pagamento'}
      description={editando ? 'Atualize os dados e salve.' : 'Cadastre uma nova forma aceita no PDV.'}
    >
      <div className="space-y-3">
        <Field label="Nome">
          <Input
            value={form.nome}
            onChange={(e) => onChange({ ...form, nome: e.target.value })}
            placeholder="Ex.: Crédito 3x"
            maxLength={60}
          />
        </Field>
        <Field label="Tipo">
          <select
            value={form.tipo}
            onChange={(e) => onTipoChange(e.target.value as TipoForma)}
            className="h-10 w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 text-sm text-[var(--color-text-primary)]"
          >
            {(Object.keys(TIPOS_MAP) as TipoForma[]).map((t) => (
              <option key={t} value={t}>
                {TIPOS_MAP[t]}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Taxa %">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.taxaPercentual}
              onChange={(e) => onChange({ ...form, taxaPercentual: Number(e.target.value) || 0 })}
            />
          </Field>
          <Field label="Prazo (dias)">
            <Input
              type="number"
              min={0}
              step="1"
              value={form.prazoDias}
              onChange={(e) => onChange({ ...form, prazoDias: Number(e.target.value) || 0 })}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Máx. parcelas">
            <Input
              type="number"
              min={1}
              step="1"
              value={form.maxParcelas}
              onChange={(e) => onChange({ ...form, maxParcelas: Math.max(1, Number(e.target.value) || 1) })}
            />
          </Field>
          <Field label="Código NFC-e (tPag)">
            <Input
              value={form.tPagNfce}
              onChange={(e) => onChange({ ...form, tPagNfce: e.target.value })}
              placeholder="01, 03, 04, 17, 99..."
              maxLength={2}
            />
          </Field>
        </div>
        <div className="flex gap-5 pt-1">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text-primary)]">
            <input
              type="checkbox"
              checked={form.permiteParcelar}
              onChange={(e) => onChange({ ...form, permiteParcelar: e.target.checked })}
              className="h-4 w-4 accent-[var(--color-primary)]"
            />
            Permite parcelar
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text-primary)]">
            <input
              type="checkbox"
              checked={form.padrao}
              onChange={(e) => onChange({ ...form, padrao: e.target.checked })}
              className="h-4 w-4 accent-[var(--color-primary)]"
            />
            Padrão no PDV
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text-primary)]">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => onChange({ ...form, ativo: e.target.checked })}
              className="h-4 w-4 accent-[var(--color-primary)]"
            />
            Ativa
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] pt-3">
          <Button variant="outline" onClick={onCancel} disabled={isPending}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={onSalvar} disabled={isPending} aria-busy={isPending}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            {editando ? 'Salvar' : 'Cadastrar'}
          </Button>
        </div>
      </div>
    </DialogSmall>
  );
}

function DialogSmall({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('fixed inset-0 z-[60] flex items-center justify-center', !open && 'hidden')}>
      <div className="absolute inset-0 bg-[var(--color-text-primary)]/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative max-h-[90vh] w-full max-w-[420px] overflow-auto rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 shadow-xl"
      >
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{description}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">{label}</span>
      {children}
    </label>
  );
}