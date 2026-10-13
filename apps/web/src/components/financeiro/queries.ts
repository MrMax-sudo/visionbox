import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/apiClient';
import { unwrapPage, type PageResponse } from '@/lib/types';
import type { FinanceiroTotaisDTO, FormaPagamentoDTO, FornecedorDTO } from './types';

/**
 * Queries compartilhadas do módulo Financeiro (Fase 3 §3.3).
 * Chaves sob o guarda-chuva ['financeiro'] — invalidação em cascata
 * após qualquer mutação (baixa, CRUD fornecedor, criação de conta a pagar).
 */

export const FINANCEIRO_KEYS = {
  raiz: ['financeiro'] as const,
  formasPagamento: ['financeiro', 'formas-pagamento'] as const,
  fornecedores: (nome: string, incluirInativos: boolean) =>
    ['financeiro', 'fornecedores', nome, incluirInativos] as const,
  pagamentos: (contaId: string) => ['financeiro', 'pagamentos', contaId] as const,
  totais: (dataInicio: string, dataFim: string) =>
    ['financeiro', 'totais', dataInicio, dataFim] as const,
};

/** GET /v1/financeiro/formas-pagamento — somente ativas. */
export function useFormasPagamento() {
  return useQuery({
    queryKey: FINANCEIRO_KEYS.formasPagamento,
    queryFn: () => apiGet<FormaPagamentoDTO[]>('/v1/financeiro/formas-pagamento'),
    staleTime: 60_000,
    retry: 1,
  });
}

/**
 * GET /v1/financeiro/fornecedores?nome&incluirInativos — page única ampla; CNPJ
 * mascarado. incluirInativos=true (V41) traz também os soft-deletados, para o
 * toggle "Mostrar inativos" + botão Reativar do FornecedorPanel.
 */
export function useFornecedores(nome = '', incluirInativos = false) {
  return useQuery({
    queryKey: FINANCEIRO_KEYS.fornecedores(nome, incluirInativos),
    queryFn: () =>
      apiGet<PageResponse<FornecedorDTO> | FornecedorDTO[]>('/v1/financeiro/fornecedores', {
        params: {
          page: 0,
          size: 100,
          ...(nome ? { nome } : {}),
          ...(incluirInativos ? { incluirInativos: true } : {}),
        },
      }),
    staleTime: 30_000,
    retry: 1,
    select: (data) => unwrapPage(data),
  });
}

/**
 * GET /v1/financeiro/totais?dataInicio&dataFim (V41) — métricas do topo do hub
 * agregadas no banco (SUM nos repositórios; fim da limitação de 1 página size=100).
 * Chave inclui o período: acompanha o filtro De/Até da tela (default = mês corrente).
 */
export function useFinanceiroTotais(dataInicio: string, dataFim: string) {
  return useQuery({
    queryKey: FINANCEIRO_KEYS.totais(dataInicio, dataFim),
    queryFn: () =>
      apiGet<FinanceiroTotaisDTO>('/v1/financeiro/totais', {
        params: { dataInicio, dataFim },
      }),
    staleTime: 30_000,
    retry: 1,
  });
}
