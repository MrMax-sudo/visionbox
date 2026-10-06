/**
 * masks.ts — utilitários de máscara PT-BR (VisionBox)
 * LGPD: CPF nunca logado em plain; masks apenas para exibição/UX.
 */

/** Remove tudo que não for dígito */
export function unmask(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\D/g, '');
}

/** 000.000.000-00 — aceita parcial durante digitação */
export function maskCPF(value: string | null | undefined): string {
  const d = unmask(value).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** 00000-000 — aceita parcial */
export function maskCEP(value: string | null | undefined): string {
  const d = unmask(value).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

/**
 * Telefone PT-BR
 *  (00) 0000-0000  — 10 dígitos
 *  (00) 00000-0000 — 11 dígitos
 *  Parcial tolerante durante digitação
 */
export function maskTelefone(value: string | null | undefined): string {
  const d = unmask(value).slice(0, 11);
  if (!d) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) {
    // 10 dígitos: (00) 0000-0000
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  // 11 dígitos: (00) 00000-0000
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Formata número para BRL — ex: 1234.5 → R$ 1.234,50 */
export function formatBRL(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Converte string BRL ("1.234,56" ou "1234,56") → number */
export function parseBRL(value: string): number {
  if (!value) return 0;
  // remove R$, espaços, pontos de milhar, troca vírgula por ponto
  const cleaned = value.replace(/[^0-9,-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isNaN(n) ? 0 : n;
}

/** Validação simples CPF (dígitos verificadores) — usado em Zod refine */
export function isValidCPF(raw: string): boolean {
  const cpf = unmask(raw);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i);
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== Number(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i);
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  return rev === Number(cpf[10]);
}
