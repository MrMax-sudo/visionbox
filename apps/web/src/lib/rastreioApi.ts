import axios, { type AxiosError, type AxiosInstance } from 'axios';
import { ApiError, type ProblemDetail } from '@/lib/apiClient';
import type { StatusOS } from '@/lib/osStatus';

/**
 * rastreioApi — cliente do rastreio PÚBLICO da OS (Portal do Cliente, US17 / §6.3)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * STATUS DO BACKEND: PENDENTE (nenhum endpoint de rastreio público existe hoje).
 *
 * Verificado em src/main/java:
 *  - modules/ordemservico/controller/OrdemServicoController.java → apenas CRUD autenticado
 *    (/api/v1/ordens-servico/** exige ROLE, ver SecurityConfig.java:88).
 *  - modules/laboratorio/controller/LabPortalTokenController.java → único portal público
 *    (/api/v1/laboratorios/portal/**, SecurityConfig.java:72), voltado ao LABORATÓRIO
 *    (inclui prescrição OD/OE e ação de mudar status) — não serve ao cliente final.
 *  - GET /api/v1/empresa/** é AUTENTICADO (SecurityConfig.java:75) → dados da ótica vêm
 *    do payload do rastreio (campo `optica`) ou de placeholder; o portal NÃO chama /empresa
 *    (um 401 lá dispararia o interceptor do apiClient e redirecionaria o cliente para /login).
 *
 * O contrato abaixo é PROVISÓRIO e foi espelhado nos DTOs já existentes
 * (OrdemServicoResponse + LabPortalDetalhesResponse) para não inventar formato proprietário.
 * Agente de backend deve implementar:
 *   GET /api/v1/ordens-servico/rastreio/{token}   → RastreioOS        (token opaco/UUID, TTL)
 *   GET /api/v1/ordens-servico/rastreio?numero=X  → RastreioOS | { token }
 * ambos SEM autenticação, com minimização LGPD (sem CPF/grau/receita completa) e
 * permitAll em SecurityConfig + TenantFilter.isPublicPath.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface RastreioEvento {
  id?: string;
  statusAnterior?: string | null;
  statusNovo?: string;
  dataHora?: string;
  responsavel?: string | null;
  observacao?: string | null;
}

export interface RastreioOptica {
  nome?: string;
  cnpj?: string;
  telefone?: string;
  whatsapp?: string | null;
  endereco?: string;
  cidade?: string;
  uf?: string;
}

export interface RastreioGarantiaItem {
  descricao?: string;
  quantidade?: number;
  garantiaMeses?: number;
  validade?: string;
}

export interface RastreioGarantia {
  dataCompra?: string;
  validadeMeses?: number;
  itens?: RastreioGarantiaItem[];
}

export interface RastreioOS {
  ordemServicoId?: string;
  numeroOs?: string;
  statusAtual?: string;
  dataAbertura?: string;
  previsaoEntrega?: string;
  dataEntregaReal?: string | null;
  /** Minimização LGPD: apenas primeiro nome (o backend não deve devolver documento completo). */
  clientePrimeiroNome?: string;
  produtoResumo?: string;
  armacaoNome?: string;
  lenteNome?: string;
  optica?: RastreioOptica;
  garantia?: RastreioGarantia;
  timeline?: RastreioEvento[];
}

export interface RastreioBusca {
  /** Quando a busca por número devolve um link (token) em vez do payload completo. */
  token?: string;
  ordem?: RastreioOS;
}

function getApiBaseUrl(): string {
  const envUrl = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_URL;
  return envUrl || '/api';
}

/**
 * Instância SEPARADA do apiClient (sem interceptores):
 * - 401/404 de token público não pode redirecionar o cliente para /login (interceptor do apiClient faz isso);
 * - portal é somente leitura → não injeta Authorization nem Idempotency-Key.
 * Timeout 10s (celular ruim) e erro normalizado em ApiError para reuso de ErrorState.
 */
const publicClient: AxiosInstance = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 10000,
  headers: { Accept: 'application/json' },
});

publicClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ProblemDetail>) => {
    const status = error.response?.status;
    const problem = error.response?.data && typeof error.response.data === 'object' ? error.response.data : undefined;
    if (error.code === 'ECONNABORTED') {
      return Promise.reject(new ApiError('Tempo de resposta excedido. Verifique sua conexão e tente novamente.', status, problem));
    }
    if (!error.response) {
      return Promise.reject(new ApiError('Sem conexão com o servidor. O portal funciona offline com os dados já carregados.', undefined, problem));
    }
    const message =
      problem?.detail || problem?.title || problem?.message || (typeof error.response.data === 'string' ? error.response.data : null) || error.message || 'Erro inesperado';
    return Promise.reject(new ApiError(message, status, problem));
  },
);

export const RASTREIO_ROTA = '/rastreio';

export function rastreioUrl(token: string): string {
  return `${RASTREIO_ROTA}/${encodeURIComponent(token)}`;
}

/** Normaliza o que o usuário digitou: aceita "OS-2024-001", link colado etc. */
export function extrairTokenColado(valor: string): string | null {
  const match = valor.match(/(?:^|[^\w])rastreio\/([^/?#\s]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function normalizarNumero(value: string): string {
  return value.trim().replace(/^os[\s:.-]*/i, '');
}

/** Validação leve do número da OS (sem chamada de rede). */
export function validarNumero(value: string): string | null {
  const numero = normalizarNumero(value);
  if (!numero) return 'Informe o número da OS.';
  if (/^https?:\/\//i.test(numero)) {
    return 'Colo o link de rastreio completo (contendo /rastreio/...) ou digite apenas o número da OS.';
  }
  if (numero.length < 3) return 'Número muito curto (mínimo 3 caracteres).';
  if (numero.length > 40) return 'Número muito longo (máximo 40 caracteres).';
  if (!/^[A-Za-z0-9./-]+$/.test(numero)) return 'Use apenas letras, números, ponto, barra ou hífen.';
  return null;
}

function ehRastreioOS(payload: unknown): payload is RastreioOS {
  return !!payload && typeof payload === 'object' && ('numeroOs' in payload || 'statusAtual' in payload || 'timeline' in payload);
}

/** Rastreio por token opaco (link enviado ao cliente). */
export async function fetchRastreioPorToken(token: string): Promise<RastreioOS> {
  const res = await publicClient.get<RastreioOS>(`/v1/ordens-servico/rastreio/${encodeURIComponent(token)}`);
  if (!ehRastreioOS(res.data)) {
    throw new ApiError('Resposta inválida do servidor de rastreio.', 500);
  }
  return res.data;
}

/**
 * Busca por número da OS (validação leve no cliente; a autorização/segurança
 * contra enumeração é responsabilidade do backend — ver nota no topo do arquivo).
 */
export async function buscarRastreioPorNumero(numero: string): Promise<RastreioBusca> {
  const res = await publicClient.get<RastreioOS | RastreioBusca>('/v1/ordens-servico/rastreio', {
    params: { numero: normalizarNumero(numero) },
  });
  const data = res.data;
  if (!data || typeof data !== 'object') {
    throw new ApiError('Resposta inválida do servidor de rastreio.', 500);
  }
  if (ehRastreioOS(data)) return { ordem: data };
  return data as RastreioBusca;
}

/** Mensagem amigável por código de erro (404 = não achou, 410 = link expirado etc.). */
export function mensagemRastreio(err: unknown): string {
  const api = err as ApiError;
  if (api instanceof ApiError) {
    if (api.status === 404) return 'OS não encontrada. Confira o número informado ou fale com a ótica.';
    if (api.status === 410) return 'Este link de rastreio expirou. Peça um novo na ótica.';
    if (api.status === 400 || api.status === 422) return 'Não foi possível validar os dados informados.';
    if (!api.status) return api.message; // offline / timeout
    return api.message;
  }
  return err instanceof Error ? err.message : 'Erro inesperado ao consultar o rastreio.';
}

/** Conveniência para o semáforo/timeline: status conhecido ou bruto. */
export function statusOSOuBruto(status?: string): StatusOS | string {
  return status ?? 'ORCAMENTO';
}
