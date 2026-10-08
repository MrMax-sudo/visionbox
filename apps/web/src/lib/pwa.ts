import * as React from 'react';

/**
 * pwa.ts — utilitários PWA do Portal do Cliente (US17)
 *
 * - applyThemeColorMeta(): o <meta name="theme-color"> é preenchido em runtime a partir dos
 *   tokens de theme-visionbox.css (R5: nenhum hex novo no código). O valor estático do
 *   index.html serve apenas de fallback antes do JS carregar.
 * - registerPortalServiceWorker(): registra /sw.js somente em produção e somente quando o
 *   cliente visita o portal público (não mexe no app autenticado em dev).
 * - useInstallPrompt(): botão "Instalar app" quando o navegador disparar beforeinstallprompt.
 */

type ThemeColorMode = 'light' | 'dark';

/** Cor do chrome do navegador: marca na light, fundo na dark (evita barra clara em tema escuro). */
const THEME_COLOR_TOKEN: Record<ThemeColorMode, string> = {
  light: '--color-primary',
  dark: '--color-bg-page',
};

function currentMode(): ThemeColorMode {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function readToken(name: string): string | null {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || null;
}

/** Sincroniza <meta name="theme-color"> com o token vigente. Retorna função de cleanup. */
export function syncThemeColorMeta(): () => void {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return () => undefined;

  const apply = () => {
    const token = THEME_COLOR_TOKEN[currentMode()];
    const value = readToken(token);
    if (value) meta.setAttribute('content', value);
  };
  apply();

  const observer = new MutationObserver(apply);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

/** Registra o service worker do portal. No-op em dev/SSR/navegador sem suporte. */
export function registerPortalServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  // microtask: não competir com a primeira pintura do portal
  void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
    // PWA é progressive enhancement — falha de registro não pode quebrar o rastreio.
  });
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function useInstallPrompt(): { canInstall: boolean; instalando: boolean; install: () => Promise<void> } {
  const [event, setEvent] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [instalando, setInstalando] = React.useState(false);

  React.useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setEvent(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = React.useCallback(async () => {
    if (!event) return;
    setInstalando(true);
    try {
      await event.prompt();
      await event.userChoice;
    } finally {
      setEvent(null);
      setInstalando(false);
    }
  }, [event]);

  return { canInstall: !!event, instalando, install };
}
