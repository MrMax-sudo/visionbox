import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, FileText, Glasses, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { PortalOffline } from '@/components/portal/PortalChrome';
import { RastreioView } from '@/components/portal/RastreioView';
import { ApiError } from '@/lib/apiClient';
import { useOnline } from '@/hooks/useOnline';
import {
  buscarRastreioPorNumero,
  extrairTokenColado,
  mensagemRastreio,
  normalizarNumero,
  rastreioUrl,
  validarNumero,
} from '@/lib/rastreioApi';

/** Skeleton da visão de rastreio (resumo + cards). */
export function RastreioSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando rastreio">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-20 w-full rounded-card" />
        <Skeleton className="h-20 w-full rounded-card" />
        <Skeleton className="h-20 w-full rounded-card" />
        <Skeleton className="h-20 w-full rounded-card" />
      </div>
      <Skeleton className="h-64 w-full rounded-card" />
    </div>
  );
}

/** Erro do rastreio — 404/410 viram empty-state amigável; o resto, ErrorState com retry. */
export function RastreioErro({
  error,
  onRetry,
  onNovaBusca,
}: {
  error: unknown;
  onRetry: () => void;
  onNovaBusca?: () => void;
}) {
  const status = error instanceof ApiError ? error.status : undefined;

  if (status === 404 || status === 410) {
    return (
      <EmptyState
        icon={status === 410 ? AlertTriangle : Search}
        title={status === 410 ? 'Link de rastreio expirado' : 'OS não encontrada'}
        description={
          status === 410
            ? 'Este link expirou por segurança. Peça um novo na ótica ou informe o número da OS para gerar outra consulta.'
            : 'Confira o número informado ou fale com a ótica. Se você recebeu um link de rastreio, ele pode ter expirado.'
        }
        action={
          onNovaBusca ? (
            <Button variant="default" size="sm" onClick={onNovaBusca}>
              <Search className="mr-2 h-4 w-4" /> Nova busca
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <ErrorState
      error={new ApiError(mensagemRastreio(error), status)}
      onRetry={onRetry}
    />
  );
}

/**
 * Busca por número da OS — mobile-first, teclado-first (autofocus + Enter).
 * Aceita número da OS, link colado do WhatsApp ou token solto.
 */
export function BuscaOS() {
  const navigate = useNavigate();
  const online = useOnline();
  const [valor, setValor] = React.useState('');
  const [erroCampo, setErroCampo] = React.useState<string | null>(null);
  const [consulta, setConsulta] = React.useState<string | null>(null);
  const [nonce, setNonce] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const busca = useQuery({
    queryKey: ['rastreio-busca', consulta, nonce],
    queryFn: () => buscarRastreioPorNumero(consulta!),
    enabled: !!consulta,
    retry: false,
    staleTime: 0,
  });

  React.useEffect(() => {
    const token = busca.data?.token;
    if (token) navigate(rastreioUrl(token), { replace: true });
  }, [busca.data, navigate]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const bruto = valor.trim();
    const colado = extrairTokenColado(bruto);
    if (colado) {
      navigate(rastreioUrl(colado));
      return;
    }
    // Token "solto" colado da URL (token opaco longo não é um número de OS válido)
    if (bruto.length > 40 && /^[A-Za-z0-9_.\-]+$/.test(bruto)) {
      navigate(rastreioUrl(bruto));
      return;
    }
    const erro = validarNumero(valor);
    setErroCampo(erro);
    if (erro) return;
    setNonce((n) => n + 1);
    setConsulta(normalizarNumero(valor));
  }

  const resultadoOrdem = consulta && !busca.data?.token ? busca.data?.ordem : undefined;
  const carregando = busca.isFetching && !resultadoOrdem;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      <PortalOffline mensagem="Sem conexão — a consulta será feita quando a rede voltar." />

      <section className="space-y-2 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light text-brand">
          <Glasses className="h-8 w-8" aria-hidden />
        </span>
        <h1 className="text-xl font-bold text-primary sm:text-2xl">Acompanhe seu pedido</h1>
        <p className="mx-auto max-w-md text-sm text-secondary">
          Informe o número da OS (está no comprovante da sua compra) para ver as etapas, a previsão
          de entrega e a garantia.
        </p>
      </section>

      <Card>
        <CardContent className="p-5">
          <form onSubmit={handleSubmit} noValidate className="space-y-3">
            <label htmlFor="numero-os" className="block text-xs font-semibold text-secondary">
              Número da Ordem de Serviço
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="numero-os"
                ref={inputRef}
                name="numero-os"
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="Ex.: OS-2026-00123"
                value={valor}
                onChange={(e) => {
                  setValor(e.target.value);
                  if (erroCampo) setErroCampo(null);
                }}
                aria-invalid={!!erroCampo}
                aria-describedby={erroCampo ? 'numero-os-erro' : undefined}
              />
              <Button type="submit" variant="default" disabled={carregando} className="sm:w-auto">
                <Search className="mr-2 h-4 w-4" />
                {carregando ? 'Consultando…' : 'Consultar'}
              </Button>
            </div>
            {erroCampo && (
              <p id="numero-os-erro" role="alert" className="text-xs font-medium text-danger-dark">
                {erroCampo}
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      {!consulta && !carregando && (
        <EmptyState
          icon={FileText}
          title="Pronto para consultar"
          description="Digite o número da OS acima. Você também pode colar o link de rastreio recebido pelo WhatsApp."
        />
      )}

      {carregando && <RastreioSkeleton />}

      {busca.isError && consulta && !carregando && (
        <RastreioErro
          error={busca.error}
          onRetry={() => void busca.refetch()}
          onNovaBusca={() => {
            setConsulta(null);
            setValor('');
            inputRef.current?.focus();
          }}
        />
      )}

      {resultadoOrdem && (
        <div className="space-y-3">
          <RastreioView dados={resultadoOrdem} />
          <div className="text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setConsulta(null);
                setValor('');
                inputRef.current?.focus();
              }}
            >
              Consultar outra OS
            </Button>
          </div>
        </div>
      )}

      {/* Resposta sem token e sem OS: contrato do backend não cumprido (ver rastreioApi.ts) */}
      {consulta && !busca.isFetching && !busca.isError && busca.data && !busca.data.token && !busca.data.ordem && (
        <ErrorState
          error={new ApiError('O servidor não devolveu dados de rastreio. Tente novamente em instantes.')}
          onRetry={() => void busca.refetch()}
        />
      )}
    </div>
  );
}
