import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { getAccessToken, setAccessToken } from '@/lib/authSession';

/**
 * apiClient — cliente HTTP central do VisionBox Web
 *
 * - baseURL: VITE_API_URL (default /api → proxy Vite para localhost:8080)
 * - Request interceptor: injeta Authorization Bearer se houver access token em memória e
 *   Idempotency-Key (UUID v4) para métodos não-idempotentes (POST/PATCH/PUT) — exigido
 *   pelo PDV offline-first/outbox (ADR-001/R4). Opcional: desative por request com
 *   header `X-Skip-Idempotency-Key`.
 * - Response interceptor: normaliza ProblemDetail (RFC 7807) do Spring Boot
 *   e trata 401 → limpa auth + redireciona /login.
 */

export type ProblemDetail = {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  errors?: Array<{ field: string; message: string }>;
  message?: string;
  [key: string]: unknown;
};

export class ApiError extends Error {
  status?: number;
  problem?: ProblemDetail;
  constructor(message: string, status?: number, problem?: ProblemDetail) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.problem = problem;
  }
}

type RetriableRequestConfig = InternalAxiosRequestConfig & { _retry?: boolean };

function getApiBaseUrl(): string {
  const envUrl = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_URL;
  return envUrl || '/api';
}

function getAuthToken(): string | null {
  return getAccessToken();
}

function getPersistedLojaId(): string | null {
  try {
    const raw = localStorage.getItem('visionbox-auth');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { user?: { lojaId?: string } } };
    return parsed.state?.user?.lojaId ?? null;
  } catch {
    return null;
  }
}

function uuidv4(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 15000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Request interceptor — JWT + Idempotency-Key. Tenant autenticado vem do claim loja_id do JWT.
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const isAuthRequest = config.url?.includes('/auth/login') || config.url?.includes('/auth/register');
    const token = getAuthToken();
    if (token && config.headers && !isAuthRequest) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const lojaId = getPersistedLojaId();
    if (lojaId && config.headers && !isAuthRequest && !config.headers['X-Loja-Id']) {
      (config.headers as Record<string, string>)['X-Loja-Id'] = lojaId;
    }

    const method = (config.method ?? 'get').toUpperCase();
    const needsIdempotency = ['POST', 'PATCH', 'PUT'].includes(method);
    const skipHeader = config.headers?.['X-Skip-Idempotency-Key'];
    if (needsIdempotency && !skipHeader) {
      const existing = config.headers?.['Idempotency-Key'] as string | undefined;
      if (!existing) {
        (config.headers as Record<string, string>)['Idempotency-Key'] = uuidv4();
      }
    }
    if (config.headers?.['X-Skip-Idempotency-Key']) {
      delete (config.headers as Record<string, string>)['X-Skip-Idempotency-Key'];
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor — ProblemDetail + 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ProblemDetail>) => {
    const status = error.response?.status;
    const data = error.response?.data;
    const problem: ProblemDetail | undefined = data && typeof data === 'object' ? data : undefined;

    const message =
      problem?.detail ||
      problem?.title ||
      problem?.message ||
      (typeof data === 'string' ? data : null) ||
      error.message ||
      'Erro inesperado';

    if (status === 401) {
      const originalConfig = error.config as RetriableRequestConfig | undefined;
      // só limpa auth se não for rota de login — evita reload infinito quando token ainda não existe
      const isLoginRequest = originalConfig?.url?.includes('/auth/login') || originalConfig?.url?.includes('/auth/register');
      const isRefreshRequest = originalConfig?.url?.includes('/auth/refresh');
      if (isLoginRequest) {
        return Promise.reject(new ApiError(message, status, problem));
      }
      if (originalConfig && !originalConfig._retry && !isRefreshRequest) {
        originalConfig._retry = true;
        try {
          const refreshed = await apiClient.post<{ accessToken: string; usuario?: unknown }>(
            '/v1/auth/refresh',
            undefined,
            { headers: { 'X-Skip-Idempotency-Key': 'true' } },
          );
          setAccessToken(refreshed.data.accessToken);
          originalConfig.headers.Authorization = `Bearer ${refreshed.data.accessToken}`;
          return apiClient.request(originalConfig);
        } catch {
          setAccessToken(null);
        }
      }
      setAccessToken(null);
      try {
        localStorage.removeItem('visionbox-auth');
      } catch {
        /* ignore */
      }
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        // usa replace para não empilhar histórico e evita loop se /login não existir
        window.location.replace('/login');
      }
    }

    if (error.code === 'ECONNABORTED') {
      return Promise.reject(new ApiError('Tempo de resposta excedido. Verifique sua conexão.', status, problem));
    }
    if (!error.response) {
      return Promise.reject(
        new ApiError('Sem conexão com o servidor. Operação será sincronizada quando a rede voltar.', undefined, problem),
      );
    }

    return Promise.reject(new ApiError(message, status, problem));
  },
);

export async function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const res = await apiClient.get<T>(url, config);
  return res.data;
}
export async function apiPost<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const res = await apiClient.post<T>(url, data, config);
  return res.data;
}
export async function apiPut<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const res = await apiClient.put<T>(url, data, config);
  return res.data;
}
export async function apiPatch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const res = await apiClient.patch<T>(url, data, config);
  return res.data;
}
export async function apiDelete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const res = await apiClient.delete<T>(url, config);
  return res.data;
}
