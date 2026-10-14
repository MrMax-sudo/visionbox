import type { CriarOrdemServicoPayload, ProdutoDTO } from '@/lib/types';

/* -------------------------------------------------------------------------
   Tipos e helpers puros do PDV (ONDA 2A)
   Extraídos da página para que `pages/PDV.tsx` fique só com orquestração
   de estado/mutações. NENHUMA regra de negócio mudou — só a localização.
   ------------------------------------------------------------------------- */

export type CartItem = {
  sku: string;
  nome: string;
  qtd: number;
  preco: number;
  produtoId?: string;
  categoria?: string;
  ncm?: string;
};

export type Feedback = { tone: 'success' | 'error' | 'warning'; msg: string };

export type DescontoTipo = 'valor' | 'percentual';

export type ProdutoPdv = ProdutoDTO & { tipoProduto?: string };

export type TipoCupom = 'CUPOM' | 'NFCE' | 'DANFE';

export type VendaConcluida = {
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
  tipoDocumento?: TipoCupom;
};

/** Normaliza acento/caixa para comparar rótulo de categoria. */
export function normalizarRotulo(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
}

/**
 * Filtro client-side defensivo por categoria (espelha ProdutoService.tipoPorRotuloCategoria).
 * Compara rótulo da UI contra categoria text e tipoProduto — nunca esconde o que o backend aceitou.
 */
export function categoriaCombina(produto: ProdutoPdv, rotulo: string): boolean {
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

/** Quantidade de vendas aguardando sincronização (outbox local). */
export function getOutboxCount(): number {
  try {
    const raw = localStorage.getItem('visionbox-outbox');
    if (!raw) return 0;
    const arr = JSON.parse(raw) as unknown[];
    return Array.isArray(arr) ? arr.length : 0;
  } catch {
    return 0;
  }
}

/** Enfileira a venda offline (contingência) — botão Finalizar nunca fica bloqueado. */
export function pushOutbox(payload: CriarOrdemServicoPayload & { _idempotencyKey?: string }) {
  try {
    const raw = localStorage.getItem('visionbox-outbox');
    const arr = raw ? (JSON.parse(raw) as unknown[]) : [];
    const next = Array.isArray(arr) ? [...arr, { ...payload, _ts: Date.now() }] : [payload];
    localStorage.setItem('visionbox-outbox', JSON.stringify(next));
  } catch {
    /* local outbox best effort */
  }
}

export function currency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function initials(name?: string): string {
  return (
    name
      ?.split(' ')
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase() || 'CL'
  );
}
