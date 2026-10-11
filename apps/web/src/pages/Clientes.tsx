import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, Pencil, Plus, Search, Filter, RefreshCw, Trash2, FileSpreadsheet } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingRows } from '@/components/ui/loading-state';

import { apiClient } from '@/lib/apiClient';
import type { PageResponse, ClienteDTO } from '@/lib/types';
import { unwrapPage } from '@/lib/types';
import { useDebounce, useOnline } from '@/hooks/useOnline';
import { formatBRL } from '@/lib/masks';

import { ClienteFormDialog } from '@/components/pessoas/ClienteFormDialog';
import { ClienteDeleteDialog, ClienteViewDialog } from '@/components/pessoas/ClienteDialogs';
import { CsvImportDialog } from '@/components/pessoas/CsvImportDialog';

type ClientesPage = PageResponse<ClienteDTO>;

export default function Clientes() {
  const online = useOnline();
  const [q, setQ] = React.useState('');
  const [page, setPage] = React.useState(0);
  const size = 20;
  const debouncedQ = useDebounce(q, 350);

  const [formOpen, setFormOpen] = React.useState(false);
  const [viewOpen, setViewOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [selectedCliente, setSelectedCliente] = React.useState<ClienteDTO | null>(null);

  const queryKey = ['clientes', { q: debouncedQ, page, size }] as const;

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await apiClient.get<ClientesPage | ClienteDTO[]>('/v1/clientes', {
        params: { page, size, search: debouncedQ || undefined, q: debouncedQ || undefined },
      });
      return res.data;
    },
    staleTime: 30_000,
    retry: 1,
    placeholderData: (prev) => prev,
  });

  const clientes: ClienteDTO[] = React.useMemo(() => unwrapPage(data as ClientesPage | ClienteDTO[]), [data]);

  // filtro client-side defensivo (o backend já recebe `search`)
  const filtered = React.useMemo(() => {
    if (!debouncedQ) return clientes;
    const l = debouncedQ.toLowerCase();
    return clientes.filter(
      (c) =>
        c.nome.toLowerCase().includes(l) ||
        (c.cpf ?? c.cpfMasked ?? '').includes(l) ||
        (c.cidade ?? '').toLowerCase().includes(l),
    );
  }, [clientes, debouncedQ]);

  const totalElements = (data as ClientesPage)?.totalElements ?? filtered.length;
  const totalPages = (data as ClientesPage)?.totalPages;
  const isLastPage = (data as ClientesPage)?.last;

  React.useEffect(() => {
    setPage(0);
  }, [debouncedQ]);

  function abrirNovo() {
    setSelectedCliente(null);
    setFormOpen(true);
  }

  function abrirVer(cliente: ClienteDTO) {
    setSelectedCliente(cliente);
    setViewOpen(true);
  }

  function abrirEditar(cliente: ClienteDTO) {
    setSelectedCliente(cliente);
    setFormOpen(true);
  }

  function abrirExcluir(cliente: ClienteDTO) {
    setSelectedCliente(cliente);
    setDeleteOpen(true);
  }

  function limparBusca() {
    setQ('');
    setPage(0);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-primary">Clientes</h1>
          <p className="text-sm text-secondary">
            LGPD: CPF criptografado AES-GCM • exibição mascarada • consentimento recall
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <FileSpreadsheet className="mr-2 h-4 w-4" aria-hidden /> Importar CSV
          </Button>
          <Button variant="primary" onClick={abrirNovo}>
            <Plus className="mr-2 h-4 w-4" aria-hidden /> Novo cliente
          </Button>
        </div>
      </div>

      <OfflineBanner />
      {!online && !isLoading && clientes.length > 0 && (
        <p className="text-xs text-muted">
          Exibindo dados em cache — busca server-side indisponível offline.
        </p>
      )}

      {/* Barra de busca / contagem */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[260px] flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar nome, CPF, cidade…"
              className="pl-9"
              aria-label="Buscar clientes"
            />
          </div>
          <Button variant="outline" size="sm" onClick={limparBusca} disabled={!q}>
            <Filter className="mr-2 h-4 w-4" aria-hidden /> Limpar filtros
          </Button>
          <Badge variant="outline">
            {isLoading ? 'carregando…' : `${totalElements} clientes`}
            {isFetching && !isLoading && ' • atualizando…'}
          </Badge>
          <Button variant="ghost" size="sm" onClick={() => refetch()} aria-label="Atualizar lista">
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} aria-hidden />
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="p-4">
            <LoadingRows rows={8} />
          </CardContent>
        </Card>
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={debouncedQ ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
          description={
            debouncedQ
              ? `Nenhum resultado para “${debouncedQ}”. Tente outro termo ou cadastre um novo cliente.`
              : 'Cadastre o primeiro cliente para iniciar vendas no PDV e gerar OS.'
          }
          action={
            debouncedQ ? (
              <Button variant="outline" size="sm" onClick={limparBusca}>
                Limpar busca
              </Button>
            ) : (
              <Button variant="primary" size="sm" onClick={abrirNovo}>
                <Plus className="mr-2 h-4 w-4" aria-hidden /> Novo cliente
              </Button>
            )
          }
        />
      ) : (
        <>
          {/* Tabela densa (desktop) */}
          <Card className="hidden overflow-hidden md:block">
            <Table>
              <TableHeader className="bg-page">
                <TableRow className="hover:bg-transparent">
                  <TableHead>Cliente</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead className="text-right">Total gasto</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <p className="font-medium text-primary">{c.nome}</p>
                      <p className="text-xs text-muted">
                        Última compra{' '}
                        {c.ultimaCompra ? new Date(c.ultimaCompra).toLocaleDateString('pt-BR') : '—'}
                      </p>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-secondary">
                      {c.cpfMasked ?? c.cpf ?? '***'}
                    </TableCell>
                    <TableCell className="text-secondary">{c.telefone ?? '—'}</TableCell>
                    <TableCell className="text-secondary">{c.cidade ?? '—'}</TableCell>
                    <TableCell className="text-right font-semibold">{formatBRL(c.totalGasto ?? 0)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label={`Ver ${c.nome}`}
                          onClick={() => abrirVer(c)}
                        >
                          <Eye className="h-4 w-4" aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label={`Editar ${c.nome}`}
                          onClick={() => abrirEditar(c)}
                        >
                          <Pencil className="h-4 w-4" aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-danger"
                          aria-label={`Excluir ${c.nome}`}
                          onClick={() => abrirExcluir(c)}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between border-t border-border bg-page px-4 py-3 text-xs">
              <span className="text-secondary">
                Página {page + 1} {totalPages ? `de ${totalPages}` : ''} • {totalElements} registros
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!!isLastPage || filtered.length < size}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </Card>

          {/* Cards (mobile) */}
          <div className="grid gap-3 md:hidden">
            {filtered.map((c) => (
              <Card key={c.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-primary">{c.nome}</p>
                    <p className="truncate font-mono text-xs text-muted">{c.cpfMasked ?? c.cpf ?? '***'}</p>
                    <p className="mt-1 text-xs text-secondary">
                      {c.telefone ?? '—'} • {c.cidade ?? '—'}
                    </p>
                  </div>
                  <Badge variant="info">{formatBRL(c.totalGasto ?? 0)}</Badge>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => abrirVer(c)}>
                    <Eye className="mr-1 h-3.5 w-3.5" aria-hidden /> Ver
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => abrirEditar(c)}
                    aria-label={`Editar ${c.nome}`}
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-danger"
                    onClick={() => abrirExcluir(c)}
                    aria-label={`Excluir ${c.nome}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <ClienteFormDialog open={formOpen} cliente={selectedCliente} onClose={() => setFormOpen(false)} />
      <ClienteViewDialog
        cliente={viewOpen ? selectedCliente : null}
        onClose={() => setViewOpen(false)}
        onEdit={(c) => {
          setViewOpen(false);
          abrirEditar(c);
        }}
      />
      <ClienteDeleteDialog
        cliente={deleteOpen ? selectedCliente : null}
        onClose={() => setDeleteOpen(false)}
      />
      <CsvImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Importar Clientes (CSV)"
        description="Carregue sua base de clientes existente a partir de uma planilha CSV."
        endpoint="/v1/clientes/importar-csv"
        invalidateKeys={[['clientes']]}
        columns="nome,cpf,telefone,email,cidade,uf,cep,logradouro,numero,bairro"
        example="Maria Silva;12345678900;11988887777;maria@email.com;São Paulo;SP;01310-100;Av Paulista;1000;Bela Vista"
        itemLabel="clientes"
        successVerb="importados com sucesso"
        errorLabel="linhas com inconsistência"
        sanitizeNote="CPF e Telefone são sanitizados automaticamente."
      />
    </div>
  );
}
