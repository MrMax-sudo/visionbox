import * as React from 'react';
import { Calculator, Percent, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { ComissaoConfigCard } from '@/components/financeiro/comissao/ComissaoConfigCard';
import { ApurarComissaoDialog } from '@/components/financeiro/comissao/ApurarComissaoDialog';
import { FechamentoComissoesPanel } from '@/components/financeiro/comissao/FechamentoComissoesPanel';
import type { ComissaoConfigDTO } from '@/lib/comissaoService';

/**
 * Comissões — vendedores (§3.6, Fase 4 / R11 FINANCEIRO_COMPLETO).
 *
 * • Regras: percentual GERAL ou por CATEGORIA (CRUD /comissoes/config)
 * • Apuração: botão que lança a comissão de uma venda (/comissoes/apurar)
 * • Fechamento: relatório por período e vendedor (/comissoes/fechamento)
 *
 * Estados Loading/Empty/Error nas três seções (dentro dos componentes).
 */
export default function Comissoes() {
  const [apurarOpen, setApurarOpen] = React.useState(false);
  const [categoriasAtivas, setCategoriasAtivas] = React.useState<string[]>([]);

  const handleConfigsCarregadas = React.useCallback((configs: ComissaoConfigDTO[]) => {
    setCategoriasAtivas(
      configs
        .filter((c) => c.tipo === 'CATEGORIA' && c.categoria)
        .map((c) => c.categoria as string),
    );
  }, []);

  return (
    <div className="space-y-6 pb-12">
      <OfflineBanner />

      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Comissões</h1>
          <p className="text-xs text-secondary">
            Regras, apuração por venda e fechamento por período para pagamento na folha ou vale
          </p>
        </div>
        <Button size="sm" onClick={() => setApurarOpen(true)} className="gap-1.5 font-semibold">
          <Calculator className="h-4 w-4" /> Apurar venda
        </Button>
      </div>

      <Tabs defaultValue="regras">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="regras" className="gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
            Regras
          </TabsTrigger>
          <TabsTrigger value="fechamento" className="gap-1.5">
            <Percent className="h-3.5 w-3.5" aria-hidden />
            Fechamento por período
          </TabsTrigger>
        </TabsList>

        <TabsContent value="regras" className="mt-4">
          <ComissaoConfigCard onConfigsCarregadas={handleConfigsCarregadas} />
        </TabsContent>

        <TabsContent value="fechamento" className="mt-4">
          <FechamentoComissoesPanel />
        </TabsContent>
      </Tabs>

      <ApurarComissaoDialog
        open={apurarOpen}
        onClose={() => setApurarOpen(false)}
        categoriasSugeridas={categoriasAtivas}
      />
    </div>
  );
}
