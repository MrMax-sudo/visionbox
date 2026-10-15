import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { AlertTriangle, Filter, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select } from '@/components/ui/select';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';

import { apiClient } from '@/lib/apiClient';
import type { PageResponse, ReceitaDTO } from '@/lib/types';
import { normalizeReceita, unwrapPage } from '@/lib/types';
import { useDebounce } from '@/hooks/useOnline';

import { ReceitaFormDialog } from '@/components/pessoas/ReceitaFormDialog';
import { ReceitaAnexoDialog } from '@/components/pessoas/ReceitaAnexoDialog';
import { ReceitaCard } from '@/components/pessoas/ReceitaCard';

type ReceitasPage = PageResponse<ReceitaDTO>;
type StatusFilter = 'Todas' | 'Com anexo' | 'Sem anexo';

export default function Receitas() {
  const { toast } = useToast();
  const [q, setQ] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('Todas');
  const debouncedQ = useDebounce(q, 350);
  const [page, setPage] = React.useState(0);
  const size = 12;

  const [formOpen, setFormOpen] = React.useState(false);
  const [receitaParaEditar, setReceitaParaEditar] = React.useState<ReceitaDTO | null>(null);
  const [receitaParaExcluir, setReceitaParaExcluir] = React.useState<ReceitaDTO | null>(null);
  const [isExcluindo, setIsExcluindo] = React.useState(false);
  const [anexoReceita, setAnexoReceita] = React.useState<ReceitaDTO | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['receitas', { q: debouncedQ, page, size }],
    queryFn: async () => {
      const res = await apiClient.get<ReceitasPage | ReceitaDTO[]>('/v1/receitas', {
        params: { page, size, search: debouncedQ || undefined, q: debouncedQ || undefined },
      });
      return res.data;
    },
    staleTime: 30_000,
    retry: 1,
    placeholderData: (prev) => prev,
  });

  const handleExcluir = async () => {
    if (!receitaParaExcluir) return;
    setIsExcluindo(true);
    try {
      await apiClient.delete(`/v1/receitas/${receitaParaExcluir.id}`);
      toast({
        title: 'Receita excluída',
        description: 'A prescrição óptica foi removida com sucesso.',
        variant: 'success',
      });
      setReceitaParaExcluir(null);
      refetch();
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir receita',
        description: err?.response?.data?.message || err?.message || 'Falha na comunicação com o servidor.',
        variant: 'destructive',
      });
    } finally {
      setIsExcluindo(false);
    }
  };

  const receitas: ReceitaDTO[] = React.useMemo(
    () => unwrapPage(data as ReceitasPage | ReceitaDTO[]).map((r) => normalizeReceita(r)),
    [data],
  );

  // filtro de anexo + busca client-side defensiva (backend já recebe `search`)
  const filteredReceitas = React.useMemo(() => {
    return receitas.filter((r) => {
      if (statusFilter === 'Com anexo' && !r.fotoUrl) return false;
      if (statusFilter === 'Sem anexo' && r.fotoUrl) return false;
      if (!debouncedQ) return true;
      const term = debouncedQ.toLowerCase();
      return (
        r.id.toLowerCase().includes(term) ||
        r.clienteId.toLowerCase().includes(term) ||
        (r.clienteNome ?? '').toLowerCase().includes(term)
      );
    });
  }, [debouncedQ, receitas, statusFilter]);

  React.useEffect(() => {
    setPage(0);
  }, [debouncedQ]);

  const total = (data as ReceitasPage)?.totalElements ?? filteredReceitas.length;
  const totalPages = (data as ReceitasPage)?.totalPages;
  const isLastPage = (data as ReceitasPage)?.last;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-primary">Receitas</h1>
          <p className="text-sm text-secondary">Prescrição óptica, anexos e histórico clínico do cliente.</p>
        </div>
        <Button variant="primary" onClick={() => { setReceitaParaEditar(null); setFormOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" aria-hidden /> Nova receita
        </Button>
      </div>

      <OfflineBanner />

      {/* Barra de busca / filtro de anexo */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[260px] flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar cliente ou ID…"
              className="pl-9"
              aria-label="Buscar receitas"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted" aria-hidden />
            <Select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="h-9 w-[150px]"
              aria-label="Filtrar receitas"
            >
              <option value="Todas">Todas</option>
              <option value="Com anexo">Com anexo</option>
              <option value="Sem anexo">Sem anexo</option>
            </Select>
          </div>
          <Badge variant="outline">
            {isLoading ? 'carregando…' : `${total} receitas`} {isFetching && !isLoading && '• atualizando'}
          </Badge>
          <Button variant="ghost" size="sm" onClick={() => refetch()} aria-label="Atualizar lista">
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} aria-hidden />
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Carregando receitas">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="mt-3 h-4 w-3/4" />
              <Skeleton className="mt-2 h-20 w-full" />
            </Card>
          ))}
          <span className="sr-only">Carregando receitas.</span>
        </div>
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : filteredReceitas.length === 0 ? (
        <EmptyState
          title={debouncedQ || statusFilter !== 'Todas' ? 'Nenhuma receita encontrada' : 'Nenhuma receita cadastrada'}
          description={
            debouncedQ
              ? `Sem resultados para “${debouncedQ}”.`
              : statusFilter !== 'Todas'
                ? `Nenhuma receita “${statusFilter.toLowerCase()}”. Ajuste o filtro ou cadastre uma nova.`
                : 'Cadastre a primeira receita para vincular grau, validade e anexo ao cliente.'
          }
          action={
            <Button variant="primary" size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="mr-2 h-4 w-4" aria-hidden /> Nova receita
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredReceitas.map((r) => (
              <ReceitaCard
                key={r.id}
                receita={r}
                loading={!!anexoReceita}
                onVerFoto={(receita) => setAnexoReceita(receita)}
                onEditar={(receita) => {
                  setReceitaParaEditar(receita);
                  setFormOpen(true);
                }}
                onExcluir={(receita) => setReceitaParaExcluir(receita)}
              />
            ))}
          </div>
          <div className="flex items-center justify-between text-xs text-secondary">
            <span>
              Página {page + 1} {totalPages ? `de ${totalPages}` : ''} • {total} itens
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!!isLastPage}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        </>
      )}

      <ReceitaFormDialog
        open={formOpen}
        receitaParaEditar={receitaParaEditar}
        onClose={() => {
          setFormOpen(false);
          setReceitaParaEditar(null);
        }}
      />
      <ReceitaAnexoDialog receita={anexoReceita} onClose={() => setAnexoReceita(null)} />

      {/* Diálogo de Confirmação de Exclusão */}
      <Dialog
        open={!!receitaParaExcluir}
        onClose={() => !isExcluindo && setReceitaParaExcluir(null)}
        title="Excluir receita médica"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold">Atenção: Ação irreversível</p>
              <p className="mt-1 text-xs opacity-90">
                Tem certeza que deseja excluir esta receita óptica? O histórico de prescrição médica e anexo vinculado serão permanentemente removidos.
              </p>
            </div>
          </div>

          {receitaParaExcluir && (
            <div className="rounded-md border border-subtle bg-subtle/50 p-3 text-xs space-y-1">
              <div><span className="font-semibold text-secondary">Cliente:</span> {receitaParaExcluir.clienteNome || receitaParaExcluir.clienteId}</div>
              {receitaParaExcluir.nomeMedico && (
                <div><span className="font-semibold text-secondary">Médico:</span> {receitaParaExcluir.nomeMedico}</div>
              )}
              {receitaParaExcluir.tipo && (
                <div><span className="font-semibold text-secondary">Tipo:</span> {receitaParaExcluir.tipo}</div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isExcluindo}
              onClick={() => setReceitaParaExcluir(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isExcluindo}
              onClick={handleExcluir}
            >
              {isExcluindo ? 'Excluindo…' : 'Excluir definitivamente'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
