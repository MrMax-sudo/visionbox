import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  ShieldCheck,
  Key,
  Server,
  AlertCircle,
  HelpCircle,
  Zap,
} from 'lucide-react';
import { useEmpresaStore } from '@/stores/empresaStore';
import { apiClient } from '@/lib/apiClient';

interface DevInfo {
  app: string;
  version: string;
  profiles: string;
  fiscalProvider: string;
}

/**
 * FiscalConfig — Gestão e Informações do Módulo Fiscal & Certificado Digital A1.
 * Exibe o status real de conexão com o Flowbox (TECHBOXBR) e os parâmetros fiscais da loja.
 */
export function FiscalConfig() {
  const empresa = useEmpresaStore((s) => s.empresa);

  const { data: devInfo } = useQuery<DevInfo>({
    queryKey: ['dev-info-fiscal'],
    queryFn: async () => {
      const res = await apiClient.get<DevInfo>('/v1/dev/info');
      return res.data;
    },
    staleTime: 60_000,
    retry: 1,
  });

  const isFlowboxConnected = devInfo?.fiscalProvider === 'flowbox';

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
              Gateway fiscal centralizado Flowbox (TECHBOXBR)
            </p>
          </div>
        </div>
        {isFlowboxConnected ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="h-3 w-3" />
            Flowbox Conectado
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <AlertCircle className="h-3 w-3" />
            Flowbox Desconectado (Pendente)
          </span>
        )}
      </div>

      {/* Alerta Real do Estado da Integração */}
      {!isFlowboxConnected && (
        <div className="flex items-start gap-2.5 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-amber-800 dark:text-amber-300">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="text-[11px] space-y-1">
            <p className="font-semibold">Serviço Flowbox ainda não iniciado</p>
            <p className="text-secondary leading-relaxed">
              O microsserviço Flowbox Fiscal Gateway não está rodando nesta instância. O VisionBox está atualmente em modo local/homologação. A comunicação externa e emissão oficial com a SEFAZ será ativada assim que o Flowbox for iniciado na porta 8085 ou na VPS.
            </p>
          </div>
        </div>
      )}

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
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Isolamento do Certificado
            </span>
            <p className="text-[11px] text-muted">
              O arquivo <code className="text-primary font-mono">.pfx</code> e sua senha nunca ficam expostos no navegador ou nos caixas locais, prevenindo clonagem e vazamento.
            </p>
          </div>
          <div className="rounded border border-border bg-card p-2.5">
            <span className="font-semibold text-primary flex items-center gap-1.5 mb-1">
              <Zap className="h-3.5 w-3.5 text-amber-500" /> Assinatura e Autorização
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
          Parâmetros Fiscais Cadastrados no Banco
        </h4>
        <dl className="grid gap-2 sm:grid-cols-3">
          <div className="rounded border border-border bg-card p-2.5">
            <dt className="text-[10px] text-muted uppercase font-medium">Razão Social</dt>
            <dd className="text-xs font-semibold text-primary mt-0.5 truncate">
              {empresa?.nome || 'Não cadastrada'}
            </dd>
          </div>
          <div className="rounded border border-border bg-card p-2.5">
            <dt className="text-[10px] text-muted uppercase font-medium">CNPJ Emitente</dt>
            <dd className="font-mono text-xs font-semibold text-primary mt-0.5">
              {empresa?.cnpj ? empresa.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : 'Pendente de cadastro'}
            </dd>
          </div>
          <div className="rounded border border-border bg-card p-2.5">
            <dt className="text-[10px] text-muted uppercase font-medium">Status do Provider</dt>
            <dd className="text-xs font-semibold text-primary mt-0.5">
              {isFlowboxConnected ? 'Flowbox Ativo' : 'Simulação Local / Pendente'}
            </dd>
          </div>
        </dl>
      </div>

      {/* NCMs e Regras Óticas */}
      <div className="rounded-lg border border-border bg-card p-3 space-y-2">
        <h4 className="font-semibold text-primary flex items-center gap-1.5">
          <HelpCircle className="h-3.5 w-3.5 text-blue-500" />
          Regras de Tributação e NCMs do Setor Óptico (Referência)
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
      <div className="flex items-start gap-2.5 rounded border border-border bg-card p-3 text-secondary">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-muted" />
        <div className="text-[11px] space-y-0.5">
          <p className="font-semibold text-primary">Contingência Offline no PDV</p>
          <p className="text-muted">
            Se a internet ou o serviço fiscal estiver indisponível, o PDV do VisionBox permite concluir vendas normalmente. As notas são enfileiradas no outbox para transmissão assim que o serviço for restabelecido.
          </p>
        </div>
      </div>
    </section>
  );
}
