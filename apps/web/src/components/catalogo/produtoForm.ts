import { z } from 'zod';
import type { ProdutoDTO } from '@/lib/types';

export const CATEGORIAS_PRODUTO = ['Armação', 'Lente', 'Lente de contato', 'Acessório', 'Serviço'] as const;
export type CategoriaProduto = (typeof CATEGORIAS_PRODUTO)[number];

export const TIPO_POR_CATEGORIA: Record<CategoriaProduto, string> = {
  'Armação': 'ARMACAO',
  'Lente': 'LENTE',
  'Lente de contato': 'LENTE_CONTATO',
  'Acessório': 'ACESSORIO',
  'Serviço': 'SERVICO',
};

export const produtoSchema = z.object({
  sku: z.string().trim().min(1, 'SKU é obrigatório').max(50, 'SKU máximo 50 caracteres'),
  nome: z
    .string()
    .trim()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(200, 'Nome máximo 200 caracteres'),
  categoria: z.enum(CATEGORIAS_PRODUTO, { errorMap: () => ({ message: 'Selecione a categoria' }) }),
  marca: z.string().max(100, 'Marca máxima 100 caracteres').optional().or(z.literal('')),
  custo: z.coerce.number({ invalid_type_error: 'Custo é obrigatório' }).min(0, 'Custo não pode ser negativo'),
  precoVenda: z.coerce
    .number({ invalid_type_error: 'Preço é obrigatório' })
    .min(0.01, 'Preço de venda deve ser maior que zero'),
  estoqueQuantidade: z.coerce
    .number({ invalid_type_error: 'Estoque é obrigatório' })
    .min(0, 'Estoque não pode ser negativo')
    .int('Estoque deve ser um número inteiro'),
  ncm: z
    .string()
    .regex(/^\d{0,8}$/, 'NCM deve ter até 8 dígitos')
    .optional()
    .or(z.literal('')),
  codigoBarras: z.string().max(50, 'Código de barras máximo 50 caracteres').optional().or(z.literal('')),
});

export type ProdutoForm = z.infer<typeof produtoSchema>;

export const PRODUTO_DEFAULT_VALUES: ProdutoForm = {
  sku: '',
  nome: '',
  categoria: 'Armação',
  marca: '',
  custo: 0,
  precoVenda: 0,
  estoqueQuantidade: 0,
  ncm: '',
  codigoBarras: '',
};

/** Normaliza a categoria vinda do backend (ARMACAO/LENTE/…) para o label da UI. */
export function categoriaDeProduto(p: ProdutoDTO): CategoriaProduto {
  const bruta = p.categoria ?? '';
  const normalizada = bruta.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  if (normalizada.startsWith('LENTE DE CONTATO') || normalizada === 'LENTE_CONTATO') return 'Lente de contato';
  if (normalizada.startsWith('ACESSOR')) return 'Acessório';
  if (normalizada.startsWith('SERVIC')) return 'Serviço';
  if (normalizada.startsWith('LENTE')) return 'Lente';
  return 'Armação';
}
