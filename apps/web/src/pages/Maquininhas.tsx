import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Loader2, Pencil, Percent, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingRows } from '@/components/ui/loading-state';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { ApiError } from '@/lib/apiClient';
import { SimuladorMdrCard } from '@/components/financeiro/maquininha/SimuladorMdrCard';
import {
  MaquininhaFormDialog,
  formDaMaquininha,
  maquininhaFormVazio,
  payloadDoForm,
  validarForm,
  type MaquininhaForm,
} from '@/components/financeiro/maquininha/MaquininhaFormDialog';
import { money } from '@/components/financeiro/types';
import {
  atualizarMaquininha,
  criarMaquininha,
  listarMaquininhas,
  removerMaquininha,
  type MaquininhaDTO,
} from '@/lib/maquininhaService';

function mensagemErro(err: unknown): string {
  if (err instanceof ApiError) {
    return err.problem?.detail || err.problem?.message || err.message;
  }
  return 'Não foi possível concluir. Tente novamente.';
}

/** Resumo das 4 faixas de taxa para exibição em linha. */
function taxasResumo(m: MaquininhaDTO): string {
  return [
    `Débito ${Number(m.debitoTaxaPercentual ?? 0).toFixed(2)}% + ${money(m.debitoTaxaFixa)}`,
    `1x ${Number(m.credito1xTaxaPercentual ?? 0).toFixed(2)}% + ${money(m.credito1xTaxaFixa)}`,
    `2–6x ${Number(m.credito2a6TaxaPercentual ?? 0).toFixed(2)}% + ${money(m.credito2a6TaxaFixa)}`,
    `7–12x ${Number(m.credito7a12TaxaPercentual ?? 0).toFixed(2)}% + ${money(m.credito7a12TaxaFixa)}`,
  ].join(' · ');
}

/**
 * Maquininhas — CRUD de adquirentes/taxas MDR + simulador de líquido (§3.5,
 * Fase 4 / R11 FINANCEIRO_COMPLETO). Exclusão é soft-delete (ativo=false).
 */
export default function Maquininhas() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editando, setEditando] = React.useState<MaquininhaDTO | null>(null);
  const [form, setForm] = React.useState<MaquininhaForm>(maquininhaFormVazio);
  const [erroForm, setErroForm] = React.useState<string | null>(null);
  const [excluindo, setExcluindo] = React.useState<MaquininhaDTO | null>(null);

  const maquininhasQuery = useQuery({
    queryKey: ['maquininhas'],
    queryFn: listarMaquininhas,
    staleTime: 30_000,
  });

  const salvarMutation = useMutation({
    mutationFn: async () => {
      const payload = payloadDoForm(form);
      return editando ? atualizarMaquininha(editando.id, payload) : criarMaquininha(payload);
    },
    onSuccess: (m) => {
      queryClient.invalidateQueries({ queryKey: ['maquininhas'] });
      toast({
        variant: 'success',
        title: editando ? 'Maquininha atualizada' : 'Maquininha cadastrada',
        description: `${m.nome} (${m.adquirente}) já está disponível.`,
      });
      setDialogOpen(false);
      setEditando(null);
      setForm(maquininhaFormVazio);
      setErroForm(null);
    },
    onError: (err: unknown) => setErroForm(mensagemErro(err)),
  });

  const removerMutation = useMutation({
    mutationFn: (id: string) => removerMaquininha(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maquininhas'] });
      toast({
        variant: 'success',
        title: 'Maquininha removida',
        description: 'Ela saiu da lista ativa — o histórico de cálculos é preservado.',
      });
      setExcluindo(null);
    },
    onError: (err: unknown) => {
      toast({ variant: 'destructive', title: 'Falha ao remover', description: mensagemErro(err) });
      setExcluindo(null);
    },
  });

  function abrirNovo() {
    setEditando(null);
    setForm(maquininhaFormVazio);
    setErroForm(null);
    setDialogOpen(true);
  }

  function abrirEdicao(m: MaquininhaDTO) {
    setEditando(m);
    setForm(formDaMaquininha(m));
    setErroForm(null);
    setDialogOpen(true);
  }

  function salvar() {
    const erroValidacao = validarForm(form);
    if (erroValidacao) {
      setErroForm(erroValidacao);
      return;
    }
    salvarMutation.mutate();
  }

  const maquininhas = maquininhasQuery.data ?? [];

  return (
    <div className="space-y-6 pb-12">
      <OfflineBanner />

      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Maquininhas</h1>
          <p className="text-xs text-secondary">
            Taxas MDR por adquirente (débito, crédito 1x, 2–6x e 7–12x) e cálculo do valor líquido
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => maquininhasQuery.refetch()}
            disabled={maquininhasQuery.isFetching}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${maquininhasQuery.isFetching ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button size="sm" onClick={abrirNovo} className="gap-1.5 font-semibold">
            <Plus className="h-4 w-4" /> Nova Maquininha
          </Button>
        </div>
      </div>

      {/* Lista */}
      <section aria-label="Maquininhas cadastradas" className="space-y-3">
        {maquininhasQuery.isLoading ? (
          <div className="rounded-card border border-border bg-card p-4">
            <LoadingRows rows={3} />
          </div>
        ) : maquininhasQuery.isError ? (
          <div className="rounded-card border border-border bg-card p-4">
            <ErrorState error={maquininhasQuery.error} onRetry={() => maquininhasQuery.refetch()} />
          </div>
        ) : maquininhas.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="Nenhuma maquininha cadastrada"
            description="Cadastre as taxas de cada adquirente (Cielo, Stone, Rede, PagBank…) para apurar o líquido dos pagamentos em cartão."
            action={
              <Button size="sm" onClick={abrirNovo}>
                <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Cadastrar primeira
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-border rounded-card border border-border bg-card shadow-soft">
            {maquininhas.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-primary-light text-brand">
                  <CreditCard className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-primary">
                    {m.nome}
                    <span className="ml-1.5 font-normal text-muted">({m.adquirente})</span>
                  </p>
                  <p className="truncate text-xs text-secondary" title={taxasResumo(m)}>
                    {taxasResumo(m)}
                  </p>
                </div>
                <Badge variant="success">
                  <Percent className="mr-1 h-3 w-3" aria-hidden />
                  Ativa
                </Badge>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => abrirEdicao(m)}
                    aria-label={`Editar ${m.nome}`}
                    title="Editar"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted hover:bg-danger-light hover:text-danger-dark"
                    onClick={() => setExcluindo(m)}
                    aria-label={`Remover ${m.nome}`}
                    title="Remover"
                    disabled={removerMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Simulador */}
      <SimuladorMdrCard maquininhas={maquininhas} />

      {/* Dialog criar/editar */}
      {dialogOpen && (
        <MaquininhaFormDialog
          editando={editando}
          form={form}
          erro={erroForm}
          isPending={salvarMutation.isPending}
          onChange={setForm}
          onCancel={() => setDialogOpen(false)}
          onSalvar={salvar}
        />
      )}

      {/* Dialog confirmação de exclusão (soft-delete) */}
      {excluindo && (
        <Dialog
          open
          onClose={() => setExcluindo(null)}
          title="Remover maquininha"
          description="A maquininha sai da lista ativa; lançamentos e cálculos existentes são preservados."
        >
          <p className="py-2 text-sm text-secondary">
            Confirmar a remoção de{' '}
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
              Remover
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
