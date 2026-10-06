import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * cn — merge condicional de classes Tailwind (shadcn/ui pattern)
 * Combina clsx + tailwind-merge para resolver conflitos de utilitários.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
