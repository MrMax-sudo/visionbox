// types.ts — DTOs alinhados ao backend Spring (/api/v1/*)

export type PageResponse<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first?: boolean;
  last?: boolean;
  empty?: boolean;
};

// Backend pode retornar Page ou array puro — helper unifica
export function unwrapPage<T>(data: PageResponse<T> | T[] | { data: T[] } | null | undefined): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if ('content' in data && Array.isArray((data as PageResponse<T>).content)) return (data as PageResponse<T>).content;
  if ('data' in data && Array.isArray((data as { data: T[] }).data)) return (data as { data: T[] }).data;
  return [];
}

export type ClienteDTO = {
  id: string;
  nome: string;
  // backend retorna cpf mascarado para VENDEDOR, plain só para ADMIN/GERENTE
  cpf?: string;
  cpfMasked?: string;
  cpfHash?: string;
  telefone?: string;
  whatsapp?: string;
  cidade?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  uf?: string;
  canalPreferido?: string;
  consentimentoRecall?: boolean;
  endereco?: string;
  email?: string;
  ultimaCompra?: string; // ISO
  totalGasto?: number;
  ativo?: boolean;
  lojaId?: string;
};

export type ProdutoDTO = {
  id?: string;
  sku: string;
  codigoBarras?: string;
  nome: string;
  marca?: string;
  categoria: 'Armação' | 'Lente' | string;
  preco: number;
  custo?: number;
  estoque: number;
  ncm?: string;
  ativo?: boolean;
};

type ProdutoApiDTO = ProdutoDTO & {
  precoVenda?: number;
  estoqueQuantidade?: number;
  tipoProduto?: string;
  ativoVenda?: boolean;
};

export function normalizeProduto(raw: ProdutoApiDTO): ProdutoDTO {
  const preco = Number(raw.preco ?? raw.precoVenda ?? 0);
  const estoque = Number(raw.estoque ?? raw.estoqueQuantidade ?? 0);
  const categoriaRaw = raw.categoria ?? raw.tipoProduto ?? 'Produto';
  const categoria =
    categoriaRaw === 'ARMACAO' ? 'Armação' :
    categoriaRaw === 'LENTE' ? 'Lente' :
    categoriaRaw;
  return {
    ...raw,
    categoria,
    preco: Number.isFinite(preco) ? preco : 0,
    estoque: Number.isFinite(estoque) ? estoque : 0,
    ativo: raw.ativo ?? raw.ativoVenda,
  };
}

export type ReceitaDTO = {
  id: string;
  clienteId: string;
  clienteNome?: string;
  data: string; // ISO
  dataValidade?: string;
  od: string; // ex: "-2.50 -1.25 x 180"
  oe: string;
  rawOd?: GrauApiDTO;
  rawOe?: GrauApiDTO;
  fotoUrl?: string | null;
  status?: string;
  tipo?: string;
  dp?: number;
  observacao?: string;
  nomeMedico?: string;
  crmMedico?: string;
};

type GrauApiDTO = {
  esferico?: number;
  cilindrico?: number;
  eixo?: number | null;
  adicao?: number | null;
};

type ReceitaApiDTO = Omit<ReceitaDTO, 'od' | 'oe' | 'data'> & {
  od: ReceitaDTO['od'] | GrauApiDTO;
  oe: ReceitaDTO['oe'] | GrauApiDTO;
  data?: string;
  dataEmissao?: string;
  dataValidade?: string;
  criadoEm?: string;
  tipo?: string;
  anexoS3Key?: string | null;
  observacao?: string;
  nomeMedico?: string;
  crmMedico?: string;
};

function formatGrau(grau: ReceitaApiDTO['od']): string {
  if (typeof grau === 'string') return grau;
  if (!grau) return '-';
  const esf = Number(grau.esferico ?? 0).toFixed(2);
  const cil = Number(grau.cilindrico ?? 0).toFixed(2);
  const eixo = grau.eixo == null ? '' : ` x ${grau.eixo}`;
  const ad = grau.adicao ? ` ad ${Number(grau.adicao).toFixed(2)}` : '';
  return `${esf} ${cil}${eixo}${ad}`;
}

export function normalizeReceita(raw: ReceitaApiDTO): ReceitaDTO {
  const data = raw.data ?? raw.dataEmissao ?? raw.criadoEm ?? '';
  return {
    ...raw,
    data,
    od: formatGrau(raw.od),
    oe: formatGrau(raw.oe),
    rawOd: typeof raw.od === 'object' && raw.od !== null ? (raw.od as GrauApiDTO) : undefined,
    rawOe: typeof raw.oe === 'object' && raw.oe !== null ? (raw.oe as GrauApiDTO) : undefined,
    fotoUrl: raw.fotoUrl ?? raw.anexoS3Key ?? null,
    status: raw.status ?? (raw.dataValidade ? 'VALIDA' : raw.tipo),
    tipo: raw.tipo,
    observacao: raw.observacao,
    nomeMedico: raw.nomeMedico,
    crmMedico: raw.crmMedico,
  };
}

export type OrdemServicoDTO = {
  id: string;
  lojaId?: string;
  numero?: string;
  cliente?: string;
  clienteId?: string;
  clienteNome?: string;
  clienteWhatsapp?: string | null;
  cpfMasked?: string;
  produto?: string;
  receitaId?: string | null;
  armacaoId?: string | null;
  lenteId?: string | null;
  laboratorioId?: string | null;
  status:
    | 'ORCAMENTO'
    | 'PEDIDO_CONFIRMADO'
    | 'ENVIADO_LABORATORIO'
    | 'EM_PRODUCAO'
    | 'LENTE_PRONTA'
    | 'MONTAGEM'
    | 'CONTROLE_QUALIDADE'
    | 'PRONTO_PARA_RETIRADA'
    | 'ENTREGUE'
    | 'CANCELADO'
    | string;
  previsao?: string; // ISO
  previsaoEntrega?: string;
  dataEntregaReal?: string | null;
  criadoEm?: string;
  atualizadoEm?: string;
  tokenRastreio?: string;
  sla?: 'ok' | 'atencao' | 'atrasado';
  slaStatus?: 'OK' | 'ATENCAO' | 'ATRASADO';
  vendedor?: string;
  valor?: number;
  total?: number;
  /**
   * Pagamentos da OS (§3.5 MDR) — OrdemServicoResponse.pagamentos.
   * Campo AUSENTE (backend antigo/falha parcial) → seção de pagamentos oculta.
   */
  pagamentos?: OrdemServicoPagamentoView[];
  itens?: Array<{ sku: string; nome: string; qtd: number; preco: number }>;
  historico?: Array<{
    id?: string;
    statusAnterior?: string | null;
    statusNovo?: string | null;
    dataHora?: string;
    responsavel?: string | null;
    observacao?: string | null;
  }>;
};

/**
 * Pagamento exibido no detalhe da OS (§3.5 MDR):
 * `{"id","formaPagamentoId","formaPagamentoNome","valor","taxaValor","valorLiquido","maquininhaId","parcelas"}`
 * `taxaValor`/`valorLiquido` null → taxa pendente de conciliação da maquininha.
 * BigDecimal chega como number|string conforme serialização — nunca calcular no front.
 */
export type OrdemServicoPagamentoView = {
  id: string;
  formaPagamentoId?: string | null;
  formaPagamentoNome?: string | null;
  valor: number | string;
  taxaValor?: number | string | null;
  valorLiquido?: number | string | null;
  maquininhaId?: string | null;
  parcelas?: number | null;
};

export type CriarOrdemServicoPayload = {
  clienteId: string;
  itens: Array<{ sku: string; quantidade: number; produtoId?: string }>;
  desconto?: number;
  senhaAutorizacao?: string;
  formaPagamento?: string;
  pagamentos?: Array<{
    formaPagamentoId: string;
    valor: number;
    /** Cartão (§3.5): maquininha que processou; ausente → MDR pendente (WARN backend). */
    maquininhaId?: string;
    /** Cartão: débito força 1; crédito 1–12. Não enviado por formas não-cartão. */
    parcelas?: number;
  }>;
  observacao?: string;
  receitaId?: string | null;
  armacaoId?: string | null;
  lenteId?: string | null;
  laboratorioId?: string | null;
  previsaoEntrega?: string | null;
};
