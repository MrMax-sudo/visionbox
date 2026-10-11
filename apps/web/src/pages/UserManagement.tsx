import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CheckCircle,
  Edit,
  Plus,
  Shield,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { LoadingRows } from '@/components/ui/loading-state';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { apiClient, ApiError } from '@/lib/apiClient';
import { unwrapPage, type PageResponse } from '@/lib/types';
import { useAuthStore } from '@/stores/authStore';

/* --------------------------- Modelo / schema --------------------------- */

const PERFIS_USUARIO = [
  'ADMIN',
  'GERENTE',
  'VENDEDOR',
  'OTICO',
  'TECNICO',
  'FINANCEIRO',
  'LABORATORIO',
  'DESENVOLVEDOR',
] as const;
const perfilSchema = z.enum(PERFIS_USUARIO);

const usuarioSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  senha: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').optional().or(z.literal('')),
  perfil: perfilSchema,
});

type UsuarioForm = z.infer<typeof usuarioSchema>;
type PerfilUsuario = UsuarioForm['perfil'];

interface UsuarioDTO {
  id: string;
  lojaId: string;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  ativo: boolean;
  criadoEm: string;
}

/* ------------------------------- Tabela -------------------------------- */

function UsuariosTabela({
  usuarios,
  carregando,
  onEditar,
  onExcluir,
}: {
  usuarios: UsuarioDTO[];
  carregando: boolean;
  onEditar: (u: UsuarioDTO) => void;
  onExcluir: (u: UsuarioDTO) => void;
}) {
  if (carregando) return <LoadingRows rows={6} />;

  if (usuarios.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Nenhum usuário encontrado"
        description="Nenhum usuário nesta página. Crie um novo acesso ou navegue na paginação."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-card border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-page hover:bg-page">
            <TableHead>Nome</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead>Perfil</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-24 text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {usuarios.map((usuario) => (
            <TableRow key={usuario.id}>
              <TableCell className="font-medium">{usuario.nome}</TableCell>
              <TableCell className="text-secondary">{usuario.email}</TableCell>
              <TableCell>
                <Badge variant={usuario.perfil === 'ADMIN' ? 'default' : 'secondary'}>
                  <Shield className="mr-1 h-3 w-3" aria-hidden />
                  {usuario.perfil}
                </Badge>
              </TableCell>
              <TableCell>
                {usuario.ativo ? (
                  <Badge variant="success">
                    <CheckCircle className="mr-1 h-3 w-3" aria-hidden />
                    Ativo
                  </Badge>
                ) : (
                  <Badge variant="danger">
                    <XCircle className="mr-1 h-3 w-3" aria-hidden />
                    Inativo
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label={`Editar ${usuario.nome}`}
                    title="Editar"
                    onClick={() => onEditar(usuario)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-danger hover:bg-danger-light"
                    aria-label={`Excluir ${usuario.nome}`}
                    title="Excluir"
                    onClick={() => onExcluir(usuario)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/* -------------------------------- Página ------------------------------- */

export default function UserManagement() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Redireciona se não for ADMIN (regra da tela legada, preservada)
  useEffect(() => {
    if (user?.perfil !== 'ADMIN') {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const [usuarios, setUsuarios] = useState<UsuarioDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const size = 20;
  const [totalPages, setTotalPages] = useState(0);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUsuario, setSelectedUsuario] = useState<UsuarioDTO | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const form = useForm<UsuarioForm>({
    resolver: zodResolver(usuarioSchema),
    defaultValues: { nome: '', email: '', senha: '', perfil: 'VENDEDOR' },
  });

  async function carregarUsuarios() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get<PageResponse<UsuarioDTO> | UsuarioDTO[]>(
        '/v1/usuarios',
        { params: { page, size } },
      );
      setUsuarios(unwrapPage(data));
      setTotalPages((data as PageResponse<UsuarioDTO>)?.totalPages ?? 1);
    } catch (err) {
      const problem = err instanceof ApiError ? err.problem : undefined;
      setError(problem?.detail || (err instanceof Error ? err.message : 'Erro ao carregar'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarUsuarios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function handleSubmit(data: UsuarioForm) {
    if (isCreating && !data.senha) {
      form.setError('senha', { message: 'Senha é obrigatória para novo usuário' });
      return;
    }
    setActionError(null);
    try {
      if (isCreating) {
        await apiClient.post('/v1/usuarios', {
          nome: data.nome,
          email: data.email,
          senha: data.senha,
          perfil: data.perfil,
        });
        toast({
          variant: 'success',
          title: 'Usuário criado',
          description: `${data.nome} já pode acessar o VisionBox.`,
        });
      } else if (selectedUsuario) {
        await apiClient.put(`/v1/usuarios/${selectedUsuario.id}`, {
          nome: data.nome,
          senha: data.senha || undefined,
          perfil: data.perfil,
        });
        toast({
          variant: 'success',
          title: 'Usuário atualizado',
          description: `Dados de ${data.nome} foram salvos.`,
        });
      }
      setEditDialogOpen(false);
      setIsCreating(false);
      carregarUsuarios();
    } catch (err: unknown) {
      const problem = err instanceof ApiError ? err.problem : undefined;
      const fieldErrors = problem?.errors?.map((e) => `${e.field}: ${e.message}`).join(' • ');
      const msg =
        problem?.detail ||
        problem?.message ||
        (err instanceof Error ? err.message : null) ||
        'Não foi possível salvar o usuário';
      setActionError(fieldErrors ? `${msg} — ${fieldErrors}` : msg);
    }
  }

  async function handleDelete() {
    if (!selectedUsuario) return;
    setActionError(null);
    try {
      await apiClient.delete(`/v1/usuarios/${selectedUsuario.id}`);
      toast({
        variant: 'success',
        title: 'Usuário excluído',
        description: `${selectedUsuario.nome} foi removido da loja.`,
      });
      setDeleteDialogOpen(false);
      carregarUsuarios();
    } catch (err: unknown) {
      const problem = err instanceof ApiError ? err.problem : undefined;
      setActionError(
        problem?.detail || (err instanceof Error ? err.message : null) || 'Não foi possível excluir o usuário',
      );
    }
  }

  function abrirEditar(usuario: UsuarioDTO) {
    setSelectedUsuario(usuario);
    setIsCreating(false);
    setActionError(null);
    form.reset({ nome: usuario.nome, email: usuario.email, senha: '', perfil: usuario.perfil });
    setEditDialogOpen(true);
  }

  function abrirNovo() {
    setIsCreating(true);
    setSelectedUsuario(null);
    setActionError(null);
    form.reset({ nome: '', email: '', senha: '', perfil: 'VENDEDOR' });
    setEditDialogOpen(true);
  }

  function confirmarDelete(usuario: UsuarioDTO) {
    setSelectedUsuario(usuario);
    setActionError(null);
    setDeleteDialogOpen(true);
  }

  if (!user || user.perfil !== 'ADMIN') {
    return (
      <div className="mx-auto max-w-lg py-10">
        <EmptyState
          icon={Shield}
          title="Acesso restrito"
          description="Apenas administradores podem gerenciar usuários."
        />
      </div>
    );
  }

  const erros = form.formState.errors;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-secondary">
          Gerencie usuários, perfis e acessos do sistema. Perfis definem o que cada pessoa enxerga
          no VisionBox.
        </p>
        <Button size="sm" className="gap-2" onClick={abrirNovo}>
          <Plus className="h-4 w-4" aria-hidden />
          Novo Usuário
        </Button>
      </div>

      <OfflineBanner />

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-danger-light bg-danger-light px-4 py-3 text-sm text-danger-dark"
        >
          <span className="min-w-0">{error}</span>
          <Button variant="ghost" size="sm" className="h-7 shrink-0" onClick={() => carregarUsuarios()}>
            Tentar novamente
          </Button>
        </div>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle>Usuários cadastrados</CardTitle>
          <span className="text-xs text-muted">
            Página {page + 1} de {totalPages || 1}
          </span>
        </CardHeader>
        <CardContent className="space-y-3">
          <UsuariosTabela
            usuarios={usuarios}
            carregando={loading}
            onEditar={abrirEditar}
            onExcluir={confirmarDelete}
          />

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted">
              {usuarios.length} usuário{usuarios.length === 1 ? '' : 's'} nesta página
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || loading}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1 || loading}
              >
                Próxima
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialog criar/editar */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        title={isCreating ? 'Novo Usuário' : 'Editar Usuário'}
        description={
          isCreating
            ? 'Informe nome, e-mail, senha e perfil de acesso.'
            : 'Ajuste os dados de acesso. Deixe a senha em branco para manter a atual.'
        }
      >
        <form onSubmit={form.handleSubmit(handleSubmit)} noValidate>
          <div className="grid gap-4 py-2">
            <Field label="Nome" required error={erros.nome}>
              {(ctrl) => (
                <Input
                  {...ctrl}
                  placeholder="Nome completo"
                  autoComplete="off"
                  disabled={!isCreating && !!selectedUsuario}
                  {...form.register('nome')}
                />
              )}
            </Field>

            <Field label="E-mail" required error={erros.email}>
              {(ctrl) => (
                <Input
                  {...ctrl}
                  type="email"
                  placeholder="email@exemplo.com"
                  autoComplete="off"
                  disabled={!isCreating && !!selectedUsuario}
                  {...form.register('email')}
                />
              )}
            </Field>

            <Field
              label="Senha"
              required={isCreating}
              hint={
                isCreating
                  ? 'Mínimo de 6 caracteres'
                  : 'Deixe em branco para manter a senha atual'
              }
              error={erros.senha}
            >
              {(ctrl) => (
                <Input
                  {...ctrl}
                  type="password"
                  placeholder={isCreating ? 'Mínimo 6 caracteres' : 'Deixe em branco para manter'}
                  autoComplete="new-password"
                  {...form.register('senha')}
                />
              )}
            </Field>

            <Field label="Perfil" error={erros.perfil}>
              <Select
                value={form.watch('perfil')}
                onChange={(event) =>
                  form.setValue('perfil', event.target.value as PerfilUsuario, {
                    shouldValidate: true,
                  })
                }
              >
                {PERFIS_USUARIO.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {actionError && (
            <p
              role="alert"
              className="mb-3 rounded border border-danger-light bg-danger-light px-3 py-2 text-sm text-danger-dark"
            >
              {actionError}
            </p>
          )}

          <div className="mt-4 flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {isCreating ? 'Criar' : 'Salvar'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Dialog excluir */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        title="Confirmar exclusão"
        description="Esta ação não pode ser desfeita."
      >
        <p className="py-2 text-sm text-secondary">
          Tem certeza que deseja excluir{' '}
          <span className="font-semibold text-primary">{selectedUsuario?.nome}</span>? O acesso
          deixará de funcionar imediatamente.
        </p>
        {actionError && (
          <p
            role="alert"
            className="mt-3 rounded border border-danger-light bg-danger-light px-3 py-2 text-sm text-danger-dark"
          >
            {actionError}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={!selectedUsuario}>
            <Trash2 className="mr-2 h-4 w-4" aria-hidden />
            Excluir
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
