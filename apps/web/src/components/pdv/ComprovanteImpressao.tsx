import * as React from 'react';
import { FileText, Printer, QrCode, ReceiptText, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEmpresaStore } from '@/stores/empresaStore';
import {
  executarImpressao,
  gerarHtmlReciboNaoFiscal,
  gerarHtmlNfce,
  gerarHtmlDanfeNfe,
  gerarHtmlOrcamento,
  type DadosImpressao,
  type ItemImpressao,
} from '@/lib/reciboPrint';

export interface ComprovanteItem extends ItemImpressao {
  sku: string;
  nome: string;
  qtd: number;
  preco: number;
  ncm?: string;
}

export type TipoDocumentoFiscal = 'CUPOM' | 'NFCE' | 'DANFE' | 'ORCAMENTO';

export interface ComprovanteProps {
  osNumero?: string;
  clienteNome?: string;
  clienteCpf?: string;
  clienteTelefone?: string;
  clienteEndereco?: string;
  data?: Date | string;
  itens: ComprovanteItem[];
  subtotal: number;
  desconto: number;
  total: number;
  formaPagamento: string;
  chaveNfce?: string;
  protocoloNfce?: string;
  tipo?: 'cupom' | 'os';
  tipoDocumento?: TipoDocumentoFiscal;
  grauOD?: string;
  grauOE?: string;
  onTipoDocumentoChange?: (tipo: TipoDocumentoFiscal) => void;
}

/**
 * Comprovante de venda e Documentos Fiscais (Cupom Não-Fiscal, NFC-e e DANFE).
 * Layout fiel a impressoras de bobina térmica 80mm de ótica conforme templates oficiais:
 * - D:\TECHBOXBR\PRODUTOS\VisionBox\templates recibos\recibo.html
 * - D:\TECHBOXBR\PRODUTOS\VisionBox\templates recibos\cupom-fiscal.html
 */
export function ComprovanteImpressao({
  osNumero = '—',
  clienteNome = 'Consumidor',
  clienteCpf,
  clienteTelefone,
  clienteEndereco,
  data = new Date(),
  itens,
  subtotal,
  desconto,
  total,
  formaPagamento,
  chaveNfce,
  protocoloNfce,
  tipoDocumento = 'CUPOM',
  grauOD,
  grauOE,
  onTipoDocumentoChange,
}: ComprovanteProps) {
  const empresa = useEmpresaStore((s) => s.empresa);
  const [formato, setFormato] = React.useState<TipoDocumentoFiscal>(tipoDocumento);

  React.useEffect(() => {
    setFormato(tipoDocumento);
  }, [tipoDocumento]);

  const handleSelectFormato = (novo: TipoDocumentoFiscal) => {
    setFormato(novo);
    if (onTipoDocumentoChange) {
      onTipoDocumentoChange(novo);
    }
  };

  const dataFormatada = new Date(data).toLocaleString('pt-BR');

  const cnpjFormatado = empresa?.cnpj
    ? empresa.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
    : '00.000.000/0001-91';
  const contatoEmpresa = empresa?.telefone || empresa?.whatsapp || '(11) 99999-0000';
  const enderecoEmpresa = [empresa?.endereco, empresa?.numero, empresa?.cidade, empresa?.uf]
    .filter(Boolean)
    .join(', ') || 'Rua das Óticas, 100 - Centro, São Paulo - SP';

  const htmlDocument = React.useMemo(() => {
    const dados: DadosImpressao = {
      osNumero,
      data,
      empresa: {
        nome: empresa?.nome,
        razaoSocial: empresa?.razaoSocial || empresa?.nome,
        cnpj: empresa?.cnpj,
        inscricaoEstadual: empresa?.inscricaoEstadual,
        endereco: empresa?.endereco,
        numero: empresa?.numero,
        bairro: empresa?.bairro,
        cidade: empresa?.cidade,
        uf: empresa?.uf,
        cep: empresa?.cep,
        telefone: empresa?.telefone,
        whatsapp: empresa?.whatsapp || undefined,
        logoUrl: empresa?.logoUrl || '/api/v1/empresa/logo.png',
      },
      cliente: {
        nome: clienteNome,
        cpf: clienteCpf || undefined,
        telefone: clienteTelefone,
        endereco: clienteEndereco,
      },
      itens,
      subtotal,
      desconto,
      total,
      formaPagamento,
      chaveNfce,
      protocoloNfce,
      tipoDocumento: formato,
      grauOD,
      grauOE,
    };

    if (formato === 'ORCAMENTO') {
      return gerarHtmlOrcamento(dados);
    }
    if (formato === 'DANFE') {
      return gerarHtmlDanfeNfe(dados);
    }
    if (formato === 'NFCE') {
      return gerarHtmlNfce(dados);
    }
    return gerarHtmlReciboNaoFiscal(dados);
  }, [
    osNumero,
    data,
    empresa,
    clienteNome,
    clienteCpf,
    clienteTelefone,
    clienteEndereco,
    itens,
    subtotal,
    desconto,
    total,
    formaPagamento,
    chaveNfce,
    protocoloNfce,
    formato,
    grauOD,
    grauOE,
  ]);

  const handlePrint = () => {
    executarImpressao(htmlDocument);
  };

  const handleIframeLoad = (e: React.SyntheticEvent<HTMLIFrameElement>) => {
    const iframe = e.currentTarget;
    try {
      if (iframe.contentDocument) {
        const bodyH = iframe.contentDocument.body?.scrollHeight || 0;
        const docH = iframe.contentDocument.documentElement?.scrollHeight || 0;
        const finalH = Math.max(bodyH, docH);
        if (finalH > 200) {
          iframe.style.height = `${finalH + 20}px`;
        }
      }
    } catch {
      // fallback safe
    }
  };

  const getTipoDescricao = () => {
    switch (formato) {
      case 'ORCAMENTO':
        return {
          titulo: 'Orçamento Comercial (A4)',
          detalhe: 'Proposta comercial formal em folha A4 com dados da ótica, cliente, termos e assinaturas.',
          largura: 'w-full max-w-[780px]',
          minAltura: 'min-h-[920px]',
        };
      case 'DANFE':
        return {
          titulo: 'DANFE NF-e Mod. 55 (A4)',
          detalhe: 'Documento Auxiliar da Nota Fiscal Eletrônica oficial padrão SEFAZ em folha A4.',
          largura: 'w-full max-w-[780px]',
          minAltura: 'min-h-[960px]',
        };
      case 'NFCE':
        return {
          titulo: 'DANFE NFC-e Mod. 65 (80mm)',
          detalhe: 'Cupom fiscal eletrônico para impressora térmica de bobina 80mm com QR Code oficial.',
          largura: 'w-[350px]',
          minAltura: 'min-h-[580px]',
        };
      default:
        return {
          titulo: 'Recibo Não-Fiscal (80mm)',
          detalhe: 'Comprovante térmico de venda de 80mm para controle da loja e do cliente.',
          largura: 'w-[340px]',
          minAltura: 'min-h-[520px]',
        };
    }
  };

  const descAtual = getTipoDescricao();

  return (
    <div className="space-y-3">
      {/* Seletor de Formatos / Abas de Visualização */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border bg-page p-2">
        <span className="text-xs font-semibold text-secondary flex items-center gap-1.5">
          <FileText className="h-4 w-4 text-brand" /> Modelo do Documento:
        </span>
        <div className="flex flex-wrap items-center gap-1">
          <Button
            type="button"
            variant={formato === 'ORCAMENTO' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => handleSelectFormato('ORCAMENTO')}
            className="h-7 text-xs gap-1"
          >
            <FileText className="h-3.5 w-3.5" /> Orçamento (A4)
          </Button>
          <Button
            type="button"
            variant={formato === 'CUPOM' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => handleSelectFormato('CUPOM')}
            className="h-7 text-xs gap-1"
          >
            <ReceiptText className="h-3.5 w-3.5" /> Recibo 80mm
          </Button>
          <Button
            type="button"
            variant={formato === 'NFCE' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => handleSelectFormato('NFCE')}
            className="h-7 text-xs gap-1"
          >
            <QrCode className="h-3.5 w-3.5" /> NFC-e (Mod. 65)
          </Button>
          <Button
            type="button"
            variant={formato === 'DANFE' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => handleSelectFormato('DANFE')}
            className="h-7 text-xs gap-1"
          >
            <ShieldCheck className="h-3.5 w-3.5" /> DANFE (Mod. 55)
          </Button>
        </div>
      </div>

      {/* Informativo do Formato Ativo */}
      <div className="flex items-center justify-between px-3 py-1.5 rounded border border-border bg-card-soft text-xs text-secondary">
        <div>
          <strong className="text-primary font-semibold">{descAtual.titulo}:</strong>{' '}
          <span>{descAtual.detalhe}</span>
        </div>
      </div>

      {/* Pré-visualização Real 1:1 Correspondente ao Modelo Selecionado */}
      <div className="flex justify-center bg-gray-200/90 dark:bg-gray-950/80 p-3 sm:p-5 rounded-card border border-border max-h-[62vh] overflow-y-auto">
        <div
          className={`${descAtual.largura} ${descAtual.minAltura} bg-white shadow-2xl rounded-[3px] border border-gray-300 overflow-hidden transition-all duration-150`}
        >
          <iframe
            key={formato}
            title={`Pré-visualização ${descAtual.titulo}`}
            srcDoc={htmlDocument}
            onLoad={handleIframeLoad}
            className="w-full border-0 bg-white"
            style={{
              minHeight: formato === 'ORCAMENTO' || formato === 'DANFE' ? '920px' : '540px',
            }}
          />
        </div>
      </div>

      {/* Ação de impressão */}
      <div className="flex justify-end gap-2 pt-1">
        <Button onClick={handlePrint} className="gap-2 bg-primary text-primary-foreground font-bold shadow-sm">
          <Printer className="h-4 w-4" aria-hidden /> Imprimir {descAtual.titulo}
        </Button>
      </div>
    </div>
  );
}
