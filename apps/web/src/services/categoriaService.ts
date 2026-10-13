import { apiClient } from '@/lib/apiClient';

export interface Categoria {
  id: string;
  lojaId?: string;
  nome: string;
  descricao?: string;
  ativo: boolean;
  criadoEm?: string;
  atualizadoEm?: string;
}

export interface CategoriaPayload {
  nome: string;
  descricao?: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export async function listarCategorias(termo?: string): Promise<Categoria[]> {
  const params: Record<string, string> = { size: '100' };
  if (termo?.trim()) {
    params.search = termo.trim();
  }
  const response = await apiClient.get<PageResponse<Categoria>>('/v1/categorias', { params });
  return response.data?.content ?? [];
}

export async function listarTodasCategorias(): Promise<Categoria[]> {
  const response = await apiClient.get<Categoria[]>('/v1/categorias/todas');
  return response.data ?? [];
}

export async function buscarCategoriaPorId(id: string): Promise<Categoria> {
  const response = await apiClient.get<Categoria>(`/v1/categorias/${id}`);
  return response.data;
}

export async function criarCategoria(payload: CategoriaPayload): Promise<Categoria> {
  const response = await apiClient.post<Categoria>('/v1/categorias', payload);
  return response.data;
}

export async function atualizarCategoria(id: string, payload: CategoriaPayload): Promise<Categoria> {
  const response = await apiClient.put<Categoria>(`/v1/categorias/${id}`, payload);
  return response.data;
}

export async function excluirCategoria(id: string): Promise<void> {
  await apiClient.delete(`/v1/categorias/${id}`);
}
