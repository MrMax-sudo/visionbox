# ADR-005 — Stack Frontend

- **Data:** 2026-09-05
- **Status:** Aceito
- **Contexto:** Spec §2 sugere React+Tailwind reaproveitando OUTBOXERP ou Angular dependendo da equipe.
- **Decisão:** **React 18 + Vite 5 + Tailwind 3.4 + TanStack Query v5 + Zustand + RHF+Zod + shadcn/ui + Dexie + Workbox PWA**. Reuso padrão OUTBOXERP, bundle menor para PDV fraco, WebAR maduro. Tokens exclusivamente de `theme-visionbox.css:6-102`, Tailwind `darkMode selector [data-theme="dark"]`, shadcn variants via `var(--color-*)`. Angular só se guilda existente exigir — não é o caso TECHBOXBR.
- **Consequências:** `openapi-typescript` gera tipos, `axe` AA em CI, PDV teclado-first F2/F4/F8, Dexie outbox `Idempotency-Key`.

