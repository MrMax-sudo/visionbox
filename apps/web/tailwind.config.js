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
const config = {
    darkMode: ['selector', '[data-theme="dark"]'],
    content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
    theme: {
        extend: {
            colors: {
                /* ---- Marca / ações (bg-primary, ring-primary, border-primary…) ---- */
                primary: {
                    DEFAULT: 'var(--color-primary)',
                    dark: 'var(--color-primary-dark)',
                    light: 'var(--color-primary-light)',
                    foreground: 'var(--color-text-on-primary)',
                },
                /* alias semântico da marca (texto/ícone cor café) */
                brand: {
                    DEFAULT: 'var(--color-primary)',
                    dark: 'var(--color-primary-dark)',
                    light: 'var(--color-primary-light)',
                },
                secondary: {
                    DEFAULT: 'var(--color-secondary)',
                    dark: 'var(--color-secondary-dark)',
                    light: 'var(--color-secondary-light)',
                    foreground: 'var(--color-text-on-secondary)',
                },
                /* ---- Status (OS / financeiro) ---- */
                success: {
                    DEFAULT: 'var(--color-success)',
                    dark: 'var(--color-success-dark)',
                    light: 'var(--color-success-light)',
                    foreground: 'var(--color-text-on-primary)',
                },
                warning: {
                    DEFAULT: 'var(--color-warning)',
                    dark: 'var(--color-warning-dark)',
                    light: 'var(--color-warning-light)',
                    foreground: 'var(--color-text-on-warning)',
                },
                danger: {
                    DEFAULT: 'var(--color-danger)',
                    dark: 'var(--color-danger-dark)',
                    light: 'var(--color-danger-light)',
                    foreground: 'var(--color-text-on-danger)',
                },
                info: {
                    DEFAULT: 'var(--color-info)',
                    dark: 'var(--color-info)',
                    light: 'var(--color-info-light)',
                    foreground: 'var(--color-text-on-primary)',
                },
                /* ---- Superfícies (bg-page, bg-panel, bg-card, bg-card-soft) ---- */
                page: 'var(--color-bg-page)',
                panel: 'var(--color-bg-panel)',
                card: {
                    DEFAULT: 'var(--color-bg-card)',
                    soft: 'var(--color-bg-card-soft)',
                },
                /* alias shadcn: bg-background continua funcionando */
                background: {
                    DEFAULT: 'var(--color-bg-page)',
                    card: 'var(--color-bg-card)',
                },
                surface: 'var(--color-pdv-surface)',
                /* véu semitransparente de modal/sidebar (usa color token — sem modifier) */
                scrim: 'var(--color-scrim)',
                /* ---- Bordas (border, border-strong, border-border) ---- */
                border: {
                    DEFAULT: 'var(--color-border)',
                    strong: 'var(--color-border-strong)',
                },
                /* ---- Texto (text-foreground, text-foreground-secondary…) ---- */
                foreground: {
                    DEFAULT: 'var(--color-text-primary)',
                    secondary: 'var(--color-text-secondary)',
                    muted: 'var(--color-text-muted)',
                },
                muted: 'var(--color-text-muted)',
                /* ---- Sidebar (gradiente + texto sobre ele) ---- */
                sidebar: {
                    DEFAULT: 'var(--color-pdv-sidebar-mid)',
                    top: 'var(--color-pdv-sidebar-top)',
                    mid: 'var(--color-pdv-sidebar-mid)',
                    bottom: 'var(--color-pdv-sidebar-bottom)',
                    text: 'var(--color-sidebar-text)',
                },
            },
            /**
             * `text-primary` / `text-secondary` apontam para o token de TEXTO
             * (--color-text-primary/secondary) e não para a cor da marca.
             * Para a cor da marca use `text-brand` ou `bg-primary`.
             * (Os sub-nomes aninhados são re-declarados abaixo porque este extend
             * substitui o objeto colors inteiro dentro do namespace textColor.)
             */
            textColor: {
                primary: 'var(--color-text-primary)',
                'primary-dark': 'var(--color-primary-dark)',
                'primary-light': 'var(--color-primary-light)',
                'primary-foreground': 'var(--color-text-on-primary)',
                secondary: 'var(--color-text-secondary)',
                'secondary-dark': 'var(--color-secondary-dark)',
                'secondary-light': 'var(--color-secondary-light)',
                'secondary-foreground': 'var(--color-text-on-secondary)',
                muted: 'var(--color-text-muted)',
                brand: 'var(--color-primary)',
                'brand-dark': 'var(--color-primary-dark)',
                'brand-light': 'var(--color-primary-light)',
                'on-primary': 'var(--color-text-on-primary)',
                'on-secondary': 'var(--color-text-on-secondary)',
                'on-action': 'var(--color-text-on-action)',
                'on-danger': 'var(--color-text-on-danger)',
                'on-warning': 'var(--color-text-on-warning)',
            },
            /* `ring` simples usa o anel da marca (foco visível AA) */
            ringColor: {
                DEFAULT: 'var(--color-primary)',
            },
            fontFamily: {
                sans: ['var(--font-sans)'],
                display: ['var(--font-display)'],
            },
            borderRadius: {
                DEFAULT: 'var(--radius)',
                card: 'var(--radius-card)',
            },
            boxShadow: {
                soft: 'var(--shadow-soft)',
                panel: 'var(--shadow-panel)',
            },
            /* camadas de UI (nada de position:fixed na estrutura) */
            zIndex: {
                backdrop: '20',
                sidebar: '30',
                overlay: '40',
                modal: '50',
                toast: '60',
            },
        },
    },
    plugins: [],
};
export default config;
