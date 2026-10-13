import { apiClient } from '@/lib/apiClient';

/**
 * comissaoService — Comissões de vendedores (§3.6, Fase 4).
 *
 * Contratos (ComissaoController):
 *   GET    /api/v1/financeiro/comissoes/config   → ComissaoConfigResponse[] (ativas)
 *   POST   /api/v1/financeiro/comissoes/config   → 201 (criar)
 *   PUT    /api/v1/financeiro/comissoes/config/{id} → atualizar
 *   DELETE /api/v1/financeiro/comissoes/config/{id} → 204 (soft-delete)
 *   GET    /api/v1/financeiro/comissoes/vendedores → ComissaoVendedorResponse[] (VENDEDOR/OTICO ativos)
 *   POST   /api/v1/financeiro/comissoes/apurar   → 201 ComissaoLancamentoResponse[] (idempotente por venda+vendedor)
 *   GET    /api/v1/financeiro/comissoes/fechamento?dataInicio&dataFim&vendedorId → ComissaoFechamentoResponse
 *     (porVendedor = agregado; lancamentos = linhas por venda do mesmo período — totais batem)
 */

export type TipoComissao = 'GERAL' | 'CATEGORIA';

export type ComissaoConfigDTO = {
  id: string;
  tipo?: TipoComissao;
  categoria?: string | null;
  percentual?: number;
  ativo?: boolean;
};

export type ComissaoConfigPayload = {
  tipo: TipoComissao;
  categoria?: string;
  percentual: number;
  ativo?: boolean;
};

export type ItemApuracaoDTO = {
  categoria: string;
  subtotal: number;
};

export type ApurarComissaoPayload = {
  vendaId?: string;
  vendaNumero?: string;
  vendedorId: string;
  vendedorNome?: string;
  valorTotal: number;
  itens?: ItemApuracaoDTO[];
};

export type ComissaoLancamentoDTO = {
  id: string;
  vendaId?: string | null;
  vendaNumero?: string | null;
  vendedorId?: string;
  vendedorNome?: string | null;
  categoria?: string | null;
  baseCalculo?: number;
  percentualAplicado?: number;
  valorComissao?: number;
  /** PENDENTE | CANCELADO (StatusComissao). */
  status?: string;
  dataLancamento?: string;
};

export type VendedorFechamentoDTO = {
  vendedorId?: string;
  vendedorNome?: string | null;
  quantidadeLancamentos?: number;
  baseCalculo?: number;
  valorComissao?: number;
};

export type ComissaoFechamentoDTO = {
  dataInicio?: string;
  dataFim?: string;
  quantidadeLancamentos?: number;
  totalBase?: number;
  totalComissao?: number;
  porVendedor?: VendedorFechamentoDTO[];
  /** Linhas por venda do período (mesmos filtros do agregado — cancelados fora). */
  lancamentos?: ComissaoLancamentoDTO[] | null;
};

/** ComissaoVendedorResponse — vendedor ativo que apura comissão (id+nome, sem PII). */
export type VendedorComissaoDTO = {
  id: string;
  nome: string;
};

/* ------------------------------ regras (config) ------------------------------ */

export async function listarConfigComissoes(): Promise<ComissaoConfigDTO[]> {
  const res = await apiClient.get<ComissaoConfigDTO[]>('/v1/financeiro/comissoes/config');
  return res.data ?? [];
}

export async function criarConfigComissao(
  payload: ComissaoConfigPayload,
): Promise<ComissaoConfigDTO> {
  const res = await apiClient.post<ComissaoConfigDTO>('/v1/financeiro/comissoes/config', payload);
  return res.data;
}

export async function atualizarConfigComissao(
  id: string,
  payload: ComissaoConfigPayload,
): Promise<ComissaoConfigDTO> {
  const res = await apiClient.put<ComissaoConfigDTO>(
    `/v1/financeiro/comissoes/config/${id}`,
    payload,
  );
  return res.data;
}

/** Soft-delete no backend (ativo=false). */
export async function removerConfigComissao(id: string): Promise<void> {
  await apiClient.delete(`/v1/financeiro/comissoes/config/${id}`);
}

/* --------------------------- apuração e fechamento --------------------------- */

/**
 * Vendedores ativos da loja que apuram comissão (VENDEDOR, OTICO) — id+nome.
 * Substitui /v1/usuarios (ADMIN-only): agora GERENTE/FINANCEIRO também listam.
 */
export async function listarVendedoresComissao(): Promise<VendedorComissaoDTO[]> {
  const res = await apiClient.get<VendedorComissaoDTO[]>(
    '/v1/financeiro/comissoes/vendedores',
  );
  return res.data ?? [];
}

/** Apura a comissão de uma venda — idempotente por (vendaId, vendedorId) no backend. */
export async function apurarComissao(
  payload: ApurarComissaoPayload,
): Promise<ComissaoLancamentoDTO[]> {
  const res = await apiClient.post<ComissaoLancamentoDTO[]>(
    '/v1/financeiro/comissoes/apurar',
    payload,
  );
  return res.data ?? [];
}

/** Fechamento por período (agregado por vendedor) — datas ISO 'YYYY-MM-DD'. */
export async function fechamentoComissoes(
  dataInicio: string,
  dataFim: string,
  vendedorId?: string,
): Promise<ComissaoFechamentoDTO> {
  const res = await apiClient.get<ComissaoFechamentoDTO>('/v1/financeiro/comissoes/fechamento', {
    params: { dataInicio, dataFim, ...(vendedorId ? { vendedorId } : {}) },
  });
  return res.data;
}
