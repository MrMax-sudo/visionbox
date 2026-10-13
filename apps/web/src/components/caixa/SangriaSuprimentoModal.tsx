import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowDownCircle, ArrowUpCircle, Loader2 } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { useToast } from '@/components/ui/use-toast';
import {
  formatarBRL,
  invalidarQueriesCaixa,
  mensagemErroCaixa,
  parseValorMonetario,
  sangria,
  suprimento,
  type CaixaSessao,
} from '@/lib/caixaService';
import { useAuthStore } from '@/stores/authStore';

type TipoMovimentacao = 'SANGRIA' | 'SUPRIMENTO';

interface SangriaSuprimentoModalProps {
  open: boolean;
  onClose: () => void;
  tipo: TipoMovimentacao;
  sessao: CaixaSessao | null;
}

/**
 * Sangria (retirada) / Suprimento (aporte) de gaveta — Fase 2 Robustez ERP.
 * Motivo e valor obrigatórios (auditoria); endpoint dedicado /caixa/{sangria|suprimento}
 * com Idempotency-Key (R4). Visual compatível com as abas do ControleCaixaModal do PDV.
 */
export function SangriaSuprimentoModal({ open, onClose, tipo, sessao }: SangriaSuprimentoModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const user = useAuthStore((s) => s.user);

  const [valorInput, setValorInput] = React.useState('');
  const [motivoInput, setMotivoInput] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setValorInput('');
      setMotivoInput('');
      setFormError(null);
    }
  }, [open, tipo]);

  const movMutation = useMutation({
    mutationFn: async (payload: { valor: number; motivo: string; usuarioNome: string }) => {
      return tipo === 'SANGRIA'
        ? sangria(payload)
        : suprimento(payload);
    },
    onSuccess: (sessaoAtualizada) => {
      invalidarQueriesCaixa(queryClient);
      setFormError(null);
      toast({
        title: tipo === 'SANGRIA' ? 'Sangria registrada' : 'Suprimento registrado',
        description: `Saldo esperado em gaveta: ${formatarBRL(sessaoAtualizada.saldoEsperado)}`,
      });
      onClose();
    },
    onError: (err) => {
      setFormError(
        mensagemErroCaixa(err, tipo === 'SANGRIA' ? 'Erro ao registrar sangria' : 'Erro ao registrar suprimento'),
      );
    },
  });

  const isSangria = tipo === 'SANGRIA';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const valor = parseValorMonetario(valorInput);
    if (valor == null || valor <= 0) {
      setFormError('Informe um valor válido maior que zero.');
      return;
    }
    const motivo = motivoInput.trim();
    if (!motivo) {
      setFormError('O motivo é obrigatório para auditoria de movimentações de gaveta.');
      return;
    }
    if (isSangria && sessao && valor > sessao.saldoEsperado) {
      setFormError(
        `Valor da sangria excede o saldo disponível em gaveta (${formatarBRL(sessao.saldoEsperado)}).`,
      );
      return;
    }
    movMutation.mutate({
      valor,
      motivo,
      usuarioNome: user?.nome || sessao?.operadorNome || 'Operador',
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isSangria ? 'Sangria de Gaveta (Retirada)' : 'Suprimento de Gaveta (Troco)'}
      description={
        isSangria
          ? 'Recolhimento de dinheiro da gaveta — motivo obrigatório para auditoria.'
          : 'Entrada de dinheiro na gaveta para reforço de troco — motivo obrigatório para auditoria.'
      }
      className="max-w-[480px]"
    >
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

        {sessao && (
          <div className="flex items-center justify-between rounded-card border border-border bg-page p-3 text-xs">
            <span className="text-secondary">
              Saldo esperado em gaveta ({sessao.identificacaoCaixa})
            </span>
            <span className="font-mono font-bold text-success">{formatarBRL(sessao.saldoEsperado)}</span>
          </div>
        )}

        <Field
          label={isSangria ? 'Valor da Retirada / Sangria (R$)' : 'Valor do Reforço / Suprimento (R$)'}
          id={`caixa-turnos-valor-${tipo.toLowerCase()}`}
          hint={isSangria ? 'Recolhimento para cofre.' : 'Entrada de dinheiro para troco.'}
          required
        >
          <Input
            type="number"
            step="0.01"
            min="0.01"
            inputMode="decimal"
            value={valorInput}
            onChange={(e) => setValorInput(e.target.value)}
            placeholder={isSangria ? 'Ex: 200.00' : 'Ex: 50.00'}
            className="font-mono"
            autoFocus
          />
        </Field>

        <Field
          label={isSangria ? 'Motivo do Recolhimento' : 'Motivo / Justificativa'}
          id={`caixa-turnos-motivo-${tipo.toLowerCase()}`}
          hint="Registrado no extrato do turno para auditoria."
          required
        >
          <Input
            type="text"
            value={motivoInput}
            onChange={(e) => setMotivoInput(e.target.value)}
            placeholder={
              isSangria
                ? 'Ex: Sangria para cofre principal / pagamento fornecedor'
                : 'Ex: Reforço de moedas e notas de R$ 5'
            }
          />
        </Field>

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={movMutation.isPending}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant={isSangria ? 'destructive' : 'default'}
            disabled={movMutation.isPending}
          >
            {movMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : isSangria ? (
              <ArrowDownCircle className="mr-2 h-4 w-4" aria-hidden />
            ) : (
              <ArrowUpCircle className="mr-2 h-4 w-4" aria-hidden />
            )}
            {isSangria ? 'Confirmar Sangria' : 'Registrar Suprimento'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
