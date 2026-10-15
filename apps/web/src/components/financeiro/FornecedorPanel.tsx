import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Loader2, Pencil, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingRows } from '@/components/ui/loading-state';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { apiClient } from '@/lib/apiClient';
import { ApiError } from '@/lib/apiClient';
import { fetchCnpj } from '@/lib/cnpj';
import { maskTelefone, unmask } from '@/lib/masks';
import { FINANCEIRO_KEYS, useFornecedores } from './queries';
import {
  actionErrorMessage,
  isCNPJCompleto,
  maskCNPJ,
  type FornecedorDTO,
  type FornecedorPayload,
} from './types';

/**
 * Gestão de Fornecedores (§3.3 — Contas a Pagar corporativas).
 * Aba dentro do hub Financeiro. CNPJ chega SEMPRE mascarado do GET
 * (LGPD/ADR-002); no POST/PUT enviamos os dígitos em plain — no PUT só
 * enviamos CNPJ quando o operador digitar (evita sobrescrever cifra com
 * a máscara). DELETE = soft-delete (ativo=false) no backend.
 *
 * V41 — reativação: toggle "Mostrar inativos" (GET ?incluirInativos=true,
 * que contorna o filtro ativo do backend) traz os desativados com badge
 * Inativo e botão Reativar (POST /{id}/reativar — reversal do soft-delete,
 * idempotente; 409 se o CNPJ já estiver em outro fornecedor ativo da loja).
 * Linhas inativas não oferecem Editar/Desativar (o backend só enxerga ativos
 * nesses fluxos).
 */
export function FornecedorPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [busca, setBusca] = React.useState('');
  const [mostrarInativos, setMostrarInativos] = React.useState(false);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editando, setEditando] = React.useState<FornecedorDTO | null>(null);
  const [confirmando, setConfirmando] = React.useState<FornecedorDTO | null>(null);

  const fornecedoresQuery = useFornecedores(busca.trim(), mostrarInativos);

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['financeiro', 'fornecedores'] });
  };

  const desativarMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/v1/financeiro/fornecedores/${id}`);
    },
    onSuccess: () => {
      invalidar();
      setConfirmando(null);
      toast({
        variant: 'success',
        title: 'Fornecedor desativado',
        description: 'Fornecedor saiu das listas de vínculo ativo (soft-delete).',
      });
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Não foi possível desativar',
        description: actionErrorMessage(err),
      });
    },
  });

  const reativarMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post<FornecedorDTO>(
        `/v1/financeiro/fornecedores/${id}/reativar`,
      );
      return res.data;
    },
    onSuccess: (f) => {
      invalidar();
      toast({
        variant: 'success',
        title: 'Fornecedor reativado',
        description: `${f?.nome ?? 'Fornecedor'} voltou para as listas de vínculo ativo.`,
      });
    },
    onError: (err) => {
      // 409 do backend chega com detail genérico do handler — mensagem específica aqui.
      const conflitoCnpj = err instanceof ApiError && err.status === 409;
      toast({
        variant: 'destructive',
        title: 'Não foi possível reativar',
        description: conflitoCnpj
          ? 'CNPJ já cadastrado em outro fornecedor ativo desta loja.'
          : actionErrorMessage(err),
      });
    },
  });

  const abrirNovo = () => {
    setEditando(null);
    setFormOpen(true);
  };

  const abrirEdicao = (f: FornecedorDTO) => {
    setEditando(f);
    setFormOpen(true);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-full max-w-xs">
          <Field label="Buscar por nome" id="fornecedores-busca">
            {(ctrl) => (
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                  aria-hidden
                />
                <Input
                  {...ctrl}
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Ex.: Essilor, Hoya…"
                  className="pl-8"
                />
              </div>
            )}
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="fornecedores-inativos"
              checked={mostrarInativos}
              onCheckedChange={setMostrarInativos}
            />
            <Label htmlFor="fornecedores-inativos" className="cursor-pointer text-sm">
              Mostrar inativos
            </Label>
          </div>
          <Button onClick={abrirNovo} className="gap-2">
            <Plus className="h-4 w-4" aria-hidden />
            Novo fornecedor
          </Button>
        </div>
      </div>

      {fornecedoresQuery.isLoading ? (
        <LoadingRows rows={4} />
      ) : fornecedoresQuery.isError ? (
        <ErrorState error={fornecedoresQuery.error} onRetry={() => fornecedoresQuery.refetch()} />
      ) : (fornecedoresQuery.data ?? []).length === 0 ? (
        <EmptyState
          icon={Building2}
          title={mostrarInativos ? 'Nenhum fornecedor encontrado' : 'Nenhum fornecedor cadastrado'}
          description={
            busca
              ? 'Nenhum resultado para esta busca.'
              : mostrarInativos
                ? 'Nenhum fornecedor ativo nem inativo com esta busca.'
                : 'Cadastre laboratórios e distribuidores para vincular às contas a pagar.'
          }
          action={
            <Button onClick={abrirNovo} className="gap-2">
              <Plus className="h-4 w-4" aria-hidden />
              Cadastrar fornecedor
            </Button>
          }
        />
      ) : (
        <div className="rounded-card border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-page text-left text-xs text-secondary">
                <th scope="col" className="px-3 py-2 font-medium">Fornecedor</th>
                <th scope="col" className="px-3 py-2 font-medium">CNPJ</th>
                <th scope="col" className="hidden px-3 py-2 font-medium md:table-cell">Contato</th>
                <th scope="col" className="hidden px-3 py-2 font-medium lg:table-cell">Telefone</th>
                <th scope="col" className="hidden px-3 py-2 font-medium lg:table-cell">E-mail</th>
                <th scope="col" className="px-3 py-2 font-medium">Status</th>
                <th scope="col" className="w-24 px-3 py-2 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {(fornecedoresQuery.data ?? []).map((f) => (
                <tr key={f.id} className="border-b border-border last:border-0 hover:bg-page">
                  <td className="px-3 py-2">
                    <p className="truncate font-medium text-primary">{f.nome}</p>
                    {f.contato && <p className="truncate text-xs text-muted">{f.contato}</p>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-secondary">
                    {f.cnpjMasked ?? '—'}
                  </td>
                  <td className="hidden px-3 py-2 text-secondary md:table-cell">
                    {f.contato || '—'}
                  </td>
                  <td className="hidden whitespace-nowrap px-3 py-2 tabular-nums text-secondary lg:table-cell">
                    {f.telefone || '—'}
                  </td>
                  <td className="hidden max-w-[16rem] truncate px-3 py-2 text-secondary lg:table-cell">
                    {f.email || '—'}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={f.ativo ? 'success' : 'outline'}>
                      {f.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      {f.ativo ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`Editar ${f.nome}`}
                            title="Editar fornecedor"
                            onClick={() => abrirEdicao(f)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-danger hover:bg-danger-light"
                            aria-label={`Desativar ${f.nome}`}
                            title="Desativar fornecedor"
                            disabled={desativarMutation.isPending}
                            onClick={() => setConfirmando(f)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-success hover:bg-success-light"
                          aria-label={`Reativar ${f.nome}`}
                          title="Reativar fornecedor (soft-delete reversal)"
                          disabled={reativarMutation.isPending}
                          onClick={() => reativarMutation.mutate(f.id)}
                        >
                          {reativarMutation.isPending &&
                          reativarMutation.variables === f.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          ) : (
                            <RotateCcw className="h-4 w-4" aria-hidden />
                          )}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <FornecedorFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        fornecedor={editando}
        onSalvo={invalidar}
      />

      {/* Confirmação de desativação (soft-delete) */}
      <Dialog
        open={confirmando !== null}
        onClose={() => setConfirmando(null)}
        title="Desativar fornecedor"
        description="O fornecedor sai das listas de vínculo ativo. Nada é apagado (LGPD)."
        className="max-w-[420px]"
      >
        <p className="text-sm text-secondary">
          Desativar <strong className="text-primary">{confirmando?.nome}</strong>?
          Contas a pagar existentes permanecem intactas.
        </p>
        <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
          <Button variant="outline" onClick={() => setConfirmando(null)}>
            Manter ativo
          </Button>
          <Button
            variant="destructive"
            disabled={desativarMutation.isPending}
            onClick={() => confirmando && desativarMutation.mutate(confirmando.id)}
          >
            {desativarMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            )}
            Desativar
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Form modal — criar/editar                                          */
/* ------------------------------------------------------------------ */

function FornecedorFormModal({
  open,
  onClose,
  fornecedor,
  onSalvo,
}: {
  open: boolean;
  onClose: () => void;
  fornecedor: FornecedorDTO | null;
  onSalvo: () => void;
}) {
  const { toast } = useToast();

  const [nome, setNome] = React.useState('');
  const [cnpj, setCnpj] = React.useState('');
  const [cnpjTocado, setCnpjTocado] = React.useState(false);
  const [buscandoCnpj, setBuscandoCnpj] = React.useState(false);
  const [contato, setContato] = React.useState('');
  const [telefone, setTelefone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [erro, setErro] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setNome(fornecedor?.nome ?? '');
      setCnpj('');
      setCnpjTocado(false);
      setBuscandoCnpj(false);
      setContato(fornecedor?.contato ?? '');
      setTelefone(fornecedor?.telefone ?? '');
      setEmail(fornecedor?.email ?? '');
      setErro(null);
    }
  }, [open, fornecedor]);

  const buscarCnpjReceita = async () => {
    const digitos = unmask(cnpj);
    if (!digitos || digitos.length !== 14) {
      toast({
        variant: 'destructive',
        title: 'CNPJ incompleto',
        description: 'Digite o CNPJ completo com 14 números para consultar a Receita.',
      });
      return;
    }
    setBuscandoCnpj(true);
    try {
      const data = await fetchCnpj(digitos);
      const nomeEncontrado = data.nome_fantasia || data.razao_social;
      setNome(nomeEncontrado);
      if (data.ddd_telefone_1) setTelefone(maskTelefone(data.ddd_telefone_1));
      if (data.email) setEmail(data.email);
      toast({
        variant: 'success',
        title: 'Dados do fornecedor localizados!',
        description: nomeEncontrado,
      });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Erro ao consultar CNPJ',
        description: e instanceof Error ? e.message : 'Falha na consulta.',
      });
    } finally {
      setBuscandoCnpj(false);
    }
  };

  const salvando = useMutation({
    mutationFn: async () => {
      if (nome.trim().length < 2) throw new Error('Nome deve ter ao menos 2 caracteres.');
      const digitos = unmask(cnpj);
      if (cnpjTocado && digitos && digitos.length !== 14) {
        throw new Error('CNPJ deve ter 14 dígitos — digite o número completo ou deixe vazio.');
      }

      const body: FornecedorPayload = {
        nome: nome.trim(),
        ...(cnpjTocado && digitos ? { cnpj: digitos } : {}), // plain, só se o operador digitou
        ...(contato.trim() ? { contato: contato.trim() } : {}),
        ...(telefone.trim() ? { telefone: unmask(telefone) } : {}),
        ...(email.trim() ? { email: email.trim() } : {}),
      };

      if (fornecedor) {
        const res = await apiClient.put<FornecedorDTO>(
          `/v1/financeiro/fornecedores/${fornecedor.id}`,
          body,
        );
        return res.data;
      }
      const res = await apiClient.post<FornecedorDTO>('/v1/financeiro/fornecedores', body);
      return res.data;
    },
    onSuccess: (salvo) => {
      onSalvo();
      toast({
        variant: 'success',
        title: fornecedor ? 'Fornecedor atualizado' : 'Fornecedor cadastrado',
        description: salvo.nome,
      });
      onClose();
    },
    onError: (err) => {
      setErro(actionErrorMessage(err));
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={fornecedor ? 'Editar fornecedor' : 'Novo fornecedor'}
      description="CNPJ é opcional e armazenado cifrado (ADR-002) — o sistema devolve apenas a máscara."
      className="max-w-[520px]"
    >
      <div className="space-y-4">
        <Field label="Nome / Razão social" id="fornecedor-nome" required error={erro}>
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Essilor Brasil"
            disabled={salvando.isPending}
          />
        </Field>

        <Field
          label="CNPJ"
          id="fornecedor-cnpj"
          hint={
            fornecedor
              ? `Atual: ${fornecedor.cnpjMasked ?? 'sem CNPJ'}. Deixe vazio para manter; digite para alterar.`
              : 'Opcional — 14 dígitos, preenche nome, telefone e email automaticamente.'
          }
        >
          <div className="flex gap-2">
            <Input
              value={cnpj}
              onChange={(e) => {
                setCnpjTocado(true);
                const masked = maskCNPJ(e.target.value);
                setCnpj(masked);
                const dig = unmask(masked);
                if (dig.length === 14 && !nome) {
                  fetchCnpj(dig).then((data) => {
                    setNome(data.nome_fantasia || data.razao_social);
                    if (data.ddd_telefone_1) setTelefone(maskTelefone(data.ddd_telefone_1));
                    if (data.email) setEmail(data.email);
                  }).catch(() => undefined);
                }
              }}
              placeholder={fornecedor?.cnpjMasked ?? '00.000.000/0000-00'}
              inputMode="numeric"
              disabled={salvando.isPending}
              className="tabular-nums"
              aria-invalid={cnpjTocado && !isCNPJCompleto(cnpj) && cnpj !== '' ? true : undefined}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={buscarCnpjReceita}
              disabled={salvando.isPending || buscandoCnpj}
              className="shrink-0 gap-1 text-xs"
              title="Buscar dados do fornecedor na Receita Federal via BrasilAPI"
            >
              <Search className={buscandoCnpj ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
              {buscandoCnpj ? 'Consultando…' : 'Buscar Receita'}
            </Button>
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Pessoa de contato" id="fornecedor-contato">
            <Input
              value={contato}
              onChange={(e) => setContato(e.target.value)}
              placeholder="Ex.: João (comercial)"
              disabled={salvando.isPending}
            />
          </Field>
          <Field label="Telefone" id="fornecedor-telefone">
            <Input
              value={telefone}
              onChange={(e) => setTelefone(maskTelefone(e.target.value))}
              placeholder="(00) 00000-0000"
              inputMode="tel"
              disabled={salvando.isPending}
              className="tabular-nums"
            />
          </Field>
        </div>

        <Field label="E-mail" id="fornecedor-email">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="comercial@fornecedor.com.br"
            disabled={salvando.isPending}
          />
        </Field>

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button variant="outline" onClick={onClose} disabled={salvando.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => salvando.mutate()} disabled={salvando.isPending}>
            {salvando.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            {fornecedor ? 'Salvar alterações' : 'Cadastrar'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
