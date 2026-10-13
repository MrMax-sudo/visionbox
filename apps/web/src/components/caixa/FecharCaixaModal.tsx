import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Loader2, Lock, Printer } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  fecharCaixa,
  formatarBRL,
  formatarDataHora,
  invalidarQueriesCaixa,
  mensagemErroCaixa,
  parseValorMonetario,
  relatorioFechamento,
  type CaixaSessao,
  type ClassificacaoDiferenca,
} from '@/lib/caixaService';
import { imprimirFechamentoCaixa } from '@/lib/caixaPrint';
import { useEmpresaStore } from '@/stores/empresaStore';

interface FecharCaixaModalProps {
  open: boolean;
  onClose: () => void;
  sessao: CaixaSessao | null;
}

function badgeClassificacao(classificacao?: ClassificacaoDiferenca | null) {
  if (classificacao === 'SOBRA') return 'success' as const;
  if (classificacao === 'QUEBRA') return 'danger' as const;
  return 'secondary' as const;
}

/**
 * Fechamento Cego de Caixa — Fase 2 Robustez ERP.
 * Etapa 1 (conferência): operador digita APENAS o valor contado — o saldo esperado
 * do sistema não é exibido (cego). Etapa 2 (resultado): o backend apura e devolve a
 * diferença classificada (SOBRA/QUEBRA/EXATO) e a UI oferece o cupom 80mm.
 */
export function FecharCaixaModal({ open, onClose, sessao }: FecharCaixaModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const empresa = useEmpresaStore((s) => s.empresa);

  const [etapa, setEtapa] = React.useState<'conferencia' | 'resultado'>('conferencia');
  const [saldoInformadoInput, setSaldoInformadoInput] = React.useState('');
  const [obsInput, setObsInput] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);
  const [resultado, setResultado] = React.useState<CaixaSessao | null>(null);

  React.useEffect(() => {
    if (open) {
      setEtapa('conferencia');
      setSaldoInformadoInput('');
      setObsInput('');
      setFormError(null);
      setResultado(null);
    }
  }, [open]);

  const fecharMutation = useMutation({
    mutationFn: async (payload: { saldoInformado: number; observacao?: string }) => {
      return fecharCaixa(payload);
    },
    onSuccess: (sessaoFechada) => {
      invalidarQueriesCaixa(queryClient);
      setResultado(sessaoFechada);
      setEtapa('resultado');
      setFormError(null);
      toast({
        title: 'Caixa fechado',
        description:
          sessaoFechada.diferencaFechamento != null
            ? `Diferença de conferência: ${formatarBRL(sessaoFechada.diferencaFechamento)} (${sessaoFechada.classificacaoDiferenca ?? '—'})`
            : 'Sessão encerrada.',
      });
    },
    onError: (err) => {
      setFormError(mensagemErroCaixa(err, 'Erro ao fechar caixa'));
    },
  });

  const imprimirMutation = useMutation({
    mutationFn: async () => {
      if (!resultado) throw new Error('Fechamento ainda não confirmado.');
      return relatorioFechamento(resultado.id);
    },
    onSuccess: (relatorio) => {
      imprimirFechamentoCaixa(relatorio, empresa);
      toast({ title: 'Impressão disparada', description: 'Fechamento de caixa 80mm enviado à impressora.' });
    },
    onError: (err) => {
      toast({
        title: 'Falha ao imprimir',
        description: mensagemErroCaixa(err, 'Não foi possível gerar o cupom de fechamento.'),
      });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const valor = parseValorMonetario(saldoInformadoInput);
    if (valor == null || valor < 0) {
      setFormError('Informe o valor total contado na gaveta (0 ou mais).');
      return;
    }
    fecharMutation.mutate({
      saldoInformado: valor,
      observacao: obsInput.trim() || undefined,
    });
  }

  if (!sessao) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Fechar Caixa — Conferência Cega"
      description={
        etapa === 'conferencia'
          ? 'Conte o dinheiro físico na gaveta e digite o valor exato. O sistema registra sobra ou falta.'
          : 'Resultado da conferência cega registrado pelo sistema.'
      }
      className="max-w-[520px]"
    >
      {etapa === 'conferencia' ? (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {formError && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-card border border-danger-light bg-danger-light p-3 text-xs text-danger-dark"
            >
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
              <span>{formError}</span>
            </div>
          )}

          <div className="rounded-card border border-warning bg-warning-light p-3 text-xs text-warning-dark">
            <p className="font-semibold">Conferência Cega de Valores</p>
            <p className="mt-0.5 text-[11px]">
              Conte o dinheiro físico na gaveta e digite o valor exato. O sistema compara com o
              apurado e registra qualquer sobra ou falta — sem exibir o esperado antes da confirmação.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded border border-border bg-page p-2">
              <span className="text-[10px] uppercase text-muted">Caixa</span>
              <p className="truncate text-xs font-semibold">{sessao.identificacaoCaixa}</p>
            </div>
            <div className="rounded border border-border bg-page p-2">
              <span className="text-[10px] uppercase text-muted">Aberto em</span>
              <p className="text-xs font-semibold">{formatarDataHora(sessao.abertoEm)}</p>
            </div>
          </div>

          <Field
            label="Total em Dinheiro Físico Contado (R$)"
            id="caixa-turnos-saldo-fechamento"
            hint="Contagem cega: o sistema compara com o saldo apurado."
            required
          >
            <Input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={saldoInformadoInput}
              onChange={(e) => setSaldoInformadoInput(e.target.value)}
              placeholder="Ex: 450.00"
              className="font-mono"
              autoFocus
            />
          </Field>

          <Field label="Observações do Fechamento" id="caixa-turnos-obs-fechamento">
            <Input
              type="text"
              value={obsInput}
              onChange={(e) => setObsInput(e.target.value)}
              placeholder="Ex: Troco correto, comprovantes arquivados"
            />
          </Field>

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={fecharMutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" disabled={fecharMutation.isPending}>
              {fecharMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Lock className="mr-2 h-4 w-4" aria-hidden />
              )}
              Fechar Caixa Agora
            </Button>
          </div>
        </form>
      ) : (
        resultado && (
          <div className="space-y-4" role="status" aria-live="polite">
            <div className="flex items-center gap-3 rounded-card border border-border bg-page p-3">
              <CheckCircle2 className="h-8 w-8 shrink-0 text-success" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-primary">
                  Turno encerrado — {resultado.identificacaoCaixa}
                </p>
                <p className="text-xs text-secondary">
                  {resultado.operadorNome || 'Operador'} • {formatarDataHora(resultado.fechadoEm)}
                </p>
              </div>
              <Badge
                variant={badgeClassificacao(resultado.classificacaoDiferenca)}
                className="ml-auto shrink-0"
              >
                {resultado.classificacaoDiferenca ?? 'ENCERRADO'}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded border border-border bg-card p-2">
                <span className="text-[10px] uppercase text-muted">Apurado (Sistema)</span>
                <p className="font-mono text-xs font-semibold">
                  {formatarBRL(resultado.valorFechamentoSistema ?? resultado.saldoEsperado)}
                </p>
              </div>
              <div className="rounded border border-border bg-card p-2">
                <span className="text-[10px] uppercase text-muted">Contado (Informado)</span>
                <p className="font-mono text-xs font-semibold">
                  {formatarBRL(resultado.saldoInformadoFechamento)}
                </p>
              </div>
              <div
                className={`rounded border p-2 ${
                  resultado.classificacaoDiferenca === 'QUEBRA'
                    ? 'border-danger-light bg-danger-light'
                    : resultado.classificacaoDiferenca === 'SOBRA'
                      ? 'border-warning-light bg-warning-light'
                      : 'border-success-light bg-success-light'
                }`}
              >
                <span className="text-[10px] uppercase text-muted">Diferença</span>
                <p
                  className={`font-mono text-xs font-bold ${
                    resultado.classificacaoDiferenca === 'QUEBRA'
                      ? 'text-danger-dark'
                      : resultado.classificacaoDiferenca === 'SOBRA'
                        ? 'text-warning-dark'
                        : 'text-success-dark'
                  }`}
                >
                  {formatarBRL(resultado.diferencaFechamento)}
                </p>
              </div>
            </div>

            {resultado.observacaoFechamento && (
              <div className="rounded border border-border bg-page p-3 text-xs">
                <span className="font-semibold text-secondary">Observações: </span>
                <span className="text-secondary">{resultado.observacaoFechamento}</span>
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => imprimirMutation.mutate()}
                disabled={imprimirMutation.isPending}
                className="gap-1.5"
              >
                {imprimirMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Printer className="h-4 w-4" aria-hidden />
                )}
                Imprimir Fechamento (80mm)
              </Button>
              <Button type="button" onClick={onClose}>
                Concluir
              </Button>
            </div>
          </div>
        )
      )}
    </Dialog>
  );
}
