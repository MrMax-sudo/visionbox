import * as z from 'zod';
import { ApiError } from '@/lib/apiClient';

// ---------------------------------------------------------------------------
// Schema da receita óptica — regras do domínio (eixo/adicao) — inalterado
// ---------------------------------------------------------------------------
function grauOlhoSchema() {
  return z.object({
    esferico: z.coerce
      .number({ invalid_type_error: 'Esférico é obrigatório' })
      .min(-30, 'Esférico mínimo -30')
      .max(30, 'Esférico máximo 30'),
    cilindrico: z.coerce
      .number({ invalid_type_error: 'Cilíndrico é obrigatório' })
      .min(-10, 'Cilíndrico mínimo -10')
      .max(0, 'Cilíndrico máximo 0'),
    eixo: z.coerce.number().min(0).max(180).optional().nullable(),
    adicao: z.coerce.number().min(0).max(6).optional().nullable(),
  });
}

const baseSchema = z.object({
  clienteId: z.string().uuid('Selecione um cliente da lista'),
  tipoLente: z.enum(['MONOFOCAL', 'BIFOCAL', 'MULTIFOCAL']),
  dp: z.coerce.number().min(20, 'DP mínimo 20mm').max(80, 'DP máximo 80mm'),
  od: grauOlhoSchema(),
  oe: grauOlhoSchema(),
  observacao: z.string().max(500).optional().or(z.literal('')),
});

export const receitaSchema = baseSchema.superRefine((data, ctx) => {
  // Eixo obrigatório se cilindro != 0
  for (const lado of ['od', 'oe'] as const) {
    const olho = data[lado];
    const cil = olho.cilindrico;
    if (cil !== 0 && cil !== null && cil !== undefined) {
      if (olho.eixo == null || Number.isNaN(olho.eixo as number)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [lado, 'eixo'],
          message: 'Eixo 0–180 obrigatório quando cilindro ≠ 0',
        });
      } else if ((olho.eixo as number) < 0 || (olho.eixo as number) > 180) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [lado, 'eixo'],
          message: 'Eixo deve estar entre 0 e 180',
        });
      }
    }
    // Adição só permitida em MULTIFOCAL; se MULTIFOCAL, 0..6; senão deve ser 0/vazio
    const ad = olho.adicao;
    if (data.tipoLente !== 'MULTIFOCAL') {
      if (ad != null && ad !== 0 && !Number.isNaN(ad as number) && (ad as number) !== 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [lado, 'adicao'],
          message: 'Adição só permitida para lente MULTIFOCAL',
        });
      }
    } else {
      if (ad != null && !Number.isNaN(ad as number) && ((ad as number) < 0 || (ad as number) > 6)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [lado, 'adicao'],
          message: 'Adição deve estar entre 0 e 6',
        });
      }
    }
  }
});

export type ReceitaForm = z.infer<typeof receitaSchema>;

export const RECEITA_DEFAULT_VALUES: ReceitaForm = {
  clienteId: '',
  tipoLente: 'MONOFOCAL',
  dp: 62 as unknown as number,
  od: { esferico: 0, cilindrico: 0, eixo: null, adicao: null },
  oe: { esferico: 0, cilindrico: 0, eixo: null, adicao: null },
  observacao: '',
};

// ---------------------------------------------------------------------------
// Helpers — erro da API (ProblemDetail) e detecção de URL de foto navegável
// ---------------------------------------------------------------------------
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const p = err.problem;
    const fieldErrors =
      p?.errors && p.errors.length > 0 ? p.errors.map((fe) => `${fe.field}: ${fe.message}`).join(' • ') : '';
    return p?.detail || p?.message || fieldErrors || err.message || fallback;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/** Só é "foto de verdade" se for URL navegável (http(s) ou endpoint da API). */
export function isNavigableFotoUrl(url?: string | null): boolean {
  if (!url) return false;
  return /^https?:\/\//i.test(url) || url.startsWith('/api/');
}
