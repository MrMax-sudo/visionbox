import * as React from 'react';
import { Link } from 'react-router-dom';
import { Glasses, Lock, MessageCircle, ScrollText, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { GRAU_OCULTO, brl, shortId } from '@/components/os/osDomain';
import { sanitizeWhatsApp } from '@/stores/empresaStore';
import type { OrdemServicoDTO, ReceitaDTO } from '@/lib/types';

function Linha({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-secondary">{label}</span>
      <span className="min-w-0 truncate text-right text-primary">{children}</span>
    </div>
  );
}

/** Cliente + contato rápido (wa.me). */
export function ClientePanel({ os }: { os: OrdemServicoDTO }) {
  const digitos = sanitizeWhatsApp(os.clienteWhatsapp);
  const valor = os.valor ?? os.total;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4 text-brand" aria-hidden /> Cliente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <Linha label="Cliente">{os.clienteNome ?? shortId(os.clienteId)}</Linha>
        <div className="flex items-center justify-between gap-3">
          <span className="shrink-0 text-secondary">WhatsApp</span>
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-mono text-xs text-primary">{os.clienteWhatsapp ?? '-'}</span>
            {digitos && (
              <Button asChild variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-xs">
                <a href={`https://wa.me/${digitos}`} target="_blank" rel="noreferrer noopener">
                  <MessageCircle className="h-3.5 w-3.5" aria-hidden /> Abrir
                </a>
              </Button>
            )}
          </span>
        </div>
        {os.receitaId && <Linha label="Receita">{shortId(os.receitaId)}</Linha>}
        {os.vendedor && <Linha label="Vendedor">{os.vendedor}</Linha>}
        {typeof valor === 'number' && valor > 0 && <Linha label="Valor">{brl(valor)}</Linha>}
      </CardContent>
    </Card>
  );
}

/** Produção — vínculos de armação/lente/laboratório. */
export function ProducaoPanel({ os }: { os: OrdemServicoDTO }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Glasses className="h-4 w-4 text-brand" aria-hidden /> Produção
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <Linha label="Armação">
          <span className="font-mono text-xs">{shortId(os.armacaoId)}</span>
        </Linha>
        <Linha label="Lente">
          <span className="font-mono text-xs">{shortId(os.lenteId)}</span>
        </Linha>
        <Linha label="Laboratório">
          <span className="font-mono text-xs">{shortId(os.laboratorioId)}</span>
        </Linha>
      </CardContent>
    </Card>
  );
}

/**
 * Receita clínica da OS — LGPD/R2: o grau só aparece em claro para perfis
 * clínicos/gerenciais; VENDEDOR (e perfis fora da lista) veem máscara.
 * Leitura usa `GET /v1/receitas/{id}` (o backend registra a leitura em métrica LGPD).
 */
export function ReceitaPanel({
  receitaId,
  receita,
  isLoading,
  error,
  onRetry,
  podeLer,
  podeVerGrau,
}: {
  receitaId: string | null | undefined;
  receita?: ReceitaDTO;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  podeLer: boolean;
  podeVerGrau: boolean;
}) {
  if (!receitaId) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ScrollText className="h-4 w-4 text-brand" aria-hidden /> Receita
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded border border-dashed border-border bg-page p-4 text-sm text-secondary">
            OS sem receita vinculada.{' '}
            <Link to="/receitas" className="font-medium underline-offset-2 hover:underline">
              Cadastrar receita
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!podeLer) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ScrollText className="h-4 w-4 text-brand" aria-hidden /> Receita
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2 rounded border border-warning-light bg-warning-light p-3 text-xs text-warning-dark">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              Seu perfil não tem acesso ao módulo de receitas — grau e dados clínicos permanecem
              ocultos (LGPD, minimização de dados).
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <ScrollText className="h-4 w-4 text-brand" aria-hidden /> Receita
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {isLoading && (
          <div className="space-y-2" aria-busy="true" aria-label="Carregando receita">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        )}

        {!isLoading && error ? <ErrorState error={error} onRetry={onRetry} compact /> : null}

        {!isLoading && !error && receita && (
          <>
            <Linha label="Emissão">{receita.data || '—'}</Linha>
            {receita.status && <Linha label="Situação">{receita.status}</Linha>}
            <div className="space-y-1.5 border-t border-border pt-2">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-secondary">OD</span>
                <span className="font-mono text-xs text-primary">
                  {podeVerGrau ? receita.od : GRAU_OCULTO}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-secondary">OE</span>
                <span className="font-mono text-xs text-primary">
                  {podeVerGrau ? receita.oe : GRAU_OCULTO}
                </span>
              </div>
            </div>
            {!podeVerGrau && (
              <p className="flex items-start gap-1.5 pt-1 text-[11px] text-muted">
                <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                Grau mascarado para o seu perfil (ADR-002 — exibição mínima de dado sensível).
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
