import type { Config } from 'tailwindcss';
/**
 * Tema VisionBox — ONDA 1 (refator frontend)
 *
 * Regra R5: NENHUM hex neste arquivo. Todo valor aponta para tokens oficiais
 * de `src/styles/theme-visionbox.css` (var(--color-*), var(--font-*),
 * var(--radius*), var(--shadow-*)).
 *
 * Dark mode: os próprios tokens já são redefinidos em `[data-theme="dark"]`,
 * portanto utilities como `bg-card`, `text-primary` e `border` se adaptam
 * automaticamente. `darkMode` segue habilitado para quem quiser variants
 * explícitas (`dark:bg-...`).
 */
declare const config: Config;
export default config;
