import { apiClient, ApiError } from '@/lib/apiClient';

/**
 * caixaService — camada de acesso à API de Caixa & Turnos (Fase 2 Robustez ERP).
 *
 * Contratos espelham `src/main/java/com/visionbox/modules/caixa`:
 * - CaixaController: /api/v1/caixa/{status-atual,abrir,movimentar,sangria,suprimento,fechar,
 *   {sessaoId}/extrato, {sessaoId}/fechamento, historico}
 * - CaixaDTOs: CaixaSessaoDTO, CaixaMovimentoDTO, RelatorioFechamentoDTO, ResumoModalidadeDTO,
 *   SangriaSuprimentoRequest (valor + motivo obrigatórios), FecharCaixaRequest.
 *
 * R4: sangria/suprimento enviam `Idempotency-Key` explícito (crypto.randomUUID) — reenvios
 * de sincronização fazem replay seguro no servidor (IdempotencyFilter global).
 */

// ------------------------------------------------------------------------ tipos

/** Espelha CaixaMovimento.TipoMovimento (backend). */
export type TipoMovimentoCaixa =
  | 'ABERTURA'
  | 'SUPRIMENTO'
  | 'SANGRIA'
  | 'VENDA_DINHEIRO'
  | 'VENDA_OUTROS'
  | 'ESTORNO'
  | 'FECHAMENTO';

export type StatusCaixa = 'ABERTO' | 'FECHADO';

/** Classificação da diferença de fechamento (CaixaService.classificarDiferenca). */
export type ClassificacaoDiferenca = 'SOBRA' | 'QUEBRA' | 'EXATO';

export interface CaixaMovimento {
  id: string;
  tipo: TipoMovimentoCaixa;
  valor: number;
  formaPagamento?: string;
  motivo?: string;
  usuarioNome?: string;
  criadoEm: string;
}

/** Espelha CaixaSessaoDTO (CaixaDTOs.java). */
export interface CaixaSessao {
  id: string;
  lojaId: string;
  usuarioId: string;
  operadorNome?: string;
  identificacaoCaixa: string;
  status: StatusCaixa;
  abertoEm: string;
  fechadoEm?: string;
  saldoInicial: number;
  totalEntradas: number;
  totalSaidas: number;
  saldoEsperado: number;
  saldoInformadoFechamento?: number;
  /** Valor apurado pelo sistema no fechamento (saldoEsperado no ato do fechamento). */
  valorFechamentoSistema?: number;
  diferencaFechamento?: number;
  classificacaoDiferenca?: ClassificacaoDiferenca | null;
  observacaoFechamento?: string;
  movimentos: CaixaMovimento[];
}

/** Espelha ResumoModalidadeDTO — total por forma de pagamento das vendas do turno. */
export interface ResumoModalidade {
  formaPagamentoId?: string | null;
  nome: string;
  total: number;
}

/** Espelha RelatorioFechamentoDTO — JSON base do cupom térmico 80mm. */
export interface RelatorioFechamento {
  sessaoId: string;
  identificacaoCaixa: string;
  operadorNome?: string;
  status: StatusCaixa;
  abertoEm: string;
  fechadoEm?: string;
  saldoInicial: number;
  totalEntradas: number;
  totalSaidas: number;
  valorFechamentoSistema: number;
  valorFechamentoInformado?: number | null;
  diferencaFechamento?: number | null;
  classificacaoDiferenca?: ClassificacaoDiferenca | null;
  observacaoFechamento?: string | null;
  totalVendas: number;
  totalSangrias: number;
  totalSuprimentos: number;
  resumoPorModalidade: ResumoModalidade[];
  movimentos: CaixaMovimento[];
}

/** Página Spring (subset usado pela UI). */
export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

// ---------------------------------------------------------------------- payloads

export interface AbrirCaixaPayload {
  saldoInicial: number;
  identificacaoCaixa?: string;
  operadorNome?: string;
}

/** SangriaSuprimentoRequest — motivo obrigatório (auditoria de gaveta). */
export interface SangriaSuprimentoPayload {
  valor: number;
  motivo: string;
  formaPagamento?: string;
  usuarioNome?: string;
}

export interface FecharCaixaPayload {
  saldoInformado: number;
  observacao?: string;
}

export interface ExtratoFiltros {
  tipo?: TipoMovimentoCaixa;
  page?: number;
  size?: number;
}

export interface HistoricoFiltros {
  operadorId?: string;
  /** yyyy-MM-dd (inclusivo). */
  dataInicio?: string;
  /** yyyy-MM-dd (inclusiva — backend converte para início do dia seguinte). */
  dataFim?: string;
  page?: number;
  size?: number;
}

// ------------------------------------------------------------- chaves TanStack Query

import type { QueryClient } from '@tanstack/react-query';

/** Mantém compatibilidade com PDV/ControleCaixaModal (mesma chave literal). */
export const caixaQueryKeys = {
  statusAtual: ['caixa-status-atual'] as const,
  historico: (filtros: Omit<HistoricoFiltros, 'page' | 'size'> & { page: number; size: number }) =>
    ['caixa-historico', filtros.operadorId ?? null, filtros.dataInicio ?? null, filtros.dataFim ?? null, filtros.page, filtros.size] as const,
  extrato: (sessaoId: string, tipo: TipoMovimentoCaixa | null, page: number, size: number) =>
    ['caixa-extrato', sessaoId, tipo ?? 'TODOS', page, size] as const,
  relatorio: (sessaoId: string) => ['caixa-relatorio-fechamento', sessaoId] as const,
};

/** Invalida tudo que depende do estado do caixa (após mutations). */
export function invalidarQueriesCaixa(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: caixaQueryKeys.statusAtual });
  queryClient.invalidateQueries({ queryKey: ['caixa-historico'] });
  queryClient.invalidateQueries({ queryKey: ['caixa-extrato'] });
  queryClient.invalidateQueries({ queryKey: ['caixa-relatorio-fechamento'] });
}

// ------------------------------------------------------------------------ helpers

/** Chave de idempotência UUID v4 (R4) — uma por tentativa de mutation. */
export function novoIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Aceita "450,00" e "450.00" (mesma convenção do ControleCaixaModal). */
export function parseValorMonetario(input: string): number | null {
  const valor = parseFloat(input.trim().replace(',', '.'));
  return Number.isFinite(valor) ? valor : null;
}

export function formatarBRL(val?: number | null): string {
  return (val ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatarDataHora(iso?: string | null): string {
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

/** Mensagem amigável de erro (ProblemDetail RFC 7807 → fallback). */
export function mensagemErroCaixa(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    return err.problem?.detail || err.problem?.message || err.problem?.title || err.message || fallback;
  }
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

// ----------------------------------------------------------------------- endpoints

/** Sessão aberta atual da loja. 204/404 = nenhum caixa aberto (não é erro). */
export async function obterSessaoAtual(): Promise<CaixaSessao | null> {
  try {
    const res = await apiClient.get<CaixaSessao>('/v1/caixa/status-atual');
    return res.data ?? null;
  } catch (err) {
    if (err instanceof ApiError && (err.status === 204 || err.status === 404)) return null;
    // Sem sessão (204/404) = caixa fechado; qualquer outro erro (rede/5xx)
    // deve chegar à UI como erro — não como "caixa fechado".
    throw err;
  }
}

export async function abrirCaixa(payload: AbrirCaixaPayload): Promise<CaixaSessao> {
  const res = await apiClient.post<CaixaSessao>('/v1/caixa/abrir', payload);
  return res.data;
}

/** Sangria de gaveta — motivo + valor obrigatórios, Idempotency-Key explícito (R4). */
export async function sangria(payload: SangriaSuprimentoPayload): Promise<CaixaSessao> {
  const res = await apiClient.post<CaixaSessao>('/v1/caixa/sangria', payload, {
    headers: { 'Idempotency-Key': novoIdempotencyKey() },
  });
  return res.data;
}

/** Suprimento de gaveta — motivo + valor obrigatórios, Idempotency-Key explícito (R4). */
export async function suprimento(payload: SangriaSuprimentoPayload): Promise<CaixaSessao> {
  const res = await apiClient.post<CaixaSessao>('/v1/caixa/suprimento', payload, {
    headers: { 'Idempotency-Key': novoIdempotencyKey() },
  });
  return res.data;
}

/** Fechamento cego: operador informa o contado; sistema apura diferença/classificação. */
export async function fecharCaixa(payload: FecharCaixaPayload): Promise<CaixaSessao> {
  const res = await apiClient.post<CaixaSessao>('/v1/caixa/fechar', payload);
  return res.data;
}

/** Extrato paginado do turno, com filtro opcional por tipo de movimento. */
export async function extrato(
  sessaoId: string,
  filtros: ExtratoFiltros = {},
): Promise<PageResponse<CaixaMovimento>> {
  const res = await apiClient.get<PageResponse<CaixaMovimento>>(`/v1/caixa/${sessaoId}/extrato`, {
    params: {
      tipo: filtros.tipo,
      page: filtros.page ?? 0,
      size: filtros.size ?? 50,
    },
  });
  return res.data;
}

/** Relatório consolidado de fechamento (JSON para cupom térmico 80mm). */
export async function relatorioFechamento(sessaoId: string): Promise<RelatorioFechamento> {
  const res = await apiClient.get<RelatorioFechamento>(`/v1/caixa/${sessaoId}/fechamento`);
  return res.data;
}

/** Histórico de turnos por operador e/ou período. */
export async function historicoTurnos(filtros: HistoricoFiltros = {}): Promise<PageResponse<CaixaSessao>> {
  const res = await apiClient.get<PageResponse<CaixaSessao>>('/v1/caixa/historico', {
    params: {
      operadorId: filtros.operadorId,
      dataInicio: filtros.dataInicio,
      dataFim: filtros.dataFim,
      page: filtros.page ?? 0,
      size: filtros.size ?? 20,
    },
  });
  return res.data;
}
