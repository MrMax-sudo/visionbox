import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

import { apiClient, ApiError } from '@/lib/apiClient';
import { cn } from '@/lib/utils';
import type { ProdutoDTO } from '@/lib/types';
import {
  CATEGORIAS_PRODUTO,
  PRODUTO_DEFAULT_VALUES,
  TIPO_POR_CATEGORIA,
  categoriaDeProduto,
  produtoSchema,
  type CategoriaProduto,
  type ProdutoForm,
} from '@/components/catalogo/produtoForm';

export interface ProdutoFormDialogProps {
  open: boolean;
  /** null = novo produto */
  produto: ProdutoDTO | null;
  onClose: () => void;
}

/** CRUD de produto (SKU único por loja) — create/PUT `/v1/produtos`. */
export function ProdutoFormDialog({ open, produto, onClose }: ProdutoFormDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEditing = !!produto;
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [loadingSugestao, setLoadingSugestao] = React.useState(false);

  const form = useForm<ProdutoForm>({
    resolver: zodResolver(produtoSchema),
    defaultValues: PRODUTO_DEFAULT_VALUES,
  });

  const carregarSugestao = React.useCallback(async () => {
    try {
      setLoadingSugestao(true);
      const res = await apiClient.get<{ sku: string; codigoBarras: string }>('/v1/produtos/sugestao-sku-ean');
      if (res.data) {
        if (res.data.sku) form.setValue('sku', res.data.sku, { shouldValidate: true });
        if (res.data.codigoBarras) form.setValue('codigoBarras', res.data.codigoBarras, { shouldValidate: true });
      }
    } catch {
      // se a chamada falhar, o backend gera na criação
    } finally {
      setLoadingSugestao(false);
    }
  }, [form]);

  React.useLayoutEffect(() => {
    if (!open) return;
    setActionError(null);
    if (!produto) {
      form.reset(PRODUTO_DEFAULT_VALUES);
      carregarSugestao();
      return;
    }
    form.reset({
      sku: produto.sku ?? '',
      nome: produto.nome ?? '',
      categoria: categoriaDeProduto(produto),
      marca: produto.marca ?? '',
      custo: Number(produto.custo ?? 0),
      precoVenda: Number(produto.preco ?? 0),
      estoqueQuantidade: Number(produto.estoque ?? 0),
      ncm: produto.ncm ?? '',
      codigoBarras: produto.codigoBarras ?? '',
    });
  }, [open, produto, form, carregarSugestao]);

  const saveMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (produto?.id) {
        const res = await apiClient.put(`/v1/produtos/${produto.id}`, payload);
        return res.data;
      }
      const res = await apiClient.post('/v1/produtos', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      queryClient.invalidateQueries({ queryKey: ['pdv-produtos'] });
      toast({
        title: isEditing ? 'Produto atualizado' : 'Produto criado',
        description: 'Catálogo salvo com sucesso.',
        variant: 'success',
      });
      onClose();
    },
    onError: (err: unknown) => {
      const problem = err instanceof ApiError ? err.problem : undefined;
      const fieldErrors = problem?.errors?.map((e) => `${e.field}: ${e.message}`).join(' • ');
      const msg = problem?.detail || problem?.message || (err instanceof Error ? err.message : 'Falha ao salvar produto');
      setActionError(fieldErrors ? `${msg} — ${fieldErrors}` : msg);
    },
  });

  const handleClose = () => {
    if (saveMutation.isPending) return;
    onClose();
  };

  function onSalvarProduto(values: ProdutoForm) {
    setActionError(null);
    const payload: Record<string, unknown> = {
      sku: values.sku,
      nome: values.nome,
      categoria: values.categoria,
      tipoProduto: TIPO_POR_CATEGORIA[values.categoria],
      marca: values.marca?.trim() ? values.marca.trim() : null,
      custo: values.custo,
      precoVenda: values.precoVenda,
      estoqueQuantidade: values.estoqueQuantidade,
      ncm: values.ncm?.trim() ? values.ncm.trim() : null,
      codigoBarras: values.codigoBarras?.trim() ? values.codigoBarras.trim() : null,
      ativoVenda: true,
    };
    saveMutation.mutate(payload);
  }

  const errors = form.formState.errors;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={isEditing ? 'Editar produto' : 'Novo produto'}
      description={
        isEditing
          ? 'Atualize preço, estoque e dados fiscais do SKU.'
          : 'Cadastre uma armação ou lente com SKU único para a loja.'
      }
    >
      <form onSubmit={form.handleSubmit(onSalvarProduto)} className="space-y-4" noValidate>
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="SKU"
            id="produto-sku"
            error={errors.sku}
            hint={!isEditing ? "Gerado automaticamente em sequência" : undefined}
          >
            <div className="flex gap-2">
              <Input placeholder="Ex.: PRD-000001" {...form.register('sku')} />
              {!isEditing && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  onClick={carregarSugestao}
                  disabled={loadingSugestao}
                  title="Recarregar próximo SKU e EAN sequenciais"
                  aria-label="Recarregar sequência"
                >
                  <RefreshCw className={cn("h-4 w-4 text-muted", loadingSugestao && "animate-spin text-primary")} />
                </Button>
              )}
            </div>
          </Field>
          <Field label="Nome" id="produto-nome" required error={errors.nome}>
            <Input placeholder="Ex.: Armação Ray-Ban Aviador" {...form.register('nome')} />
          </Field>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Categoria" id="produto-categoria" required error={errors.categoria}>
            <Select
              value={form.watch('categoria')}
              onChange={(e) =>
                form.setValue('categoria', e.target.value as CategoriaProduto, { shouldValidate: true })
              }
            >
              {CATEGORIAS_PRODUTO.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Marca" id="produto-marca" error={errors.marca}>
            <Input placeholder="Ex.: Ray-Ban" {...form.register('marca')} />
          </Field>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Custo (R$)" id="produto-custo" required error={errors.custo}>
            <Input type="number" step="0.01" min={0} {...form.register('custo', { valueAsNumber: true })} />
          </Field>
          <Field label="Preço de venda (R$)" id="produto-preco" required error={errors.precoVenda}>
            <Input type="number" step="0.01" min={0} {...form.register('precoVenda', { valueAsNumber: true })} />
          </Field>
          <Field label="Estoque" id="produto-estoque" required error={errors.estoqueQuantidade}>
            <Input type="number" step="1" min={0} {...form.register('estoqueQuantidade', { valueAsNumber: true })} />
          </Field>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="NCM"
            id="produto-ncm"
            error={errors.ncm}
            hint="Opcional — se vazio, o sistema usa o NCM padrão da categoria."
          >
            <Input placeholder="Ex.: 90031100" {...form.register('ncm')} />
          </Field>
          <Field
            label="Código de barras (EAN)"
            id="produto-barras"
            error={errors.codigoBarras}
            hint={!isEditing ? "EAN-13 gerado automaticamente em sequência" : undefined}
          >
            <Input placeholder="EAN-13 automático" {...form.register('codigoBarras')} />
          </Field>
        </div>

        {actionError && (
          <p
            role="alert"
            className="rounded border border-danger-light bg-danger-light px-3 py-2 text-sm text-danger-dark"
          >
            {actionError}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button type="button" variant="outline" onClick={handleClose} disabled={saveMutation.isPending}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={saveMutation.isPending}>
            {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            {isEditing ? 'Salvar alterações' : 'Criar produto'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
