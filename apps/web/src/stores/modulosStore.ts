import { create } from 'zustand';
import { apiClient, ApiError } from '@/lib/apiClient';

/**
 * useModulosStore — flags de módulo SaaS da loja autenticada (spec §4.4 / R11).
 *
 * Carregado no login (Login.tsx) e sob demanda pelo GuardaModulo/AppShell.
 * Fonte: GET /v1/modulos (rota aberta a autenticados, sempre da própria loja via JWT).
 *
 * Default de leitura: SEM dado carregado => `temModulo` devolve true (mesma semântica do
 * backend "sem registro = tudo ativo") e o guard nunca quebra a UI por falha de rede —
 * o enforcement real acontece no backend via @RequerModulo/ModuloTenantInterceptor.
 */
export type ModuloStatus = {
  codigo: string;
  nome: string;
  descricao: string;
  rotas: string[];
  ativo: boolean;
  fonte: 'PADRAO' | 'REGISTRO';
};

export type ModulosStatus = {
  lojaId: string;
  planoAtual: string;
  registrosExistem: boolean;
  modulos: ModuloStatus[];
};

type ModulosState = {
  status: ModulosStatus | null;
  loaded: boolean;
  loading: boolean;
  erro: string | null;
  carregar: (force?: boolean) => Promise<ModulosStatus | null>;
  temModulo: (codigo: string) => boolean;
  reiniciar: () => void;
};

export const useModulosStore = create<ModulosState>((set, get) => ({
  status: null,
  loaded: false,
  loading: false,
  erro: null,

  carregar: async (force = false) => {
    const { status, loaded, loading } = get();
    if (!force && loaded && status) return status;
    if (!force && loading) return status;
    set({ loading: true, erro: null });
    try {
      const res = await apiClient.get<ModulosStatus>('/v1/modulos');
      set({ status: res.data, loaded: true, loading: false, erro: null });
      return res.data;
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Falha ao carregar módulos da loja.';
      // fail-open no guard (backend continua bloqueando); erro fica visível p/ retry
      set({ loading: false, erro: msg });
      return get().status;
    }
  },

  temModulo: (codigo: string) => {
    const { status } = get();
    if (!status) return true; // sem dado => default ativo (compat com backend)
    const modulo = status.modulos.find((m) => m.codigo === codigo);
    if (!modulo) return true; // código desconhecido => não bloqueia (não é módulo SaaS)
    return modulo.ativo;
  },

  reiniciar: () => set({ status: null, loaded: false, loading: false, erro: null }),
}));
