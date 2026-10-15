import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Search,
  Printer,
  ShoppingCart,
  CheckCircle,
  XCircle,
  Calendar,
  User,
  Eye,
  RefreshCw,
  Plus
} from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';

import { apiClient } from '@/lib/apiClient';
import type { PageResponse, OrcamentoDTO } from '@/lib/types';
import { unwrapPage } from '@/lib/types';
import { formatBRL } from '@/lib/masks';
import { useDebounce } from '@/hooks/useOnline';
import { ComprovanteImpressao } from '@/components/pdv/ComprovanteImpressao';

function formatarData(dataStr?: string) {
  if (!dataStr) return '—';
  try {
    return new Date(dataStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dataStr;
  }
}

export default function Orcamentos() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [busca, setBusca] = React.useState('');
  const debouncedBusca = useDebounce(busca, 350);
  const [statusFiltro, setStatusFiltro] = React.useState<string>('TODOS');
  const [page, setPage] = React.useState(0);
  const size = 15;

  const [orcamentoVisualizando, setOrcamentoVisualizando] = React.useState<OrcamentoDTO | null>(null);
  const [impressaoModalOpen, setImpressaoModalOpen] = React.useState(false);

  const queryKey = ['orcamentos', { busca: debouncedBusca, status: statusFiltro, page, size }];

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await apiClient.get<PageResponse<OrcamentoDTO> | OrcamentoDTO[]>('/v1/orcamentos', {
        params: {
          page,
          size,
          search: debouncedBusca || undefined,
          status: statusFiltro !== 'TODOS' ? statusFiltro : undefined,
        },
      });
      return res.data;
    },
    staleTime: 15_000,
  });

  const orcamentos: OrcamentoDTO[] = React.useMemo(() => unwrapPage(data), [data]);

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiClient.put(`/v1/orcamentos/${id}/status`, { status });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
      toast({
        title: 'Status atualizado',
        description: 'O orçamento teve seu status alterado com sucesso.',
        variant: 'success',
      });
      if (orcamentoVisualizando) {
        setOrcamentoVisualizando(null);
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Falha ao atualizar orçamento';
      toast({ title: 'Erro', description: msg, variant: 'destructive' });
    },
  });

  function handleAbrirNoPdv(orc: OrcamentoDTO) {
    navigate(`/pdv?orcamentoNumero=${encodeURIComponent(orc.numero)}&cliente=${encodeURIComponent(orc.clienteNome)}`);
  }

  function handleImprimir(orc: OrcamentoDTO) {
    setOrcamentoVisualizando(orc);
    setImpressaoModalOpen(true);
  }

  const getStatusBadge = (status: OrcamentoDTO['status']) => {
    switch (status) {
      case 'ABERTO':
        return <Badge variant="warning">Em Aberto</Badge>;
      case 'APROVADO':
        return <Badge variant="success">Aprovado</Badge>;
      case 'CONVERTIDO':
        return <Badge variant="default" className="bg-primary text-primary-foreground">Venda Realizada</Badge>;
      case 'CANCELADO':
        return <Badge variant="destructive">Cancelado</Badge>;
      case 'EXPIRADO':
        return <Badge variant="secondary">Expirado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary flex items-center gap-2">
            <FileText className="h-7 w-7 text-brand" />
            Central de Orçamentos
          </h1>
          <p className="text-sm text-secondary">
            Gestão de propostas comerciais emitidas no balcão e no PDV com validade e conversão direta em venda.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button variant="primary" size="sm" onClick={() => navigate('/pdv')}>
            <Plus className="mr-1.5 h-4 w-4" />
            Novo Orçamento no PDV
          </Button>
        </div>
      </div>

      {/* Barra de Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                placeholder="Buscar por número, cliente, CPF ou telefone..."
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setPage(0);
                }}
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {['TODOS', 'ABERTO', 'APROVADO', 'CONVERTIDO', 'CANCELADO'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    setStatusFiltro(st);
                    setPage(0);
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    statusFiltro === st
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 text-foreground hover:bg-muted'
                  }`}
                >
                  {st === 'TODOS' ? 'Todos' : st === 'ABERTO' ? 'Em Aberto' : st === 'APROVADO' ? 'Aprovados' : st === 'CONVERTIDO' ? 'Convertidos' : 'Cancelados'}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conteúdo / Tabela */}
      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : orcamentos.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nenhum orçamento encontrado"
          description="Gere propostas comerciais pelo PDV clicando em 'Orçamento' ou ajuste seus filtros de busca."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-card-soft text-xs font-semibold text-secondary uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Itens</th>
                <th className="px-4 py-3 text-right">Valor Total</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orcamentos.map((orc) => (
                <tr key={orc.id} className="hover:bg-card-soft/50 transition-colors">
                  <td className="px-4 py-3 font-mono font-semibold text-primary">
                    {orc.numero}
                  </td>
                  <td className="px-4 py-3 text-xs text-secondary">
                    {formatarData(orc.criadoEm)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{orc.clienteNome}</p>
                    {orc.clienteTelefone && (
                      <p className="text-xs text-muted">{orc.clienteTelefone}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-secondary">
                    {orc.itens?.length ?? 0} item(ns)
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-foreground">
                    {formatBRL(orc.valorTotal)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {getStatusBadge(orc.status)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        title="Imprimir Orçamento (A4)"
                        onClick={() => handleImprimir(orc)}
                      >
                        <Printer className="h-4 w-4" />
                      </Button>

                      {orc.status === 'ABERTO' && (
                        <>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 text-success hover:bg-success/10"
                            title="Aprovar Proposta"
                            onClick={() => statusMutation.mutate({ id: orc.id, status: 'APROVADO' })}
                            disabled={statusMutation.isPending}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 text-danger hover:bg-danger/10"
                            title="Cancelar Orçamento"
                            onClick={() => statusMutation.mutate({ id: orc.id, status: 'CANCELADO' })}
                            disabled={statusMutation.isPending}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs font-semibold"
                        onClick={() => handleAbrirNoPdv(orc)}
                      >
                        <ShoppingCart className="mr-1 h-3.5 w-3.5" />
                        PDV
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Impressão de Orçamento */}
      {orcamentoVisualizando && (
        <Dialog
          open={impressaoModalOpen}
          onClose={() => {
            setImpressaoModalOpen(false);
            setOrcamentoVisualizando(null);
          }}
          title={`Orçamento Comercial ${orcamentoVisualizando.numero}`}
          description="Documento para impressão e proposta ao cliente"
        >
          <div className="py-2">
            <ComprovanteImpressao
              osNumero={orcamentoVisualizando.numero}
              clienteNome={orcamentoVisualizando.clienteNome}
              clienteCpf={orcamentoVisualizando.clienteCpf}
              clienteTelefone={orcamentoVisualizando.clienteTelefone}
              data={orcamentoVisualizando.criadoEm}
              itens={(orcamentoVisualizando.itens ?? []).map((it) => ({
                sku: it.sku || 'SKU',
                nome: it.descricao,
                qtd: Number(it.quantidade),
                preco: Number(it.precoUnitario),
              }))}
              subtotal={Number(orcamentoVisualizando.valorSubtotal)}
              desconto={Number(orcamentoVisualizando.desconto)}
              total={Number(orcamentoVisualizando.valorTotal)}
              formaPagamento={orcamentoVisualizando.condicoesPagamento || 'A Combinar'}
              tipoDocumento="ORCAMENTO"
            />
          </div>
        </Dialog>
      )}
    </div>
  );
}
