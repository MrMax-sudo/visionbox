import { create } from 'zustand';
import { apiClient } from '@/lib/apiClient';

export type EmpresaConfig = {
  id: string;
  nome: string;
  cnpj?: string;
  telefone?: string;
  whatsapp?: string | null;
  emailContato?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  site?: string;
  logoUrl?: string;
};

type EmpresaState = {
  empresa: EmpresaConfig | null;
  loaded: boolean;
  loading: boolean;
  carregar: (force?: boolean) => Promise<EmpresaConfig | null>;
};

function sanitizeWhatsApp(numero?: string | null): string {
  if (!numero) return '';
  const digits = numero.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55')) return digits;
  if (digits.length <= 11) return `55${digits}`;
  return digits;
}

export const useEmpresaStore = create<EmpresaState>((set, get) => ({
  empresa: null,
  loaded: false,
  loading: false,

  carregar: async (force = false) => {
    const { empresa, loaded, loading } = get();
    if (!force && loaded && empresa) return empresa;
    if (!force && loading) return empresa;
    set({ loading: true });
    try {
      const res = await apiClient.get<EmpresaConfig>('/v1/empresa');
      set({ empresa: res.data, loaded: true, loading: false });
      return res.data;
    } catch {
      set({ loading: false });
      return get().empresa;
    }
  },
}));

export function whatsappSuporteUrl(numero?: string | null, message?: string): string {
  const digits = sanitizeWhatsApp(numero);
  const base = digits ? `https://wa.me/${digits}` : 'https://wa.me/5511984987382';
  if (message) {
    return `${base}?text=${encodeURIComponent(message)}`;
  }
  return base;
}

export { sanitizeWhatsApp };