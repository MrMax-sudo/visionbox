import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileUp, Loader2, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { ApiError } from '@/lib/apiClient';
import {
  importarXmlNfe,
  type CompraDTO,
} from '@/lib/comprasService';

/**
 * UploadXmlCard — upload do XML NF-e de entrada via clique ou drag & drop
 * (§3.4). Multipart → POST /v1/compras/importar-xml.
 *
 * Estados completos: idle / arquivo inválido / enviando (spinner) / erro
 * (ProblemDetail) / sucesso (modal de resultado controlado pela página).
 */
export function UploadXmlCard({ onImportada }: { onImportada: (compra: CompraDTO) => void }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const importarMutation = useMutation({
    mutationFn: importarXmlNfe,
    onSuccess: (compra) => {
      setErro(null);
      queryClient.invalidateQueries({ queryKey: ['compras'] });
      toast({
        variant: 'success',
        title: 'NF-e importada',
        description: `Nota ${compra.numero ?? ''} de ${compra.fornecedorNome ?? 'fornecedor'} processada.`,
      });
      onImportada(compra);
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof ApiError
          ? err.problem?.detail || err.problem?.message || err.message
          : 'Falha ao importar o XML. Tente novamente.';
      setErro(msg);
      toast({ variant: 'destructive', title: 'Falha na importação', description: msg });
    },
  });

  function validarArquivo(file: File | undefined | null): File | null {
    if (!file) return null;
    const nome = file.name.toLowerCase();
    const tipoOk = file.type === 'text/xml' || file.type === 'application/xml';
    if (!nome.endsWith('.xml') && !tipoOk) {
      setErro('Selecione um arquivo XML da NF-e (extensão .xml).');
      return null;
    }
    return file;
  }

  function iniciarImportacao(file: File) {
    setErro(null);
    importarMutation.mutate(file);
  }

  function selecionarDoDisco() {
    setErro(null);
    inputRef.current?.click();
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = validarArquivo(e.target.files?.[0]);
    if (file) iniciarImportacao(file);
    // permite re-selecionar o mesmo arquivo após erro
    e.target.value = '';
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const file = validarArquivo(e.dataTransfer?.files?.[0]);
    if (file) iniciarImportacao(file);
  }

  const enviando = importarMutation.isPending;

  return (
    <section
      aria-label="Importar XML de NF-e de entrada"
      className="rounded-card border border-border bg-card p-5 shadow-soft"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-primary">Importar XML NF-e de entrada</h2>
          <p className="mt-0.5 text-xs text-secondary">
            Nota do fornecedor (Essilor, Hoya, Zeiss, distribuidores…): itens entram no catálogo,
            o estoque é atualizado e os títulos caem no Contas a Pagar.
          </p>
        </div>
        <span className="rounded-full bg-secondary-light px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-secondary-dark">
          Módulo COMPRAS_XML
        </span>
      </div>

      {/* Dropzone — clicável e operável por teclado (Enter/Espaço abre o seletor) */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Selecionar ou arrastar arquivo XML da NF-e"
        aria-disabled={enviando}
        onClick={() => !enviando && selecionarDoDisco()}
        onKeyDown={(e) => {
          if (enviando) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selecionarDoDisco();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!enviando) setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-card border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragActive
            ? 'border-primary bg-primary-light'
            : 'border-border bg-page hover:border-primary hover:bg-primary-light/50'
        } ${enviando ? 'cursor-not-allowed opacity-70' : ''}`}
      >
        {enviando ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-brand" aria-hidden />
            <p className="mt-3 text-sm font-medium text-secondary" aria-live="polite">
              Processando XML e atualizando estoque…
            </p>
            <p className="text-xs text-muted">Itens, custos e títulos em Contas a Pagar</p>
          </>
        ) : (
          <>
            <UploadCloud className="h-8 w-8 text-brand" aria-hidden />
            <p className="mt-3 text-sm font-medium text-primary">
              Arraste o XML aqui ou clique para selecionar
            </p>
            <p className="text-xs text-muted">Arquivo .xml da NF-e emitida pelo fornecedor</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".xml,text/xml,application/xml"
          className="sr-only"
          onChange={onInputChange}
          disabled={enviando}
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>

      <p aria-live="polite" className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-muted">
        <FileUp className="h-3 w-3 shrink-0" aria-hidden />
        Importação idempotente: a mesma chave de acesso (44 dígitos) não é importada duas vezes.
      </p>

      {erro && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded border border-danger-light bg-danger-light px-3 py-2 text-xs text-danger-dark"
        >
          <span className="min-w-0 flex-1">{erro}</span>
          <button
            type="button"
            onClick={() => setErro(null)}
            className="shrink-0 font-semibold underline underline-offset-2"
          >
            fechar
          </button>
        </div>
      )}

      <div className="mt-3 flex justify-end">
        <Button size="sm" onClick={selecionarDoDisco} disabled={enviando} aria-busy={enviando}>
          {enviando ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <UploadCloud className="mr-2 h-4 w-4" aria-hidden />
          )}
          Selecionar XML
        </Button>
      </div>
    </section>
  );
}
