/**
 * Utilitário de Geração e Impressão de Recibos e Documentos Fiscais
 * Fiel aos templates de bobina térmica 80mm e DANFE A4 em:
 * D:\TECHBOXBR\PRODUTOS\VisionBox\templates recibos\recibo.html
 * D:\TECHBOXBR\PRODUTOS\VisionBox\templates recibos\cupom-fiscal.html
 * D:\TECHBOXBR\PRODUTOS\VisionBox\templates recibos\danfe-nfe.html
 */

export interface ItemImpressao {
  sku?: string;
  nome: string;
  qtd: number;
  preco: number;
  ncm?: string;
}

export interface EmpresaImpressao {
  nome?: string;
  razaoSocial?: string;
  cnpj?: string;
  inscricaoEstadual?: string;
  endereco?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  telefone?: string;
  whatsapp?: string;
}

export interface ClienteImpressao {
  nome?: string;
  cpf?: string;
  telefone?: string;
  endereco?: string;
}

export interface DadosImpressao {
  osNumero: string;
  data?: Date | string;
  empresa?: EmpresaImpressao;
  cliente?: ClienteImpressao;
  itens: ItemImpressao[];
  subtotal: number;
  desconto?: number;
  total: number;
  formaPagamento: string;
  valorRecebido?: number;
  troco?: number;
  chaveNfce?: string;
  protocoloNfce?: string;
  tipoDocumento?: 'CUPOM' | 'NFCE' | 'DANFE';
  grauOD?: string;
  grauOE?: string;
}

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatarData(data?: Date | string): string {
  const d = data ? new Date(data) : new Date();
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatarCpfCnpj(doc?: string): string {
  if (!doc) return 'CONSUMIDOR FINAL';
  const clean = doc.replace(/\D/g, '');
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (clean.length === 14) {
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return doc;
}

/**
 * Gera o HTML exato da bobina térmica 80mm para Cupom Não-Fiscal
 * Baseado 1:1 em templates recibos/recibo.html
 */
export function gerarHtmlReciboNaoFiscal(dados: DadosImpressao): string {
  const empNome = dados.empresa?.razaoSocial || dados.empresa?.nome || 'VISIONBOX ÓTICA MATRIZ';
  const empCnpj = dados.empresa?.cnpj ? formatarCpfCnpj(dados.empresa.cnpj) : '00.000.000/0001-91';
  const empIe = dados.empresa?.inscricaoEstadual ? ` - IE: ${dados.empresa.inscricaoEstadual}` : '';
  const empEnd = [
    dados.empresa?.endereco || 'Rua das Óticas',
    dados.empresa?.numero ? `, ${dados.empresa.numero}` : ', 100',
    dados.empresa?.bairro ? ` - ${dados.empresa.bairro}` : ' - Centro',
    dados.empresa?.cidade ? ` / ${dados.empresa.cidade}` : ' / São Paulo',
    dados.empresa?.uf ? ` - ${dados.empresa.uf}` : ' - SP',
  ].join('');
  const empFone = dados.empresa?.telefone || dados.empresa?.whatsapp || '(11) 99999-0000';

  const cliNome = (dados.cliente?.nome || 'CONSUMIDOR FINAL').toUpperCase();
  const cliDoc = dados.cliente?.cpf ? formatarCpfCnpj(dados.cliente.cpf) : 'CONSUMIDOR FINAL';
  const dataStr = formatarData(dados.data);
  const subtotalStr = formatarMoeda(dados.subtotal);
  const totalStr = formatarMoeda(dados.total);
  const descStr = dados.desconto && dados.desconto > 0 ? formatarMoeda(dados.desconto) : null;

  const itensHtml = dados.itens
    .map((it) => {
      const totItem = formatarMoeda(it.preco * it.qtd);
      const unItem = formatarMoeda(it.preco);
      return `
        <tr>
          <td>${it.nome}</td>
          <td class="qty">${it.qtd}</td>
          <td class="unit">${unItem}</td>
          <td class="total">${totItem}</td>
        </tr>`;
    })
    .join('');

  const prescricaoHtml =
    dados.grauOD || dados.grauOE
      ? `
      <div class="divider"></div>
      <div style="font-size:0.82em;">
        <strong>PRESCRIÇÃO ÓTICA:</strong><br>
        ${dados.grauOD ? `OD: ${dados.grauOD}<br>` : ''}
        ${dados.grauOE ? `OE: ${dados.grauOE}<br>` : ''}
      </div>`
      : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Recibo de Venda - ${dados.osNumero}</title>
  <style>
    @page {
      margin: 0;
      size: 80mm auto;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Lucida Console', 'Consolas', 'Courier New', monospace;
      background-color: #fff;
      color: #000;
      padding: 6mm 4mm;
      width: 80mm;
      margin: 0 auto;
      font-size: 11px;
      line-height: 1.3;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .receipt-container {
      width: 100%;
      background-color: white;
      padding: 0;
      line-height: 1.3;
    }
    h4 {
      text-align: center;
      margin: 4px 0;
      text-transform: uppercase;
      font-size: 12px;
      font-weight: bold;
    }
    .text-center { text-align: center; }
    .text-right  { text-align: right; }
    .divider {
      border-bottom: 1px dashed #000;
      margin: 6px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9em;
    }
    th, td {
      text-align: left;
      padding: 3px 1px;
      vertical-align: top;
    }
    th {
      border-bottom: 1px solid #000;
      font-size: 0.85em;
      text-transform: uppercase;
    }
    .qty   { width: 32px; text-align: right; white-space: nowrap; padding-right: 4px; }
    .unit  { width: 55px; text-align: right; white-space: nowrap; padding-right: 4px; }
    .total { width: 60px; text-align: right; white-space: nowrap; font-weight: bold; }
    @media print {
      body {
        width: 100%;
        padding: 2mm 3mm;
      }
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <h4>${empNome}</h4>
    <div class="text-center" style="font-size:0.8em; line-height:1.35;">
      <div>CNPJ: ${empCnpj}${empIe}</div>
      <div>${empEnd}</div>
      <div>Fone: ${empFone}</div>
    </div>

    <div class="divider"></div>
    <h4>CUPOM NÃO FISCAL</h4>
    <div class="divider"></div>

    <div style="font-size:0.85em;">
      <span>Venda / OS N°: </span><strong>${dados.osNumero}</strong><br>
      <span>Data: </span><span>${dataStr}</span>
    </div>

    <div class="divider"></div>

    <div style="font-size:0.85em;">
      <strong>CLIENTE:</strong> <span>${cliNome}</span><br>
      <div><span>CPF: </span><span>${cliDoc}</span></div>
      ${dados.cliente?.telefone ? `<div><span>Telefone: </span><span>${dados.cliente.telefone}</span></div>` : ''}
      ${dados.cliente?.endereco ? `<div><span>Endereço: </span><span>${dados.cliente.endereco}</span></div>` : ''}
    </div>

    ${prescricaoHtml}

    <div class="divider"></div>

    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th class="qty">Qtd</th>
          <th class="unit">Unit.</th>
          <th class="total">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itensHtml}
      </tbody>
    </table>

    <div class="divider"></div>

    <table style="font-weight:bold;">
      <tr>
        <td>Subtotal:</td>
        <td class="text-right">R$ ${subtotalStr}</td>
      </tr>
      ${descStr ? `
      <tr style="color:#000;">
        <td>Desconto:</td>
        <td class="text-right">-R$ ${descStr}</td>
      </tr>` : ''}
      <tr>
        <td style="font-size:1.15em; padding-top:4px;">TOTAL:</td>
        <td class="text-right" style="font-size:1.15em; padding-top:4px;">R$ ${totalStr}</td>
      </tr>
    </table>

    <div class="divider"></div>

    <div style="font-size:0.85em;">
      <strong>PAGAMENTO:</strong>
      <div style="display:flex; justify-content:space-between; margin-top:2px;">
        <span>${dados.formaPagamento || 'Dinheiro'}</span>
        <span style="font-weight:bold;">R$ ${totalStr}</span>
      </div>
      ${dados.troco && dados.troco > 0 ? `
      <div style="display:flex; justify-content:space-between; font-size:0.85em; color:#333; margin-top:1px;">
        <span>Troco:</span>
        <span>R$ ${formatarMoeda(dados.troco)}</span>
      </div>` : ''}
    </div>

    <div class="divider" style="margin-top:10px;"></div>
    <div class="text-center" style="font-size:0.85em; font-weight:bold;">
      OBRIGADO PELA PREFERENCIA!<br>
      Volte Sempre &#9829;
    </div>
    <div class="divider"></div>

    <div style="font-size:0.75em; text-align:center; color:#444; margin-top:6px; line-height:1.3;">
      Garantia: 90 dias contra defeitos de fabricação na armação e adaptação de lentes conforme CDC.
      <div style="border-top:1px solid #999; margin-top:20px; padding-top:3px;">
        Assinatura do Cliente / Comprovante de Retirada
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Gera o HTML exato da bobina térmica 80mm para NFC-e (Modelo 65)
 * Baseado 1:1 em templates recibos/cupom-fiscal.html
 */
export function gerarHtmlNfce(dados: DadosImpressao): string {
  const empNome = dados.empresa?.razaoSocial || dados.empresa?.nome || 'VISIONBOX ÓTICA MATRIZ';
  const empCnpj = dados.empresa?.cnpj ? formatarCpfCnpj(dados.empresa.cnpj) : '00.000.000/0001-91';
  const empIe = dados.empresa?.inscricaoEstadual || '123.456.789.110';
  const empEnd = [
    dados.empresa?.endereco || 'Rua das Óticas',
    dados.empresa?.numero ? `, ${dados.empresa.numero}` : ', 100',
    dados.empresa?.bairro ? ` - ${dados.empresa.bairro}` : ' - Centro',
    dados.empresa?.cidade ? ` / ${dados.empresa.cidade}` : ' / São Paulo',
    dados.empresa?.uf ? ` - ${dados.empresa.uf}` : ' - SP',
  ].join('');

  const chave = dados.chaveNfce || '35261000000000019165001000000123100000123456';
  const chaveFormatada = chave.replace(/(\d{4})/g, '$1 ').trim();
  const protocolo = dados.protocoloNfce || `135260098765432 - ${formatarData(dados.data)}`;
  const cliNome = dados.cliente?.nome ? dados.cliente.nome.toUpperCase() : 'CONSUMIDOR FINAL';
  const cliDoc = dados.cliente?.cpf ? formatarCpfCnpj(dados.cliente.cpf) : 'CONSUMIDOR NÃO IDENTIFICADO';
  const dataStr = formatarData(dados.data);

  const itensHtml = dados.itens
    .map((it, idx) => {
      const totItem = formatarMoeda(it.preco * it.qtd);
      const unItem = formatarMoeda(it.preco);
      return `
        <tr>
          <td colspan="4" style="font-weight:bold; padding-top:3px;">${String(idx + 1).padStart(3, '0')} ${it.sku || 'PRD'} ${it.nome}</td>
        </tr>
        <tr style="border-bottom:1px dashed #ccc;">
          <td style="padding-left:8px;">${it.qtd} UN X R$ ${unItem}</td>
          <td colspan="3" style="text-align:right; font-weight:bold;">R$ ${totItem}</td>
        </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>DANFE NFC-e - ${dados.osNumero}</title>
  <style>
    @page { margin: 0; size: 80mm auto; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Lucida Console', 'Consolas', 'Courier New', monospace;
      background-color: #fff;
      color: #000;
      padding: 5mm 4mm;
      width: 80mm;
      margin: 0 auto;
      font-size: 11px;
      line-height: 1.3;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .faixa-nfce {
      background: #000;
      color: #fff;
      text-align: center;
      font-weight: bold;
      padding: 3px 0;
      font-size: 10px;
      margin: 5px 0;
      letter-spacing: 0.5px;
    }
    .divider { border-bottom: 1px dashed #555; margin: 5px 0; }
    .divider-solid { border-bottom: 1px solid #000; margin: 5px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 0.88em; }
    th, td { text-align: left; padding: 2px 0; vertical-align: top; }
  </style>
</head>
<body>
  <div class="text-center">
    <strong style="font-size:12px; text-transform:uppercase;">${empNome}</strong><br>
    <span style="font-size:9px;">CNPJ: ${empCnpj} &nbsp; IE: ${empIe}</span><br>
    <span style="font-size:9px;">${empEnd}</span>
  </div>

  <div class="faixa-nfce">
    DANFE NFC-e - Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica
  </div>
  <div class="text-center" style="font-size:8.5px; margin-bottom:4px;">
    Não permite aproveitamento de crédito de ICMS
  </div>

  <div class="divider-solid"></div>

  <table>
    <thead>
      <tr style="border-bottom:1px solid #000; font-size:9px; text-transform:uppercase;">
        <th># CÓDIGO DESCRIÇÃO</th>
        <th style="text-align:right;">VALOR TOTAL</th>
      </tr>
    </thead>
    <tbody>
      ${itensHtml}
    </tbody>
  </table>

  <div class="divider-solid"></div>

  <table style="font-weight:bold; font-size:10px;">
    <tr>
      <td>QTD. TOTAL DE ITENS:</td>
      <td class="text-right">${dados.itens.reduce((acc, i) => acc + i.qtd, 0)}</td>
    </tr>
    <tr>
      <td>VALOR TOTAL R$:</td>
      <td class="text-right">R$ ${formatarMoeda(dados.total)}</td>
    </tr>
    <tr>
      <td>FORMA DE PAGAMENTO:</td>
      <td class="text-right">${dados.formaPagamento || 'Dinheiro'}</td>
    </tr>
    <tr>
      <td>VALOR PAGO R$:</td>
      <td class="text-right">R$ ${formatarMoeda(dados.total)}</td>
    </tr>
  </table>

  <div class="divider"></div>

  <div class="text-center" style="font-size:9px;">
    <strong>EMISSÃO: ${dataStr}</strong><br>
    Número: ${dados.osNumero.replace(/\D/g, '') || '001'} &nbsp; Série: 001<br>
    <div style="margin-top:4px; font-weight:bold;">CONSULTA PELA CHAVE DE ACESSO EM:</div>
    <div style="font-size:8px;">http://nfce.fazenda.sp.gov.br/consulta</div>
    <div style="margin:4px 0; font-size:9px; font-weight:bold; letter-spacing:0.5px; word-break:break-all;">
      ${chaveFormatada}
    </div>
  </div>

  <div class="divider"></div>

  <div style="font-size:9px;">
    <strong>CONSUMIDOR:</strong> ${cliNome}<br>
    <strong>CPF:</strong> ${cliDoc}
  </div>

  <div class="divider"></div>

  <div class="text-center" style="font-size:8.5px;">
    Protocolo de Autorização:<br>
    <strong>${protocolo}</strong>
  </div>
</body>
</html>`;
}

/**
 * Dispara a impressão sem renderizar o resto da aplicação
 * Cria um iframe invisível isolado e dispara window.print()
 */
export function executarImpressao(html: string) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const frameDoc = iframe.contentWindow?.document;
  if (!frameDoc) {
    document.body.removeChild(iframe);
    window.print();
    return;
  }

  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      window.print();
    } finally {
      setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch {}
      }, 1500);
    }
  }, 250);
}
