import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Banknote,
  Box,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  FileText,
  LockKeyhole,
  MoreHorizontal,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  Trash2,
  UserRound,
  Wallet,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog } from '@/components/ui/dialog';
import { ComprovanteImpressao, type ComprovanteItem } from '@/components/pdv/ComprovanteImpressao';
import { ControleCaixaModal } from '@/components/caixa/ControleCaixaModal';
import { AutorizacaoDescontoModal } from '@/components/pdv/AutorizacaoDescontoModal';
import { NovoClienteModal } from '@/components/pdv/NovoClienteModal';
import { DadosClienteModal } from '@/components/pdv/DadosClienteModal';
import { MaisAcoesModal } from '@/components/pdv/MaisAcoesModal';
import { FinalizarVendaModal, type FormaPagamentoDTO } from '@/components/pdv/FinalizarVendaModal';
import { apiClient, ApiError } from '@/lib/apiClient';
import type { ClienteDTO, CriarOrdemServicoPayload, PageResponse, ProdutoDTO } from '@/lib/types';
import { normalizeProduto, unwrapPage } from '@/lib/types';
import { useDebounce, useOnline } from '@/hooks/useOnline';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { ErrorState } from '@/components/ui/error-state';

type CartItem = { sku: string; nome: string; qtd: number; preco: number; produtoId?: string; categoria?: string };
type Feedback = { tone: 'success' | 'error' | 'warning'; msg: string };
type DescontoTipo = 'valor' | 'percentual';
type ProdutoPdv = ProdutoDTO & { tipoProduto?: string };

function normalizarRotulo(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
}

/**
 * Filtro client-side defensivo por categoria (espelha ProdutoService.tipoPorRotuloCategoria).
 * Compara rótulo da UI contra categoria text e tipoProduto — nunca esconde o que o backend aceitou.
 */
function categoriaCombina(produto: ProdutoPdv, rotulo: string): boolean {
  if (rotulo === 'Todos') return true;
  const alvo = normalizarRotulo(rotulo);
  const candidatos = [produto.categoria, produto.tipoProduto]
    .filter((valor): valor is string => typeof valor === 'string' && valor.length > 0)
    .map(normalizarRotulo);
  if (alvo === 'ARMACOES') return candidatos.some((c) => c.includes('ARMACAO'));
  if (alvo === 'LENTES') return candidatos.some((c) => c.includes('LENTE'));
  if (alvo === 'ACESSORIOS') return candidatos.some((c) => c.includes('ACESSORIO'));
  if (alvo === 'SERVICOS') return candidatos.some((c) => c.includes('SERVICO'));
  return candidatos.includes(alvo);
}

function getOutboxCount(): number {
  try {
    const raw = localStorage.getItem('visionbox-outbox');
    if (!raw) return 0;
    const arr = JSON.parse(raw) as unknown[];
    return Array.isArray(arr) ? arr.length : 0;
  } catch {
    return 0;
  }
}

function pushOutbox(payload: CriarOrdemServicoPayload & { _idempotencyKey?: string }) {
  try {
    const raw = localStorage.getItem('visionbox-outbox');
    const arr = raw ? (JSON.parse(raw) as unknown[]) : [];
    const next = Array.isArray(arr) ? [...arr, { ...payload, _ts: Date.now() }] : [payload];
    localStorage.setItem('visionbox-outbox', JSON.stringify(next));
  } catch {
    /* local outbox best effort */
  }
}

function currency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function initials(name?: string): string {
  return name?.split(' ').slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase() || 'CL';
}

function PixIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M12 3.4 8.7 6.7a2.6 2.6 0 0 0 0 3.7L12 13.7l3.3-3.3a2.6 2.6 0 0 0 0-3.7L12 3.4Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m5.6 9.8-2.2 2.2 2.2 2.2a2.6 2.6 0 0 0 3.7 0l2.7-2.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m18.4 9.8 2.2 2.2-2.2 2.2a2.6 2.6 0 0 1-3.7 0L12 11.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m12 13.7-3.3 3.3a2.6 2.6 0 0 0 0 3.7L12 23.6l3.3-2.9a2.6 2.6 0 0 0 0-3.7L12 13.7Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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
  const [valorRecebido, setValorRecebido] = React.useState(0);
  const [formaPagamento, setFormaPagamento] = React.useState('Dinheiro');
  const [feedback, setFeedback] = React.useState<Feedback | null>(null);
  const [finalizarOpen, setFinalizarOpen] = React.useState(false);

  // Modais
  const [caixaModalOpen, setCaixaModalOpen] = React.useState(false);
  const [descontoModalOpen, setDescontoModalOpen] = React.useState(false);
  const [novoClienteOpen, setNovoClienteOpen] = React.useState(false);
  const [dadosClienteOpen, setDadosClienteOpen] = React.useState(false);
  const [maisAcoesOpen, setMaisAcoesOpen] = React.useState(false);

  const [vendaConcluida, setVendaConcluida] = React.useState<{
    osId: string;
    osNumero: string;
    itens: CartItem[];
    subtotal: number;
    desconto: number;
    total: number;
    formaPagamento: string;
    clienteNome: string;
    clienteCpf?: string;
    clienteTelefone?: string;
    chaveNfce?: string;
    protocoloNfce?: string;
  } | null>(null);

  const emitirNfceMutation = useMutation({
    mutationFn: async ({ pedidoId }: { pedidoId: string }) => {
      const res = await apiClient.post<{
        chaveAcesso?: string;
        protocolo?: string;
        cStat?: string;
        xMotivo?: string;
        autorizado?: boolean;
      }>('/v1/fiscal/nfce/emitir', {
        pedidoId,
        serie: '001',
        modelo: '65',
      });
      return res.data;
    },
    onSuccess: (data) => {
      if (vendaConcluida) {
        setVendaConcluida({
          ...vendaConcluida,
          chaveNfce: data.chaveAcesso,
          protocoloNfce: data.protocolo,
        });
      }
      setFeedback({
        tone: 'success',
        msg: `NFC-e emitida com sucesso! Protocolo: ${data.protocolo ?? 'Autorizado'}`,
      });
    },
    onError: (err: unknown) => {
      const apiErr = err as ApiError;
      setFeedback({
        tone: 'error',
        msg: `Erro ao emitir NFC-e: ${apiErr.problem?.detail || apiErr.message || 'Falha na SEFAZ'}`,
      });
    },
  });

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
        // dispara direto: o botão pode estar disabled (carrinho vazio) e precisa dar feedback
        if (document.querySelector('[role="dialog"]')) return;
        finalizarRef.current();
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
      });

      setCart([]);
      setDesconto(0);
      setValorRecebido(0);
      queryClient.invalidateQueries({ queryKey: ['ordens-servico'] });
      queryClient.invalidateQueries({ queryKey: ['pdv-produtos'] });
      setOutboxCount(getOutboxCount());
    },
    onError: (err: unknown) => {
      const apiErr = err as ApiError;
      if (!apiErr.status && !online) {
        const payload: CriarOrdemServicoPayload = {
          clienteId: cliente?.id ?? 'offline-cliente',
          itens: cart.map((item) => ({ sku: item.sku, quantidade: item.qtd, produtoId: item.produtoId })),
          desconto: descontoAplicado > 0 ? descontoAplicado : undefined,
          formaPagamento,
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
      return [...prev, { sku: produto.sku, nome: produto.nome, qtd: 1, preco: produto.preco, produtoId: produto.id, categoria: produto.categoria }];
    });
    setBuscaSku('');
    skuRef.current?.focus();
  }

  const descontoPctCalculado = subtotal > 0 ? (descontoAplicado / subtotal) * 100 : 0;

  function handleFinalizar() {
    if (criarOrdem.isPending) return;
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

  function confirmarVenda(pagamentos: Array<{ formaId: string; formaNome: string; valor: number }>) {
    if (!cliente) return;
    const armacao = cart.find((item) => (item.categoria ?? '').toLowerCase().includes('arma'));
    const lente = cart.find((item) => (item.categoria ?? '').toLowerCase().includes('lente'));
    const payload: CriarOrdemServicoPayload = {
      clienteId: cliente.id,
      itens: cart.map((item) => ({ sku: item.sku, quantidade: item.qtd, produtoId: item.produtoId })),
      desconto: descontoAplicado > 0 ? descontoAplicado : undefined,
      formaPagamento: pagamentos.length === 1 ? pagamentos[0].formaNome : 'Múltiplo',
      pagamentos: pagamentos.map((p) => ({ formaPagamentoId: p.formaId, valor: p.valor })),
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

  return (
    <div className="pdv-screen">
      {outboxCount > 0 && <OfflineBanner pendingCount={outboxCount} />}

      {feedback && (
        <div className={`pdv-feedback pdv-feedback-${feedback.tone}`} role="status" aria-live="polite">
          {feedback.tone === 'success' ? <CheckCircle2 strokeWidth={1.8} /> : <AlertTriangle strokeWidth={1.8} />}
          <span>{feedback.msg}</span>
          <button type="button" onClick={() => setFeedback(null)} aria-label="Fechar aviso">
            <X strokeWidth={1.8} />
          </button>
        </div>
      )}

      <div className="pdv-grid">
        <section className="pdv-col-products">
          <section className="pdv-card pdv-client-card">
            <header className="pdv-card-header">
              <h2><UserRound strokeWidth={1.8} /> Cliente</h2>
              <Button variant="outline" className="pdv-outline-action gap-2" onClick={() => setNovoClienteOpen(true)}>
                <Plus /> Novo cliente
              </Button>
            </header>

            <div className="pdv-search">
              <Search strokeWidth={1.8} />
              <Input
                value={buscaCliente}
                onChange={(e) => {
                  setBuscaCliente(e.target.value);
                  setClienteRemovido(false);
                }}
                placeholder="Buscar por nome, CPF, telefone..."
                aria-label="Buscar cliente"
              />
            </div>

            {clientesQuery.isError && <ErrorState error={clientesQuery.error as ApiError} onRetry={() => clientesQuery.refetch()} compact />}

            {cliente ? (
              <div className="pdv-selected-customer">
                <button
                  type="button"
                  className="pdv-unlink-customer"
                  onClick={removerClienteDaVenda}
                  aria-label="Remover cliente da venda"
                >
                  <X strokeWidth={1.8} />
                </button>
                <div className="pdv-avatar">{initials(cliente.nome)}</div>
                <div className="pdv-customer-main">
                  <strong>{cliente.nome}</strong>
                  <span>{cliente.telefone ?? cliente.whatsapp ?? '(00) 00000-0000'}</span>
                </div>
                <div className="pdv-customer-meta">
                  <span>CPF: {cliente.cpfMasked ?? cliente.cpf ?? '***'}</span>
                  <span>Nascimento: —</span>
                  <span>Última compra: {cliente.ultimaCompra ? new Date(cliente.ultimaCompra).toLocaleDateString('pt-BR') : '—'}</span>
                </div>
                <Button
                  variant="outline"
                  className="pdv-customer-data gap-2"
                  onClick={() => setDadosClienteOpen(true)}
                >
                  Ver dados <ChevronRight />
                </Button>
              </div>
            ) : (
              <div className="pdv-selected-customer pdv-empty-customer">
                {clientesQuery.isLoading ? (
                  <>
                    <Skeleton className="h-14 w-14 rounded-full" />
                    <Skeleton className="h-12 flex-1" />
                    <Skeleton className="h-12 w-52" />
                  </>
                ) : (
                  <span>{debouncedCliente ? 'Selecione um cliente encontrado.' : 'Nenhum cliente selecionado.'}</span>
                )}
              </div>
            )}

            {buscaCliente.trim().length >= 2 && clientesFiltrados.length > 0 && (
              <div className="pdv-floating-results">
                {clientesFiltrados.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setCliente(item);
                      setBuscaCliente('');
                      setClienteRemovido(false);
                    }}
                  >
                    <span>{item.nome}</span>
                    <small>{item.cpfMasked ?? item.cpf ?? '***'}</small>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="pdv-card pdv-product-card">
            <header className="pdv-card-header">
              <h2><Box strokeWidth={1.8} /> Produto / SKU</h2>
              <Button
                variant="outline"
                className="pdv-outline-action gap-2"
                onClick={() => navigate('/catalogo?novo=1')}
              >
                <Plus /> Novo produto
              </Button>
            </header>

            <div className="pdv-search">
              <Search strokeWidth={1.8} />
              <Input
                ref={skuRef}
                value={buscaSku}
                onChange={(e) => setBuscaSku(e.target.value)}
                placeholder="Buscar por produto, SKU, código de barras..."
                aria-label="Buscar produto, SKU ou código de barras"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && produtosFiltrados[0]) addToCart(produtosFiltrados[0]);
                }}
              />
            </div>

            <div className="pdv-categories">
              {['Todos', 'Armações', 'Lentes', 'Óculos de Sol', 'Acessórios', 'Serviços'].map((categoria) => (
                <button
                  key={categoria}
                  type="button"
                  className={categoria === categoriaAtiva ? 'active' : undefined}
                  aria-pressed={categoria === categoriaAtiva}
                  onClick={() => setCategoriaAtiva((atual) => (categoria === atual && categoria !== 'Todos' ? 'Todos' : categoria))}
                >
                  {categoria}
                </button>
              ))}
            </div>

            {produtosQuery.isError && <ErrorState error={produtosQuery.error as ApiError} onRetry={() => produtosQuery.refetch()} compact />}

            {(buscaSku.trim().length > 0 || categoriaAtiva !== 'Todos') && (
              <div className="pdv-floating-results pdv-product-results">
                {produtosQuery.isLoading ? (
                  <Skeleton className="h-11 w-full" />
                ) : produtosFiltrados.length === 0 ? (
                  <span className="pdv-result-empty">
                    {debouncedSku || categoriaAtiva !== 'Todos'
                      ? 'Nenhum produto encontrado para esta busca/categoria.'
                      : 'Nenhum produto encontrado.'}
                  </span>
                ) : (
                  produtosFiltrados.map((produto) => (
                    <button key={produto.sku} type="button" onClick={() => addToCart(produto)} className="flex items-center gap-3 p-2 hover:bg-[var(--color-pdv-soft)] text-left w-full border-b border-[var(--color-pdv-border-soft)] transition-colors">
                      <img
                        src={`/assets/produtos/${produto.sku}.jpg`}
                        alt=""
                        className="h-10 w-10 object-contain rounded bg-[var(--color-bg-card-soft)] border border-[var(--color-pdv-border)] shrink-0 p-0.5"
                        onError={(e) => {
                          const img = e.currentTarget;
                          if (!img.dataset.fallback) {
                            img.dataset.fallback = 'true';
                            img.src = '/assets/produtos/ARM-RAY-001.jpg';
                          }
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="block font-medium text-sm text-[var(--color-pdv-text)] truncate">{produto.nome}</span>
                        <small className="text-xs text-[var(--color-pdv-muted)]">{produto.sku} • {currency(produto.preco)}</small>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </section>
        </section>

        <section className="pdv-col-cart">
          <section className="pdv-card pdv-cart-card">
            <header className="pdv-card-header pdv-cart-header">
              <h2><ShoppingCart strokeWidth={1.8} /> Carrinho — {cart.length} itens</h2>
              <Button variant="outline" className="pdv-outline-action gap-2" onClick={() => setCart([])}>
                <Trash2 /> Limpar carrinho
              </Button>
            </header>

            <div className="pdv-cart-table">
              <div className="pdv-cart-row pdv-cart-head">
                <span>#</span>
                <span>Produto</span>
                <span>Qtd</span>
                <span>Unitário</span>
                <span>Desconto</span>
                <span>Subtotal</span>
                <span>Ações</span>
              </div>

              {cart.length === 0 ? (
                <div className="pdv-empty-cart">
                  <ShoppingCart strokeWidth={1.8} />
                  <strong>Carrinho vazio</strong>
                  <span>Busque um produto acima para adicionar ao carrinho.</span>
                </div>
              ) : (
                cart.map((item, index) => (
                  <div className="pdv-cart-row pdv-cart-item" key={item.sku}>
                    <span>{index + 1}</span>
                    <span>
                      <strong>{item.nome}</strong>
                      <small>{item.sku}</small>
                    </span>
                    <span className="pdv-qty">
                      <button type="button" onClick={() => setCart((prev) => prev.map((row) => (row.sku === item.sku ? { ...row, qtd: Math.max(1, row.qtd - 1) } : row)))}>-</button>
                      <b>{item.qtd}</b>
                      <button type="button" onClick={() => setCart((prev) => prev.map((row) => (row.sku === item.sku ? { ...row, qtd: row.qtd + 1 } : row)))}>+</button>
                    </span>
                    <span>{currency(item.preco)}</span>
                    <span>{currency(descontoRateio.get(item.sku) ?? 0)}</span>
                    <span>{currency(item.preco * item.qtd)}</span>
                    <button type="button" onClick={() => setCart((prev) => prev.filter((row) => row.sku !== item.sku))} aria-label={`Remover ${item.nome}`}>
                      <Trash2 strokeWidth={1.8} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        </section>

        <aside className="pdv-summary">
          <header className="pdv-summary-header">
            <div className="flex items-center gap-2">
              <h2><ShoppingCart strokeWidth={1.8} /> Resumo da venda</h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCaixaModalOpen(true)}
              className="gap-1 text-xs"
            >
              <Banknote className="h-3.5 w-3.5" /> Caixa
            </Button>
          </header>

          <div className="pdv-totals">
            <div>
              <span>Subtotal</span>
              <strong>{currency(subtotal)}</strong>
            </div>
            <div className="pdv-discount">
              <span>Desconto</span>
              <button
                type="button"
                className={descontoTipo === 'percentual' ? 'active' : undefined}
                aria-pressed={descontoTipo === 'percentual'}
                onClick={() => setDescontoTipo('percentual')}
              >
                %
              </button>
              <Input
                type="number"
                min={0}
                value={desconto}
                onChange={(e) => setDesconto(Number(e.target.value) || 0)}
                aria-label={descontoTipo === 'percentual' ? 'Desconto em percentual' : 'Desconto em reais'}
              />
              <button
                type="button"
                className={descontoTipo === 'valor' ? 'active' : undefined}
                aria-pressed={descontoTipo === 'valor'}
                onClick={() => setDescontoTipo('valor')}
              >
                R$
              </button>
              <span aria-hidden="true" />
            </div>
            <div className="pdv-total-line">
              <span>Total</span>
              <strong>{currency(total)}</strong>
            </div>
          </div>

          <section className="pdv-payment">
            <h3><Wallet strokeWidth={1.8} /> Pagamento</h3>
            <div className="pdv-payment-methods">
              {[
                { label: 'Dinheiro', icon: Banknote },
                { label: 'Cartão', icon: CreditCard },
                { label: 'PIX', icon: PixIcon },
                { label: 'Outros', icon: MoreHorizontal },
              ].map((method) => (
                <button
                  key={method.label}
                  type="button"
                  className={formaPagamento === method.label ? 'active' : undefined}
                  onClick={() => setFormaPagamento(method.label)}
                >
                  <method.icon strokeWidth={1.8} />
                  <span>{method.label}</span>
                </button>
              ))}
            </div>

            <div className="pdv-received">
              <span>Valor recebido</span>
              <Input
                type="number"
                min={0}
                value={valorRecebido}
                onChange={(e) => setValorRecebido(Number(e.target.value) || 0)}
                aria-label="Valor recebido"
              />
            </div>
            <div className="pdv-change">
              <span>Troco</span>
              <strong>{currency(troco)}</strong>
            </div>
          </section>

          <Button
            id="pdv-finalizar"
            className="pdv-finish-button"
            onClick={handleFinalizar}
            disabled={cart.length === 0 || criarOrdem.isPending}
            aria-busy={criarOrdem.isPending}
          >
            <LockKeyhole strokeWidth={1.8} /> {criarOrdem.isPending ? 'Enviando...' : 'Finalizar'}
          </Button>

          <div className="pdv-next-step">
            <span />
            <div>
              <strong>Próximo passo</strong>
              <p>Ao finalizar, a OS nasce em <mark>ORÇAMENTO</mark> e aparece na fila.</p>
            </div>
          </div>

          <div className="pdv-summary-actions">
            <Button variant="outline" className="gap-2" onClick={gerarPrevia}>
              <FileText /> Orçamento
            </Button>
            <Button variant="outline" className="gap-2" onClick={gerarPrevia}>
              <Printer /> Imprimir
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Mais ações"
              onClick={() => setMaisAcoesOpen(true)}
            >
              <MoreHorizontal />
            </Button>
          </div>
        </aside>
      </div>

      {/* Modal de Conclusão da Venda e Impressão de Cupom / NFC-e */}
      {vendaConcluida && (
        <Dialog
          open={!!vendaConcluida}
          onClose={() => setVendaConcluida(null)}
          title={vendaConcluida.osId === 'PREVIA' ? 'Orçamento / Prévia da Venda' : 'Venda Concluída com Sucesso!'}
          description={
            vendaConcluida.osId === 'PREVIA'
              ? 'Prévia pronta para impressão — nenhuma OS foi criada ainda.'
              : `Ordem de Serviço: ${vendaConcluida.osNumero}`
          }
        >
          <div className="space-y-4">
            {/* Opções de Emissão Fiscal */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-page)] p-3 text-sm">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-[var(--color-primary)]" />
                <div>
                  <p className="font-semibold text-[var(--color-text-primary)]">Emissão Fiscal (NFC-e)</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {vendaConcluida.chaveNfce
                      ? `Autorizada! Chave: ${vendaConcluida.chaveNfce.slice(0, 16)}...`
                      : 'Emitir cupom fiscal eletrônico na SEFAZ'}
                  </p>
                </div>
              </div>
              {!vendaConcluida.chaveNfce && (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={emitirNfceMutation.isPending || vendaConcluida.osId === 'PREVIA'}
                  onClick={() => emitirNfceMutation.mutate({ pedidoId: vendaConcluida.osId })}
                >
                  {emitirNfceMutation.isPending ? 'Emitindo...' : 'Emitir NFC-e'}
                </Button>
              )}
            </div>

            {/* Componente de Impressão Formatado */}
            <ComprovanteImpressao
              osNumero={vendaConcluida.osNumero}
              clienteNome={vendaConcluida.clienteNome}
              clienteCpf={vendaConcluida.clienteCpf}
              clienteTelefone={vendaConcluida.clienteTelefone}
              itens={vendaConcluida.itens}
              subtotal={vendaConcluida.subtotal}
              desconto={vendaConcluida.desconto}
              total={vendaConcluida.total}
              formaPagamento={vendaConcluida.formaPagamento}
              chaveNfce={vendaConcluida.chaveNfce}
              protocoloNfce={vendaConcluida.protocoloNfce}
            />

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
              <Button
                variant="outline"
                onClick={() => setVendaConcluida(null)}
              >
                Fechar / Nova Venda
              </Button>
              {vendaConcluida.osId !== 'PREVIA' && (
                <Button
                  variant="primary"
                  onClick={() => {
                    const osId = vendaConcluida.osId;
                    setVendaConcluida(null);
                    navigate(`/os/${osId}`);
                  }}
                >
                  Acompanhar OS
                </Button>
              )}
            </div>
          </div>
        </Dialog>
      )}

      {/* Modal de Controle de Caixa Físico */}
      <ControleCaixaModal
        open={caixaModalOpen}
        onClose={() => setCaixaModalOpen(false)}
      />

      {/* Modal de Autorização de Desconto (Alçada Gerencial > 15%) */}
      <AutorizacaoDescontoModal
        open={descontoModalOpen}
        onClose={() => setDescontoModalOpen(false)}
        percentualDesconto={descontoPctCalculado}
        valorDesconto={descontoAplicado}
        subtotal={subtotal}
        onAutorizado={(supervisor) => {
          setDescontoAutorizadoPor(supervisor);
          setDescontoModalOpen(false);
          setFeedback({ tone: 'success', msg: `Desconto de ${descontoPctCalculado.toFixed(1)}% autorizado por ${supervisor}.` });
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
      />
    </div>
  );
}
