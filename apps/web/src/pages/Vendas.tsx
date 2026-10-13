import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingBag,
  TrendingUp,
  DollarSign,
  ShieldCheck,
  Ban,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Printer,
  FileText,
  Plus,
  AlertTriangle,
  Receipt,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { DetalhesVendaModal } from '@/components/vendas/DetalhesVendaModal';
import { CancelarVendaModal } from '@/components/vendas/CancelarVendaModal';
import { apiClient } from '@/lib/apiClient';
import { useEmpresaStore } from '@/stores/empresaStore';
import { VendaKpis, VendaView } from '@/types/vendas';
import {
  executarImpressao,
  gerarHtmlNfce,
  gerarHtmlReciboNaoFiscal,
  DadosImpressao,
} from '@/lib/reciboPrint';

interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

function currency(val?: number): string {
  if (val == null) return 'R$ 0,00';
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso?: string): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function Vendas() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const empresa = useEmpresaStore((s) => s.empresa);

  // Filtros
  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [periodoPreset, setPeriodoPreset] = React.useState<'hoje' | 'ontem' | '7d' | '30d' | 'mes' | 'todos'>('30d');
  const [dataInicio, setDataInicio] = React.useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dataFim, setDataFim] = React.useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [statusVenda, setStatusVenda] = React.useState('TODOS');
  const [statusFiscal, setStatusFiscal] = React.useState('TODOS');
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(20);

  // Modais
  const [vendaSelecionada, setVendaSelecionada] = React.useState<VendaView | null>(null);
  const [modalDetalhesOpen, setModalDetalhesOpen] = React.useState(false);
  const [vendaParaCancelar, setVendaParaCancelar] = React.useState<VendaView | null>(null);
  const [modalCancelarOpen, setModalCancelarOpen] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  // Debounce na busca
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Altera preset de datas
  function aplicarPreset(preset: 'hoje' | 'ontem' | '7d' | '30d' | 'mes' | 'todos') {
    setPeriodoPreset(preset);
    setPage(0);
    const hoje = new Date();
    if (preset === 'hoje') {
      const hStr = hoje.toISOString().split('T')[0];
      setDataInicio(hStr);
      setDataFim(hStr);
    } else if (preset === 'ontem') {
      const ontem = new Date();
      ontem.setDate(hoje.getDate() - 1);
      const oStr = ontem.toISOString().split('T')[0];
      setDataInicio(oStr);
      setDataFim(oStr);
    } else if (preset === '7d') {
      const d7 = new Date();
      d7.setDate(hoje.getDate() - 7);
      setDataInicio(d7.toISOString().split('T')[0]);
      setDataFim(hoje.toISOString().split('T')[0]);
    } else if (preset === '30d') {
      const d30 = new Date();
      d30.setDate(hoje.getDate() - 30);
      setDataInicio(d30.toISOString().split('T')[0]);
      setDataFim(hoje.toISOString().split('T')[0]);
    } else if (preset === 'mes') {
      const primDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      setDataInicio(primDia.toISOString().split('T')[0]);
      setDataFim(hoje.toISOString().split('T')[0]);
    } else if (preset === 'todos') {
      setDataInicio('');
      setDataFim('');
    }
  }

  // Query de Vendas
  const vendasQuery = useQuery({
    queryKey: ['vendas-historico', debouncedSearch, dataInicio, dataFim, statusVenda, statusFiscal, page, pageSize],
    queryFn: async () => {
      const res = await apiClient.get<PageResponse<VendaView>>('/v1/vendas', {
        params: {
          search: debouncedSearch || undefined,
          dataInicio: dataInicio || undefined,
          dataFim: dataFim || undefined,
          status: statusVenda !== 'TODOS' ? statusVenda : undefined,
          statusFiscal: statusFiscal !== 'TODOS' ? statusFiscal : undefined,
          page,
          size: pageSize,
        },
      });
      return res.data;
    },
    staleTime: 15_000,
  });

  // Query de KPIs
  const kpisQuery = useQuery({
    queryKey: ['vendas-kpis', dataInicio, dataFim],
    queryFn: async () => {
      const res = await apiClient.get<VendaKpis>('/v1/vendas/kpis', {
        params: {
          dataInicio: dataInicio || undefined,
          dataFim: dataFim || undefined,
        },
      });
      return res.data;
    },
    staleTime: 30_000,
  });

  // Mutação para cancelar venda
  const cancelarMutation = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      const res = await apiClient.post<VendaView>(`/v1/vendas/${id}/cancelar`, { motivo });
      return res.data;
    },
    onSuccess: (vendaAtualizada) => {
      setModalCancelarOpen(false);
      setVendaParaCancelar(null);
      if (vendaSelecionada?.id === vendaAtualizada.id) {
        setVendaSelecionada(vendaAtualizada);
      }
      setFeedback({
        tipo: 'sucesso',
        texto: `Venda ${vendaAtualizada.numero} cancelada com sucesso. Estoque e financeiro estornados.`,
      });
      queryClient.invalidateQueries({ queryKey: ['vendas-historico'] });
      queryClient.invalidateQueries({ queryKey: ['vendas-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['ordens-servico'] });
      queryClient.invalidateQueries({ queryKey: ['contas-receber'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Falha ao cancelar venda.';
      setFeedback({ tipo: 'erro', texto: msg });
    },
  });

  function abrirDetalhes(v: VendaView) {
    setVendaSelecionada(v);
    setModalDetalhesOpen(true);
  }

  function dispararCancelamento(v: VendaView) {
    setVendaParaCancelar(v);
    setModalCancelarOpen(true);
  }

  function handleImprimirReciboRapido(venda: VendaView) {
    const dados: DadosImpressao = {
      osNumero: venda.numero,
      data: venda.dataHora,
      empresa: {
        nome: empresa?.nome,
        razaoSocial: empresa?.nome,
        cnpj: empresa?.cnpj,
        endereco: empresa?.endereco,
        numero: empresa?.numero,
        bairro: empresa?.bairro,
        cidade: empresa?.cidade,
        uf: empresa?.uf,
        telefone: empresa?.telefone,
        whatsapp: empresa?.whatsapp || undefined,
      },
      cliente: {
        nome: venda.clienteNome,
        cpf: venda.clienteCpf || undefined,
        telefone: venda.clienteTelefone || venda.clienteWhatsapp || undefined,
      },
      itens: venda.itens.map((it) => ({
        nome: it.nome,
        qtd: it.quantidade,
        preco: it.precoUnitario,
        sku: it.sku,
      })),
      subtotal: venda.subtotal,
      desconto: venda.desconto,
      total: venda.valorTotal,
      formaPagamento: venda.formaPagamento,
    };
    const html = gerarHtmlReciboNaoFiscal(dados);
    executarImpressao(html);
  }

  function handleImprimirNfceRapido(venda: VendaView) {
    const dados: DadosImpressao = {
      osNumero: venda.numero,
      data: venda.dataAutorizacaoFiscal || venda.dataHora,
      empresa: {
        nome: empresa?.nome,
        razaoSocial: empresa?.nome,
        cnpj: empresa?.cnpj,
        endereco: empresa?.endereco,
        numero: empresa?.numero,
        bairro: empresa?.bairro,
        cidade: empresa?.cidade,
        uf: empresa?.uf,
        telefone: empresa?.telefone,
        whatsapp: empresa?.whatsapp || undefined,
      },
      cliente: {
        nome: venda.clienteNome,
        cpf: venda.clienteCpf || undefined,
      },
      itens: venda.itens.map((it) => ({
        nome: it.nome,
        qtd: it.quantidade,
        preco: it.precoUnitario,
        sku: it.sku,
      })),
      subtotal: venda.subtotal,
      desconto: venda.desconto,
      total: venda.valorTotal,
      formaPagamento: venda.formaPagamento,
      chaveNfce: venda.chaveAcesso,
      protocoloNfce: venda.protocoloFiscal,
      tipoDocumento: 'NFCE',
    };
    const html = gerarHtmlNfce(dados);
    executarImpressao(html);
  }

  const kpis = kpisQuery.data;
  const vendas = vendasQuery.data?.content || [];
  const totalPaginas = vendasQuery.data?.totalPages || 0;
  const totalRegistros = vendasQuery.data?.totalElements || 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Feedback */}
      {feedback && (
        <div
          role="alert"
          className={`flex items-center justify-between rounded-lg border p-4 text-sm ${
            feedback.tipo === 'sucesso'
              ? 'border-[var(--color-success-dark)]/20 bg-[var(--color-success-light)] text-[var(--color-success-dark)]'
              : 'border-[var(--color-danger-dark)]/20 bg-[var(--color-danger-light)] text-[var(--color-danger-dark)]'
          }`}
        >
          <span>{feedback.texto}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs font-semibold hover:underline"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Central de Vendas
          </h1>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Histórico completo de pedidos, balcão e PDV integrado a estoque, financeiro e NFC-e
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['vendas-historico'] });
              queryClient.invalidateQueries({ queryKey: ['vendas-kpis'] });
            }}
            disabled={vendasQuery.isFetching}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${vendasQuery.isFetching ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => navigate('/pdv')}
            className="gap-1.5 font-semibold"
          >
            <Plus className="h-4 w-4" /> Nova Venda (PDV)
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Total Vendas */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 shadow-sm">
          <div className="flex items-center justify-between text-[var(--color-text-muted)]">
            <span className="text-xs font-medium">Total de Vendas</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-[var(--color-text-primary)]">
            {kpisQuery.isLoading ? '-' : kpis?.totalVendas ?? 0}
          </div>
          <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">Vendas ativas no período</p>
        </div>

        {/* Faturamento Total */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 shadow-sm">
          <div className="flex items-center justify-between text-[var(--color-text-muted)]">
            <span className="text-xs font-medium">Faturamento Total</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-success-light)] text-[var(--color-success-dark)]">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-[var(--color-text-primary)]">
            {kpisQuery.isLoading ? '-' : currency(kpis?.faturamentoTotal)}
          </div>
          <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">Receita líquida confirmada</p>
        </div>

        {/* Ticket Médio */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 shadow-sm">
          <div className="flex items-center justify-between text-[var(--color-text-muted)]">
            <span className="text-xs font-medium">Ticket Médio</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-neutral-100)] text-[var(--color-text-primary)] dark:bg-[var(--color-neutral-800)]">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-[var(--color-text-primary)]">
            {kpisQuery.isLoading ? '-' : currency(kpis?.ticketMedio)}
          </div>
          <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">Média por cliente</p>
        </div>

        {/* Cupons Fiscais */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 shadow-sm">
          <div className="flex items-center justify-between text-[var(--color-text-muted)]">
            <span className="text-xs font-medium">NFC-e Emitidos</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-success-light)] text-[var(--color-success-dark)]">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-[var(--color-text-primary)]">
            {kpisQuery.isLoading ? '-' : kpis?.cuponsEmitidos ?? 0}
          </div>
          <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
            {kpis?.cuponsNaoEmitidos ?? 0} cupons comuns
          </p>
        </div>

        {/* Canceladas */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 shadow-sm">
          <div className="flex items-center justify-between text-[var(--color-text-muted)]">
            <span className="text-xs font-medium">Vendas Canceladas</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-danger-light)] text-[var(--color-danger-dark)]">
              <Ban className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-[var(--color-text-primary)]">
            {kpisQuery.isLoading ? '-' : kpis?.totalCanceladas ?? 0}
          </div>
          <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">Estornos registrados</p>
        </div>
      </div>

      {/* Painel de Filtros */}
      <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 shadow-sm">
        {/* Presets de Período e Busca */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-semibold text-[var(--color-text-secondary)]">Período:</span>
            {(['hoje', 'ontem', '7d', '30d', 'mes', 'todos'] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => aplicarPreset(preset)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  periodoPreset === preset
                    ? 'bg-[var(--color-brand)] text-white'
                    : 'bg-[var(--color-bg-page)] text-[var(--color-text-secondary)] hover:bg-[var(--color-neutral-100)] dark:hover:bg-[var(--color-neutral-800)]'
                }`}
              >
                {preset === 'hoje'
                  ? 'Hoje'
                  : preset === 'ontem'
                  ? 'Ontem'
                  : preset === '7d'
                  ? 'Últimos 7d'
                  : preset === '30d'
                  ? 'Últimos 30d'
                  : preset === 'mes'
                  ? 'Este Mês'
                  : 'Todos'}
              </button>
            ))}
          </div>

          <div className="relative min-w-[260px] flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--color-text-muted)]" />
            <Input
              type="text"
              placeholder="Buscar por Nº OS ou Cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>
        </div>

        {/* Filtros Avançados */}
        <div className="grid grid-cols-1 gap-3 border-t border-[var(--color-border)] pt-3 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--color-text-secondary)]">
              Data Início
            </label>
            <Input
              type="date"
              value={dataInicio}
              onChange={(e) => {
                setDataInicio(e.target.value);
                setPeriodoPreset('todos');
                setPage(0);
              }}
              className="text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--color-text-secondary)]">
              Data Fim
            </label>
            <Input
              type="date"
              value={dataFim}
              onChange={(e) => {
                setDataFim(e.target.value);
                setPeriodoPreset('todos');
                setPage(0);
              }}
              className="text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--color-text-secondary)]">
              Status da Venda
            </label>
            <Select
              value={statusVenda}
              onChange={(e) => {
                setStatusVenda(e.target.value);
                setPage(0);
              }}
              className="text-xs"
            >
              <option value="TODOS">Todos os Status</option>
              <option value="PEDIDO_CONFIRMADO">Venda Confirmada</option>
              <option value="ORCAMENTO">Orçamento</option>
              <option value="ENVIADO_LABORATORIO">No Laboratório</option>
              <option value="EM_PRODUCAO">Em Produção</option>
              <option value="MONTAGEM">Em Montagem</option>
              <option value="PRONTO_PARA_RETIRADA">Pronto para Retirada</option>
              <option value="ENTREGUE">Entregue</option>
              <option value="CANCELADO">Cancelada</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--color-text-secondary)]">
              Status Fiscal (NFC-e)
            </label>
            <Select
              value={statusFiscal}
              onChange={(e) => {
                setStatusFiscal(e.target.value);
                setPage(0);
              }}
              className="text-xs"
            >
              <option value="TODOS">Todos os Fiscais</option>
              <option value="AUTORIZADO">NFC-e Autorizada</option>
              <option value="NAO_EMITIDO">Não Emitido / Cupom Comum</option>
              <option value="CONTINGENCIA">Em Contingência</option>
              <option value="CANCELADO">Cancelado na SEFAZ</option>
            </Select>
          </div>
        </div>
      </div>

      {/* Tabela de Vendas */}
      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-sm">
        {vendasQuery.isLoading ? (
          <div className="p-12">
            <LoadingState title="Carregando histórico de vendas..." />
          </div>
        ) : vendasQuery.isError ? (
          <div className="p-8 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-[var(--color-danger-dark)]" />
            <p className="mt-2 text-sm font-semibold text-[var(--color-danger-dark)]">
              Falha ao carregar vendas
            </p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {(vendasQuery.error as any)?.message || 'Erro de conexão com o servidor.'}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => vendasQuery.refetch()}
              className="mt-4"
            >
              Tentar Novamente
            </Button>
          </div>
        ) : vendas.length === 0 ? (
          <div className="p-12">
            <EmptyState
              icon={Receipt}
              title="Nenhuma venda encontrada"
              description="Nenhum registro corresponde aos filtros selecionados. Tente ajustar o período ou a busca."
              action={
                <Button variant="outline" size="sm" onClick={() => navigate('/pdv')}>
                  Abrir PDV para Vender
                </Button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg-page)] text-[var(--color-text-muted)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Data / Hora</th>
                  <th className="px-4 py-3 font-semibold">Nº Venda (OS)</th>
                  <th className="px-4 py-3 font-semibold">Cliente</th>
                  <th className="px-4 py-3 font-semibold">Forma Pagto</th>
                  <th className="px-4 py-3 text-right font-semibold">Total R$</th>
                  <th className="px-4 py-3 text-center font-semibold">Status Venda</th>
                  <th className="px-4 py-3 text-center font-semibold">Status Fiscal</th>
                  <th className="px-4 py-3 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {vendas.map((venda) => {
                  const isCancelada = venda.status === 'CANCELADO';
                  return (
                    <tr
                      key={venda.id}
                      className="transition-colors hover:bg-[var(--color-neutral-50)] dark:hover:bg-[var(--color-neutral-900)]"
                    >
                      {/* Data / Hora */}
                      <td className="whitespace-nowrap px-4 py-3 text-[var(--color-text-secondary)]">
                        {formatDate(venda.dataHora)}
                      </td>

                      {/* Nº Venda (OS) */}
                      <td className="whitespace-nowrap px-4 py-3 font-mono font-bold text-[var(--color-brand)]">
                        <button
                          type="button"
                          onClick={() => abrirDetalhes(venda)}
                          className="hover:underline"
                        >
                          {venda.numero}
                        </button>
                      </td>

                      {/* Cliente */}
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[var(--color-text-primary)]">{venda.clienteNome}</p>
                        {venda.clienteWhatsapp && (
                          <p className="text-[11px] text-[var(--color-text-muted)]">
                            {venda.clienteWhatsapp}
                          </p>
                        )}
                      </td>

                      {/* Forma Pagto */}
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                        <span className="truncate max-w-[140px] inline-block" title={venda.formaPagamento}>
                          {venda.formaPagamento}
                        </span>
                      </td>

                      {/* Total R$ */}
                      <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-[var(--color-text-primary)]">
                        {currency(venda.valorTotal)}
                      </td>

                      {/* Status Venda */}
                      <td className="whitespace-nowrap px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            isCancelada
                              ? 'bg-[var(--color-danger-light)] text-[var(--color-danger-dark)]'
                              : venda.status === 'PEDIDO_CONFIRMADO' || venda.status === 'ENTREGUE'
                              ? 'bg-[var(--color-success-light)] text-[var(--color-success-dark)]'
                              : 'bg-[var(--color-brand)]/10 text-[var(--color-brand)]'
                          }`}
                        >
                          {venda.statusDescricao || venda.status}
                        </span>
                      </td>

                      {/* Status Fiscal */}
                      <td className="whitespace-nowrap px-4 py-3 text-center">
                        {venda.statusFiscal === 'AUTORIZADO' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success-light)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--color-success-dark)]">
                            <ShieldCheck className="h-3 w-3" /> NFC-e Autorizada
                          </span>
                        ) : venda.statusFiscal === 'CONTINGENCIA' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-warning-light)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--color-warning-dark)]">
                            <AlertTriangle className="h-3 w-3" /> Contingência
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-[var(--color-neutral-100)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--color-text-muted)] dark:bg-[var(--color-neutral-800)]">
                            Comum
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => abrirDetalhes(venda)}
                            className="rounded p-1 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-neutral-100)] hover:text-[var(--color-brand)] dark:hover:bg-[var(--color-neutral-800)]"
                            title="Ver Detalhes"
                            aria-label={`Ver detalhes da venda ${venda.numero}`}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleImprimirReciboRapido(venda)}
                            className="rounded p-1 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-neutral-100)] hover:text-[var(--color-text-primary)] dark:hover:bg-[var(--color-neutral-800)]"
                            title="Reimprimir Recibo (80mm)"
                            aria-label={`Reimprimir recibo da venda ${venda.numero}`}
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                          {venda.statusFiscal === 'AUTORIZADO' && (
                            <button
                              type="button"
                              onClick={() => handleImprimirNfceRapido(venda)}
                              className="rounded p-1 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-neutral-100)] hover:text-[var(--color-success-dark)] dark:hover:bg-[var(--color-neutral-800)]"
                              title="Reimprimir Cupom NFC-e"
                              aria-label={`Reimprimir cupom fiscal da venda ${venda.numero}`}
                            >
                              <FileText className="h-4 w-4" />
                            </button>
                          )}
                          {!isCancelada && (
                            <button
                              type="button"
                              onClick={() => dispararCancelamento(venda)}
                              className="rounded p-1 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-danger-light)] hover:text-[var(--color-danger-dark)]"
                              title="Cancelar Venda"
                              aria-label={`Cancelar venda ${venda.numero}`}
                            >
                              <Ban className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Rodapé da Tabela: Paginação */}
        {totalPaginas > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--color-border)] px-4 py-3 text-xs text-[var(--color-text-secondary)]">
            <div>
              Mostrando {vendas.length} de {totalRegistros} vendas
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || vendasQuery.isFetching}
                className="h-7 w-7 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span>
                Página {page + 1} de {totalPaginas}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPaginas - 1, p + 1))}
                disabled={page >= totalPaginas - 1 || vendasQuery.isFetching}
                className="h-7 w-7 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modais */}
      <DetalhesVendaModal
        open={modalDetalhesOpen}
        onClose={() => setModalDetalhesOpen(false)}
        venda={vendaSelecionada}
        onCancelarVenda={(v) => {
          setModalDetalhesOpen(false);
          dispararCancelamento(v);
        }}
      />

      <CancelarVendaModal
        open={modalCancelarOpen}
        onClose={() => setModalCancelarOpen(false)}
        venda={vendaParaCancelar}
        onConfirmar={(motivo) => {
          if (vendaParaCancelar) {
            cancelarMutation.mutate({ id: vendaParaCancelar.id, motivo });
          }
        }}
        isPending={cancelarMutation.isPending}
      />
    </div>
  );
}
