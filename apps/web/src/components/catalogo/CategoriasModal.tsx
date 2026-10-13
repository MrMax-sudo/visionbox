import * as React from 'react';
import {
  FolderTree,
  Plus,
  Pencil,
  Trash2,
  Search,
  Check,
  X,
  Loader2,
  Tag,
} from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  Categoria,
  CategoriaPayload,
  listarTodasCategorias,
  criarCategoria,
  atualizarCategoria,
  excluirCategoria,
} from '@/services/categoriaService';

interface CategoriasModalProps {
  open: boolean;
  onClose: () => void;
  onCategoriasChange?: () => void;
}

export function CategoriasModal({
  open,
  onClose,
  onCategoriasChange,
}: CategoriasModalProps) {
  const { toast } = useToast();

  const [categorias, setCategorias] = React.useState<Categoria[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [busca, setBusca] = React.useState('');

  // Formulário de adição / edição
  const [formAberto, setFormAberto] = React.useState(false);
  const [editandoId, setEditandoId] = React.useState<string | null>(null);
  const [nome, setNome] = React.useState('');
  const [descricao, setDescricao] = React.useState('');
  const [salvando, setSalvando] = React.useState(false);

  // Confirmação de exclusão
  const [excluindoId, setExcluindoId] = React.useState<string | null>(null);

  const carregarCategorias = React.useCallback(async () => {
    setLoading(true);
    try {
      const lista = await listarTodasCategorias();
      setCategorias(lista);
    } catch {
      toast({
        title: 'Erro ao carregar categorias',
        description: 'Não foi possível carregar a lista de categorias do servidor.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    if (open) {
      carregarCategorias();
      resetForm();
    }
  }, [open, carregarCategorias]);

  const resetForm = () => {
    setEditandoId(null);
    setNome('');
    setDescricao('');
    setFormAberto(false);
  };

  const handleIniciarEdicao = (cat: Categoria) => {
    setEditandoId(cat.id);
    setNome(cat.nome);
    setDescricao(cat.descricao ?? '');
    setFormAberto(true);
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe o nome da categoria para salvar.',
        variant: 'destructive',
      });
      return;
    }

    setSalvando(true);
    const payload: CategoriaPayload = {
      nome: nome.trim(),
      descricao: descricao.trim() || undefined,
    };

    try {
      if (editandoId) {
        await atualizarCategoria(editandoId, payload);
        toast({
          title: 'Categoria atualizada',
          description: `A categoria "${payload.nome}" foi atualizada com sucesso.`,
        });
      } else {
        await criarCategoria(payload);
        toast({
          title: 'Categoria criada',
          description: `A categoria "${payload.nome}" foi cadastrada com sucesso.`,
        });
      }
      resetForm();
      await carregarCategorias();
      onCategoriasChange?.();
    } catch (err: unknown) {
      const erroMsg =
        err instanceof Error ? err.message : 'Falha ao processar solicitação.';
      toast({
        title: 'Erro ao salvar categoria',
        description: erroMsg,
        variant: 'destructive',
      });
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (id: string, nomeCat: string) => {
    try {
      await excluirCategoria(id);
      toast({
        title: 'Categoria desativada',
        description: `A categoria "${nomeCat}" foi removida do catálogo.`,
      });
      setExcluindoId(null);
      await carregarCategorias();
      onCategoriasChange?.();
    } catch {
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível desativar esta categoria.',
        variant: 'destructive',
      });
    }
  };

  const categoriasFiltradas = React.useMemo(() => {
    if (!busca.trim()) return categorias;
    const termo = busca.toLowerCase().trim();
    return categorias.filter(
      (c) =>
        c.nome.toLowerCase().includes(termo) ||
        (c.descricao && c.descricao.toLowerCase().includes(termo))
    );
  }, [categorias, busca]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Categorias de Produtos"
      description="Gerencie as categorias de armações, lentes, óculos de sol e acessórios da sua ótica."
      className="max-w-[620px]"
    >
      <div className="space-y-4">
        {/* Barra superior de ações */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar categoria..."
              className="pl-8 text-sm"
            />
          </div>
          {!formAberto && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                resetForm();
                setFormAberto(true);
              }}
              className="flex items-center gap-1.5 shrink-0"
            >
              <Plus className="h-4 w-4" />
              Nova Categoria
            </Button>
          )}
        </div>

        {/* Formulário Inline de Cadastro / Edição */}
        {formAberto && (
          <form
            onSubmit={handleSalvar}
            className="rounded-card border border-border bg-page p-3.5 space-y-3 shadow-sm transition-all"
          >
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                <Tag className="h-3.5 w-3.5 text-brand" />
                {editandoId ? 'Editar Categoria' : 'Cadastrar Nova Categoria'}
              </span>
              <button
                type="button"
                onClick={resetForm}
                className="text-secondary hover:text-primary transition-colors"
                title="Fechar formulário"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-primary">
                Nome da Categoria <span className="text-danger">*</span>
              </label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Armações de Grau, Lentes Digitais..."
                maxLength={100}
                required
                autoFocus
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-secondary">
                Descrição (opcional)
              </label>
              <Textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descrição breve ou orientações de aplicação..."
                maxLength={500}
                rows={2}
                className="text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetForm}
                disabled={salvando}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={salvando || !nome.trim()}
                className="flex items-center gap-1.5"
              >
                {salvando ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    {editandoId ? 'Atualizar' : 'Salvar'}
                  </>
                )}
              </Button>
            </div>
          </form>
        )}

        {/* Lista de Categorias */}
        <div className="max-h-[340px] overflow-y-auto space-y-2 pr-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 text-secondary">
              <Loader2 className="h-6 w-6 animate-spin text-brand mb-2" />
              <span className="text-xs">Carregando categorias...</span>
            </div>
          ) : categoriasFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-border py-8 text-center text-secondary">
              <FolderTree className="h-8 w-8 text-secondary/50 mb-2" />
              <p className="text-sm font-medium text-primary">
                {busca ? 'Nenhuma categoria encontrada' : 'Nenhuma categoria cadastrada'}
              </p>
              <p className="text-xs text-secondary max-w-[280px] mt-1">
                {busca
                  ? 'Tente buscar com outro termo.'
                  : 'Clique em "Nova Categoria" para cadastrar sua primeira categoria de produtos.'}
              </p>
            </div>
          ) : (
            categoriasFiltradas.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between gap-3 rounded-card border border-border bg-card p-3 hover:border-brand/40 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-primary truncate">
                      {cat.nome}
                    </span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      Ativa
                    </Badge>
                  </div>
                  {cat.descricao && (
                    <p className="text-xs text-secondary mt-0.5 line-clamp-1">
                      {cat.descricao}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {excluindoId === cat.id ? (
                    <div className="flex items-center gap-1.5 animate-fadeIn">
                      <span className="text-[11px] text-danger font-medium">Excluir?</span>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleExcluir(cat.id, cat.nome)}
                      >
                        Sim
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setExcluindoId(null)}
                      >
                        Não
                      </Button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleIniciarEdicao(cat)}
                        className="rounded p-1 text-secondary hover:text-brand hover:bg-page transition-colors"
                        title="Editar categoria"
                        aria-label={`Editar categoria ${cat.nome}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setExcluindoId(cat.id)}
                        className="rounded p-1 text-secondary hover:text-danger hover:bg-page transition-colors"
                        title="Desativar categoria"
                        aria-label={`Excluir categoria ${cat.nome}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Rodapé do Modal */}
        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="text-xs text-secondary">
            {categorias.length} {categorias.length === 1 ? 'categoria' : 'categorias'} no total
          </span>
          <Button variant="outline" size="sm" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
