import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Field, TextField } from '@/components/ui/field';
import { LoadingRows } from '@/components/ui/loading-state';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { ApiError } from '@/lib/apiClient';
import {
  atualizarConfigComissao,
  criarConfigComissao,
  listarConfigComissoes,
  removerConfigComissao,
  type ComissaoConfigDTO,
  type ComissaoConfigPayload,
  type TipoComissao,
} from '@/lib/comissaoService';

type ConfigForm = {
  tipo: TipoComissao;
  categoria: string;
  percentual: number;
  ativo: boolean;
};

const configVazia: ConfigForm = { tipo: 'GERAL', categoria: '', percentual: 0, ativo: true };

function mensagemErro(err: unknown): string {
  if (err instanceof ApiError) {
    return err.problem?.detail || err.problem?.message || err.message;
  }
  return 'Não foi possível concluir. Tente novamente.';
}

function validarConfig(form: ConfigForm): string | null {
  if (form.tipo === 'CATEGORIA' && !form.categoria.trim()) {
    return 'Informe a categoria da regra (ex.: Lente, Armação Solar).';
  }
  if (form.percentual < 0 || form.percentual > 100) {
    return 'Percentual deve estar entre 0 e 100.';
  }
  return null;
}

/**
 * ComissaoConfigCard — regras de comissão (§3.6): percentual GERAL sobre a
 * venda ou por CATEGORIA. Backend garante uma regra GERAL ativa e uma por
 * categoria (erro exibido vem do ProblemDetail).
 */
export function ComissaoConfigCard({ onConfigsCarregadas }: { onConfigsCarregadas?: (configs: ComissaoConfigDTO[]) => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editando, setEditando] = React.useState<ComissaoConfigDTO | null>(null);
  const [form, setForm] = React.useState<ConfigForm>(configVazia);
  const [erroForm, setErroForm] = React.useState<string | null>(null);
  const [excluindo, setExcluindo] = React.useState<ComissaoConfigDTO | null>(null);

  const configsQuery = useQuery({
    queryKey: ['comissoes', 'config'],
    queryFn: listarConfigComissoes,
    staleTime: 30_000,
  });

  const configsCarregadasRef = React.useRef(onConfigsCarregadas);
  configsCarregadasRef.current = onConfigsCarregadas;

  React.useEffect(() => {
    if (configsQuery.data) configsCarregadasRef.current?.(configsQuery.data);
  }, [configsQuery.data]);

  const salvarMutation = useMutation({
    mutationFn: async () => {
      const payload: ComissaoConfigPayload = {
        tipo: form.tipo,
        ...(form.tipo === 'CATEGORIA' ? { categoria: form.categoria.trim() } : {}),
        percentual: form.percentual,
        ativo: form.ativo,
      };
      return editando
        ? atualizarConfigComissao(editando.id, payload)
        : criarConfigComissao(payload);
    },
    onSuccess: (cfg) => {
      queryClient.invalidateQueries({ queryKey: ['comissoes', 'config'] });
      toast({
        variant: 'success',
        title: editando ? 'Regra atualizada' : 'Regra criada',
        description:
          cfg.tipo === 'GERAL'
            ? `Comissão geral de ${Number(cfg.percentual ?? 0).toFixed(2)}%.`
            : `Categoria "${cfg.categoria}" com ${Number(cfg.percentual ?? 0).toFixed(2)}%.`,
      });
      setDialogOpen(false);
      setEditando(null);
      setForm(configVazia);
      setErroForm(null);
    },
    onError: (err: unknown) => setErroForm(mensagemErro(err)),
  });

  const removerMutation = useMutation({
    mutationFn: (id: string) => removerConfigComissao(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comissoes', 'config'] });
      toast({ variant: 'success', title: 'Regra removida', description: 'Ela deixou de valer para as próximas apurações.' });
      setExcluindo(null);
    },
    onError: (err: unknown) => {
      toast({ variant: 'destructive', title: 'Falha ao remover', description: mensagemErro(err) });
      setExcluindo(null);
    },
  });

  function abrirNovo() {
    setEditando(null);
    setForm(configVazia);
    setErroForm(null);
    setDialogOpen(true);
  }

  function abrirEdicao(cfg: ComissaoConfigDTO) {
    setEditando(cfg);
    setForm({
      tipo: cfg.tipo ?? 'GERAL',
      categoria: cfg.categoria ?? '',
      percentual: Number(cfg.percentual ?? 0),
      ativo: cfg.ativo ?? true,
    });
    setErroForm(null);
    setDialogOpen(true);
  }

  function salvar() {
    const erroValidacao = validarConfig(form);
    if (erroValidacao) {
      setErroForm(erroValidacao);
      return;
    }
    salvarMutation.mutate();
  }

  const configs = configsQuery.data ?? [];

  return (
    <section aria-label="Regras de comissão" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-primary">Regras de comissão</h2>
          <p className="text-xs text-secondary">
            Percentual geral sobre a venda ou diferenciado por categoria — a base da regra geral
            exclui o que já foi apurado por categoria.
          </p>
        </div>
        <Button size="sm" variant="outline" className="gap-1" onClick={abrirNovo}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Nova regra
        </Button>
      </div>

      {configsQuery.isLoading ? (
        <LoadingRows rows={3} />
      ) : configsQuery.isError ? (
        <ErrorState error={configsQuery.error} compact onRetry={() => configsQuery.refetch()} />
      ) : configs.length === 0 ? (
        <EmptyState
          title="Nenhuma regra de comissão"
          description="Cadastre um percentual geral sobre a venda ou por categoria de produto (lentes, armações…)."
          action={
            <Button size="sm" onClick={abrirNovo}>
              <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Criar regra
            </Button>
          }
        />
      ) : (
        <div className="divide-y divide-border rounded-card border border-border bg-card shadow-soft">
          {configs.map((cfg) => (
            <div key={cfg.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
              {cfg.tipo === 'GERAL' ? (
                <Badge variant="default">Geral</Badge>
              ) : (
                <Badge variant="secondary">{cfg.categoria || 'Categoria'}</Badge>
              )}
              <span className="text-sm font-semibold tabular-nums text-primary">
                {Number(cfg.percentual ?? 0).toFixed(2)}%
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-muted">
                {cfg.tipo === 'GERAL'
                  ? 'Aplicado sobre o total da venda (exceto bases por categoria)'
                  : `Aplicado sobre o subtotal da categoria "${cfg.categoria}"`}
              </span>
              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => abrirEdicao(cfg)}
                  aria-label={`Editar regra ${cfg.tipo === 'GERAL' ? 'geral' : cfg.categoria ?? ''}`}
                  title="Editar"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted hover:bg-danger-light hover:text-danger-dark"
                  onClick={() => setExcluindo(cfg)}
                  aria-label="Excluir regra"
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

      {dialogOpen && (
        <Dialog
          open
          onClose={() => setDialogOpen(false)}
          title={editando ? 'Editar regra de comissão' : 'Nova regra de comissão'}
          description="Defina o percentual e o escopo — regra geral ou por categoria."
          className="max-w-[480px]"
        >
          <div className="space-y-3 py-1">
            <Field label="Escopo da regra" id="cfg-tipo">
              {(ctrl) => (
                <Select
                  id={ctrl.id}
                  value={form.tipo}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, tipo: e.target.value as TipoComissao }))
                  }
                >
                  <option value="GERAL">Geral (% sobre a venda)</option>
                  <option value="CATEGORIA">Por categoria de produto</option>
                </Select>
              )}
            </Field>

            {form.tipo === 'CATEGORIA' && (
              <TextField
                label="Categoria"
                required
                maxLength={100}
                placeholder="Ex.: Lente, Armação Solar, Solução"
                hint="Deve bater com a categoria dos itens da venda (ignora maiúsculas)."
                value={form.categoria}
                onChange={(e) => setForm((prev) => ({ ...prev, categoria: e.target.value }))}
              />
            )}

            <TextField
              label="Percentual (%)"
              required
              type="number"
              min={0}
              max={100}
              step="0.01"
              inputMode="decimal"
              value={form.percentual}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, percentual: Number(e.target.value) || 0 }))
              }
            />

            <div className="flex items-center justify-between gap-2 rounded border border-border bg-page px-3 py-2">
              <span className="text-xs font-medium text-primary">Regra ativa</span>
              <Switch
                checked={form.ativo}
                onCheckedChange={(v) => setForm((prev) => ({ ...prev, ativo: v }))}
                aria-label="Regra ativa"
              />
            </div>

            {erroForm && (
              <p role="alert" className="rounded border border-danger-light bg-danger-light px-3 py-2 text-xs text-danger-dark">
                {erroForm}
              </p>
            )}

            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={salvarMutation.isPending}>
                Cancelar
              </Button>
              <Button onClick={salvar} disabled={salvarMutation.isPending} aria-busy={salvarMutation.isPending}>
                {salvarMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Check className="mr-2 h-4 w-4" aria-hidden />
                )}
                {editando ? 'Salvar' : 'Cadastrar'}
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {excluindo && (
        <Dialog
          open
          onClose={() => setExcluindo(null)}
          title="Excluir regra de comissão"
          description="A regra deixa de valer para novas apurações — lançamentos existentes são preservados."
        >
          <p className="py-2 text-sm text-secondary">
            Confirmar a exclusão da regra{' '}
            <span className="font-semibold text-primary">
              {excluindo.tipo === 'GERAL' ? 'geral' : `da categoria "${excluindo.categoria}"`}
            </span>{' '}
            ({Number(excluindo.percentual ?? 0).toFixed(2)}%)?
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
