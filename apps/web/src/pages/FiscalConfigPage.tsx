import { FiscalConfig } from '@/components/config/FiscalConfig';

/**
 * Configuração Fiscal — versão página cheia do conteúdo da aba
 * "Módulo Fiscal (A1)" do ConfiguracoesDialog (menu lateral → /fiscal).
 * Rota protegida por AdminOnly em App.tsx; campos ficam no FiscalConfig.
 */
export default function FiscalConfigPage() {
  return (
    <div className="space-y-6 pb-12">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-primary">Configuração Fiscal</h1>
        <p className="text-xs text-secondary">
          Gateway Flowbox, dados do emitente, série e numeração NFC-e/NF-e, CSC e teste de conexão
        </p>
      </div>

      <FiscalConfig />
    </div>
  );
}
