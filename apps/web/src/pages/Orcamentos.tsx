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
  Plus,
  Pencil,
  Trash2,
  Phone,
  CreditCard,
  AlertTriangle
} from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Dialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';

import { apiClient } from '@/lib/apiClient';
import type { PageResponse, OrcamentoDTO, OrcamentoItemDTO } from '@/lib/types';
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

  // Modais de estado
  const [detalhesOrcamento, setDetalhesOrcamento] = React.useState<OrcamentoDTO | null>(null);
  const [orcamentoParaImprimir, setOrcamentoParaImprimir] = React.useState<OrcamentoDTO | null>(null);
  const [orcamentoParaEditar, setOrcamentoParaEditar] = React.useState<OrcamentoDTO | null>(null);
  const [orcamentoParaExcluir, setOrcamentoParaExcluir] = React.useState<OrcamentoDTO | null>(null);

  // Estados do formulário de edição
  const [editClienteNome, setEditClienteNome] = React.useState('');
  const [editClienteCpf, setEditClienteCpf] = React.useState('');
  const [editClienteTelefone, setEditClienteTelefone] = React.useState('');
  const [editValidadeDias, setEditValidadeDias] = React.useState(15);
  const [editCondicoes, setEditCondicoes] = React.useState('');
  const [editObservacoes, setEditObservacoes] = React.useState('');
  const [editItens, setEditItens] = React.useState<OrcamentoItemDTO[]>([]);
  const [editDesconto, setEditDesconto] = React.useState(0);

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

  // Mutation de Status
  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiClient.put(`/v1/orcamentos/${id}/status`, { status });
      return res.data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
      toast({
        title: 'Status atualizado',
        description: `O orçamento foi marcado como ${vars.status}.`,
        variant: 'success',
      });
      if (detalhesOrcamento && detalhesOrcamento.id === vars.id) {
        setDetalhesOrcamento((prev) => (prev ? { ...prev, status: vars.status as OrcamentoDTO['status'] } : null));
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Falha ao atualizar status';
      toast({ title: 'Erro', description: msg, variant: 'destructive' });
    },
  });

  // Mutation de Edição (PUT)
  const editMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: unknown }) => {
      const res = await apiClient.put(`/v1/orcamentos/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
      toast({
        title: 'Orçamento atualizado',
        description: 'Os dados do orçamento foram salvos com sucesso.',
        variant: 'success',
      });
      setOrcamentoParaEditar(null);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar edição';
      toast({ title: 'Erro', description: msg, variant: 'destructive' });
    },
  });

  // Mutation de Exclusão (DELETE)
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/v1/orcamentos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
      toast({
        title: 'Orçamento excluído',
        description: 'O orçamento foi removido com sucesso.',
        variant: 'success',
      });
      setOrcamentoParaExcluir(null);
      if (detalhesOrcamento) setDetalhesOrcamento(null);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Falha ao excluir orçamento';
      toast({ title: 'Erro', description: msg, variant: 'destructive' });
    },
  });

  function handleCarregarNoPdv(orc: OrcamentoDTO) {
    navigate(`/pdv?orcamentoId=${encodeURIComponent(orc.id)}`);
  }

  function handleImprimir(orc: OrcamentoDTO) {
    setOrcamentoParaImprimir(orc);
  }

  function handleAbrirEdicao(orc: OrcamentoDTO) {
    setOrcamentoParaEditar(orc);
    setEditClienteNome(orc.clienteNome || '');
    setEditClienteCpf(orc.clienteCpf || '');
    setEditClienteTelefone(orc.clienteTelefone || '');
    setEditValidadeDias(orc.validadeDias || 15);
    setEditCondicoes(orc.condicoesPagamento || '');
    setEditObservacoes(orc.observacoes || '');
    setEditItens(orc.itens ? [...orc.itens] : []);
    setEditDesconto(orc.desconto || 0);
  }

  function handleSalvarEdicao() {
    if (!orcamentoParaEditar) return;
    const subtotal = editItens.reduce((acc, it) => acc + (Number(it.precoUnitario) * Number(it.quantidade)), 0);
    const payload = {
      clienteNome: editClienteNome.trim() || 'Consumidor Final',
      clienteCpf: editClienteCpf.trim() || undefined,
      clienteTelefone: editClienteTelefone.trim() || undefined,
      validadeDias: Number(editValidadeDias) || 15,
      condicoesPagamento: editCondicoes.trim() || undefined,
      observacoes: editObservacoes.trim() || undefined,
      desconto: Number(editDesconto) || 0,
      itens: editItens.map((it) => ({
        produtoId: it.produtoId,
        sku: it.sku,
        descricao: it.descricao,
        quantidade: Number(it.quantidade) || 1,
        precoUnitario: Number(it.precoUnitario) || 0,
        desconto: Number(it.desconto) || 0,
        subtotal: (Number(it.quantidade) || 1) * (Number(it.precoUnitario) || 0) - (Number(it.desconto) || 0),
      })),
    };
    editMutation.mutate({ id: orcamentoParaEditar.id, payload });
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
    <div className="space-y-6 p-4 sm:p-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary flex items-center gap-2">
            <FileText className="h-7 w-7 text-brand" />
            Central de Orçamentos
          </h1>
          <p className="text-sm text-secondary">
            Gestão, consulta, edição e conversão direta em venda com status persistido no banco.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
                      ? 'bg-primary text-primary-foreground shadow-sm'
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

      {/* Conteúdo / Tabela de Orçamentos */}
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
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
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
                  <td className="px-4 py-3 text-xs text-secondary whitespace-nowrap">
                    {formatarData(orc.criadoEm)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{orc.clienteNome}</p>
                    {orc.clienteTelefone && (
                      <p className="text-xs text-muted flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {orc.clienteTelefone}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-secondary whitespace-nowrap">
                    {orc.itens?.length ?? 0} item(ns)
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-foreground whitespace-nowrap">
                    {formatBRL(orc.valorTotal)}
                  </td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    {getStatusBadge(orc.status)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* 1. Botão Visualizar Detalhes */}
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 text-primary hover:bg-card-soft"
                        title="Visualizar Detalhes do Orçamento"
                        onClick={() => setDetalhesOrcamento(orc)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>

                      {/* 2. Botão Carregar no PDV */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 text-xs font-semibold bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground border-primary/30"
                        title="Carregar itens e cliente diretamente no PDV"
                        onClick={() => handleCarregarNoPdv(orc)}
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                        PDV
                      </Button>

                      {/* 3. Botão Imprimir Proposta (A4) */}
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        title="Imprimir Orçamento (A4)"
                        onClick={() => handleImprimir(orc)}
                      >
                        <Printer className="h-4 w-4" />
                      </Button>

                      {/* 4. Ações condicionais (quando ABERTO) */}
                      {orc.status === 'ABERTO' && (
                        <>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 text-secondary hover:text-primary"
                            title="Editar Orçamento"
                            onClick={() => handleAbrirEdicao(orc)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
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

                      {/* 5. Excluir (se não virou venda) */}
                      {orc.status !== 'CONVERTIDO' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted hover:text-danger"
                          title="Excluir Orçamento"
                          onClick={() => setOrcamentoParaExcluir(orc)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL 1: VISUALIZAR DETALHES COMPLETOS DO ORÇAMENTO */}
      {detalhesOrcamento && (
        <Dialog
          open={!!detalhesOrcamento}
          onClose={() => setDetalhesOrcamento(null)}
          title={`Detalhes do Orçamento ${detalhesOrcamento.numero}`}
          description="Visualização completa de itens, cliente e condições comerciais"
        >
          <div className="space-y-4 py-2">
            {/* Header resumo */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-lg border border-border bg-card-soft">
              <div>
                <span className="text-xs text-muted">Status Atual</span>
                <div className="mt-1">{getStatusBadge(detalhesOrcamento.status)}</div>
              </div>
              <div>
                <span className="text-xs text-muted">Data de Criação</span>
                <p className="text-xs font-semibold text-primary mt-1">{formatarData(detalhesOrcamento.criadoEm)}</p>
              </div>
              <div>
                <span className="text-xs text-muted">Validade</span>
                <p className="text-xs font-semibold text-primary mt-1">{detalhesOrcamento.validadeDias || 15} dias</p>
              </div>
              <div>
                <span className="text-xs text-muted">Vendedor</span>
                <p className="text-xs font-semibold text-primary mt-1">{detalhesOrcamento.vendedorNome || 'Balcão'}</p>
              </div>
            </div>

            {/* Dados do Cliente */}
            <div className="p-3 rounded-lg border border-border bg-card space-y-1">
              <span className="text-xs font-semibold text-secondary uppercase tracking-wider flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-brand" /> Dados do Cliente
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
                <div>
                  <strong className="text-muted">Nome:</strong>{' '}
                  <span className="font-semibold text-primary">{detalhesOrcamento.clienteNome}</span>
                </div>
                <div>
                  <strong className="text-muted">CPF:</strong>{' '}
                  <span>{detalhesOrcamento.clienteCpf || 'Não informado'}</span>
                </div>
                <div>
                  <strong className="text-muted">Telefone:</strong>{' '}
                  <span>{detalhesOrcamento.clienteTelefone || 'Não informado'}</span>
                </div>
              </div>
            </div>

            {/* Tabela de Itens */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-secondary uppercase tracking-wider">
                Itens da Proposta ({detalhesOrcamento.itens?.length || 0})
              </span>
              <div className="overflow-x-auto rounded border border-border">
                <table className="w-full text-xs text-left">
                  <thead className="bg-card-soft text-secondary uppercase font-semibold">
                    <tr>
                      <th className="px-3 py-2">Item / Descrição</th>
                      <th className="px-3 py-2 text-center">Qtd</th>
                      <th className="px-3 py-2 text-right">Unitário</th>
                      <th className="px-3 py-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(detalhesOrcamento.itens || []).map((it, idx) => (
                      <tr key={idx} className="hover:bg-card-soft/40">
                        <td className="px-3 py-2">
                          <p className="font-medium text-primary">{it.descricao}</p>
                          {it.sku && <span className="font-mono text-[10px] text-muted">SKU: {it.sku}</span>}
                        </td>
                        <td className="px-3 py-2 text-center font-semibold">{it.quantidade}</td>
                        <td className="px-3 py-2 text-right">{formatBRL(it.precoUnitario)}</td>
                        <td className="px-3 py-2 text-right font-bold text-primary">{formatBRL(it.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totais e Condições */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg border border-border bg-card-soft text-xs">
              <div>
                <span className="font-semibold text-secondary flex items-center gap-1">
                  <CreditCard className="h-3.5 w-3.5" /> Condições Comerciais
                </span>
                <p className="mt-1 text-primary">{detalhesOrcamento.condicoesPagamento || 'A combinar com o vendedor.'}</p>
                {detalhesOrcamento.observacoes && (
                  <p className="mt-2 text-muted italic">"{detalhesOrcamento.observacoes}"</p>
                )}
              </div>
              <div className="space-y-1 sm:text-right">
                <div className="flex justify-between sm:justify-end gap-3 text-secondary">
                  <span>Subtotal:</span>
                  <span>{formatBRL(detalhesOrcamento.valorSubtotal)}</span>
                </div>
                {detalhesOrcamento.desconto > 0 && (
                  <div className="flex justify-between sm:justify-end gap-3 text-danger">
                    <span>Desconto:</span>
                    <span>-{formatBRL(detalhesOrcamento.desconto)}</span>
                  </div>
                )}
                <div className="flex justify-between sm:justify-end gap-3 text-sm font-bold text-primary border-t border-border pt-1">
                  <span>Valor Total:</span>
                  <span className="text-base text-brand">{formatBRL(detalhesOrcamento.valorTotal)}</span>
                </div>
              </div>
            </div>

            {/* Ações no Rodapé do Modal */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
              <div className="flex gap-1.5">
                {detalhesOrcamento.status === 'ABERTO' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        handleAbrirEdicao(detalhesOrcamento);
                        setDetalhesOrcamento(null);
                      }}
                      className="gap-1 text-xs"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => statusMutation.mutate({ id: detalhesOrcamento.id, status: 'APROVADO' })}
                      className="gap-1 text-xs text-success"
                    >
                      <CheckCircle className="h-3.5 w-3.5" /> Aprovar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => statusMutation.mutate({ id: detalhesOrcamento.id, status: 'CANCELADO' })}
                      className="gap-1 text-xs text-danger"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Cancelar
                    </Button>
                  </>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    handleImprimir(detalhesOrcamento);
                    setDetalhesOrcamento(null);
                  }}
                  className="gap-1.5 text-xs font-semibold"
                >
                  <Printer className="h-3.5 w-3.5" /> Imprimir Proposta (A4)
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleCarregarNoPdv(detalhesOrcamento)}
                  className="gap-1.5 text-xs font-bold"
                >
                  <ShoppingCart className="h-3.5 w-3.5" /> Carregar no PDV
                </Button>
              </div>
            </div>
          </div>
        </Dialog>
      )}

      {/* MODAL 2: EDIÇÃO COMPLETA DE ORÇAMENTO (CRUD - U) */}
      {orcamentoParaEditar && (
        <Dialog
          open={!!orcamentoParaEditar}
          onClose={() => setOrcamentoParaEditar(null)}
          title={`Editar Orçamento ${orcamentoParaEditar.numero}`}
          description="Altere dados do cliente, itens, descontos e condições comerciais"
        >
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-secondary">Nome do Cliente</label>
                <Input
                  value={editClienteNome}
                  onChange={(e) => setEditClienteNome(e.target.value)}
                  placeholder="Nome do cliente..."
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-secondary">CPF</label>
                <Input
                  value={editClienteCpf}
                  onChange={(e) => setEditClienteCpf(e.target.value)}
                  placeholder="000.000.000-00"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-secondary">WhatsApp / Fone</label>
                <Input
                  value={editClienteTelefone}
                  onChange={(e) => setEditClienteTelefone(e.target.value)}
                  placeholder="(11) 99999-0000"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-secondary">Validade da Proposta (Dias)</label>
                <Input
                  type="number"
                  min={1}
                  max={90}
                  value={editValidadeDias}
                  onChange={(e) => setEditValidadeDias(Number(e.target.value) || 15)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-secondary">Condições de Pagamento</label>
                <Input
                  value={editCondicoes}
                  onChange={(e) => setEditCondicoes(e.target.value)}
                  placeholder="Ex: Em até 6x no cartão sem juros"
                  className="mt-1"
                />
              </div>
            </div>

            {/* Lista e Ajuste de Itens */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-secondary uppercase tracking-wider">
                Itens do Orçamento
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {editItens.map((it, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 rounded border border-border bg-card-soft text-xs">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-primary truncate">{it.descricao}</p>
                      <span className="text-[10px] text-muted">SKU: {it.sku || '—'}</span>
                    </div>
                    <div className="w-16">
                      <label className="text-[10px] text-muted block">Qtd</label>
                      <Input
                        type="number"
                        min={1}
                        value={it.quantidade}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 1;
                          setEditItens((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, quantidade: val } : item))
                          );
                        }}
                        className="h-7 text-xs"
                      />
                    </div>
                    <div className="w-24">
                      <label className="text-[10px] text-muted block">Preço (R$)</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={it.precoUnitario}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          setEditItens((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, precoUnitario: val } : item))
                          );
                        }}
                        className="h-7 text-xs"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-danger hover:bg-danger/10 mt-3"
                      title="Remover Item"
                      onClick={() => setEditItens((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-secondary">Desconto Geral (R$)</label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={editDesconto}
                onChange={(e) => setEditDesconto(Number(e.target.value) || 0)}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-secondary">Observações Comerciais</label>
              <Input
                value={editObservacoes}
                onChange={(e) => setEditObservacoes(e.target.value)}
                placeholder="Observações internas ou para o cliente..."
                className="mt-1"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setOrcamentoParaEditar(null)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSalvarEdicao}
                disabled={editMutation.isPending}
                className="font-bold"
              >
                {editMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* MODAL 3: EXCLUSÃO DE ORÇAMENTO (CRUD - D) */}
      {orcamentoParaExcluir && (
        <Dialog
          open={!!orcamentoParaExcluir}
          onClose={() => setOrcamentoParaExcluir(null)}
          title="Excluir Orçamento"
          description="Tem certeza que deseja excluir esta proposta comercial?"
        >
          <div className="space-y-3 py-2 text-sm">
            <div className="flex items-center gap-2 p-3 rounded-lg border border-warning/30 bg-warning/10 text-warning-dark text-xs">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span>
                Esta ação removerá o orçamento <strong>{orcamentoParaExcluir.numero}</strong> da base de dados.
              </span>
            </div>
            <p className="text-xs text-secondary">
              Cliente: <strong>{orcamentoParaExcluir.clienteNome}</strong> • Valor: <strong>{formatBRL(orcamentoParaExcluir.valorTotal)}</strong>
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setOrcamentoParaExcluir(null)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteMutation.mutate(orcamentoParaExcluir.id)}
                disabled={deleteMutation.isPending}
                className="font-bold"
              >
                {deleteMutation.isPending ? 'Excluindo...' : 'Confirmar Exclusão'}
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* MODAL 4: IMPRESSÃO DE ORÇAMENTO (COM PREVIEW A4 REAL) */}
      {orcamentoParaImprimir && (
        <Dialog
          open={!!orcamentoParaImprimir}
          onClose={() => setOrcamentoParaImprimir(null)}
          title={`Orçamento Comercial ${orcamentoParaImprimir.numero}`}
          description="Documento para impressão e proposta ao cliente"
        >
          <div className="py-2">
            <ComprovanteImpressao
              osNumero={orcamentoParaImprimir.numero}
              clienteNome={orcamentoParaImprimir.clienteNome}
              clienteCpf={orcamentoParaImprimir.clienteCpf}
              clienteTelefone={orcamentoParaImprimir.clienteTelefone}
              data={orcamentoParaImprimir.criadoEm}
              itens={(orcamentoParaImprimir.itens ?? []).map((it) => ({
                sku: it.sku || 'SKU',
                nome: it.descricao,
                qtd: Number(it.quantidade),
                preco: Number(it.precoUnitario),
              }))}
              subtotal={Number(orcamentoParaImprimir.valorSubtotal)}
              desconto={Number(orcamentoParaImprimir.desconto)}
              total={Number(orcamentoParaImprimir.valorTotal)}
              formaPagamento={orcamentoParaImprimir.condicoesPagamento || 'A Combinar'}
              tipoDocumento="ORCAMENTO"
            />
          </div>
        </Dialog>
      )}
    </div>
  );
}
