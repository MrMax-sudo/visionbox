import { apiClient } from '@/lib/apiClient';

/**
 * maquininhaService — Maquininhas de cartão e taxas MDR (§3.5, Fase 4).
 *
 * Contratos (MaquininhaCartaoController):
 *   GET    /api/v1/financeiro/maquininhas           → MaquininhaCartaoResponse[] (ativas)
 *   POST   /api/v1/financeiro/maquininhas           → 201 (criar)
 *   PUT    /api/v1/financeiro/maquininhas/{id}      → atualizar
 *   DELETE /api/v1/financeiro/maquininhas/{id}      → 204 (soft-delete: ativo=false)
 *   POST   /api/v1/financeiro/maquininhas/{id}/calcular-liquido → ResultadoMdr
 *
 * Cálculo (backend, HALF_EVEN 2 casas — nenhuma regra fiscal no front):
 *   taxaValor = valorBruto * (taxaPercentual / 100) + taxaFixa
 *   valorLiquido = valorBruto - taxaValor
 */

export type MaquininhaDTO = {
  id: string;
  nome?: string;
  adquirente?: string;
  ativo?: boolean;
  debitoTaxaPercentual?: number;
  debitoTaxaFixa?: number;
  credito1xTaxaPercentual?: number;
  credito1xTaxaFixa?: number;
  credito2a6TaxaPercentual?: number;
  credito2a6TaxaFixa?: number;
  credito7a12TaxaPercentual?: number;
  credito7a12TaxaFixa?: number;
};

/** Payload de criar/atualizar — todos os campos de taxa são obrigatórios (>= 0). */
export type MaquininhaPayload = {
  nome: string;
  adquirente: string;
  ativo?: boolean;
  debitoTaxaPercentual: number;
  debitoTaxaFixa: number;
  credito1xTaxaPercentual: number;
  credito1xTaxaFixa: number;
  credito2a6TaxaPercentual: number;
  credito2a6TaxaFixa: number;
  credito7a12TaxaPercentual: number;
  credito7a12TaxaFixa: number;
};

export type TipoCartao = 'DEBITO' | 'CREDITO';

export type ResultadoMdrDTO = {
  maquininhaId?: string;
  tipo?: string;
  parcelas?: number;
  faixa?: string;
  valorBruto?: number;
  taxaPercentual?: number;
  taxaFixa?: number;
  taxaValor?: number;
  valorLiquido?: number;
};

export type CalculoLiquidoPayload = {
  valor: number;
  tipo: TipoCartao;
  parcelas: number;
};

/** Faixas de taxa exibidas no formulário (espelham FaixaMdr do backend). */
export const FAIXAS_TAXA = [
  { chave: 'debito', rotulo: 'Débito', hint: 'Cartão de débito (à vista)' },
  { chave: 'credito1x', rotulo: 'Crédito 1x', hint: 'Crédito à vista' },
  { chave: 'credito2a6', rotulo: 'Crédito 2x a 6x', hint: 'Parcelado curto' },
  { chave: 'credito7a12', rotulo: 'Crédito 7x a 12x', hint: 'Parcelado longo' },
] as const;

export async function listarMaquininhas(): Promise<MaquininhaDTO[]> {
  const res = await apiClient.get<MaquininhaDTO[]>('/v1/financeiro/maquininhas');
  return res.data ?? [];
}

export async function criarMaquininha(payload: MaquininhaPayload): Promise<MaquininhaDTO> {
  const res = await apiClient.post<MaquininhaDTO>('/v1/financeiro/maquininhas', payload);
  return res.data;
}

export async function atualizarMaquininha(
  id: string,
  payload: MaquininhaPayload,
): Promise<MaquininhaDTO> {
  const res = await apiClient.put<MaquininhaDTO>(`/v1/financeiro/maquininhas/${id}`, payload);
  return res.data;
}

/** Soft-delete no backend (ativo=false). */
export async function removerMaquininha(id: string): Promise<void> {
  await apiClient.delete(`/v1/financeiro/maquininhas/${id}`);
}

/**
 * Simulação de líquido (conciliação) — cálculo SEMPRE no backend.
 * `opts.signal` permite cancelar requisições superseded (debounce do preview do PDV).
 */
export async function calcularLiquido(
  id: string,
  payload: CalculoLiquidoPayload,
  opts?: { signal?: AbortSignal },
): Promise<ResultadoMdrDTO> {
  const res = await apiClient.post<ResultadoMdrDTO>(
    `/v1/financeiro/maquininhas/${id}/calcular-liquido`,
    payload,
    opts?.signal ? { signal: opts.signal } : undefined,
  );
  return res.data;
}
