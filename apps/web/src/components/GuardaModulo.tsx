import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingState } from '@/components/ui/loading-state';
import { useModulosStore } from '@/stores/modulosStore';

/**
 * GuardaModulo — proteção de rota por módulo SaaS (spec §4.4, R11).
 *
 * Envolve o elemento da rota em App.tsx:
 *   <Route path="etiquetas" element={
 *     <LazyPage><GuardaModulo modulo="ETIQUETAS"><Etiquetas/></GuardaModulo></LazyPage>
 *   } />
 *
 * Comportamento:
 * - carrega os módulos da loja no primeiro uso (store já populada no login);
 * - módulo inativo => tela amigável (texto exato da spec §4.4);
 * - falha de rede/sem dado => deixa a rota renderizar (fail-open no guard) — o backend
 *   continua bloqueando via @RequerModulo/ModuloTenantInterceptor (403 MODULO_NAO_CONTRATADO).
 */
export default function GuardaModulo({
  modulo,
  children,
}: {
  modulo: string;
  children: React.ReactNode;
}) {
  const status = useModulosStore((s) => s.status);
  const loaded = useModulosStore((s) => s.loaded);
  const loading = useModulosStore((s) => s.loading);
  const carregar = useModulosStore((s) => s.carregar);
  const temModulo = useModulosStore((s) => s.temModulo);

  React.useEffect(() => {
    if (!loaded && !loading) {
      void carregar();
    }
  }, [loaded, loading, carregar]);

  if (!loaded && loading) {
    return <LoadingState title="Verificando módulos contratados…" />;
  }

  if (loaded && status && !temModulo(modulo)) {
    return <TelaModuloBloqueado codigo={modulo} />;
  }

  return <>{children}</>;
}

/** Texto exato exigido pela spec §4.4 (QA faz match literal). */
export const MENSAGEM_MODULO_BLOQUEADO =
  'Recurso Bloqueado: Este módulo não está ativo no plano da sua ótica. Entre em contato com a TECHBOXBR para realizar o upgrade.';

/** Tela de bloqueio — texto obrigatório conforme spec §4.4. */
export function TelaModuloBloqueado({ codigo }: { codigo: string }) {
  const navigate = useNavigate();
  return (
    <div
      className="mx-auto flex max-w-2xl justify-center py-10"
      role="alert"
      aria-label={MENSAGEM_MODULO_BLOQUEADO}
    >
      <Card className="w-full">
        <CardHeader className="items-center pb-2 text-center">
          <span className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-warning-light">
            <ShieldAlert className="h-6 w-6 text-warning-dark" aria-hidden />
          </span>
          <CardTitle className="text-base">Recurso Bloqueado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-secondary">
            Este módulo não está ativo no plano da sua ótica. Entre em contato com a TECHBOXBR
            para realizar o upgrade.
          </p>
          <p className="text-xs text-muted">
            Módulo solicitado: <span className="font-mono font-semibold">{codigo}</span>
          </p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/')}>
              Voltar ao início
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => void useModulosStore.getState().carregar(true)}
            >
              Verificar novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
