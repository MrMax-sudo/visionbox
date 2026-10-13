import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { apiClient } from '@/lib/apiClient';
import { FINANCEIRO_KEYS, useFornecedores } from './queries';
import {
  actionErrorMessage,
  money,
  type ContaPagarDTO,
  type ContaPagarPayload,
} from './types';

const OUTRO_FORNECEDOR = '__outro__';

/**
 * Criação de Conta a Pagar (§3.3 / V34).
 * POST /v1/financeiro/contas-pagar com {fornecedorId?, fornecedor?, valor,
 * vencimento, dataCompetencia?, comprovanteUrl?, descricao?, numeroDocumento?}.
 * Fornecedor vem do cadastro (somente ativos) ou texto livre quando não
 * estiver cadastrado — o backend resolve o nome a partir do vínculo.
 */
export function ContaPagarFormModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [fornecedorId, setFornecedorId] = React.useState('');
  const [fornecedorTexto, setFornecedorTexto] = React.useState('');
  const [descricao, setDescricao] = React.useState('');
  const [numeroDocumento, setNumeroDocumento] = React.useState('');
  const [valorInput, setValorInput] = React.useState('');
  const [vencimento, setVencimento] = React.useState('');
  const [dataCompetencia, setDataCompetencia] = React.useState('');
  const [comprovanteUrl, setComprovanteUrl] = React.useState('');
  const [erro, setErro] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setFornecedorId('');
      setFornecedorTexto('');
      setDescricao('');
      setNumeroDocumento('');
      setValorInput('');
      setVencimento('');
      setDataCompetencia('');
      setComprovanteUrl('');
      setErro(null);
    }
  }, [open]);

  const fornecedoresQuery = useFornecedores();

  const criarMutation = useMutation({
    mutationFn: async () => {
      const valor = Number(valorInput.replace(',', '.'));
      if (!Number.isFinite(valor) || valor <= 0) {
        throw new Error('Informe um valor maior que zero.');
      }
      if (!vencimento) {
        throw new Error('Vencimento é obrigatório.');
      }
      const outro = fornecedorId === OUTRO_FORNECEDOR;
      if (outro && fornecedorTexto.trim().length < 2) {
        throw new Error('Informe o nome do fornecedor (ou escolha um cadastrado).');
      }

      const body: ContaPagarPayload = {
        valor,
        vencimento,
        ...(outro
          ? { fornecedor: fornecedorTexto.trim() }
          : fornecedorId
            ? { fornecedorId }
            : { fornecedor: fornecedorTexto.trim() }),
        ...(descricao.trim() ? { descricao: descricao.trim() } : {}),
        ...(numeroDocumento.trim() ? { numeroDocumento: numeroDocumento.trim() } : {}),
        ...(dataCompetencia ? { dataCompetencia } : {}),
        ...(comprovanteUrl.trim() ? { comprovanteUrl: comprovanteUrl.trim() } : {}),
      };

      const res = await apiClient.post<ContaPagarDTO>('/v1/financeiro/contas-pagar', body);
      return res.data;
    },
    onSuccess: (conta) => {
      queryClient.invalidateQueries({ queryKey: FINANCEIRO_KEYS.raiz });
      toast({
        variant: 'success',
        title: 'Conta a pagar criada',
        description: `${conta.fornecedor ?? 'Fornecedor'} · ${money(conta.valor)} vence ${conta.vencimento}`,
      });
      onClose();
    },
    onError: (err) => {
      setErro(actionErrorMessage(err));
    },
  });

  const ativos = (fornecedoresQuery.data ?? []).filter((f) => f.ativo);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Nova conta a pagar"
      description="Despesas fixas ou variáveis — vincule um fornecedor cadastrado e anexe a chave do comprovante."
      className="max-w-[560px]"
    >
      <div className="space-y-4">
        <Field
          label="Fornecedor"
          id="conta-pagar-fornecedor"
          required
          hint="Fornecedores inativos não aparecem. Use “Outro” para credor avulso."
        >
          {fornecedoresQuery.isLoading ? (
            <Skeleton className="h-9 w-full" />
          ) : fornecedoresQuery.isError ? (
            <p role="alert" className="text-xs text-danger-dark">
              Falha ao carregar fornecedores — cadastre um credor avulso por texto.
            </p>
          ) : (
            <Select
              value={fornecedorId}
              onChange={(e) => setFornecedorId(e.target.value)}
              disabled={criarMutation.isPending}
            >
              <option value="">— Escolha um fornecedor —</option>
              {ativos.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
              <option value={OUTRO_FORNECEDOR}>Outro (digitar)…</option>
            </Select>
          )}
        </Field>

        {(fornecedorId === OUTRO_FORNECEDOR || fornecedoresQuery.isError) && (
          <Field label="Nome do credor" id="conta-pagar-credor" required>
            <Input
              value={fornecedorTexto}
              onChange={(e) => setFornecedorTexto(e.target.value)}
              placeholder="Ex.: Condomínio Ed. Visão"
              disabled={criarMutation.isPending}
            />
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Valor (R$)" id="conta-pagar-valor" required>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              value={valorInput}
              onChange={(e) => setValorInput(e.target.value)}
              placeholder="0.00"
              disabled={criarMutation.isPending}
              className="font-mono"
            />
          </Field>
          <Field label="Vencimento" id="conta-pagar-vencimento" required>
            <Input
              type="date"
              value={vencimento}
              onChange={(e) => setVencimento(e.target.value)}
              disabled={criarMutation.isPending}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Data de competência"
            id="conta-pagar-competencia"
            hint="Regime contábil (DRE). Vazio = usa o vencimento."
          >
            <Input
              type="date"
              value={dataCompetencia}
              onChange={(e) => setDataCompetencia(e.target.value)}
              disabled={criarMutation.isPending}
            />
          </Field>
          <Field
            label="Nº do documento"
            id="conta-pagar-doc"
            hint="NF, fatura ou duplicata."
          >
            <Input
              value={numeroDocumento}
              onChange={(e) => setNumeroDocumento(e.target.value)}
              placeholder="Ex.: NF 12345"
              disabled={criarMutation.isPending}
            />
          </Field>
        </div>

        <Field label="Descrição" id="conta-pagar-descricao">
          <Input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex.: Aluguel sala comercial — mês corrente"
            disabled={criarMutation.isPending}
          />
        </Field>

        <Field
          label="Comprovante (URL/chave)"
          id="conta-pagar-comprovante"
          hint="Chave S3/MinIO do comprovante digitalizado, se houver."
        >
          <Input
            value={comprovanteUrl}
            onChange={(e) => setComprovanteUrl(e.target.value)}
            placeholder="Ex.: s3://visionbox/comprovatos/fatura-123.pdf"
            disabled={criarMutation.isPending}
          />
        </Field>

        {erro && (
          <p role="alert" className="rounded border border-danger-light bg-danger-light p-2 text-xs font-medium text-danger-dark">
            {erro}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button variant="outline" onClick={onClose} disabled={criarMutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => criarMutation.mutate()} disabled={criarMutation.isPending}>
            {criarMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Plus className="mr-2 h-4 w-4" aria-hidden />
            )}
            Criar conta
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
