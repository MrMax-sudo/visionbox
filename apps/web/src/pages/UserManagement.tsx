import { useState, useEffect } from 'react';
import { apiClient, ApiError } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Plus, Edit, Trash2, Shield, CheckCircle, XCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { unwrapPage } from '@/lib/types';
import { OfflineBanner } from '@/components/ui/offline-banner';

const PERFIS_USUARIO = ['ADMIN', 'GERENTE', 'VENDEDOR', 'OTICO', 'TECNICO', 'FINANCEIRO', 'LABORATORIO', 'DESENVOLVEDOR'] as const;
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

interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
}

export default function UserManagement() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  // Redireciona se não for ADMIN
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
    defaultValues: {
      nome: '',
      email: '',
      senha: '',
      perfil: 'VENDEDOR',
    },
  });

  async function carregarUsuarios() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get<PageResponse<UsuarioDTO> | UsuarioDTO[]>('/v1/usuarios', {
        params: { page, size },
      });
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
      } else if (selectedUsuario) {
        await apiClient.put(`/v1/usuarios/${selectedUsuario.id}`, {
          nome: data.nome,
          senha: data.senha || undefined,
          perfil: data.perfil,
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
    form.reset({
      nome: usuario.nome,
      email: usuario.email,
      senha: '',
      perfil: usuario.perfil,
    });
    setEditDialogOpen(true);
  }

  function abrirNovo() {
    setIsCreating(true);
    setSelectedUsuario(null);
    setActionError(null);
    form.reset({
      nome: '',
      email: '',
      senha: '',
      perfil: 'VENDEDOR',
    });
    setEditDialogOpen(true);
  }

  function confirmarDelete(usuario: UsuarioDTO) {
    setSelectedUsuario(usuario);
    setActionError(null);
    setDeleteDialogOpen(true);
  }

  if (!user || user.perfil !== 'ADMIN') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center text-[var(--color-text-secondary)]">
          <Shield className="h-12 w-12 mx-auto text-[var(--color-text-muted)] mb-4" />
          <p className="text-lg font-semibold">Acesso restrito</p>
          <p className="text-sm mt-1">Apenas administradores podem gerenciar usuários.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestão de Usuários</h1>
          <p className="text-[var(--color-text-secondary)]">Gerencie usuários, perfis e acessos do sistema</p>
        </div>
        <Button onClick={abrirNovo}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Usuário
        </Button>
      </div>

      <OfflineBanner />

      {error && (
        <div role="alert" className="rounded-[var(--radius)] bg-[var(--color-danger-light)] p-4 text-[var(--color-danger-dark)] text-sm">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Usuários Cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
            </div>
          ) : (
            <>
              <div className="rounded-md border border-[var(--color-border)] overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--color-bg-page)] text-left text-xs uppercase text-[var(--color-text-secondary)]">
                    <tr className="border-b border-[var(--color-border)]">
                      <th className="px-3 py-2 font-semibold">Nome</th>
                      <th className="px-3 py-2 font-semibold">Email</th>
                      <th className="px-3 py-2 font-semibold">Perfil</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                      <th className="w-32 px-3 py-2 font-semibold">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {usuarios.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-[var(--color-text-muted)]">
                          Nenhum usuário encontrado
                        </td>
                      </tr>
                    ) : (
                      usuarios.map((usuario) => (
                        <tr key={usuario.id} className="text-[var(--color-text-primary)]">
                          <td className="px-3 py-3 font-medium">{usuario.nome}</td>
                          <td className="px-3 py-3">{usuario.email}</td>
                          <td className="px-3 py-3">
                            <Badge variant={usuario.perfil === 'ADMIN' ? 'default' : 'secondary'}>
                              <Shield className="h-3 w-3 mr-1" />
                              {usuario.perfil}
                            </Badge>
                          </td>
                          <td className="px-3 py-3">
                            <Badge variant={usuario.ativo ? 'success' : 'danger'}>
                              {usuario.ativo ? (
                                <>
                                  <CheckCircle className="h-3 w-3 mr-1" /> Ativo
                                </>
                              ) : (
                                <>
                                  <XCircle className="h-3 w-3 mr-1" /> Inativo
                                </>
                              )}
                            </Badge>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="icon" onClick={() => abrirEditar(usuario)} aria-label="Editar">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => confirmarDelete(usuario)} aria-label="Excluir" className="text-[var(--color-danger)]">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between mt-4">
                <span className="text-sm text-[var(--color-text-secondary)]">
                  Página {page + 1} de {totalPages || 1}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
                    Anterior
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                    Próxima
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog Editar/Novo */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} title={isCreating ? 'Novo Usuário' : 'Editar Usuário'}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  placeholder="Nome completo"
                  {...form.register('nome')}
                  disabled={!isCreating && !!selectedUsuario}
                />
                {form.formState.errors.nome && (
                  <p className="text-sm text-[var(--color-danger)]">{form.formState.errors.nome.message}</p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@exemplo.com"
                  {...form.register('email')}
                  disabled={!isCreating && !!selectedUsuario}
                />
                {form.formState.errors.email && (
                  <p className="text-sm text-[var(--color-danger)]">{form.formState.errors.email.message}</p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="senha">Senha {isCreating ? '(obrigatória)' : '(deixe em branco para não alterar)'}</Label>
                <Input
                  id="senha"
                  type="password"
                  placeholder={isCreating ? 'Mínimo 6 caracteres' : 'Deixe em branco para manter'}
                  {...form.register('senha')}
                />
                {form.formState.errors.senha && (
                  <p className="text-sm text-[var(--color-danger)]">{form.formState.errors.senha.message}</p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="perfil">Perfil</Label>
                <Select
                  id="perfil"
                  value={form.watch('perfil')}
                  onChange={(event) => form.setValue('perfil', event.target.value as PerfilUsuario, { shouldValidate: true })}
                >
                  {PERFIS_USUARIO.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </Select>
                {form.formState.errors.perfil && (
                  <p className="text-sm text-[var(--color-danger)]">{form.formState.errors.perfil.message}</p>
                )}
              </div>

            </div>
            {actionError && (
              <p role="alert" className="mb-3 rounded-[var(--radius)] border border-[var(--color-danger-light)] bg-[var(--color-danger-light)] px-3 py-2 text-sm text-[var(--color-danger-dark)]">
                {actionError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {isCreating ? 'Criar' : 'Salvar'}
              </Button>
            </div>
          </form>
      </Dialog>

      {/* Dialog Excluir */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} title="Confirmar Exclusão">
          <p className="py-4 text-sm">
            Tem certeza que deseja excluir <strong>{selectedUsuario?.nome}</strong>? Esta ação não pode ser desfeita.
          </p>
          {actionError && (
            <p role="alert" className="mb-3 rounded-[var(--radius)] border border-[var(--color-danger-light)] bg-[var(--color-danger-light)] px-3 py-2 text-sm text-[var(--color-danger-dark)]">
              {actionError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={!selectedUsuario}>
              Excluir
            </Button>
          </div>
      </Dialog>
    </div>
  );
}
