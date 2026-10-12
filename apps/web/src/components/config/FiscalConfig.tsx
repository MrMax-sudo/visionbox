import * as React from 'react';
import {
  FileText,
  ShieldCheck,
  Key,
  Server,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEmpresaStore } from '@/stores/empresaStore';

/**
 * FiscalConfig — Gestão e Informações do Módulo Fiscal & Certificado Digital A1.
 * Exibe a integração nativa com o Flowbox (TECHBOXBR) e os parâmetros fiscais da loja.
 */
export function FiscalConfig() {
  const empresa = useEmpresaStore((s) => s.empresa);

  return (
    <section className="space-y-4 text-xs">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText className="h-4 w-4" aria-hidden />
          </div>
          <div>
            <h3 className="font-semibold text-primary">Módulo Fiscal & Certificado A1</h3>
            <p className="text-[11px] text-muted">
              Emissão de NFC-e (65) e NF-e (55) via gateway centralizado Flowbox
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="h-3 w-3" />
          Flowbox Conectado
        </span>
      </div>

      {/* Como funciona o Certificado A1 */}
      <div className="rounded-lg border border-border bg-page p-3.5 space-y-2.5">
        <div className="flex items-center gap-2 font-semibold text-primary">
          <Key className="h-4 w-4 text-amber-500" />
          <span>Onde configurar o Certificado Digital A1 (.pfx)?</span>
        </div>
        <p className="text-secondary leading-relaxed">
          Na arquitetura do ecossistema <strong className="text-primary">TECHBOXBR</strong>, os certificados digitais A1 são gerenciados centralizadamente no microsserviço <strong className="text-primary">Flowbox</strong>.
        </p>
        <div className="grid gap-2 sm:grid-cols-2 pt-1">
          <div className="rounded border border-border bg-card p-2.5">
            <span className="font-semibold text-primary flex items-center gap-1.5 mb-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Segurança Isolada
            </span>
            <p className="text-[11px] text-muted">
              O arquivo <code className="text-primary font-mono">.pfx</code> e sua senha nunca ficam expostos no navegador ou nos caixas locais, prevenindo clonagem e vazamento.
            </p>
          </div>
          <div className="rounded border border-border bg-card p-2.5">
            <span className="font-semibold text-primary flex items-center gap-1.5 mb-1">
              <Zap className="h-3.5 w-3.5 text-amber-500" /> Emissão em Alta Velocidade
            </span>
            <p className="text-[11px] text-muted">
              O Flowbox assina o XML, autoriza na SEFAZ e devolve o protocolo com DANFE e QR-Code para impressão térmica instantânea no PDV.
            </p>
          </div>
        </div>
      </div>

      {/* Dados Fiscais da Empresa Atual */}
      <div className="space-y-2">
        <h4 className="font-semibold text-primary flex items-center gap-1.5">
          <Server className="h-3.5 w-3.5" />
          Parâmetros Fiscais da Loja
        </h4>
        <dl className="grid gap-2 sm:grid-cols-3">
          <div className="rounded border border-border bg-card p-2.5">
            <dt className="text-[10px] text-muted uppercase font-medium">CNPJ Emitente</dt>
            <dd className="font-mono text-xs font-semibold text-primary mt-0.5">
              {empresa?.cnpj ? empresa.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : 'Não cadastrado'}
            </dd>
          </div>
          <div className="rounded border border-border bg-card p-2.5">
            <dt className="text-[10px] text-muted uppercase font-medium">Ambiente SEFAZ</dt>
            <dd className="text-xs font-semibold text-primary mt-0.5">
              Homologação / Produção
            </dd>
          </div>
          <div className="rounded border border-border bg-card p-2.5">
            <dt className="text-[10px] text-muted uppercase font-medium">Regime Tributário</dt>
            <dd className="text-xs font-semibold text-primary mt-0.5">
              Simples Nacional (CRT 1)
            </dd>
          </div>
        </dl>
      </div>

      {/* NCMs e Regras Óticas */}
      <div className="rounded-lg border border-border bg-card p-3 space-y-2">
        <h4 className="font-semibold text-primary flex items-center gap-1.5">
          <HelpCircle className="h-3.5 w-3.5 text-blue-500" />
          Regras de Tributação e NCMs do Setor Óptico
        </h4>
        <div className="space-y-1.5 text-[11px] text-secondary">
          <div className="flex justify-between border-b border-border/50 pb-1">
            <span><strong>Armações para Óculos:</strong> NCM <code className="font-mono text-primary font-semibold">9003.11.00</code> / <code className="font-mono text-primary font-semibold">9003.19.00</code></span>
            <span className="text-muted">CFOP 5.102 / 5.405</span>
          </div>
          <div className="flex justify-between border-b border-border/50 pb-1">
            <span><strong>Óculos de Sol:</strong> NCM <code className="font-mono text-primary font-semibold">9004.10.00</code></span>
            <span className="text-muted">CFOP 5.102</span>
          </div>
          <div className="flex justify-between">
            <span><strong>Lentes Oftálmicas de Contato/Visão:</strong> NCM <code className="font-mono text-primary font-semibold">9001.40.00</code> / <code className="font-mono text-primary font-semibold">9001.50.00</code></span>
            <span className="text-muted">CFOP 5.102</span>
          </div>
        </div>
      </div>

      {/* Contingência Offline */}
      <div className="flex items-start gap-2.5 rounded border border-amber-500/20 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-300">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <div className="text-[11px] space-y-0.5">
          <p className="font-semibold">Contingência Offline no PDV</p>
          <p className="text-muted">
            Se a internet ou a SEFAZ estiver fora do ar, o PDV do VisionBox permite concluir vendas normalmente. As notas são assinadas e enviadas ao Flowbox automaticamente assim que o sinal for restabelecido.
          </p>
        </div>
      </div>
    </section>
  );
}
