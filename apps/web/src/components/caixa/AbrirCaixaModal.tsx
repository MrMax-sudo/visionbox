import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Loader2, Unlock } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { useToast } from '@/components/ui/use-toast';
import {
  abrirCaixa,
  invalidarQueriesCaixa,
  mensagemErroCaixa,
  parseValorMonetario,
  type CaixaSessao,
} from '@/lib/caixaService';
import { useAuthStore } from '@/stores/authStore';

interface AbrirCaixaModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Abrir Caixa — fundo de troco inicial + operador responsável (Fase 2).
 * Visual compatível com a aba "Abrir" do ControleCaixaModal do PDV.
 */
export function AbrirCaixaModal({ open, onClose }: AbrirCaixaModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const user = useAuthStore((s) => s.user);

  const [saldoInicialInput, setSaldoInicialInput] = React.useState('');
  const [operadorNomeInput, setOperadorNomeInput] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setSaldoInicialInput('');
      setOperadorNomeInput(user?.nome || '');
      setFormError(null);
    }
  }, [open, user]);

  const abrirMutation = useMutation({
    mutationFn: async (): Promise<CaixaSessao> => {
      const valor = parseValorMonetario(saldoInicialInput);
      if (valor == null || valor < 0) throw new Error('Saldo inicial inválido');
      return abrirCaixa({
        saldoInicial: valor,
        identificacaoCaixa: 'CAIXA_01',
        operadorNome: operadorNomeInput.trim() || user?.nome || 'Operador',
      });
    },
    onSuccess: (sessao) => {
      invalidarQueriesCaixa(queryClient);
      setFormError(null);
      toast({
        title: 'Caixa aberto',
        description: `Fundo de troco: ${sessao.saldoInicial.toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        })}`,
      });
      onClose();
    },
    onError: (err) => {
      setFormError(mensagemErroCaixa(err, 'Erro ao abrir caixa'));
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const valor = parseValorMonetario(saldoInicialInput);
    if (valor == null || valor < 0) {
      setFormError('Informe um fundo de troco inicial válido (0 ou mais).');
      return;
    }
    abrirMutation.mutate();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Abrir Caixa"
      description="Defina o fundo de troco inicial da gaveta para liberar as operações de venda."
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

        <Field
          label="Fundo de Troco Inicial (R$)"
          id="caixa-turnos-saldo-inicial"
          hint="Valor físico em gaveta na abertura."
          required
        >
          <Input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={saldoInicialInput}
            onChange={(e) => setSaldoInicialInput(e.target.value)}
            placeholder="0.00"
            className="font-mono"
            autoFocus
          />
        </Field>

        <Field label="Operador Responsável" id="caixa-turnos-operador">
          <Input
            type="text"
            value={operadorNomeInput}
            onChange={(e) => setOperadorNomeInput(e.target.value)}
            placeholder="Nome do operador"
          />
        </Field>

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={abrirMutation.isPending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={abrirMutation.isPending}>
            {abrirMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Unlock className="mr-2 h-4 w-4" aria-hidden />
            )}
            Confirmar Abertura
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
