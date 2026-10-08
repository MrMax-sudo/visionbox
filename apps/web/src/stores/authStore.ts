import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { setAccessToken, subscribeAccessTokenChange } from '@/lib/authSession';

type User = {
  id: string;
  nome: string;
  email: string;
  perfil: 'ADMIN' | 'GERENTE' | 'VENDEDOR' | 'OTICO' | 'TECNICO' | 'FINANCEIRO' | 'LABORATORIO' | 'DESENVOLVEDOR';
  lojaId: string;
};

type AuthState = {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  // actions
  setAuth: (params: { token: string; user: User }) => void;
  setUser: (user: User | null) => void;
  logout: () => void;
  // helper para header Authorization
  getAuthorizationHeader: () => string | null;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      get isAuthenticated() {
        return !!get().token;
      },

      setAuth: ({ token, user }) => {
        setAccessToken(token);
        return set({
          token,
          user,
        });
      },

      setUser: (user) => set({ user }),

      logout: () => {
        setAccessToken(null);
        return set({
          token: null,
          user: null,
        });
      },

      getAuthorizationHeader: () => {
        const { token } = get();
        return token ? `Bearer ${token}` : null;
      },
    }),
    {
      name: 'visionbox-auth',
      storage: createJSONStorage(() => localStorage),
      // Não persiste tokens: access fica em memória e refresh deve vir por cookie HttpOnly.
      partialize: (state) => ({
        user: state.user,
      }),
    },
  ),
);

// Seletores convenientes (evita re-render desnecessário)
export const selectIsAuthenticated = (s: AuthState) => !!s.token;
export const selectUser = (s: AuthState) => s.user;
export const selectToken = (s: AuthState) => s.token;

subscribeAccessTokenChange((token) => {
  useAuthStore.setState({ token });
});
