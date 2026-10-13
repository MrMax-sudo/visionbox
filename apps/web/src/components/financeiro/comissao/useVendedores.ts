import { useQuery } from '@tanstack/react-query';
import { listarVendedoresComissao } from '@/lib/comissaoService';

/**
 * useVendedores — opções de vendedor para apuração/fechamento de comissões.
 *
 * Fonte: GET /v1/financeiro/comissoes/vendedores — usuários ATIVOS da loja com
 * perfil que apura comissão (VENDEDOR, OTICO), id+nome. Liberado pelo matcher
 * /api/v1/financeiro/** (ADMIN, GERENTE, FINANCEIRO) — substitui a listagem de
 * /v1/usuarios (ADMIN-only) que deixava o picker degradado para GERENTE/FINANCEIRO.
 */

export type VendedorOption = {
  id: string;
  nome: string;
};

export function useVendedores() {
  return useQuery({
    queryKey: ['comissoes', 'vendedores'],
    queryFn: async (): Promise<VendedorOption[]> => {
      const vendedores = await listarVendedoresComissao();
      return vendedores
        .map((v) => ({ id: v.id, nome: v.nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    },
    staleTime: 60_000,
  });
}
