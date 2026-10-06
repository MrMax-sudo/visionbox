const config = {
    darkMode: ['selector', '[data-theme="dark"]'],
    content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: 'var(--color-primary)',
                    dark: 'var(--color-primary-dark)',
                    light: 'var(--color-primary-light)',
                    foreground: 'var(--color-text-on-primary)',
                },
                secondary: {
                    DEFAULT: 'var(--color-secondary)',
                    dark: 'var(--color-secondary-dark)',
                    light: 'var(--color-secondary-light)',
                    foreground: 'var(--color-text-on-primary)',
                },
                warning: {
                    DEFAULT: 'var(--color-warning)',
                    dark: 'var(--color-warning-dark)',
                    light: 'var(--color-warning-light)',
                },
                danger: {
                    DEFAULT: 'var(--color-danger)',
                    dark: 'var(--color-danger-dark)',
                    light: 'var(--color-danger-light)',
                },
                success: {
                    DEFAULT: 'var(--color-success)',
                    dark: 'var(--color-success-dark)',
                    light: 'var(--color-success-light)',
                },
                info: {
                    DEFAULT: 'var(--color-info)',
                    light: 'var(--color-info-light)',
                },
                border: {
                    DEFAULT: 'var(--color-border)',
                    strong: 'var(--color-border-strong)',
                },
                background: {
                    DEFAULT: 'var(--color-bg-page)',
                    card: 'var(--color-bg-card)',
                },
                foreground: {
                    DEFAULT: 'var(--color-text-primary)',
                    secondary: 'var(--color-text-secondary)',
                    muted: 'var(--color-text-muted)',
                },
            },
            fontFamily: {
                sans: ['var(--font-sans)'],
                display: ['var(--font-display)'],
            },
            borderRadius: {
                DEFAULT: 'var(--radius)',
                card: 'var(--radius-card)',
            },
        },
    },
    plugins: [],
};
export default config;
