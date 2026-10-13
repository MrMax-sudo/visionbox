import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { apiClient } from '@/lib/apiClient';
import { FINANCEIRO_KEYS, useFormasPagamento } from './queries';
import {
  actionErrorMessage,
  baixavel,
  dataBR,
  money,
  saldoDe,
  type ContaReceberDTO,
  type TipoConta,
} from './types';

/** R4 — mesma estratégia do apiClient (crypto.randomUUID com fallback). */
function novoIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** '' → 0; aceita vírgula ou ponto (mesma tolerância do campo de valor). */
function parseValor(input: string): number {
  if (!input.trim()) return 0;
  const valor = Number(input.replace(',', '.'));
  return Number.isFinite(valor) ? valor : 0;
}

/**
 * BaixaContaModal — baixa parcial ou total (§3.3 + V41/D-021).
 *
 * • Contas a Receber: POST /{id}/baixar com {valorPago, desconto, juros,
 *   formaPagamentoId, observacao} — default = saldo em aberto; enviamos o valor
 *   sempre explícito para o operador ver o que está sendo quitado.
 *   Semântica D-021: o que quita o título é valorPago + desconto (desconto =
 *   abatimento sem dinheiro entrar); juros NÃO abatem o título — são receita
 *   extra que entra no caixa junto com valorPago. Client valida
 *   valorPago + desconto <= saldo aberto e desconto/juros >= 0.
 * • Contas a Pagar: backend só lê valorPago (Map<String,String>) — forma/obs e
 *   desconto/juros omitidos (campos nem aparecem).
 * • Idempotência (R4): header Idempotency-Key via crypto.randomUUID(), reutilizado
 *   entre tentativas do MESMO payload (timeout/offline não baixa duas vezes);
 *   qualquer edição de campo gera chave nova.
 */
export function BaixaContaModal({
  open,
  onClose,
  tipo,
  conta,
}: {
  open: boolean;
  onClose: () => void;
  tipo: TipoConta;
  conta: ContaReceberDTO | null;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [valorInput, setValorInput] = React.useState('');
  const [descontoInput, setDescontoInput] = React.useState('');
  const [jurosInput, setJurosInput] = React.useState('');
  const [formaId, setFormaId] = React.useState('');
  const [observacao, setObservacao] = React.useState('');
  const [erro, setErro] = React.useState<string | null>(null);

  const saldoAberto = conta ? saldoDe(conta) : 0;

  // Chave de idempotência por payload — nova a cada edição, mantida entre retries.
  const idemKeyRef = React.useRef('');
  React.useEffect(() => {
    idemKeyRef.current = novoIdempotencyKey();
  }, [open, conta?.id, valorInput, descontoInput, jurosInput, formaId, observacao]);

  // Reset do formulário ao abrir / trocar de título.
  React.useEffect(() => {
    if (open && conta) {
      setValorInput(saldoAberto.toFixed(2));
      setDescontoInput('');
      setJurosInput('');
      setFormaId('');
      setObservacao('');
      setErro(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, conta?.id]);

  const formasQuery = useFormasPagamento();

  const baixarMutation = useMutation({
    mutationFn: async () => {
      if (!conta) throw new Error('Nenhum título selecionado');
      const valor = parseValor(valorInput);
      const desconto = parseValor(descontoInput);
      const juros = parseValor(jurosInput);
      const valorStr = valor.toFixed(2);
      const headers = { 'Idempotency-Key': idemKeyRef.current };

      if (tipo === 'receber') {
        const body: Record<string, string> = { valorPago: valorStr };
        // V41/D-021: só viajam quando > 0 (default zero no backend).
        if (desconto > 0) body.desconto = desconto.toFixed(2);
        if (juros > 0) body.juros = juros.toFixed(2);
        if (formaId) body.formaPagamentoId = formaId;
        if (observacao.trim()) body.observacao = observacao.trim();
        const res = await apiClient.post(
          `/v1/financeiro/contas-receber/${conta.id}/baixar`,
          body,
          { headers },
        );
        return res.data as ContaReceberDTO;
      }

      const res = await apiClient.post(
        `/v1/financeiro/contas-pagar/${conta.id}/baixar`,
        { valorPago: valorStr },
        { headers },
      );
      return res.data as ContaReceberDTO;
    },
    // Contexto entregue ao onSuccess: desconto da baixa que acabou de ser enviada.
    onMutate: () => ({ desconto: parseValor(descontoInput) }),
    onSuccess: (contaAtualizada, _vars, context) => {
      queryClient.invalidateQueries({ queryKey: FINANCEIRO_KEYS.raiz });
      if (conta) {
        queryClient.invalidateQueries({ queryKey: FINANCEIRO_KEYS.pagamentos(conta.id) });
      }
      const pagoTotal = (contaAtualizada?.status ?? '') === 'PAGO';
      const desconto = (context as { desconto?: number } | undefined)?.desconto ?? 0;
      toast({
        variant: 'success',
        title: pagoTotal
          ? desconto > 0
            ? 'Título quitado com desconto'
            : 'Título quitado'
          : 'Baixa parcial registrada',
        description: pagoTotal
          ? desconto > 0
            ? `Desconto de ${money(desconto)} concedido — saldo zerado (status PAGO).`
            : 'Saldo zerado — status PAGO.'
          : `Saldo restante: ${money(saldoDe(contaAtualizada))} (status PARCIAL).`,
      });
      onClose();
    },
    onError: (err) => {
      setErro(actionErrorMessage(err));
      // Sem resposta (timeout/offline): deps do efeito não mudaram, então a
      // MESMA Idempotency-Key é reenviada no retry — baixa nunca duplica.
      toast({
        variant: 'destructive',
        title: 'Não foi possível registrar a baixa',
        description: actionErrorMessage(err),
      });
    },
  });

  if (!conta) return null;

  const titulo = conta.descricao ?? conta.numeroDocumento ?? conta.id;
  const valor = parseValor(valorInput);
  const desconto = parseValor(descontoInput);
  const juros = parseValor(jurosInput);
  const valorValido = valor > 0;
  const abatido = valor + desconto;
  const excedeSaldo = valorValido && abatido > saldoAberto + 0.005;
  const valoresNegativos = desconto < -0.0001 || juros < -0.0001;
  const novoSaldo = valorValido ? Math.max(saldoAberto - abatido, 0) : saldoAberto;
  const quitaTotal = valorValido && novoSaldo < 0.005;
  const entradaCaixa = valor + juros;
  const podeEnviar =
    baixavel(conta) &&
    valorValido &&
    !excedeSaldo &&
    !valoresNegativos &&
    !baixarMutation.isPending;

  const confirmar = () => {
    if (!valorValido) {
      setErro('Informe um valor maior que zero (use vírgula ou ponto para centavos).');
      return;
    }
    if (valoresNegativos) {
      setErro('Desconto e juros não podem ser negativos.');
      return;
    }
    if (excedeSaldo) {
      setErro(
        `Valor + desconto (${money(abatido)}) excede o saldo em aberto (${money(saldoAberto)}).`,
      );
      return;
    }
    setErro(null);
    baixarMutation.mutate();
  };

  const usarSaldoIntegral = () => {
    // Quita com o desconto digitado: o dinheiro necessário é saldo − desconto.
    const necessario = Math.max(saldoAberto - desconto, 0.01);
    setValorInput(necessario.toFixed(2));
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={tipo === 'receber' ? 'Baixar conta a receber' : 'Baixar conta a pagar'}
      description={
        tipo === 'receber'
          ? 'Registre uma baixa parcial ou total — toda baixa entra no histórico do título.'
          : 'Informe o valor pago. O backend de contas a pagar registra apenas o valor da baixa.'
      }
      className="max-w-[520px]"
    >
      <div className="space-y-4">
        {/* Resumo do título — só dados que a API retorna */}
        <div className="grid grid-cols-2 gap-2 rounded-card border border-border bg-page p-3 text-xs sm:grid-cols-4">
          <div>
            <p className="text-muted">Título</p>
            <p className="truncate font-medium text-primary" title={titulo}>
              {titulo}
            </p>
          </div>
          <div>
            <p className="text-muted">Vencimento</p>
            <p className="font-medium text-primary">{dataBR(conta.vencimento)}</p>
          </div>
          <div>
            <p className="text-muted">Valor original</p>
            <p className="font-medium tabular-nums text-primary">{money(conta.valor)}</p>
          </div>
          <div>
            <p className="text-muted">Já pago</p>
            <p className="font-medium tabular-nums text-primary">{money(conta.valorPago)}</p>
          </div>
        </div>

        <Field
          label="Valor desta baixa (R$)"
          id="baixa-valor"
          required
          hint={`Saldo em aberto: ${money(saldoAberto)}. Deixe o valor cheio para quitar o título.`}
          error={erro}
        >
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            value={valorInput}
            onChange={(e) => setValorInput(e.target.value)}
            disabled={baixarMutation.isPending}
            className="font-mono"
          />
        </Field>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={usarSaldoIntegral}
            disabled={baixarMutation.isPending}
          >
            Usar saldo integral ({money(saldoAberto)})
          </Button>
        </div>

        {tipo === 'receber' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Desconto (R$)"
              id="baixa-desconto"
              hint="Abate o título junto com o valor pago — não entra no caixa. Opcional."
            >
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={descontoInput}
                onChange={(e) => setDescontoInput(e.target.value)}
                disabled={baixarMutation.isPending}
                className="font-mono"
              />
            </Field>
            <Field
              label="Juros (R$)"
              id="baixa-juros"
              hint="Mora/multa paga pelo cliente — não abate o título, entra no caixa. Opcional."
            >
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={jurosInput}
                onChange={(e) => setJurosInput(e.target.value)}
                disabled={baixarMutation.isPending}
                className="font-mono"
              />
            </Field>
          </div>
        )}

        {tipo === 'receber' && (
          <Field
            label="Forma de pagamento"
            id="baixa-forma"
            hint="Vinculada ao histórico e ao movimento de caixa (se houver caixa aberto)."
          >
            {formasQuery.isLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : formasQuery.isError ? (
              <p role="alert" className="text-xs text-danger-dark">
                Não foi possível carregar as formas de pagamento — a baixa pode seguir sem forma.
              </p>
            ) : (
              <Select
                id="baixa-forma"
                value={formaId}
                onChange={(e) => setFormaId(e.target.value)}
                disabled={baixarMutation.isPending}
              >
                <option value="">— Sem forma especificada —</option>
                {(formasQuery.data ?? []).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}

        {tipo === 'receber' && (
          <Field label="Observação" id="baixa-observacao">
            <Textarea
              rows={2}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex.: cliente pagou a 1ª parcela em dinheiro"
              disabled={baixarMutation.isPending}
              className="min-h-[56px]"
            />
          </Field>
        )}

        {/* Projeção pós-baixa — derivada localmente, exibida antes do POST */}
        <div
          role="status"
          className={`space-y-1 rounded-card border p-3 text-xs ${
            quitaTotal
              ? 'border-success-light bg-success-light text-success-dark'
              : 'border-warning-light bg-warning-light text-warning-dark'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-medium">
              <AlertCircle className="h-3.5 w-3.5" aria-hidden />
              {quitaTotal
                ? desconto > 0
                  ? `Quita o título com desconto de ${money(desconto)} (status PAGO)`
                  : 'Quita o título (status PAGO)'
                : 'Baixa parcial (status PARCIAL)'}
            </span>
            <span className="font-semibold tabular-nums">Novo saldo: {money(novoSaldo)}</span>
          </div>
          {juros > 0 && (
            <p className="tabular-nums">
              Juros de {money(juros)} não abatem o título — entram no caixa junto com o valor pago
              (entrada total: {money(entradaCaixa)}).
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button variant="outline" onClick={onClose} disabled={baixarMutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={!podeEnviar}>
            {baixarMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden />
            )}
            Confirmar baixa
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
