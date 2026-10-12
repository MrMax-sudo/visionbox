import * as React from 'react';
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { CheckCircle2, FileSpreadsheet, Loader2, Upload } from 'lucide-react';

import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/apiClient';
import { cn } from '@/lib/utils';

/**
 * CsvImportDialog — importação de base em lote (Clientes + Catálogo).
 *
 * Suporta arquivos Excel (.xlsx, .xls) e CSV (.csv) com download de modelos.
 */
export type CsvImportResult = {
  processadosComSucesso: number;
  totalErros: number;
  erros: string[];
  /** Clientes usa `totalRegistros`, Catálogo usa `totalLinhas` */
  totalRegistros?: number;
  totalLinhas?: number;
};

export interface CsvImportDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  /** ex.: `/v1/clientes/importar-csv` */
  endpoint: string;
  /** query keys a invalidar após sucesso (ex.: [['clientes']]) */
  invalidateKeys: QueryKey[];
  /** linha de cabeçalho sugerida (mono) */
  columns: string;
  /** linha de exemplo sugerida (mono) */
  example: string;
  /** plural do item: 'clientes' | 'produtos' */
  itemLabel: string;
  /** verbo do resultado: 'importados com sucesso' | 'processados com sucesso' */
  successVerb: string;
  /** rótulo do erro: 'linhas com inconsistência' | 'linhas com erro' */
  errorLabel: string;
  /** nota opcional do guia (ex.: sanitização automática de CPF/telefone) */
  sanitizeNote?: string;
}

export function CsvImportDialog({
  open,
  onClose,
  title,
  description,
  endpoint,
  invalidateKeys,
  columns,
  example,
  itemLabel,
  successVerb,
  errorLabel,
  sanitizeNote,
}: CsvImportDialogProps) {
  const queryClient = useQueryClient();
  const [file, setFile] = React.useState<File | null>(null);
  const [result, setResult] = React.useState<CsvImportResult | null>(null);
  const [downloading, setDownloading] = React.useState<'xlsx' | 'csv' | null>(null);

  // ao reabrir, começa limpo
  React.useEffect(() => {
    if (open) {
      setFile(null);
      setResult(null);
    }
  }, [open]);

  const importMutation = useMutation({
    mutationFn: async (upload: File) => {
      const formData = new FormData();
      formData.append('file', upload);
      const res = await apiClient.post<CsvImportResult>(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onSuccess: (data) => {
      setResult(data);
      invalidateKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
    },
  });

  const baixarModelo = async (formato: 'xlsx' | 'csv') => {
    try {
      setDownloading(formato);
      const baseUrl = endpoint.replace('/importar-csv', '');
      const response = await apiClient.get(`${baseUrl}/modelo-importacao?formato=${formato}`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], {
        type:
          formato === 'xlsx'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'text/csv;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `modelo-${itemLabel.toLowerCase()}.${formato}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback local se a rota de template não responder
      const csvContent = '\uFEFF' + `${columns}\n${example}\n`;
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `modelo-${itemLabel.toLowerCase()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={title} description={description}>
      <div className="space-y-4">
        <div className="space-y-2 rounded border border-border bg-page p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-primary">Modelos para preenchimento:</p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5 border-emerald-600/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 font-medium"
                onClick={() => baixarModelo('xlsx')}
                disabled={downloading !== null}
              >
                {downloading === 'xlsx' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
                )}
                Modelo Excel (.xlsx)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                onClick={() => baixarModelo('csv')}
                disabled={downloading !== null}
              >
                {downloading === 'csv' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5 rotate-180" aria-hidden />
                )}
                Modelo CSV (.csv)
              </Button>
            </div>
          </div>
          <p className="break-all font-mono text-[11px] text-secondary">{columns}</p>
          <p className="pt-1 text-[10px] text-muted">
            * Aceita arquivos <strong>Excel (.xlsx, .xls)</strong> e <strong>CSV (.csv)</strong>.
            {sanitizeNote ? ` ${sanitizeNote}` : ''} Exemplo de linha: <br />
            <code className="break-all text-brand">{example}</code>
          </p>
        </div>

        <label
          htmlFor="csv-import-file"
          className="flex cursor-pointer flex-col items-center justify-center rounded border-2 border-dashed border-border bg-card p-6 text-center transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Upload className="mb-2 h-8 w-8 text-muted" aria-hidden />
          <span className="text-sm font-medium text-primary">
            {file ? file.name : 'Clique para selecionar planilha Excel (.xlsx, .xls) ou CSV (.csv)'}
          </span>
          <span className="mt-1 text-xs text-muted">
            {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Formatos suportados: .xlsx, .xls, .csv • Tamanho máx.: 10MB'}
          </span>
          <input
            id="csv-import-file"
            type="file"
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setFile(f);
                setResult(null);
              }
            }}
          />
        </label>

        {importMutation.isPending && (
          <p className="flex items-center gap-2 text-sm text-info">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Processando e validando {itemLabel} da
            planilha...
          </p>
        )}

        {importMutation.isError && (
          <p role="alert" className="rounded border border-danger-light bg-danger-light px-3 py-2 text-sm text-danger-dark">
            {(importMutation.error as Error)?.message ?? `Falha ao importar ${itemLabel}`}
          </p>
        )}

        {result && (
          <div className="space-y-2 rounded border border-border bg-page p-3 text-xs">
            <div className="flex items-center gap-2 font-semibold text-success">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              <span>
                Resultado: {result.processadosComSucesso} {itemLabel} {successVerb}!
              </span>
            </div>
            {result.totalErros > 0 && (
              <div className="space-y-1 text-danger-dark">
                <p className="font-semibold">
                  {result.totalErros} {errorLabel}:
                </p>
                <ul className="max-h-32 list-disc space-y-0.5 overflow-auto pl-4 text-[11px]">
                  {result.erros.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className={cn('flex justify-end gap-2 border-t border-border pt-3')}>
          <Button variant="outline" onClick={onClose}>
            {result ? 'Concluir' : 'Cancelar'}
          </Button>
          <Button
            variant="primary"
            disabled={!file || importMutation.isPending}
            onClick={() => {
              if (file) importMutation.mutate(file);
            }}
          >
            {importMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            {importMutation.isPending ? 'Importando...' : 'Iniciar Importação'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
