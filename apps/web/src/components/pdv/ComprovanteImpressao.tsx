import * as React from 'react';
import { FileText, Printer, QrCode, ReceiptText, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEmpresaStore } from '@/stores/empresaStore';
import {
  executarImpressao,
  gerarHtmlReciboNaoFiscal,
  gerarHtmlNfce,
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

export type TipoDocumentoFiscal = 'CUPOM' | 'NFCE' | 'DANFE';

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

  const handlePrint = () => {
    const dados: DadosImpressao = {
      osNumero,
      data,
      empresa: {
        nome: empresa?.nome,
        cnpj: empresa?.cnpj,
        endereco: empresa?.endereco,
        numero: empresa?.numero,
        bairro: empresa?.bairro,
        cidade: empresa?.cidade,
        uf: empresa?.uf,
        telefone: empresa?.telefone,
        whatsapp: empresa?.whatsapp || undefined,
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

    if (formato === 'NFCE') {
      executarImpressao(gerarHtmlNfce(dados));
    } else {
      executarImpressao(gerarHtmlReciboNaoFiscal(dados));
    }
  };

  return (
    <div className="space-y-3">
      {/* Seletor de Formatos / Abas de Visualização */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border bg-page p-2">
        <span className="text-xs font-semibold text-secondary flex items-center gap-1.5">
          <FileText className="h-4 w-4 text-brand" /> Modelo do Recibo:
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant={formato === 'CUPOM' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => handleSelectFormato('CUPOM')}
            className="h-7 text-xs gap-1"
          >
            <ReceiptText className="h-3.5 w-3.5" /> Cupom (Não-Fiscal)
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

      {/* Visualização de Bobina Térmica 80mm Centralizada e Fiel ao Template */}
      <div className="flex justify-center bg-gray-100 dark:bg-gray-900/50 p-3 sm:p-5 rounded-card border border-border max-h-[60vh] overflow-y-auto">
        <section
          id="area-comprovante-impressao"
          aria-label="Comprovante da venda"
          className="w-full max-w-[320px] bg-white p-5 text-black shadow-md rounded-[2px] border border-gray-300 text-[11px] leading-tight select-text"
          style={{ fontFamily: "'Lucida Console', 'Consolas', 'Courier New', monospace" }}
        >
          {/* Cabeçalho Empresa */}
          <div className="text-center">
            <h4 className="font-bold text-xs uppercase tracking-wide">
              {empresa?.nome || 'VISIONBOX ÓTICA MATRIZ'}
            </h4>
            <div className="text-[10px] text-gray-700 leading-tight mt-1">
              <div>CNPJ: {cnpjFormatado}</div>
              <div>{enderecoEmpresa}</div>
              <div>Fone: {contatoEmpresa}</div>
            </div>
          </div>

          <div className="my-2 border-b border-dashed border-black" />
          <h4 className="font-bold text-xs text-center uppercase tracking-wider">
            {formato === 'CUPOM'
              ? 'CUPOM NÃO FISCAL'
              : formato === 'NFCE'
                ? (chaveNfce ? 'DANFE NFC-e (MOD. 65)' : 'NFC-e (MOD. 65) — PENDENTE SEFAZ')
                : (chaveNfce ? 'DANFE NF-e (MOD. 55)' : 'NF-e (MOD. 55) — PENDENTE SEFAZ')}
          </h4>
          <div className="my-2 border-b border-dashed border-black" />

          {/* Dados da Venda */}
          <div className="text-[11px] space-y-0.5">
            <div className="flex justify-between">
              <span>Venda / OS N°:</span>
              <strong className="font-bold">{osNumero}</strong>
            </div>
            <div className="flex justify-between">
              <span>Data:</span>
              <span>{dataFormatada}</span>
            </div>
          </div>

          <div className="my-2 border-b border-dashed border-black" />

          {/* Dados do Cliente */}
          <div className="text-[11px] space-y-0.5">
            <div><strong>CLIENTE:</strong> {clienteNome.toUpperCase()}</div>
            <div><strong>CPF:</strong> {clienteCpf || 'CONSUMIDOR FINAL'}</div>
            {clienteTelefone && <div><strong>Fone:</strong> {clienteTelefone}</div>}
            {clienteEndereco && <div><strong>End.:</strong> {clienteEndereco}</div>}
          </div>

          {(grauOD || grauOE) && (
            <>
              <div className="my-2 border-b border-dashed border-black" />
              <div className="text-[10px]">
                <strong>PRESCRIÇÃO ÓTICA:</strong>
                {grauOD && <div>OD: {grauOD}</div>}
                {grauOE && <div>OE: {grauOE}</div>}
              </div>
            </>
          )}

          <div className="my-2 border-b border-dashed border-black" />

          {/* Tabela de Itens */}
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="border-b border-black text-[10px] uppercase">
                <th className="py-1">Item</th>
                <th className="py-1 text-right">Qtd</th>
                <th className="py-1 text-right">Unit.</th>
                <th className="py-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((it, idx) => (
                <tr key={idx} className="border-b border-gray-100">
                  <td className="py-1 pr-1">{it.nome}</td>
                  <td className="py-1 text-right">{it.qtd}</td>
                  <td className="py-1 text-right">R$ {it.preco.toFixed(2)}</td>
                  <td className="py-1 text-right font-bold">R$ {(it.preco * it.qtd).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="my-2 border-b border-dashed border-black" />

          {/* Totais */}
          <table className="w-full text-[11px] font-bold">
            <tbody>
              <tr>
                <td>Subtotal:</td>
                <td className="text-right">R$ {subtotal.toFixed(2)}</td>
              </tr>
              {desconto > 0 && (
                <tr>
                  <td>Desconto:</td>
                  <td className="text-right">-R$ {desconto.toFixed(2)}</td>
                </tr>
              )}
              <tr className="text-xs">
                <td className="pt-1 font-black">TOTAL:</td>
                <td className="pt-1 text-right font-black">R$ {total.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <div className="my-2 border-b border-dashed border-black" />

          {/* Pagamento */}
          <div className="text-[11px]">
            <div className="font-bold">PAGAMENTO:</div>
            <div className="flex justify-between mt-0.5">
              <span>{formaPagamento}</span>
              <span className="font-bold">R$ {total.toFixed(2)}</span>
            </div>
          </div>

          <div className="my-3 border-b border-dashed border-black" />
          <div className="text-center font-bold text-[11px] leading-tight">
            OBRIGADO PELA PREFERENCIA!<br />
            Volte Sempre &#9829;
          </div>
          <div className="my-2 border-b border-dashed border-black" />

          <div className="text-[9px] text-center text-gray-600 mt-2 leading-tight">
            Garantia: 90 dias contra defeitos de fabricação na armação e adaptação de lentes conforme CDC.
            <div className="border-t border-gray-400 mt-4 pt-1">
              Assinatura do Cliente / Comprovante de Retirada
            </div>
          </div>
        </section>
      </div>

      {/* Ação de impressão */}
      <div className="flex justify-end gap-2">
        <Button onClick={handlePrint} className="gap-2 bg-primary text-primary-foreground font-bold shadow-sm">
          <Printer className="h-4 w-4" aria-hidden /> Imprimir {formato === 'CUPOM' ? 'Cupom Não-Fiscal' : formato === 'NFCE' ? 'NFC-e' : 'DANFE'}
        </Button>
      </div>
    </div>
  );
}
