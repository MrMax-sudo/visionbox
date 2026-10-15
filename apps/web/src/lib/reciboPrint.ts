/**
 * Utilitário de Geração e Impressão de Recibos, Orçamentos e Documentos Fiscais
 * Fiel 1:1 aos templates em:
 * D:\TECHBOXBR\PRODUTOS\VisionBox\templates recibos\recibo.html
 * D:\TECHBOXBR\PRODUTOS\VisionBox\templates recibos\cupom-fiscal.html
 * D:\TECHBOXBR\PRODUTOS\VisionBox\templates recibos\danfe-nfe.html
 * D:\TECHBOXBR\PRODUTOS\VisionBox\templates recibos\orcamento.html
 * 
 * Regra: Todos os documentos invocam obrigatoriamente a URL persistida no banco (/api/v1/empresa/logo.png)
 */

export interface ItemImpressao {
  sku?: string;
  nome: string;
  qtd: number;
  preco: number;
  ncm?: string;
  cfop?: string;
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
  cep?: string;
  telefone?: string;
  whatsapp?: string;
  logoUrl?: string;
}

export interface ClienteImpressao {
  nome?: string;
  cpf?: string;
  telefone?: string;
  endereco?: string;
  cidade?: string;
  uf?: string;
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
  tipoDocumento?: 'CUPOM' | 'NFCE' | 'DANFE' | 'ORCAMENTO';
  grauOD?: string;
  grauOE?: string;
  observacoes?: string;
  validadeDias?: number;
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
 * 1. Gera o HTML de Cupom Não Fiscal para bobina térmica 80mm
 * Fiel a: D:\TECHBOXBR\PRODUTOS\VisionBox\templates recibos\recibo.html
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
  const logoUrl = dados.empresa?.logoUrl || '/api/v1/empresa/logo.png';

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
      line-height: 1.35;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .receipt-container {
      width: 100%;
      background-color: white;
      padding: 0;
    }
    .lens-mark {
      display: flex;
      justify-content: center;
      margin-bottom: 6px;
    }
    .lens-mark svg { width: 54px; height: 23px; }
    .brand-logo-wrap {
      text-align: center;
      margin-bottom: 6px;
    }
    .brand-logo-wrap img {
      max-height: 48px;
      max-width: 180px;
      object-fit: contain;
    }
    h4 {
      text-align: center;
      margin: 4px 0;
      text-transform: uppercase;
      font-size: 12px;
      letter-spacing: 0.5px;
    }
    .text-center { text-align: center; }
    .text-right  { text-align: right; }
    .divider {
      border-bottom: 1px dashed #000;
      margin: 6px 0;
    }
    .doc-title {
      border-top: 3px double #000;
      border-bottom: 3px double #000;
      padding: 4px 0;
      margin: 4px 0;
      font-size: 0.95em;
      letter-spacing: 2px;
      text-align: center;
      font-weight: bold;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.88em;
    }
    th, td {
      text-align: left;
      padding: 3px 2px;
      vertical-align: top;
    }
    thead th {
      font-size: 0.8em;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
    }
    tbody tr + tr td { border-top: 1px dotted #777; }
    .qty   { width: 35px; text-align: right; white-space: nowrap; padding-right: 4px; }
    .unit  { width: 60px; text-align: right; white-space: nowrap; padding-right: 4px; }
    .total { width: 65px; text-align: right; white-space: nowrap; font-weight: bold; }
    .totals tr:last-child td {
      border-top: 2px solid #000;
      border-bottom: 2px solid #000;
      font-size: 1.2em !important;
      padding: 5px 2px !important;
      font-weight: bold;
    }
    @media print {
      body { width: 100%; padding: 2mm 3mm; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <div class="brand-logo-wrap">
      <img src="${logoUrl}" onerror="this.style.display='none'" alt="Logo" />
    </div>
    <div class="lens-mark"><svg viewBox="0 0 48 20" fill="none" stroke="#000" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="11" r="7"/><circle cx="36" cy="11" r="7"/><path d="M19 10 Q24 6 29 10"/><path d="M5.5 8 L1 5"/><path d="M42.5 8 L47 5"/></svg></div>

    <h4>${empNome}</h4>
    <div class="text-center" style="font-size:0.75em; line-height:1.35;">
      <div>CNPJ: ${empCnpj}${empIe}</div>
      <div>${empEnd}</div>
      <div>Fone: ${empFone}</div>
    </div>

    <div class="divider"></div>
    <div class="doc-title">CUPOM NÃO FISCAL</div>
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

    <table class="totals">
      <tr>
        <td>Subtotal:</td>
        <td class="text-right">R$ ${subtotalStr}</td>
      </tr>
      ${descStr ? `
      <tr>
        <td>Desconto:</td>
        <td class="text-right">-R$ ${descStr}</td>
      </tr>` : ''}
      <tr>
        <td>TOTAL:</td>
        <td class="text-right">R$ ${totalStr}</td>
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

    <div class="divider" style="margin-top:8px;"></div>
    <div class="text-center" style="font-size:0.85em; font-weight:bold;">
      OBRIGADO PELA PREFERÊNCIA!<br>
      Volte Sempre &#9829;
    </div>
    <div class="divider"></div>

    <div style="font-size:0.75em; text-align:center; color:#333; margin-top:6px; line-height:1.3;">
      Garantia: 90 dias contra defeitos de fabricação na armação e adaptação de lentes conforme CDC.
      <div style="border-top:1px solid #777; margin-top:22px; padding-top:3px;">
        Assinatura do Cliente / Comprovante de Retirada
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * 2. Gera o HTML de NFC-e (Modelo 65) para bobina térmica 80mm
 * Fiel a: D:\TECHBOXBR\PRODUTOS\VisionBox\templates recibos\cupom-fiscal.html
 */
export function gerarHtmlNfce(dados: DadosImpressao): string {
  const empNome = dados.empresa?.razaoSocial || dados.empresa?.nome || 'VISIONBOX ÓTICA MATRIZ';
  const empCnpj = dados.empresa?.cnpj ? formatarCpfCnpj(dados.empresa.cnpj) : '00.000.000/0001-91';
  const empIe = dados.empresa?.inscricaoEstadual || 'ISENTO';
  const empEnd = [
    dados.empresa?.endereco || 'Rua das Óticas',
    dados.empresa?.numero ? `, ${dados.empresa.numero}` : ', 100',
    dados.empresa?.bairro ? ` - ${dados.empresa.bairro}` : ' - Centro',
    dados.empresa?.cidade ? ` / ${dados.empresa.cidade}` : ' / São Paulo',
    dados.empresa?.uf ? ` - ${dados.empresa.uf}` : ' - SP',
  ].join('');
  const logoUrl = dados.empresa?.logoUrl || '/api/v1/empresa/logo.png';

  const temChaveReal = !!(dados.chaveNfce && dados.chaveNfce.trim().length === 44);
  const chave = temChaveReal ? dados.chaveNfce!.trim() : null;
  const chaveFormatada = chave ? chave.replace(/(\d{4})/g, '$1 ').trim() : null;
  const protocolo = dados.protocoloNfce ? dados.protocoloNfce.trim() : null;
  const cliNome = dados.cliente?.nome ? dados.cliente.nome.toUpperCase() : 'CONSUMIDOR FINAL';
  const cliDoc = dados.cliente?.cpf ? formatarCpfCnpj(dados.cliente.cpf) : 'CONSUMIDOR NÃO IDENTIFICADO';
  const dataStr = formatarData(dados.data);

  const itensHtml = dados.itens
    .map((it, idx) => {
      const totItem = formatarMoeda(it.preco * it.qtd);
      const unItem = formatarMoeda(it.preco);
      return `
        <tr>
          <td colspan="3" class="nome-prod">${String(idx + 1).padStart(3, '0')} ${it.sku ? it.sku + ' - ' : ''}${it.nome}</td>
        </tr>
        <tr class="fiscal-row">
          <td>${it.qtd} UN × ${unItem}</td>
          <td></td>
          <td class="text-right">${totItem}</td>
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
      line-height: 1.35;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .brand-logo-wrap {
      text-align: center;
      margin-bottom: 5px;
    }
    .brand-logo-wrap img {
      max-height: 48px;
      max-width: 170px;
      object-fit: contain;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .nfce-header { text-align: center; margin-bottom: 6px; }
    .razao-social { font-weight: bold; font-size: 12px; text-transform: uppercase; }
    .dados-empresa { font-size: 9px; line-height: 1.35; }
    .nfce-faixa {
      background: ${temChaveReal ? '#000' : '#fff'};
      color: ${temChaveReal ? '#fff' : '#000'};
      ${temChaveReal ? '' : 'border: 2px solid #000;'}
      text-align: center;
      font-weight: bold;
      padding: 4px 2px;
      font-size: 9px;
      margin: 6px 0;
      letter-spacing: 0.4px;
      text-transform: uppercase;
    }
    .divider { border-top: 1px dashed #000; margin: 6px 0; }
    .divider-solid { border-top: 2px solid #000; margin: 6px 0; }
    table.itens { width: 100%; border-collapse: collapse; font-size: 0.88em; }
    table.itens td { padding: 1px 0; vertical-align: top; }
    .nome-prod { font-weight: bold; line-height: 1.3; }
    .fiscal-row { border-bottom: 1px dotted #888; font-size: 0.9em; }
    table.totais { width: 100%; font-size: 0.9em; border-collapse: collapse; }
    table.totais td { padding: 2px 0; }
    table.totais .linha-total td {
      font-size: 1.2em;
      font-weight: bold;
      padding: 5px 0;
      border-top: 2px solid #000;
      border-bottom: 2px solid #000;
    }
    .chave-acesso {
      text-align: center;
      margin: 6px 0;
      padding: 6px 4px;
      border: 1px solid #000;
      font-size: 0.78em;
    }
    @media print {
      body { width: 100%; padding: 2mm 3mm; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="brand-logo-wrap">
    <img src="${logoUrl}" onerror="this.style.display='none'" alt="Logo" />
  </div>

  <div class="nfce-header">
    <div class="razao-social">${empNome}</div>
    <div class="dados-empresa">
      <span>CNPJ: ${empCnpj} &nbsp; IE: ${empIe}</span><br>
      <span>${empEnd}</span>
    </div>
  </div>

  <div class="divider-solid"></div>

  <div class="nfce-faixa">
    ${temChaveReal ? 'DANFE NFC-e — Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica' : 'CUPOM NÃO FISCAL — Emissão em Contingência'}
  </div>

  <div class="divider"></div>

  <div style="font-size:0.82em; line-height:1.45;">
    Data: <span>${dataStr}</span><br>
    Número: <strong>${dados.osNumero.replace(/\D/g, '') || '001'}</strong> &nbsp;&nbsp; Série: <strong>001</strong><br>
    ${protocolo ? `Protocolo de autorização: <strong>${protocolo}</strong><br>` : ''}
    Atendimento: <span>Balcão</span>
  </div>

  <div class="divider-solid"></div>

  <table class="itens">
    <tbody>
      ${itensHtml}
    </tbody>
  </table>

  <div class="divider-solid"></div>

  <table class="totais">
    <tr>
      <td>QTD. TOTAL DE ITENS:</td>
      <td class="text-right">${dados.itens.reduce((acc, i) => acc + i.qtd, 0)}</td>
    </tr>
    <tr>
      <td>VALOR TOTAL R$:</td>
      <td class="text-right">R$ ${formatarMoeda(dados.subtotal)}</td>
    </tr>
    ${dados.desconto && dados.desconto > 0 ? `
    <tr>
      <td>DESCONTOS R$:</td>
      <td class="text-right">-R$ ${formatarMoeda(dados.desconto)}</td>
    </tr>` : ''}
    <tr class="linha-total">
      <td>VALOR A PAGAR R$:</td>
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

  <div class="chave-acesso">
    <strong>CONSULTA PELA CHAVE DE ACESSO EM:</strong><br>
    <span style="font-size:0.9em;">http://nfce.fazenda.sp.gov.br/consulta</span><br>
    ${temChaveReal ? `
    <div style="margin-top:4px; font-weight:bold; letter-spacing:0.8px; font-size:1.05em;">
      ${chaveFormatada}
    </div>` : `
    <div style="margin-top:4px; font-weight:bold; color:#b91c1c;">
      [ EMISSÃO OFFLINE - TRANSMISSÃO CONFORME DISPONIBILIDADE SEFAZ ]
    </div>`}
  </div>

  <div class="divider"></div>

  <div style="font-size:0.82em;">
    <strong>CONSUMIDOR:</strong> <span>${cliNome}</span><br>
    <strong>CPF:</strong> <span>${cliDoc}</span>
  </div>

  <div class="divider"></div>

  <div class="text-center" style="font-size:0.78em; color:#333;">
    Tributos Totais Incidentes (Lei 12.741/2012): R$ ${formatarMoeda(dados.total * 0.18)} (18,00%)<br>
    Sistema VisionBox — ERP Especializado para Óticas
  </div>
</body>
</html>`;
}

/**
 * 3. Gera o HTML de DANFE NF-e (Modelo 55) em folha A4 oficial
 * Fiel a: D:\TECHBOXBR\PRODUTOS\VisionBox\templates recibos\danfe-nfe.html
 */
export function gerarHtmlDanfeNfe(dados: DadosImpressao): string {
  const empNome = dados.empresa?.razaoSocial || dados.empresa?.nome || 'VISIONBOX ÓTICA MATRIZ LTDA';
  const empCnpj = dados.empresa?.cnpj ? formatarCpfCnpj(dados.empresa.cnpj) : '00.000.000/0001-91';
  const empIe = dados.empresa?.inscricaoEstadual || '123.456.789.110';
  const empEnd = [
    dados.empresa?.endereco || 'Rua das Óticas',
    dados.empresa?.numero ? `, ${dados.empresa.numero}` : ', 100',
    dados.empresa?.bairro ? ` - ${dados.empresa.bairro}` : ' - Centro',
  ].join('');
  const empCidadeUf = `${dados.empresa?.cidade || 'São Paulo'} - ${dados.empresa?.uf || 'SP'}`;
  const empCep = dados.empresa?.cep || '01001-000';
  const empFone = dados.empresa?.telefone || dados.empresa?.whatsapp || '(11) 99999-0000';
  const logoUrl = dados.empresa?.logoUrl || '/api/v1/empresa/logo.png';

  const temChaveReal = !!(dados.chaveNfce && dados.chaveNfce.trim().length === 44);
  const chave = temChaveReal ? dados.chaveNfce!.trim() : '35260000000000000000550010000000011000000000';
  const chaveFormatada = chave.replace(/(\d{4})/g, '$1 ').trim();
  const protocolo = dados.protocoloNfce ? dados.protocoloNfce.trim() : '135260000000000 15/10/2026 10:00:00';
  const cliNome = dados.cliente?.nome ? dados.cliente.nome.toUpperCase() : 'CONSUMIDOR FINAL';
  const cliDoc = dados.cliente?.cpf ? formatarCpfCnpj(dados.cliente.cpf) : '000.000.000-00';
  const cliEnd = dados.cliente?.endereco || 'RUA DAS FLORES, 50 - BAIRRO CENTRO';
  const dataStr = formatarData(dados.data);

  const itensHtml = dados.itens
    .map((it, idx) => {
      const totItem = formatarMoeda(it.preco * it.qtd);
      const unItem = formatarMoeda(it.preco);
      return `
        <tr>
          <td style="text-align:center;">${it.sku || String(idx + 1).padStart(4, '0')}</td>
          <td>${it.nome}</td>
          <td style="text-align:center;">${it.ncm || '9003.11.00'}</td>
          <td style="text-align:center;">${it.cfop || '5102'}</td>
          <td style="text-align:center;">UN</td>
          <td style="text-align:right;">${it.qtd}</td>
          <td style="text-align:right;">${unItem}</td>
          <td style="text-align:right;">${totItem}</td>
          <td style="text-align:right;">${totItem}</td>
          <td style="text-align:right;">${formatarMoeda(it.preco * it.qtd * 0.18)}</td>
          <td style="text-align:right;">18,00</td>
        </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>DANFE NF-e - ${dados.osNumero}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      background-color: #fff;
      color: #000;
      font-size: 8px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .danfe-container {
      width: 210mm;
      min-height: 295mm;
      background: #fff;
      padding: 6mm 7mm;
      margin: 0 auto;
    }
    table.danfe-grid {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: -1px;
    }
    table.danfe-grid td, table.danfe-grid th {
      border: 1px solid #000;
      padding: 1px 3px;
      vertical-align: top;
      font-size: 8px;
      line-height: 1.15;
    }
    .section-header {
      font-size: 7px;
      font-weight: bold;
      text-transform: uppercase;
      background-color: #fff;
      padding: 2px 4px 1px 4px;
      border: 1px solid #000;
      border-bottom: none;
      margin-top: 3px;
    }
    .lbl {
      font-size: 6px;
      font-weight: bold;
      text-transform: uppercase;
      color: #000;
      display: block;
      margin-bottom: 1px;
    }
    .val {
      font-size: 8px;
      font-weight: bold;
      color: #000;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    @media print {
      body { background: none; padding: 0; }
      .danfe-container { width: 100%; padding: 0; margin: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="danfe-container">
    <!-- Canhoto de recebimento -->
    <table class="danfe-grid">
      <tr>
        <td style="width: 82%; padding: 3px;">
          <span class="lbl">RECEBEMOS DE ${empNome} OS PRODUTOS/SERVIÇOS CONSTANTES DA NOTA FISCAL INDICADA AO LADO</span>
          <table style="width: 100%; margin-top: 4px; border-collapse: collapse;">
            <tr>
              <td style="border: 1px solid #000; width: 28%; height: 22px; padding: 1px 3px;">
                <span class="lbl">DATA DE RECEBIMENTO</span>
              </td>
              <td style="border: 1px solid #000; width: 72%; height: 22px; padding: 1px 3px;">
                <span class="lbl">IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</span>
              </td>
            </tr>
          </table>
        </td>
        <td style="width: 18%; text-align: center; vertical-align: middle; padding: 2px;">
          <span class="val" style="font-size: 11px; display: block;">NF-e</span>
          <span class="val" style="font-size: 9px; display: block;">Nº ${dados.osNumero.replace(/\D/g, '') || '000001'}</span>
          <span class="val" style="font-size: 9px; display: block;">SÉRIE 001</span>
        </td>
      </tr>
    </table>

    <div style="border-top: 1px dashed #000; margin: 4px 0 5px 0;"></div>

    <!-- Cabeçalho Principal (Emitente / DANFE / Chave) -->
    <table class="danfe-grid">
      <tr>
        <td style="width: 43%; height: 95px; padding: 4px;">
          <div style="display: flex; gap: 8px; align-items: center; height: 100%;">
            <div style="max-width: 65px; flex-shrink: 0;">
              <img src="${logoUrl}" style="max-width: 60px; max-height: 60px; object-fit: contain;" onerror="this.style.display='none'" alt="Logo" />
            </div>
            <div>
              <div class="val" style="font-size: 10px; text-transform: uppercase;">${empNome}</div>
              <div style="font-size: 7.5px; margin-top: 2px; line-height: 1.2;">
                <span>${empEnd}</span><br>
                <span>${empCidadeUf} - CEP: ${empCep}</span><br>
                <span>Fone: ${empFone}</span>
              </div>
            </div>
          </div>
        </td>
        <td style="width: 19%; text-align: center; padding: 3px;">
          <div class="val" style="font-size: 13px; margin-bottom: 1px;">DANFE</div>
          <div style="font-size: 6.5px; line-height: 1.1; font-weight: bold;">Documento Auxiliar da<br>Nota Fiscal Eletrônica</div>
          <div style="display: flex; justify-content: center; align-items: center; gap: 6px; margin: 3px 0;">
            <div style="font-size: 6px; text-align: left; line-height: 1.1;">0: Entrada<br>1: Saída</div>
            <div style="border: 1px solid #000; width: 14px; height: 16px; font-size: 11px; font-weight: bold; line-height: 16px;">1</div>
          </div>
          <div class="val" style="font-size: 8px;">Nº ${dados.osNumero.replace(/\D/g, '') || '000001'}</div>
          <div class="val" style="font-size: 8px;">SÉRIE: 001</div>
          <div style="font-size: 7px; margin-top: 2px;">FOLHA: 01/01</div>
        </td>
        <td style="width: 38%; padding: 4px;">
          <div class="lbl">CHAVE DE ACESSO</div>
          <div style="font-family:'Courier New', monospace; font-size:9px; font-weight:bold; letter-spacing:0.5px; word-break:break-all; text-align:center; padding:3px 0;">
            ${chaveFormatada}
          </div>
          <div class="lbl" style="margin-top: 4px;">PROTOCOLO DE AUTORIZAÇÃO DE USO</div>
          <div class="val" style="font-size: 8px; text-align: center;">${protocolo}</div>
        </td>
      </tr>
    </table>

    <table class="danfe-grid">
      <tr>
        <td style="width: 43%;"><span class="lbl">NATUREZA DA OPERAÇÃO</span><span class="val">VENDA DE MERCADORIA AO CONSUMIDOR</span></td>
        <td style="width: 25%;"><span class="lbl">INSCRIÇÃO ESTADUAL</span><span class="val">${empIe}</span></td>
        <td style="width: 32%;"><span class="lbl">CNPJ</span><span class="val">${empCnpj}</span></td>
      </tr>
    </table>

    <!-- Destinatário -->
    <div class="section-header">DESTINATÁRIO / REMETENTE</div>
    <table class="danfe-grid">
      <tr>
        <td style="width: 60%;"><span class="lbl">NOME / RAZÃO SOCIAL</span><span class="val">${cliNome}</span></td>
        <td style="width: 25%;"><span class="lbl">CNPJ / CPF</span><span class="val">${cliDoc}</span></td>
        <td style="width: 15%;"><span class="lbl">DATA DA EMISSÃO</span><span class="val">${dataStr.split(' ')[0]}</span></td>
      </tr>
      <tr>
        <td><span class="lbl">ENDEREÇO</span><span class="val">${cliEnd}</span></td>
        <td><span class="lbl">BAIRRO / DISTRITO</span><span class="val">CENTRO</span></td>
        <td><span class="lbl">DATA DA SAÍDA</span><span class="val">${dataStr.split(' ')[0]}</span></td>
      </tr>
      <tr>
        <td><span class="lbl">MUNICÍPIO</span><span class="val">${dados.cliente?.cidade || 'SÃO PAULO'}</span></td>
        <td><span class="lbl">UF / FONE</span><span class="val">${dados.cliente?.uf || 'SP'} ${dados.cliente?.telefone || ''}</span></td>
        <td><span class="lbl">HORA DA SAÍDA</span><span class="val">${dataStr.split(' ')[1] || '10:00'}</span></td>
      </tr>
    </table>

    <!-- Cálculo do Imposto -->
    <div class="section-header">CÁLCULO DO IMPOSTO</div>
    <table class="danfe-grid">
      <tr>
        <td><span class="lbl">BASE DE CÁLCULO DO ICMS</span><span class="val text-right">R$ ${formatarMoeda(dados.total)}</span></td>
        <td><span class="lbl">VALOR DO ICMS</span><span class="val text-right">R$ ${formatarMoeda(dados.total * 0.18)}</span></td>
        <td><span class="lbl">TOTAL DOS PRODUTOS</span><span class="val text-right">R$ ${formatarMoeda(dados.subtotal)}</span></td>
        <td><span class="lbl">DESCONTO</span><span class="val text-right">R$ ${formatarMoeda(dados.desconto || 0)}</span></td>
        <td><span class="lbl">VALOR TOTAL DA NOTA</span><span class="val text-right">R$ ${formatarMoeda(dados.total)}</span></td>
      </tr>
    </table>

    <!-- Dados dos Produtos -->
    <div class="section-header">DADOS DO PRODUTO / SERVIÇO</div>
    <table class="danfe-grid">
      <thead>
        <tr>
          <th>CÓDIGO</th>
          <th>DESCRIÇÃO DO PRODUTO / SERVIÇO</th>
          <th>NCM</th>
          <th>CFOP</th>
          <th>UN</th>
          <th>QTD</th>
          <th>VL. UNIT</th>
          <th>VL. TOTAL</th>
          <th>BC ICMS</th>
          <th>VL. ICMS</th>
          <th>% ICMS</th>
        </tr>
      </thead>
      <tbody>
        ${itensHtml}
      </tbody>
    </table>

    <!-- Dados Adicionais -->
    <div class="section-header">DADOS ADICIONAIS</div>
    <table class="danfe-grid">
      <tr>
        <td style="height: 55px; padding: 4px;">
          <span class="lbl">INFORMAÇÕES COMPLEMENTARES</span>
          <div style="font-size: 7.5px; line-height: 1.3;">
            Documento emitido por ME ou EPP optante pelo Simples Nacional.<br>
            Não gera direito a crédito fiscal de IPI.<br>
            Valor aproximado dos tributos federais e estaduais: R$ ${formatarMoeda(dados.total * 0.18)} (18,00%) Lei 12.741/2012.<br>
            Venda/OS VisionBox: ${dados.osNumero}.
          </div>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}

/**
 * 4. Gera o HTML de Orçamento Comercial em folha A4 com paleta óptica
 * Fiel a: D:\TECHBOXBR\PRODUTOS\VisionBox\templates recibos\orcamento.html
 */
export function gerarHtmlOrcamento(dados: DadosImpressao): string {
  const empNome = dados.empresa?.razaoSocial || dados.empresa?.nome || 'VISIONBOX ÓTICA MATRIZ';
  const empCnpj = dados.empresa?.cnpj ? formatarCpfCnpj(dados.empresa.cnpj) : '00.000.000/0001-91';
  const empEnd = [
    dados.empresa?.endereco || 'Rua das Óticas',
    dados.empresa?.numero ? `, ${dados.empresa.numero}` : ', 100',
    dados.empresa?.bairro ? ` - ${dados.empresa.bairro}` : ' - Centro',
    dados.empresa?.cidade ? ` / ${dados.empresa.cidade}` : ' / São Paulo',
    dados.empresa?.uf ? ` - ${dados.empresa.uf}` : ' - SP',
  ].join('');
  const empFone = dados.empresa?.telefone || dados.empresa?.whatsapp || '(11) 99999-0000';
  const logoUrl = dados.empresa?.logoUrl || '/api/v1/empresa/logo.png';

  const cliNome = dados.cliente?.nome ? dados.cliente.nome.toUpperCase() : 'CLIENTE';
  const cliDoc = dados.cliente?.cpf ? formatarCpfCnpj(dados.cliente.cpf) : 'Não informado';
  const dataStr = formatarData(dados.data);
  const subtotalStr = formatarMoeda(dados.subtotal);
  const totalStr = formatarMoeda(dados.total);
  const descStr = dados.desconto && dados.desconto > 0 ? formatarMoeda(dados.desconto) : null;
  const validade = dados.validadeDias || 15;

  const itensHtml = dados.itens
    .map((it, idx) => {
      const totItem = formatarMoeda(it.preco * it.qtd);
      const unItem = formatarMoeda(it.preco);
      return `
        <tr>
          <td style="text-align:center;">${idx + 1}</td>
          <td><strong class="item-name">${it.nome}</strong></td>
          <td style="text-align:center;">${it.qtd}</td>
          <td style="text-align:right;">R$ ${unItem}</td>
          <td style="text-align:right; font-weight:bold;">R$ ${totItem}</td>
        </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Orçamento Comercial - ${dados.osNumero}</title>
  <style>
    :root {
      --color-paper: #FFFFFF;
      --color-ink: #14232E;
      --color-ink-soft: #5B6F7C;
      --color-ink-faint: #8A9CA8;
      --color-accent: #0F7C87;
      --color-accent-deep: #0B3C5D;
      --color-tint: #EAF3F5;
      --color-gold: #B0905A;
      --color-line: #DCE5E9;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      background-color: #fff;
      color: var(--color-ink);
      padding: 20px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .receipt-container {
      width: 100%;
      max-width: 21cm;
      min-height: 29.7cm;
      background-color: var(--color-paper);
      padding: 1.2cm;
      margin: 0 auto;
      position: relative;
    }
    .receipt-container::before {
      content: "";
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 7px;
      background: linear-gradient(90deg, var(--color-accent-deep) 0%, var(--color-accent) 70%, var(--color-gold) 100%);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
      margin-top: 10px;
    }
    .brand-logo img {
      max-height: 64px;
      max-width: 220px;
      object-fit: contain;
      margin-bottom: 8px;
    }
    .brand-text {
      font-weight: 700;
      font-size: 1.2rem;
      color: var(--color-accent-deep);
      margin-bottom: 3px;
    }
    .brand-meta {
      font-size: 0.75rem;
      color: var(--color-ink-soft);
      line-height: 1.4;
    }
    .doc-panel { text-align: right; }
    .doc-badge {
      display: inline-block;
      background: var(--color-accent-deep);
      color: #fff;
      padding: 6px 18px;
      border-radius: 50px;
      font-weight: 700;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 10px;
    }
    .doc-field-label {
      font-size: 0.65rem;
      text-transform: uppercase;
      color: var(--color-ink-faint);
      font-weight: 700;
      letter-spacing: 1px;
    }
    .doc-field-value {
      font-size: 0.9rem;
      color: var(--color-ink);
      font-weight: 700;
      margin-bottom: 6px;
    }
    .ornament-divider {
      display: flex;
      align-items: center;
      gap: 14px;
      margin: 18px 0;
      color: var(--color-gold);
    }
    .ornament-divider::before, .ornament-divider::after {
      content: "";
      flex: 1;
      height: 1px;
      background: var(--color-line);
    }
    .client-card {
      background: var(--color-tint);
      border-left: 4px solid var(--color-accent);
      border-radius: 4px 8px 8px 4px;
      padding: 10px 14px;
      margin-bottom: 18px;
    }
    .client-title {
      font-size: 1rem;
      font-weight: 700;
      color: var(--color-accent-deep);
      margin-bottom: 4px;
    }
    .client-info {
      font-size: 0.75rem;
      color: var(--color-ink-soft);
      line-height: 1.4;
    }
    table.table {
      width: 100%;
      border-collapse: collapse;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid var(--color-line);
      margin-top: 10px;
    }
    table.table thead th {
      background: var(--color-accent-deep);
      color: #fff;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 0.68rem;
      letter-spacing: 1px;
      padding: 8px 10px;
      text-align: left;
    }
    table.table tbody td {
      padding: 8px 10px;
      border-bottom: 1px solid var(--color-line);
      font-size: 0.75rem;
    }
    table.table tbody tr:nth-child(even) td { background: #F6FAFB; }
    .totals-wrap {
      display: flex;
      justify-content: flex-end;
      margin-top: 16px;
    }
    .totals-box {
      width: 55%;
      background: var(--color-tint);
      border-radius: 10px;
      padding: 10px 16px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 5px 0;
      font-size: 0.78rem;
      color: var(--color-ink-soft);
      font-weight: 600;
      border-bottom: 1px solid rgba(15, 124, 135, 0.18);
    }
    .totals-row.grand-total {
      margin-top: 6px;
      padding: 8px 0 0 0;
      border-top: 2px solid var(--color-accent-deep);
      border-bottom: none;
      font-size: 1.05rem;
      font-weight: 800;
      color: var(--color-accent-deep);
    }
    .conditions-box {
      margin-top: 24px;
      padding: 12px 14px;
      border-radius: 8px;
      border: 1px dashed var(--color-ink-faint);
      font-size: 0.72rem;
      color: var(--color-ink-soft);
      line-height: 1.5;
    }
    @media print {
      @page { size: A4 portrait; margin: 8mm; }
      body { padding: 0 !important; }
      .receipt-container { width: 100% !important; max-width: 100% !important; padding: 0 !important; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <div class="header">
      <div>
        <div class="brand-logo">
          <img src="${logoUrl}" onerror="this.style.display='none'" alt="Logo da Empresa" />
        </div>
        <div class="brand-text">${empNome}</div>
        <div class="brand-meta">
          <span>CNPJ: ${empCnpj}</span><br>
          <span>${empEnd}</span><br>
          <span>Contato: ${empFone}</span>
        </div>
      </div>
      <div class="doc-panel">
        <div class="doc-badge">Orçamento</div>
        <div class="doc-field-label">Nº do Documento</div>
        <div class="doc-field-value">${dados.osNumero}</div>
        <div class="doc-field-label">Data da Emissão</div>
        <div class="doc-field-value">${dataStr}</div>
      </div>
    </div>

    <div class="ornament-divider">
      <svg viewBox="0 0 48 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" style="width:44px; height:18px;"><circle cx="12" cy="11" r="7"/><circle cx="36" cy="11" r="7"/><path d="M19 10 Q24 6 29 10"/><path d="M5.5 8 L1 5"/><path d="M42.5 8 L47 5"/></svg>
    </div>

    <div class="client-card">
      <div class="client-title">${cliNome}</div>
      <div class="client-info">
        <span>CPF/Documento: ${cliDoc}</span> &nbsp;·&nbsp;
        <span>Telefone: ${dados.cliente?.telefone || 'Não informado'}</span><br>
        <span>Endereço: ${dados.cliente?.endereco || 'Não informado'}</span>
      </div>
    </div>

    ${dados.grauOD || dados.grauOE ? `
    <div style="background:#fff; border:1px solid var(--color-line); border-radius:6px; padding:8px 12px; margin-bottom:14px; font-size:0.75rem;">
      <strong style="color:var(--color-accent-deep);">Prescrição Óptica de Referência:</strong><br>
      ${dados.grauOD ? `<span>Olho Direito (OD): ${dados.grauOD}</span><br>` : ''}
      ${dados.grauOE ? `<span>Olho Esquerdo (OE): ${dados.grauOE}</span>` : ''}
    </div>` : ''}

    <table class="table">
      <thead>
        <tr>
          <th style="width:36px; text-align:center;">#</th>
          <th>Descrição do Produto / Lente / Armação</th>
          <th style="width:60px; text-align:center;">Qtd</th>
          <th style="width:100px; text-align:right;">Preço Unit.</th>
          <th style="width:110px; text-align:right;">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${itensHtml}
      </tbody>
    </table>

    <div class="totals-wrap">
      <div class="totals-box">
        <div class="totals-row">
          <span>Subtotal dos itens</span>
          <span>R$ ${subtotalStr}</span>
        </div>
        ${descStr ? `
        <div class="totals-row">
          <span>Desconto concedido</span>
          <span style="color:#b91c1c;">-R$ ${descStr}</span>
        </div>` : ''}
        <div class="totals-row">
          <span>Condição de pagamento sugerida</span>
          <span>${dados.formaPagamento || 'À vista ou parcelado'}</span>
        </div>
        <div class="totals-row grand-total">
          <span>VALOR TOTAL</span>
          <span>R$ ${totalStr}</span>
        </div>
      </div>
    </div>

    <div class="conditions-box">
      <strong>Termos e Validade da Proposta:</strong><br>
      • Este orçamento é válido por <strong>${validade} dias</strong> a contar de sua emissão.<br>
      • Preços e prazos de entrega de lentes de laboratório especiais sujeitos à confirmação no fechamento da OS.<br>
      • Garantia legal de 90 dias conforme Código de Defesa do Consumidor e garantia estendida dos fabricantes parceiros.
    </div>
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
