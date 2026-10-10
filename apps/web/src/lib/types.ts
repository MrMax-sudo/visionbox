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
  od: string; // ex: "-2.50 -1.25 x 180"
  oe: string;
  fotoUrl?: string | null;
  status?: string;
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
    fotoUrl: raw.fotoUrl ?? raw.anexoS3Key ?? null,
    status: raw.status ?? (raw.dataValidade ? 'VALIDA' : raw.tipo),
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

export type CriarOrdemServicoPayload = {
  clienteId: string;
  itens: Array<{ sku: string; quantidade: number; produtoId?: string }>;
  desconto?: number;
  senhaAutorizacao?: string;
  formaPagamento?: string;
  pagamentos?: Array<{ formaPagamentoId: string; valor: number }>;
  observacao?: string;
  receitaId?: string | null;
  armacaoId?: string | null;
  lenteId?: string | null;
  laboratorioId?: string | null;
  previsaoEntrega?: string | null;
};
