import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Search, X } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';

import { apiClient } from '@/lib/apiClient';
import type { PageResponse, ClienteDTO } from '@/lib/types';
import { unwrapPage } from '@/lib/types';
import { useDebounce } from '@/hooks/useOnline';
import type { FieldErrorLike } from '@/components/ui/field';

export interface ClienteComboboxProps {
  /** só busca enquanto o form estiver aberto */
  active: boolean;
  selected: ClienteDTO | null;
  onSelect: (cliente: ClienteDTO) => void;
  onClear: () => void;
  error?: FieldErrorLike;
}

/**
 * ClienteCombobox — busca cliente por nome (GET /v1/clientes?nome=&page=0&size=10)
 * e devolve apenas o UUID para o form (multi-tenant, nunca id de outro tenant).
 * Teclado: ↑/↓ navega, Enter seleciona.
 */
export function ClienteCombobox({ active, selected, onSelect, onClear, error }: ClienteComboboxProps) {
  const [search, setSearch] = React.useState('');
  const [highlight, setHighlight] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const debounced = useDebounce(search, 350);
  const term = search.trim();

  const searchQuery = useQuery({
    queryKey: ['receitas-clientes', debounced],
    queryFn: async () => {
      const res = await apiClient.get<PageResponse<ClienteDTO> | ClienteDTO[]>('/v1/clientes', {
        params: { nome: debounced.trim() || undefined, page: 0, size: 10 },
      });
      return res.data;
    },
    enabled: active && debounced.trim().length >= 2,
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const results = React.useMemo(
    () => unwrapPage(searchQuery.data as PageResponse<ClienteDTO> | ClienteDTO[]),
    [searchQuery.data],
  );

  const showDropdown = active && !selected && term.length >= 2;

  React.useEffect(() => {
    setHighlight(0);
  }, [debounced]);

  // ao (re)abrir o form: limpa busca e devolve o foco ao campo de cliente
  React.useEffect(() => {
    if (!active) return;
    setSearch('');
    setHighlight(0);
    const id = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, [active]);

  function select(c: ClienteDTO | undefined) {
    if (!c) return;
    setSearch('');
    setHighlight(0);
    onSelect(c);
  }

  function clear() {
    setSearch('');
    onClear();
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="clienteBusca">
        Cliente <span className="ml-1 text-danger">*</span>
      </Label>

      {selected ? (
        <div className="flex items-center justify-between gap-2 rounded border border-border bg-page px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-primary">{selected.nome}</p>
            <p className="truncate font-mono text-xs text-muted">
              CPF {selected.cpfMasked ?? selected.cpf ?? '***'}
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={clear} aria-label="Trocar cliente selecionado">
            <X className="mr-1 h-3.5 w-3.5" aria-hidden /> Trocar
          </Button>
        </div>
      ) : (
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <Input
            ref={inputRef}
            id="clienteBusca"
            className="pl-9"
            role="combobox"
            aria-expanded={showDropdown}
            aria-controls={
              showDropdown && results.length > 0 && !searchQuery.isLoading && !searchQuery.isError
                ? 'receita-cliente-listbox'
                : undefined
            }
            aria-autocomplete="list"
            aria-activedescendant={
              showDropdown && results.length > 0 ? `receita-cliente-op-${highlight}` : undefined
            }
            aria-invalid={error ? true : undefined}
            autoComplete="off"
            placeholder="Buscar cliente pelo nome…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (!showDropdown || results.length === 0) return;
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHighlight((h) => Math.min(h + 1, results.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHighlight((h) => Math.max(h - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                select(results[highlight] ?? results[0]);
              }
            }}
          />
          {showDropdown && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded border border-border bg-card shadow-panel">
              {searchQuery.isLoading ? (
                <p role="status" className="flex items-center gap-2 px-3 py-2 text-xs text-secondary">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Buscando clientes…
                </p>
              ) : searchQuery.isError ? (
                <div className="p-1">
                  <ErrorState compact error={searchQuery.error} onRetry={() => searchQuery.refetch()} />
                </div>
              ) : results.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted">
                  <p>Nenhum cliente encontrado para “{term}”.</p>
                  <p className="mt-1">Cadastre o cliente na tela Clientes e volte aqui.</p>
                </div>
              ) : (
                <ul
                  id="receita-cliente-listbox"
                  role="listbox"
                  aria-label="Clientes encontrados"
                  className="max-h-56 overflow-auto py-1"
                >
                  {results.map((c, i) => (
                    <li key={c.id} id={`receita-cliente-op-${i}`} role="option" aria-selected={i === highlight}>
                      <button
                        type="button"
                        onMouseEnter={() => setHighlight(i)}
                        onClick={() => select(c)}
                        className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${
                          i === highlight
                            ? 'bg-primary-light text-primary'
                            : 'text-primary hover:bg-page'
                        }`}
                      >
                        <span className="truncate font-medium">{c.nome}</span>
                        <span className="shrink-0 font-mono text-xs text-muted">
                          {c.cpfMasked ?? c.cpf ?? '***'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {error ? (
        <p role="alert" className="text-xs font-medium text-danger-dark">
          {typeof error === 'string' ? error : error.message}
        </p>
      ) : (
        <p className="text-[11px] text-muted">
          Busque pelo nome e escolha da lista — o vínculo usa o ID do cliente (multi-tenant).
        </p>
      )}
    </div>
  );
}
