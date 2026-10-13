import { apiClient } from '@/lib/apiClient';
import type { PageResponse } from '@/lib/types';

/**
 * comprasService — Compras de fornecedores via XML NF-e de entrada (§3.4, Fase 4).
 *
 * Contratos (CompraController):
 *   POST /api/v1/compras/importar-xml   (multipart 'file') → 201 CompraResponse (com itens + contasPagarIds)
 *   GET  /api/v1/compras                (Pageable page/size) → Page<CompraResponse> (itens nulos)
 *   GET  /api/v1/compras/{id}           → CompraResponse (com itens)
 *
 * R4: Idempotency-Key é injetada pelo apiClient no POST (importação repetida é
 * rejeitada também no backend por chave de acesso 44 dígitos por loja).
 */

/** Item da NF-e importada (CompraItemResponse). */
export type CompraItemDTO = {
  id: string;
  produtoId?: string | null;
  descricao?: string;
  ncm?: string | null;
  ean?: string | null;
  codigoFornecedor?: string | null;
  unidade?: string | null;
  quantidade?: number;
  custoUnitario?: number;
  valorTotal?: number;
  /**
   * Origem do produtoId na importação: true = pré-cadastro automático criado pelo
   * de-para (EAN/SKU não casaram); false = já existia no catálogo. Só é preenchido
   * na resposta da importação — leituras persistidas vêm null (badge oculto).
   */
  preCadastrado?: boolean | null;
};

/** CompraResponse — BigDecimal serializa como número. */
export type CompraDTO = {
  id: string;
  lojaId?: string;
  numero?: string;
  serie?: string;
  chaveAcesso?: string;
  dataEmissao?: string | null;
  fornecedorNome?: string;
  fornecedorCnpj?: string;
  valorSubtotal?: number;
  desconto?: number;
  frete?: number;
  valorTotal?: number;
  /** IMPORTADA | CONFIRMADA | CANCELADA (StatusCompra). */
  status?: 'IMPORTADA' | 'CONFIRMADA' | 'CANCELADA' | string;
  /** Populado no detalhe e na importação; nulo na listagem resumida. */
  itens?: CompraItemDTO[] | null;
  /** Títulos em Conta a Pagar gerados na importação. */
  contasPagarIds?: string[] | null;
};

export const STATUS_COMPRA = ['IMPORTADA', 'CONFIRMADA', 'CANCELADA'] as const;
export type StatusCompra = (typeof STATUS_COMPRA)[number];

export const rotuloStatusCompra: Record<string, string> = {
  IMPORTADA: 'Importada',
  CONFIRMADA: 'Confirmada',
  CANCELADA: 'Cancelada',
};

/** Importa o XML da NF-e de entrada (multipart). Timeout maior para uploads. */
export async function importarXmlNfe(file: File): Promise<CompraDTO> {
  const form = new FormData();
  form.append('file', file);
  const res = await apiClient.post<CompraDTO>('/v1/compras/importar-xml', form, {
    timeout: 60_000,
    // sem Content-Type: axios detecta FormData e deixa o browser definir o boundary
  });
  return res.data;
}

/** Listagem paginada (ordenada por criadoEm no backend). */
export async function listarCompras(page = 0, size = 20): Promise<PageResponse<CompraDTO>> {
  const res = await apiClient.get<PageResponse<CompraDTO>>('/v1/compras', {
    params: { page, size },
  });
  return res.data;
}

/** Detalhe com itens. */
export async function buscarCompra(id: string): Promise<CompraDTO> {
  const res = await apiClient.get<CompraDTO>(`/v1/compras/${id}`);
  return res.data;
}

/** Total de unidades (estoque) — mesmo critério do backend: qtd inteira HALF_UP. */
export function unidadesEstoque(itens: CompraItemDTO[] | null | undefined): number {
  if (!itens) return 0;
  return itens.reduce((sum, it) => sum + Math.round(Number(it.quantidade ?? 0)), 0);
}
