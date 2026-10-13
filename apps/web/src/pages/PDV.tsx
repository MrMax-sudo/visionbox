import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { ControleCaixaModal, type CaixaSessao } from '@/components/caixa/ControleCaixaModal';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AutorizacaoDescontoModal } from '@/components/pdv/AutorizacaoDescontoModal';
import { NovoClienteModal } from '@/components/pdv/NovoClienteModal';
import { DadosClienteModal } from '@/components/pdv/DadosClienteModal';
import { MaisAcoesModal } from '@/components/pdv/MaisAcoesModal';
import { FinalizarVendaModal } from '@/components/pdv/FinalizarVendaModal';
import { ClienteBuscaCard } from '@/components/pdv/ClienteBuscaCard';
import { ProdutosBuscaCard } from '@/components/pdv/ProdutosBuscaCard';
import { CarrinhoLista } from '@/components/pdv/CarrinhoLista';
import { ResumoVendaPanel } from '@/components/pdv/ResumoVendaPanel';
import { VendaConcluidaDialog } from '@/components/pdv/VendaConcluidaDialog';
import { FeedbackBanner } from '@/components/pdv/FeedbackBanner';
import { apiClient, ApiError } from '@/lib/apiClient';
import type { ClienteDTO, CriarOrdemServicoPayload, PageResponse, ProdutoDTO } from '@/lib/types';
import { normalizeProduto, unwrapPage } from '@/lib/types';
import { useDebounce, useOnline } from '@/hooks/useOnline';
import {
  categoriaCombina,
  currency,
  getOutboxCount,
  pushOutbox,
  type CartItem,
  type DescontoTipo,
  type Feedback,
  type ProdutoPdv,
  type TipoCupom,
  type VendaConcluida,
} from '@/components/pdv/pdvHelpers';

/**
 * PDV — frente de caixa VisionBox (ONDA 2A).
 *
 * Layout 3 colunas (busca | carrinho | resumo), teclado-first e denso:
 * cabe em 1366x768 com zoom 100%. Abaixo de 1280px as colunas empilham e a
 * página rola; a partir de 1280px tudo rola internamente (sem scroll da página).
 *
 * Offline-first: Finalizar nunca é bloqueado por rede — sem conexão a venda
 * vai para o outbox local (`visionbox-outbox`) e o banner mostra a fila.
 * Atalhos: F2 = foco na busca de produto, F8 = finalizar, ESC = fecha diálogos.
 */
export default function PDV() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const online = useOnline();
  const [outboxCount, setOutboxCount] = React.useState(getOutboxCount);

  const [cliente, setCliente] = React.useState<ClienteDTO | null>(null);
  const [clienteRemovido, setClienteRemovido] = React.useState(false);
  const [buscaCliente, setBuscaCliente] = React.useState('');
  const [buscaSku, setBuscaSku] = React.useState('');
  const [categoriaAtiva, setCategoriaAtiva] = React.useState('Todos');
  const [cart, setCart] = React.useState<CartItem[]>([]);
  const [desconto, setDesconto] = React.useState(0);
  const [descontoTipo, setDescontoTipo] = React.useState<DescontoTipo>('valor');
  const [descontoAutorizadoPor, setDescontoAutorizadoPor] = React.useState<string | null>(null);
  const [descontoSenha, setDescontoSenha] = React.useState<string | null>(null);
  const [valorRecebido, setValorRecebido] = React.useState(0);
  const [formaPagamento, setFormaPagamento] = React.useState('Dinheiro');
  const [feedback, setFeedback] = React.useState<Feedback | null>(null);
  const [finalizarOpen, setFinalizarOpen] = React.useState(false);

  // Modais
  const [caixaModalOpen, setCaixaModalOpen] = React.useState(false);

  const caixaQuery = useQuery<CaixaSessao | null>({
    queryKey: ['caixa-status-atual'],
    queryFn: async () => {
      try {
        const res = await apiClient.get<CaixaSessao>('/v1/caixa/status-atual');
        return res.data;
      } catch {
        return null;
      }
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
  const isCaixaAberto = !!(caixaQuery.data && caixaQuery.data.status === 'ABERTO');

  const [descontoModalOpen, setDescontoModalOpen] = React.useState(false);
  const [novoClienteOpen, setNovoClienteOpen] = React.useState(false);
  const [dadosClienteOpen, setDadosClienteOpen] = React.useState(false);
  const [maisAcoesOpen, setMaisAcoesOpen] = React.useState(false);

  const [vendaConcluida, setVendaConcluida] = React.useState<VendaConcluida | null>(null);

  const emitirNfceMutation = useMutation({
    mutationFn: async ({ pedidoId, modelo }: { pedidoId: string; modelo?: string }) => {
      const res = await apiClient.post<{
        chaveAcesso?: string;
        protocolo?: string;
        cStat?: string;
        xMotivo?: string;
        autorizado?: boolean;
      }>('/v1/fiscal/nfce/emitir', {
        pedidoId,
        ordemServicoId: pedidoId,
        serie: '001',
        modelo: modelo || (tipoCupom === 'DANFE' ? '55' : '65'),
      });
      return res.data;
    },
    onSuccess: (data) => {
      setVendaConcluida((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          chaveNfce: data.chaveAcesso,
          protocoloNfce: data.protocolo,
        };
      });
      if (data.autorizado) {
        setFeedback({
          tone: 'success',
          msg: `NFC-e autorizada com sucesso na SEFAZ! Chave: ${data.chaveAcesso?.slice(0, 16)}...`,
        });
      } else {
        setFeedback({
          tone: 'warning',
          msg: `NFC-e processada com retorno: ${data.xMotivo || 'cStat ' + data.cStat}`,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['vendas-historico'] });
      queryClient.invalidateQueries({ queryKey: ['vendas-kpis'] });
    },
    onError: (err: unknown) => {
      const apiErr = err as ApiError;
      setFeedback({
        tone: 'error',
        msg: `Falha ao emitir documento fiscal na SEFAZ: ${apiErr.problem?.detail || apiErr.message || 'Erro de comunicação'}`,
      });
    },
  });

  const [tipoCupom, setTipoCupom] = React.useState<TipoCupom>('CUPOM');

  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<{ mensagem?: string; produtosCriados?: number; clientesCriados?: number }>(
        '/v1/produtos/seed-demonstracao',
      );
      return res.data;
    },
    onSuccess: (data) => {
      setFeedback({
        tone: 'success',
        msg: data.mensagem || 'Carga inicial de teste realizada com sucesso!',
      });
      queryClient.invalidateQueries({ queryKey: ['pdv-produtos'] });
      queryClient.invalidateQueries({ queryKey: ['pdv-clientes'] });
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      setMaisAcoesOpen(false);
    },
    onError: (err: unknown) => {
      const apiErr = err as ApiError;
      setFeedback({
        tone: 'error',
        msg: `Erro na carga de teste: ${apiErr.problem?.detail || apiErr.message || 'Falha na requisição'}`,
      });
    },
  });

  function handleVisualizarCupom() {
    if (cart.length > 0) {
      setVendaConcluida({
        osId: 'PREVIA',
        osNumero: 'PRÉVIA-CUPOM',
        itens: [...cart],
        subtotal,
        desconto: descontoAplicado,
        total,
        formaPagamento,
        clienteNome: cliente?.nome ?? 'Consumidor',
        clienteCpf: cliente?.cpf,
        clienteTelefone: cliente?.telefone,
        tipoDocumento: tipoCupom,
      });
    } else {
      setVendaConcluida({
        osId: 'DEMO',
        osNumero: 'DEMO-001',
        itens: [
          { sku: 'PRD-000001', nome: 'Armação Ray-Ban Aviador RB3025 Dourado', qtd: 1, preco: 580.0 },
          { sku: 'PRD-000004', nome: 'Lente Monofocal Antirreflexo Crizal', qtd: 1, preco: 250.0 },
        ],
        subtotal: 830.0,
        desconto: 50.0,
        total: 780.0,
        formaPagamento: 'Cartão de Crédito',
        clienteNome: cliente?.nome ?? 'Maria Eduarda Santos (Demonstração)',
        clienteCpf: cliente?.cpf ?? '529.982.247-25',
        clienteTelefone: cliente?.telefone ?? '(11) 98888-7777',
        tipoDocumento: tipoCupom,
      });
    }
  }

  const debouncedCliente = useDebounce(buscaCliente, 350);
  const debouncedSku = useDebounce(buscaSku, 350);
  const skuRef = React.useRef<HTMLInputElement>(null);

  const clientesQuery = useQuery({
    queryKey: ['pdv-clientes', debouncedCliente],
    queryFn: async () => {
      const res = await apiClient.get<PageResponse<ClienteDTO> | ClienteDTO[]>('/v1/clientes', {
        params: {
          page: 0,
          size: 5,
          // ClienteController.listar filtra por `nome`; search/q são aliases tolerados
          nome: debouncedCliente || undefined,
          search: debouncedCliente || undefined,
          q: debouncedCliente || undefined,
        },
      });
      return res.data;
    },
    staleTime: 30_000,
    gcTime: 300_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 1,
    enabled: debouncedCliente.length === 0 || debouncedCliente.length >= 2,
  });

  const produtosQuery = useQuery({
    queryKey: ['pdv-produtos', debouncedSku, categoriaAtiva],
    queryFn: async () => {
      const res = await apiClient.get<PageResponse<ProdutoDTO> | ProdutoDTO[]>('/v1/produtos', {
        params: {
          page: 0,
          size: 6,
          search: debouncedSku || undefined,
          q: debouncedSku || undefined,
          categoria: categoriaAtiva !== 'Todos' ? categoriaAtiva : undefined,
        },
      });
      return res.data;
    },
    staleTime: 30_000,
    gcTime: 300_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const clientesFiltrados = React.useMemo(
    () => unwrapPage(clientesQuery.data as PageResponse<ClienteDTO> | ClienteDTO[]).slice(0, 5),
    [clientesQuery.data],
  );

  const produtosFiltrados = React.useMemo(
    () =>
      unwrapPage(produtosQuery.data as PageResponse<ProdutoDTO> | ProdutoDTO[])
        .map((p) => normalizeProduto(p) as ProdutoPdv)
        .filter((p) => categoriaCombina(p, categoriaAtiva))
        .slice(0, 6),
    [produtosQuery.data, categoriaAtiva],
  );

  React.useEffect(() => {
    const sku = searchParams.get('sku');
    if (sku) {
      setBuscaSku(sku);
      window.setTimeout(() => skuRef.current?.focus(), 0);
    }
  }, [searchParams]);

  const finalizarRef = React.useRef<() => void>(() => {});

  React.useEffect(() => {
    finalizarRef.current = handleFinalizar;
  });

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F8') {
        e.preventDefault();
        // dispara direto: o botão pode estar desabilitado (carrinho vazio) e precisa dar feedback
        if (document.querySelector('[role="dialog"]')) return;
        finalizarRef.current();
        return;
      }
      if (e.key === 'F2') {
        // atalho de operação: volta o foco para a busca de produto
        if (document.querySelector('[role="dialog"]')) return;
        e.preventDefault();
        skuRef.current?.focus();
        skuRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  React.useEffect(() => {
    if (!cliente && !clienteRemovido && clientesFiltrados.length > 0) {
      setCliente(clientesFiltrados[0]);
    }
  }, [cliente, clienteRemovido, clientesFiltrados]);

  React.useEffect(() => {
    const onStorage = () => setOutboxCount(getOutboxCount());
    window.addEventListener('storage', onStorage);
    const id = window.setInterval(() => setOutboxCount(getOutboxCount()), 3000);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.clearInterval(id);
    };
  }, []);

  const subtotal = cart.reduce((sum, item) => sum + item.preco * item.qtd, 0);
  const descontoAplicado = descontoTipo === 'percentual' ? subtotal * (Math.min(desconto, 100) / 100) : desconto;
  const total = Math.max(0, subtotal - descontoAplicado);
  const troco = Math.max(0, valorRecebido - total);

  // Rateio do desconto da venda por linha (em centavos): soma das linhas = desconto efetivo
  const descontoRateio = React.useMemo(() => {
    const rateio = new Map<string, number>();
    if (cart.length === 0 || subtotal <= 0) return rateio;
    const totalCents = Math.round(subtotal * 100);
    const descontoCents = Math.round(Math.min(descontoAplicado, subtotal) * 100);
    if (descontoCents <= 0) return rateio;
    let soma = 0;
    const linhas = cart.map((item) => {
      const cents = Math.floor((descontoCents * Math.round(item.preco * item.qtd * 100)) / totalCents);
      soma += cents;
      return { sku: item.sku, cents };
    });
    let resto = descontoCents - soma;
    let i = 0;
    while (resto > 0 && linhas.length > 0) {
      linhas[i % linhas.length].cents += 1;
      resto -= 1;
      i += 1;
    }
    for (const linha of linhas) rateio.set(linha.sku, linha.cents / 100);
    return rateio;
  }, [cart, subtotal, descontoAplicado]);

  const criarOrdem = useMutation({
    mutationFn: async (payload: CriarOrdemServicoPayload) => {
      const res = await apiClient.post<{ id: string; numero?: string }>('/v1/ordens-servico', payload);
      return res.data;
    },
    retry: 1,
    onSuccess: (data) => {
      const numOs = data.numero ?? data.id;
      setFeedback({ tone: 'success', msg: `Venda concluída! OS ${numOs} gerada.` });

      // Salva snapshot da venda para emissão de NFC-e e impressão de comprovante
      setVendaConcluida({
        osId: data.id,
        osNumero: numOs,
        itens: [...cart],
        subtotal,
        desconto: descontoAplicado,
        total,
        formaPagamento,
        clienteNome: cliente?.nome ?? 'Consumidor',
        clienteCpf: cliente?.cpf,
        clienteTelefone: cliente?.telefone,
        tipoDocumento: tipoCupom,
      });

      setCart([]);
      setDesconto(0);
      setDescontoAutorizadoPor(null);
      setDescontoSenha(null);
      setValorRecebido(0);
      queryClient.invalidateQueries({ queryKey: ['ordens-servico'] });
      queryClient.invalidateQueries({ queryKey: ['pdv-produtos'] });
      setOutboxCount(getOutboxCount());

      // Se venda configurada como Fiscal (NFC-e ou DANFE), dispara a transmissão automaticamente
      if (tipoCupom === 'NFCE' || tipoCupom === 'DANFE') {
        emitirNfceMutation.mutate({
          pedidoId: data.id,
          modelo: tipoCupom === 'DANFE' ? '55' : '65',
        });
      }
    },
    onError: (err: unknown, payloadEnviado: CriarOrdemServicoPayload) => {
      const apiErr = err as ApiError;
      if (!apiErr.status && !online) {
        const payload: CriarOrdemServicoPayload = {
          clienteId: cliente?.id ?? 'offline-cliente',
          itens: cart.map((item) => ({ sku: item.sku, quantidade: item.qtd, produtoId: item.produtoId })),
          desconto: descontoAplicado > 0 ? descontoAplicado : undefined,
          senhaAutorizacao: descontoSenha || undefined,
          formaPagamento,
          // preserva o rateio multi-forma + MDR (maquininha/parcelas) no outbox (§3.5)
          pagamentos: payloadEnviado.pagamentos,
        };
        const armacao = cart.find((item) => (item.categoria ?? '').toLowerCase().includes('arma'));
        const lente = cart.find((item) => (item.categoria ?? '').toLowerCase().includes('lente'));
        if (armacao?.produtoId) payload.armacaoId = armacao.produtoId;
        if (lente?.produtoId) payload.lenteId = lente.produtoId;
        pushOutbox(payload);
        setOutboxCount(getOutboxCount());
        setFeedback({ tone: 'warning', msg: 'Sem conexão. Venda enfileirada para sincronizar quando a rede voltar.' });
        return;
      }
      const detail = apiErr.problem?.detail || apiErr.message || 'Falha ao finalizar venda';
      const fieldErrors = apiErr.problem?.errors?.map((e) => `${e.field}: ${e.message}`).join(' • ');
      setFeedback({ tone: 'error', msg: fieldErrors ? `${detail} — ${fieldErrors}` : detail });
    },
  });

  function addToCart(produto: ProdutoDTO) {
    setCart((prev) => {
      const found = prev.find((item) => item.sku === produto.sku);
      if (found) return prev.map((item) => (item.sku === produto.sku ? { ...item, qtd: item.qtd + 1 } : item));
      return [
        ...prev,
        { sku: produto.sku, nome: produto.nome, qtd: 1, preco: produto.preco, produtoId: produto.id, categoria: produto.categoria },
      ];
    });
    setBuscaSku('');
    skuRef.current?.focus();
  }

  const descontoPctCalculado = subtotal > 0 ? (descontoAplicado / subtotal) * 100 : 0;

  function handleFinalizar() {
    if (criarOrdem.isPending) return;
    if (!isCaixaAberto) {
      setFeedback({
        tone: 'error',
        msg: 'Venda bloqueada: o caixa físico está fechado! Abra o caixa antes de realizar vendas.',
      });
      setCaixaModalOpen(true);
      return;
    }
    if (cart.length === 0) {
      setFeedback({ tone: 'warning', msg: 'Carrinho vazio. Adicione ao menos um produto para finalizar.' });
      return;
    }
    if (!cliente) {
      setFeedback({ tone: 'error', msg: 'Selecione um cliente antes de finalizar.' });
      return;
    }

    // Regra de Alçada de Desconto (> 15% exige autorização de gerente)
    if (descontoPctCalculado > 15.01 && !descontoAutorizadoPor) {
      setDescontoModalOpen(true);
      return;
    }

    setFinalizarOpen(true);
  }

  function confirmarVenda(
    pagamentos: Array<{
      formaId: string;
      formaNome: string;
      valor: number;
      /** Cartão (§3.5): ausente → MDR pendente no backend (WARN). */
      maquininhaId?: string;
      parcelas?: number;
    }>,
  ) {
    if (!cliente) return;
    const armacao = cart.find((item) => (item.categoria ?? '').toLowerCase().includes('arma'));
    const lente = cart.find((item) => (item.categoria ?? '').toLowerCase().includes('lente'));
    const payload: CriarOrdemServicoPayload = {
      clienteId: cliente.id,
      itens: cart.map((item) => ({ sku: item.sku, quantidade: item.qtd, produtoId: item.produtoId })),
      desconto: descontoAplicado > 0 ? descontoAplicado : undefined,
      senhaAutorizacao: descontoSenha || undefined,
      formaPagamento: pagamentos.length === 1 ? pagamentos[0].formaNome : 'Múltiplo',
      pagamentos: pagamentos.map((p) => ({
        formaPagamentoId: p.formaId,
        valor: p.valor,
        ...(p.maquininhaId ? { maquininhaId: p.maquininhaId } : {}),
        ...(p.parcelas != null ? { parcelas: p.parcelas } : {}),
      })),
      armacaoId: armacao?.produtoId ?? cart[0]?.produtoId ?? null,
      lenteId: lente?.produtoId ?? (cart.length > 1 ? cart[1]?.produtoId : null),
    };
    if (!payload.armacaoId && !payload.lenteId) {
      delete payload.armacaoId;
      delete payload.lenteId;
    }
    setFinalizarOpen(false);
    setFeedback(null);
    criarOrdem.mutate(payload);
  }

  function removerClienteDaVenda() {
    setCliente(null);
    setClienteRemovido(true);
  }

  function gerarPrevia() {
    if (vendaConcluida) return;
    if (cart.length === 0) {
      setFeedback({ tone: 'warning', msg: 'Carrinho vazio. Adicione produtos para gerar o orçamento.' });
      return;
    }
    setVendaConcluida({
      osId: 'PREVIA',
      osNumero: 'ORÇAMENTO',
      itens: [...cart],
      subtotal,
      desconto: descontoAplicado,
      total,
      formaPagamento,
      clienteNome: cliente?.nome ?? 'Consumidor',
      clienteCpf: cliente?.cpf,
      clienteTelefone: cliente?.telefone,
      tipoDocumento: tipoCupom,
    });
  }

  async function copiarResumo() {
    setMaisAcoesOpen(false);
    if (cart.length === 0) {
      setFeedback({ tone: 'warning', msg: 'Carrinho vazio. Nada para copiar.' });
      return;
    }
    const linhas = cart.map(
      (item, index) =>
        `${index + 1}. ${item.nome} (${item.sku}) — ${item.qtd} x ${currency(item.preco)} = ${currency(item.preco * item.qtd)}`,
    );
    const texto = [
      `Resumo da venda — ${cliente?.nome ?? 'Consumidor'}`,
      '',
      ...linhas,
      '',
      `Subtotal: ${currency(subtotal)}`,
      `Desconto: ${currency(descontoAplicado)}`,
      `Total: ${currency(total)}`,
      `Pagamento: ${formaPagamento}`,
      descontoAutorizadoPor ? `Desconto autorizado por: ${descontoAutorizadoPor}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    try {
      if (!navigator.clipboard) throw new Error('Área de transferência indisponível');
      await navigator.clipboard.writeText(texto);
      setFeedback({ tone: 'success', msg: 'Resumo da venda copiado para a área de transferência.' });
    } catch {
      setFeedback({ tone: 'error', msg: 'Não foi possível copiar o resumo da venda.' });
    }
  }

  function alterarQtd(sku: string, qtd: number) {
    setCart((prev) => prev.map((row) => (row.sku === sku ? { ...row, qtd } : row)));
  }

  return (
    <div className="flex min-h-full flex-col gap-2.5 xl:h-full">
      <OfflineBanner pendingCount={outboxCount} />

      {/* Cabeçalho do PDV com Sinalizador Único de Caixa */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-base font-bold text-primary">
            PDV — Frente de caixa
          </h1>
          <button
            type="button"
            onClick={() => setCaixaModalOpen(true)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer shadow-sm',
              isCaixaAberto
                ? 'border-emerald-500/50 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                : 'border-rose-400 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
            )}
            title={
              isCaixaAberto
                ? `Caixa Aberto (${caixaQuery.data?.operadorNome || 'Operador'}). Clique para gerenciar.`
                : 'Caixa Fechado. Clique para abrir o caixa.'
            }
          >
            <span className={cn('h-2 w-2 rounded-full', isCaixaAberto ? 'bg-emerald-500' : 'bg-rose-500')} />
            <span>
              {isCaixaAberto
                ? `Caixa Aberto (${caixaQuery.data?.operadorNome || 'Operador'})`
                : 'Caixa Fechado (Clique para abrir)'}
            </span>
          </button>
        </div>
      </div>

      {feedback && <FeedbackBanner feedback={feedback} onClose={() => setFeedback(null)} />}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2.5 lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[auto_auto] xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_minmax(300px,340px)] xl:grid-rows-[minmax(0,1fr)]">
        {/* Coluna 1 — cliente + produtos */}
        <div className="flex min-h-0 flex-col gap-2.5 lg:col-start-1 lg:row-start-1 xl:col-start-1 xl:row-start-1">
          <ClienteBuscaCard
            busca={buscaCliente}
            onBuscaChange={(valor) => {
              setBuscaCliente(valor);
              setClienteRemovido(false);
            }}
            cliente={cliente}
            resultados={clientesFiltrados}
            isLoading={clientesQuery.isLoading}
            error={clientesQuery.isError ? clientesQuery.error : null}
            onRetry={() => clientesQuery.refetch()}
            onSelecionar={(item) => {
              setCliente(item);
              setBuscaCliente('');
              setClienteRemovido(false);
            }}
            onRemover={removerClienteDaVenda}
            onNovoCliente={() => setNovoClienteOpen(true)}
            onVerDados={() => setDadosClienteOpen(true)}
          />

          <ProdutosBuscaCard
            className="max-h-[46vh] shrink-0 xl:max-h-none xl:min-h-0 xl:flex-1"
            busca={buscaSku}
            onBuscaChange={setBuscaSku}
            onEnter={() => {
              if (produtosFiltrados[0]) addToCart(produtosFiltrados[0]);
            }}
            skuRef={skuRef}
            debouncedBusca={debouncedSku}
            categoriaAtiva={categoriaAtiva}
            onCategoria={setCategoriaAtiva}
            produtos={produtosFiltrados}
            isLoading={produtosQuery.isLoading}
            error={produtosQuery.isError ? produtosQuery.error : null}
            onRetry={() => produtosQuery.refetch()}
            onAdicionar={addToCart}
            onNovoProduto={() => navigate('/catalogo?novo=1')}
          />
        </div>

        {/* Coluna 2 — carrinho */}
        <div className="min-h-0 lg:col-start-1 lg:row-start-2 xl:col-start-2 xl:row-start-1">
          <CarrinhoLista
            cart={cart}
            cliente={cliente}
            onQtdChange={alterarQtd}
            onRemover={(sku) => setCart((prev) => prev.filter((row) => row.sku !== sku))}
            onLimpar={() => setCart([])}
          />
        </div>

        {/* Coluna 3 — resumo + pagamento + finalizar */}
        <div className="min-h-0 lg:col-start-2 lg:row-start-1 lg:row-span-2 xl:col-start-3 xl:row-start-1 xl:row-span-1">
          <ResumoVendaPanel
            subtotal={subtotal}
            desconto={desconto}
            descontoTipo={descontoTipo}
            onDescontoTipo={setDescontoTipo}
            onDesconto={setDesconto}
            total={total}
            troco={troco}
            valorRecebido={valorRecebido}
            onValorRecebido={setValorRecebido}
            formaPagamento={formaPagamento}
            onFormaPagamento={setFormaPagamento}
            onFinalizar={handleFinalizar}
            finalizando={criarOrdem.isPending}
            temItens={cart.length > 0}
            tipoCupom={tipoCupom}
            onTipoCupomChange={setTipoCupom}
            onVisualizarCupom={handleVisualizarCupom}
            onAbrirCaixa={() => setCaixaModalOpen(true)}
            onOrcamento={gerarPrevia}
            onMaisAcoes={() => setMaisAcoesOpen(true)}
            isCaixaAberto={isCaixaAberto}
            caixaOperador={caixaQuery.data?.operadorNome}
          />
        </div>
      </div>

      {/* Conclusão da venda: emissão NFC-e + comprovante */}
      <VendaConcluidaDialog
        venda={vendaConcluida}
        onClose={() => setVendaConcluida(null)}
        emitindo={emitirNfceMutation.isPending}
        onEmitir={() => {
          if (vendaConcluida) emitirNfceMutation.mutate({ pedidoId: vendaConcluida.osId });
        }}
        onAcompanhar={(osId) => {
          setVendaConcluida(null);
          navigate(`/os/${osId}`);
        }}
      />

      {/* Modal de Controle de Caixa Físico */}
      <ControleCaixaModal open={caixaModalOpen} onClose={() => setCaixaModalOpen(false)} />

      {/* Modal de Autorização de Desconto (Alçada Gerencial > 15%) */}
      <AutorizacaoDescontoModal
        open={descontoModalOpen}
        onClose={() => setDescontoModalOpen(false)}
        percentualDesconto={descontoPctCalculado}
        valorDesconto={descontoAplicado}
        subtotal={subtotal}
        onAutorizado={(supervisor, pin) => {
          setDescontoAutorizadoPor(supervisor);
          setDescontoSenha(pin);
          setDescontoModalOpen(false);
          setFeedback({ tone: 'success', msg: `Desconto de ${descontoPctCalculado.toFixed(1)}% autorizado por ${supervisor}.` });
          setFinalizarOpen(true);
        }}
      />

      <NovoClienteModal
        open={novoClienteOpen}
        onClose={() => setNovoClienteOpen(false)}
        onSelecionado={(novoCliente) => {
          setCliente(novoCliente);
          setClienteRemovido(false);
          setBuscaCliente('');
        }}
        onFeedback={setFeedback}
      />

      <DadosClienteModal
        open={dadosClienteOpen}
        onClose={() => setDadosClienteOpen(false)}
        cliente={cliente}
        onRemover={removerClienteDaVenda}
      />

      <MaisAcoesModal
        open={maisAcoesOpen}
        onClose={() => setMaisAcoesOpen(false)}
        temItens={cart.length > 0}
        temCliente={!!cliente}
        onLimparCarrinho={() => {
          setCart([]);
          setMaisAcoesOpen(false);
          setFeedback({ tone: 'success', msg: 'Carrinho limpo.' });
        }}
        onRemoverCliente={() => {
          removerClienteDaVenda();
          setMaisAcoesOpen(false);
          setFeedback({ tone: 'success', msg: 'Cliente removido da venda.' });
        }}
        onCopiarResumo={copiarResumo}
        onSeedDemonstracao={() => seedMutation.mutate()}
        isSeeding={seedMutation.isPending}
      />

      <FinalizarVendaModal
        open={finalizarOpen}
        onClose={() => setFinalizarOpen(false)}
        onConfirmar={confirmarVenda}
        itens={cart}
        subtotal={subtotal}
        desconto={descontoAplicado}
        total={total}
        clienteNome={cliente?.nome ?? 'Consumidor'}
        isPending={criarOrdem.isPending}
        tipoCupom={tipoCupom}
        onTipoCupomChange={setTipoCupom}
      />
    </div>
  );
}
