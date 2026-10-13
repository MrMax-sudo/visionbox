import * as React from 'react';
import { FileText, Printer, QrCode, ReceiptText, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useEmpresaStore } from '@/stores/empresaStore';

export interface ComprovanteItem {
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
 * Layout monocromático fiel a impressoras de bobina (térmicas 80mm) e folhas de recibo.
 * Permite comutar interativamente entre os 3 formatos com visualização prévia completa.
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
  tipo = 'cupom',
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
  const handlePrint = () => {
    window.print();
  };

  const cnpjFormatado = empresa?.cnpj
    ? empresa.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
    : '00.000.000/0001-91';
  const contatoEmpresa = empresa?.telefone || empresa?.whatsapp || '(11) 99999-0000';
  const enderecoEmpresa = [empresa?.endereco, empresa?.numero, empresa?.cidade, empresa?.uf]
    .filter(Boolean)
    .join(', ') || 'Rua das Óticas, 100 - Centro, São Paulo - SP';

  // Chave de acesso simulada para homologação se não houver chave real retornada
  const chaveFiscalExibicao = chaveNfce || '3526 1000 0000 0001 9165 0010 0000 0123 1000 0012 3456';
  const protocoloExibicao = protocoloNfce || '135260098765432 - 12/10/2026 20:30:00';
  const tributosAprox = total * 0.18; // ~18% tributos aprox. (Lei 12.741/2012)

  return (
    <div className="space-y-4">
      {/* Seletor de Formatos / Abas de Visualização (oculto na impressão) */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border bg-page p-2 print:hidden">
        <span className="text-xs font-semibold text-secondary flex items-center gap-1.5">
          <FileText className="h-4 w-4 text-brand" /> Visualizar Modelo:
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

      {/* Área visível na tela e formatada para impressão */}
      <section
        id="area-comprovante-impressao"
        aria-label="Comprovante da venda"
        className="rounded-card border border-border bg-white p-6 font-mono text-black shadow-sm print:m-0 print:border-0 print:p-0 print:text-[10pt]"
      >
        {/* ================================================================= */}
        {/* MODELO 1: CUPOM NÃO-FISCAL                                       */}
        {/* ================================================================= */}
        {formato === 'CUPOM' && (
          <div>
            {/* Cabeçalho */}
            <div className="mb-3 border-b border-dashed border-gray-400 pb-3 text-center">
              <h2 className="text-sm font-bold tracking-wider uppercase">
                {empresa?.nome || 'VISIONBOX ÓTICA'}
              </h2>
              <p className="text-[10px] text-gray-600">CNPJ: {cnpjFormatado}</p>
              <p className="text-[10px] text-gray-600">Atendimento: {contatoEmpresa}</p>
              <p className="text-[10px] text-gray-600">{enderecoEmpresa}</p>
              <div className="mt-2 inline-block rounded border border-gray-300 bg-gray-100 px-2.5 py-0.5 text-[11px] font-bold text-black">
                {tipo === 'os' ? 'VIA DE ORDEM DE SERVIÇO' : 'COMPROVANTE DE PEDIDO / VENDA'}
              </div>
              <p className="mt-1 text-[9px] font-bold tracking-wide text-gray-500 uppercase">
                *** NÃO É DOCUMENTO FISCAL ***
              </p>
            </div>

            {/* Informações da OS e Cliente */}
            <div className="mb-3 space-y-1 border-b border-dashed border-gray-400 pb-3">
              <div className="flex justify-between gap-3">
                <span className="font-bold">NÚMERO OS:</span>
                <span className="font-bold">{osNumero}</span>
              </div>
              <div className="flex justify-between gap-3 text-[11px]">
                <span>EMISSÃO:</span>
                <span>{dataFormatada}</span>
              </div>
              <div className="flex justify-between gap-3 text-[11px]">
                <span>CLIENTE:</span>
                <span className="font-bold">{clienteNome}</span>
              </div>
              {clienteCpf && (
                <div className="flex justify-between gap-3 text-[11px]">
                  <span>CPF:</span>
                  <span>{clienteCpf}</span>
                </div>
              )}
              {clienteTelefone && (
                <div className="flex justify-between gap-3 text-[11px]">
                  <span>TELEFONE:</span>
                  <span>{clienteTelefone}</span>
                </div>
              )}
            </div>

            {/* Prescrição Ótica (se houver) */}
            {(grauOD || grauOE) && (
              <div className="mb-3 border-b border-dashed border-gray-400 pb-3">
                <p className="mb-1 text-[11px] font-bold">PRESCRIÇÃO ÓTICA (GRAUS):</p>
                {grauOD && <p className="text-[10px]">OD: {grauOD}</p>}
                {grauOE && <p className="text-[10px]">OE: {grauOE}</p>}
              </div>
            )}

            {/* Itens */}
            <div className="mb-3 border-b border-dashed border-gray-400 pb-3">
              <p className="mb-1 text-[11px] font-bold">ITENS DO PEDIDO:</p>
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200 text-[10px] text-gray-500">
                    <th scope="col" className="py-1">ITEM</th>
                    <th scope="col" className="py-1 text-center">QTD</th>
                    <th scope="col" className="py-1 text-right">UN (R$)</th>
                    <th scope="col" className="py-1 text-right">TOTAL (R$)</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((it, idx) => (
                    <tr key={idx} className="border-b border-gray-100 text-[11px]">
                      <td className="py-1 pr-1 font-sans">{it.nome}</td>
                      <td className="py-1 text-center">{it.qtd}</td>
                      <td className="py-1 text-right">{it.preco.toFixed(2)}</td>
                      <td className="py-1 text-right font-bold">{(it.preco * it.qtd).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totais e Pagamento */}
            <div className="mb-3 space-y-1 border-b border-dashed border-gray-400 pb-3 text-[11px]">
              <div className="flex justify-between gap-3">
                <span>SUBTOTAL:</span>
                <span>R$ {subtotal.toFixed(2)}</span>
              </div>
              {desconto > 0 && (
                <div className="flex justify-between gap-3 text-gray-600">
                  <span>DESCONTO:</span>
                  <span>- R$ {desconto.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between gap-3 border-t border-gray-300 pt-1 text-sm font-bold">
                <span>TOTAL PAGO:</span>
                <span>R$ {total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-3 pt-1 text-[11px]">
                <span>FORMA DE PAGAMENTO:</span>
                <span className="font-bold">{formaPagamento}</span>
              </div>
            </div>

            {/* Termo de Garantia e Rodapé */}
            <div className="space-y-3 pt-2 text-center text-[10px] text-gray-500">
              <p className="font-sans leading-relaxed">
                Termo de Garantia: 90 dias contra defeitos de fabricação na armação e adaptação das lentes oftálmicas conforme CDC.
              </p>
              <div className="border-t border-gray-300 pt-6">
                <p className="text-[9px] text-gray-400">Assinatura do Cliente / Comprovante de Retirada</p>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* MODELO 2: DANFE NFC-e (MODELO 65)                                */}
        {/* ================================================================= */}
        {formato === 'NFCE' && (
          <div>
            <div className="mb-3 border-b border-dashed border-gray-400 pb-3 text-center">
              <h2 className="text-sm font-bold tracking-wider uppercase">
                {empresa?.nome || 'VISIONBOX ÓTICA'}
              </h2>
              <p className="text-[10px] text-gray-600">CNPJ: {cnpjFormatado}</p>
              <p className="text-[10px] text-gray-600">{enderecoEmpresa}</p>
              <div className="mt-2 inline-block rounded border border-black bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-black uppercase">
                DANFE NFC-e - Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica
              </div>
              <p className="mt-1 text-[9px] text-gray-600">Não permite aproveitamento de crédito de ICMS</p>
            </div>

            {/* Detalhe dos Itens */}
            <div className="mb-3 border-b border-dashed border-gray-400 pb-3 text-[11px]">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-300 text-[10px] text-gray-600">
                    <th className="py-1">CÓD / DESCRIÇÃO</th>
                    <th className="py-1 text-center">QTD</th>
                    <th className="py-1 text-right">VL UN</th>
                    <th className="py-1 text-right">VL TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((it, idx) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td className="py-1 pr-1 font-sans">
                        <span className="font-mono text-[10px] text-gray-500">[{it.sku}] </span>
                        {it.nome}
                      </td>
                      <td className="py-1 text-center">{it.qtd} UN</td>
                      <td className="py-1 text-right">{it.preco.toFixed(2)}</td>
                      <td className="py-1 text-right font-bold">{(it.preco * it.qtd).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totais Fiscais */}
            <div className="mb-3 space-y-1 border-b border-dashed border-gray-400 pb-3 text-[11px]">
              <div className="flex justify-between">
                <span>QTD. TOTAL DE ITENS:</span>
                <span>{itens.reduce((acc, i) => acc + i.qtd, 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>VALOR TOTAL R$:</span>
                <span>{subtotal.toFixed(2)}</span>
              </div>
              {desconto > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>DESCONTO R$:</span>
                  <span>- {desconto.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold border-t border-gray-300 pt-1">
                <span>VALOR A PAGAR R$:</span>
                <span>{total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span>FORMA DE PAGAMENTO:</span>
                <span>{formaPagamento} (R$ {total.toFixed(2)})</span>
              </div>
              <div className="flex justify-between text-[10px] text-gray-500 pt-1">
                <span>Tributos Totais Incidentes (Lei 12.741/2012):</span>
                <span>R$ {tributosAprox.toFixed(2)} (18.00%)</span>
              </div>
            </div>

            {/* Informações Fiscais da NFC-e */}
            <div className="mb-3 border-b border-dashed border-gray-400 pb-3 text-center text-[10px]">
              <p className="font-bold">EMISSÃO EM HOMOLOGAÇÃO / SEFAZ</p>
              <p>Número: 000.000.123 • Série: 001 • Data: {dataFormatada}</p>
              <div className="my-2 rounded border border-gray-300 bg-gray-50 p-2 font-mono">
                <p className="text-[9px] text-gray-500 mb-0.5">CHAVE DE ACESSO:</p>
                <p className="text-[10px] font-bold break-all">{chaveFiscalExibicao}</p>
              </div>
              <p className="text-[9px] text-gray-600">Protocolo de Autorização: {protocoloExibicao}</p>
            </div>

            {/* Bloco QR-Code SEFAZ */}
            <div className="mb-3 border-b border-dashed border-gray-400 pb-3 text-center">
              <div className="inline-flex flex-col items-center justify-center p-2 border border-gray-300 rounded bg-gray-50">
                <QrCode className="h-20 w-20 text-black stroke-[1.5]" />
                <span className="text-[8px] text-gray-500 mt-1">Consulte via QR-Code</span>
              </div>
              <p className="text-[9px] text-gray-500 mt-2">
                Consulte pela Chave de Acesso no portal oficial da SEFAZ
              </p>
            </div>

            {/* Consumidor */}
            <div className="text-[10px] text-gray-600 text-center">
              <p>CONSUMIDOR: {clienteNome} {clienteCpf ? `(CPF: ${clienteCpf})` : '(Consumidor não identificado)'}</p>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* MODELO 3: DANFE COMPLETO NF-e (MODELO 55)                         */}
        {/* ================================================================= */}
        {formato === 'DANFE' && (
          <div className="border border-black p-3 text-[10px] leading-tight font-sans">
            {/* Topo DANFE */}
            <div className="grid grid-cols-[1fr_140px_1fr] border-b border-black pb-2 gap-2">
              <div>
                <h3 className="font-bold text-xs uppercase">{empresa?.nome || 'VISIONBOX ÓTICA'}</h3>
                <p className="text-[9px]">{enderecoEmpresa}</p>
                <p className="text-[9px]">Fone: {contatoEmpresa}</p>
              </div>
              <div className="border-x border-black px-2 text-center">
                <p className="font-bold text-sm">DANFE</p>
                <p className="text-[8px]">Documento Auxiliar da Nota Fiscal Eletrônica</p>
                <p className="text-[9px] font-bold mt-1">0 - ENTRADA<br/>1 - SAÍDA: <strong>1</strong></p>
                <p className="text-[9px] font-bold mt-1">Nº: 000.000.123</p>
                <p className="text-[8px]">SÉRIE: 001</p>
              </div>
              <div className="text-right">
                <div className="border border-black p-1 bg-gray-100 text-center font-mono text-[8px] mb-1">
                  |||||| |||||||| |||| |||||||||||| |||||||
                </div>
                <p className="text-[8px] font-bold break-all font-mono">CHAVE DE ACESSO:</p>
                <p className="text-[8px] break-all font-mono">{chaveFiscalExibicao}</p>
                <p className="text-[8px] text-gray-600 mt-1">Protocolo: {protocoloExibicao}</p>
              </div>
            </div>

            {/* Natureza da Operação */}
            <div className="grid grid-cols-2 border-b border-black py-1.5 gap-2">
              <div>
                <span className="text-[8px] text-gray-500">NATUREZA DA OPERAÇÃO:</span>
                <p className="font-bold">VENDA DE MERCADORIA AO CONSUMIDOR</p>
              </div>
              <div>
                <span className="text-[8px] text-gray-500">INSCRIÇÃO ESTADUAL / CNPJ:</span>
                <p className="font-bold">ISENTO • {cnpjFormatado}</p>
              </div>
            </div>

            {/* Destinatário */}
            <div className="border-b border-black py-1.5">
              <p className="font-bold text-[9px] mb-1">DESTINATÁRIO / REMETENTE</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-[8px] text-gray-500">NOME / RAZÃO SOCIAL:</span>
                  <p className="font-bold">{clienteNome}</p>
                </div>
                <div>
                  <span className="text-[8px] text-gray-500">CPF / CNPJ:</span>
                  <p>{clienteCpf || '000.000.000-00'}</p>
                </div>
                <div>
                  <span className="text-[8px] text-gray-500">DATA DA EMISSÃO:</span>
                  <p>{dataFormatada.split(' ')[0]}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <div>
                  <span className="text-[8px] text-gray-500">ENDEREÇO:</span>
                  <p>{clienteEndereco || 'Rua Principal, 100'}</p>
                </div>
                <div>
                  <span className="text-[8px] text-gray-500">TELEFONE:</span>
                  <p>{clienteTelefone || '(11) 99999-9999'}</p>
                </div>
                <div>
                  <span className="text-[8px] text-gray-500">UF / MUNICÍPIO:</span>
                  <p>SP / SÃO PAULO</p>
                </div>
              </div>
            </div>

            {/* Cálculo do Imposto */}
            <div className="border-b border-black py-1.5">
              <p className="font-bold text-[9px] mb-1">CÁLCULO DO IMPOSTO</p>
              <div className="grid grid-cols-5 text-center gap-1 bg-gray-50 border border-gray-300 p-1">
                <div>
                  <span className="text-[8px] text-gray-500">BASE CÁLC. ICMS</span>
                  <p className="font-bold">0,00</p>
                </div>
                <div>
                  <span className="text-[8px] text-gray-500">VALOR DO ICMS</span>
                  <p className="font-bold">0,00</p>
                </div>
                <div>
                  <span className="text-[8px] text-gray-500">DESCONTO</span>
                  <p className="font-bold">R$ {desconto.toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-[8px] text-gray-500">TOTAL PRODUTOS</span>
                  <p className="font-bold">R$ {subtotal.toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-[8px] text-gray-500">VALOR TOTAL NOTA</span>
                  <p className="font-bold text-xs">R$ {total.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Dados dos Produtos */}
            <div className="py-1.5">
              <p className="font-bold text-[9px] mb-1">DADOS DOS PRODUTOS / SERVIÇOS</p>
              <table className="w-full text-left border border-gray-300">
                <thead>
                  <tr className="bg-gray-100 text-[8px] text-gray-600 border-b border-gray-300">
                    <th className="p-1">CÓDIGO</th>
                    <th className="p-1">DESCRIÇÃO DO PRODUTO</th>
                    <th className="p-1 text-center">NCM</th>
                    <th className="p-1 text-center">CFOP</th>
                    <th className="p-1 text-center">QTD</th>
                    <th className="p-1 text-right">VL UNIT</th>
                    <th className="p-1 text-right">VL TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((it, idx) => (
                    <tr key={idx} className="border-b border-gray-200 text-[9px]">
                      <td className="p-1 font-mono">{it.sku}</td>
                      <td className="p-1">{it.nome}</td>
                      <td className="p-1 text-center font-mono">{it.ncm || '90031100'}</td>
                      <td className="p-1 text-center font-mono">5102</td>
                      <td className="p-1 text-center">{it.qtd}</td>
                      <td className="p-1 text-right">R$ {it.preco.toFixed(2)}</td>
                      <td className="p-1 text-right font-bold">R$ {(it.preco * it.qtd).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Dados Adicionais */}
            <div className="border-t border-black pt-1.5 text-[8px] text-gray-600">
              <p className="font-bold text-[9px]">DADOS ADICIONAIS / INFORMAÇÕES COMPLEMENTARES:</p>
              <p>Documento emitido por ME ou EPP optante pelo Simples Nacional. Não gera direito a crédito fiscal de IPI.</p>
              <p>Ordem de Serviço Vinculada: {osNumero} • Pagamento: {formaPagamento}</p>
            </div>
          </div>
        )}
      </section>

      {/* Ação de impressão */}
      <div className="flex justify-end gap-2 print:hidden">
        <Button onClick={handlePrint} className="gap-2">
          <Printer className="h-4 w-4" aria-hidden /> Imprimir {formato === 'CUPOM' ? 'Cupom' : formato === 'NFCE' ? 'NFC-e' : 'DANFE'}
        </Button>
      </div>
    </div>
  );
}
