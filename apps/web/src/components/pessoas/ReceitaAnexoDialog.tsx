import * as React from 'react';
import { Loader2 } from 'lucide-react';

import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { apiClient, ApiError } from '@/lib/apiClient';
import type { ReceitaDTO } from '@/lib/types';
import { apiErrorMessage, isNavigableFotoUrl } from '@/components/pessoas/receitaForm';

export interface ReceitaAnexoDialogProps {
  /** null = fechado */
  receita: ReceitaDTO | null;
  onClose: () => void;
}

type ViewState = {
  src: string;
  revoke: boolean;
  loading: boolean;
  error: string | null;
  broken: boolean;
};

const IDLE: ViewState = { src: '', revoke: false, loading: false, error: null, broken: false };

/**
 * ReceitaAnexoDialog — visualiza o anexo clínico.
 * URL navegável → abre direto; caso contrário busca o binário em
 * GET /v1/receitas/{id}/anexo (o ProblemDetail pode chegar como Blob).
 */
export function ReceitaAnexoDialog({ receita, onClose }: ReceitaAnexoDialogProps) {
  const [view, setView] = React.useState<ViewState>(IDLE);
  const blobRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!receita) {
      setView(IDLE);
      return;
    }
    let cancelled = false;

    const release = () => {
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = null;
      }
    };
    release();

    if (isNavigableFotoUrl(receita.fotoUrl)) {
      setView({ src: receita.fotoUrl as string, revoke: false, loading: false, error: null, broken: false });
      return () => {
        cancelled = true;
      };
    }

    setView({ ...IDLE, loading: true });
    apiClient
      .get<Blob>(`/v1/receitas/${receita.id}/anexo`, { responseType: 'blob' })
      .then((res) => {
        if (cancelled) return;
        const blobUrl = URL.createObjectURL(res.data);
        blobRef.current = blobUrl;
        setView({ src: blobUrl, revoke: true, loading: false, error: null, broken: false });
      })
      .catch(async (e: unknown) => {
        if (cancelled) return;
        // responseType blob → o ProblemDetail chega como Blob; extrai a mensagem real
        let detail: string | null = null;
        const problem = e instanceof ApiError ? (e.problem as unknown as Blob | undefined) : undefined;
        if (problem && typeof problem.text === 'function') {
          try {
            const parsed = JSON.parse(await problem.text()) as {
              detail?: string;
              title?: string;
              message?: string;
            };
            detail = parsed.detail || parsed.title || parsed.message || null;
          } catch {
            detail = null;
          }
        }
        setView({
          ...IDLE,
          error: detail || apiErrorMessage(e, 'Falha ao carregar o anexo da receita.'),
        });
      });

    return () => {
      cancelled = true;
      release();
    };
  }, [receita]);

  const handleClose = () => {
    if (view.revoke && view.src) URL.revokeObjectURL(view.src);
    if (blobRef.current) {
      URL.revokeObjectURL(blobRef.current);
      blobRef.current = null;
    }
    setView(IDLE);
    onClose();
  };

  return (
    <Dialog
      open={!!receita}
      onClose={handleClose}
      title="Foto da Receita Oftálmica"
      description="Documento anexado no histórico clínico."
    >
      <div className="space-y-4">
        {view.loading && (
          <p
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 rounded border border-border bg-page px-3 py-6 text-sm text-secondary"
          >
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Carregando anexo do servidor…
          </p>
        )}

        {!view.loading && view.error && (
          <div
            role="alert"
            className="rounded border border-danger-light bg-danger-light px-3 py-3 text-sm text-danger-dark"
          >
            {view.error}
          </div>
        )}

        {!view.loading && !view.error && view.src && (
          <div className="flex max-h-[70vh] items-center justify-center overflow-auto rounded-lg border border-border bg-page p-2">
            {view.broken ? (
              <div className="p-6 text-center text-sm">
                <p className="mb-3 font-semibold text-primary">Documento PDF ou arquivo anexado</p>
                <a
                  href={view.src}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary-dark"
                >
                  Abrir anexo em nova aba
                </a>
              </div>
            ) : (
              <img
                src={view.src}
                alt="Receita Oftálmica"
                className="max-h-[65vh] w-auto rounded object-contain"
                onError={() => setView((v) => ({ ...v, broken: true }))}
              />
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
          {!view.loading && !view.error && view.src ? (
            <a
              href={view.src}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium text-brand hover:underline"
            >
              Abrir imagem em tamanho real
            </a>
          ) : (
            <span />
          )}
          <Button variant="outline" onClick={handleClose}>
            Fechar
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
