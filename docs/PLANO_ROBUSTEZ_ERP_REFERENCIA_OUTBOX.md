# PLANO DE ROBUSTEZ ERP — BENCHMARK E REFERÊNCIA OUTBOX ERP

> **LEITURA OBRIGATÓRIA PARA TODAS AS PRÓXIMAS IMPLEMENTAÇÕES DO VISIONBOX.**  
> Este documento é o guia arquitetural e funcional canônico para elevar o VisionBox da condição de gerenciador de Ordens de Serviço (OS) e PDV clínico para um **ERP Comercial Vertical Completo e Robusto**, tomando como padrão ouro a base de código do **Outbox ERP** (`D:\TECHBOXBR\CLIENTES\I LOVE MIMOS\OUTBOX ERP\sistema\src`).

---

## 1. Contexto e Diagnóstico Executivo

O VisionBox possui diferenciais sólidos no nicho óptico (máquina de 12 status de OS, prescrições de receitas esférico/cilíndrico/eixo/adp, portal de laboratório e rastreio para o cliente). No entanto, sob a ótica de **ERP de gestão comercial**, apresentava lacunas críticas de maturidade quando comparado ao Outbox ERP:

1. **Vendas Misturadas com OS**: Não existia uma central independente de gestão de vendas e histórico de pedidos. Toda venda de balcão era forçada para a tela de OS/Kanban, gerando confusão entre "venda concluída com cupom entregue" e "orçamento clínico em laboratório".
2. **Caixa sem Turnos Corporativos no Frontend**: O backend dispõe de infraestrutura para sessões de caixa, mas o frontend não oferecia uma tela dedicada de gestão de turnos, extrato detalhado por operador, sangria/suprimento rastreável e conferência cega.
3. **Financeiro Embrionário**: Contas a receber sem suporte a baixas parciais com histórico (`ContaReceberPagamento`), ausência de contas a pagar vinculadas a compras e despesas de fornecedores, e falta de conciliação do valor líquido de taxas de cartão (MDR).
4. **Ausência de Compras por XML**: Necessidade de cadastro e atualização de estoque manual, sem importação de NF-e (XML) emitida por laboratórios e distribuidores de armações.

---

## 2. Benchmark Detalhado: Outbox ERP vs. VisionBox

A inspeção detalhada da base do Outbox ERP (`D:\TECHBOXBR\CLIENTES\I LOVE MIMOS\OUTBOX ERP\sistema\src`) identificou a estrutura e os padrões maduros que devem ser absorvidos:

```
OUTBOX ERP (Referência)                        VISIONBOX (Evolução Alvo)
├── entity/ContaReceber.java                   ├── modules/financeiro/domain/ContaReceber.java
├── entity/ContaReceberPagamento.java    ────► ├── modules/financeiro/domain/ContaReceberPagamento.java  (A Criar)
├── entity/ContaPagar.java                     ├── modules/financeiro/domain/ContaPagar.java
├── entity/Caixa.java                          ├── modules/caixa/domain/CaixaSessao.java
├── entity/CaixaMovimento.java                 ├── modules/caixa/domain/CaixaMovimento.java
├── entity/Venda.java                          ├── modules/vendas/domain/Venda.java
├── entity/VendaPagamento.java                 ├── modules/vendas/domain/VendaPagamento.java
├── entity/VendaTaxaAdicional.java       ────► ├── modules/vendas/domain/VendaTaxaAdicional.java (A Criar)
├── entity/Compra.java + CompraItem.java ────► ├── modules/compras/domain/Compra.java            (A Criar)
├── entity/MaquininhaCartao.java         ────► ├── modules/financeiro/domain/MaquininhaCartao.java (A Criar)
├── entity/ComissaoConfig.java           ────► ├── modules/financeiro/domain/ComissaoConfig.java   (A Criar)
├── templates/venda/listar.html          ────► ├── apps/web/src/pages/Vendas.tsx                 (A Criar)
├── templates/caixa/index.html           ────► ├── apps/web/src/pages/CaixaTurnos.tsx            (A Criar)
└── templates/contas/index.html          ────► ├── apps/web/src/pages/Financeiro.tsx             (Evoluir)
```

---

## 3. Módulos e Funcionalidades a Absorver

### 3.1. Central de Vendas & Histórico de Pedidos (`/vendas`)
No Outbox ERP, o operador e o lojista possuem total controle das vendas já realizadas através de `venda/listar.html` e `VendaWebController.java`.

* **Tabela de Vendas Completa**:
  * Número da Venda (ex: `VD-2026-000123`), Data/Hora, Nome do Cliente (ou Consumidor Final), Vendedor responsável, Valor Total, Status da Venda (`FINALIZADA`, `CANCELADA`, `ORCAMENTO`), Status Fiscal (`EMITIDA`, `CONTINGENCIA`, `CANCELADA`, `ERRO`) e Chave de Acesso SEFAZ.
* **Filtros Avançados**:
  * Por período (Data Início e Fim), por Cliente (nome ou telefone), por Número da Venda e por Status.
* **Ações Imediatas por Venda**:
  * 👁️ **Visualizar Detalhes**: Modal detalhado com itens, quantidades, valores unitários, descontos, acréscimos, taxas adicionais, forma de pagamento, troco e observações.
  * 🧾 **Reimprimir Recibo Comum (80mm)**: Disparo instantâneo em iframe isolado via `executarImpressao` (template térmico oficial).
  * 📄 **Reimprimir Cupom Fiscal / NFC-e (80mm)**: Emissão do layout fiscal com QR Code e protocolo SEFAZ.
  * 📑 **Imprimir DANFE (A4)**: Impressão formato folha completa para empresas ou clientes corporativos.
  * 🌐 **Consultar na SEFAZ**: Link direto com redirecionamento para o portal estadual da SEFAZ utilizando a Chave de Acesso de 44 dígitos ou a URL do QR Code.
  * 🔄 **Retransmitir Contingências**: Ação em lote para retransmitir notas emitidas em contingência offline ao Flowbox/SEFAZ.
  * ❌ **Cancelar Venda / Estorno**: Cancelamento seguro com validação de perfil (Gerente/Admin), estorno no Caixa e retorno ao estoque.

---

### 3.2. Fluxo de Caixa & Gestão de Turnos (`/caixas`)
No Outbox ERP (`Caixa.java`, `CaixaMovimento.java`, `CaixaWebController.java`), o caixa opera como uma ferramenta financeira auditável e não apenas um flag booleano.

* **Histórico de Turnos**:
  * Listagem de todas as aberturas e fechamentos de caixa por operador e data.
* **Abertura com Fundo de Troco**:
  * Definição obrigatória do valor em dinheiro presente na gaveta no início do expediente.
* **Movimentações Auditadas (Sangria e Suprimento)**:
  * Tipo de movimento: `SANGRIA`, `SUPRIMENTO`, `ENTRADA`, `SAIDA`, `VENDA`, `ESTORNO`, `RECEBIMENTO_FIADO`.
  * Obrigatoriedade de informar o motivo e o valor, gerando comprovante térmico opcional de sangria.
* **Fechamento Cego (Conferência de Caixa)**:
  * Ao fechar o turno, o operador insere o valor contado na gaveta (`valorFechamentoInformado`).
  * O sistema calcula o valor apurado pelo sistema (`valorFechamentoSistema` = `valorAbertura` + `entradas` - `saidas`).
  * O sistema calcula e registra a diferença (`diferencaFechamento`):
    * Se positivo: Sobra de caixa.
    * Se negativo: Quebra de caixa.
* **Extrato e Relatório de Fechamento**:
  * Resumo por modalidade: Total em Dinheiro, Total em PIX, Total em Débito, Total em Crédito.
  * Impressão do fechamento de caixa na impressora térmica 80mm e exportação em PDF/Excel.

---

### 3.3. Financeiro Avançado (Contas a Receber e a Pagar)
O Outbox ERP adota um hub unificado (`contas/index.html`) com controle de quitação parcial.

* **Baixas Parciais com Histórico (`ContaReceberPagamento`)**:
  * Título a receber mantém `valorOriginal`, `valorAberto` e `status` (`ABERTO`, `PARCIAL`, `PAGO`, `CANCELADO`).
  * Toda baixa gera uma linha na tabela `conta_receber_pagamento`, gravando:
    * `conta_receber_id`
    * `caixa_id` (vinculado ao turno de caixa aberto no momento do pagamento)
    * `usuario_id` (operador que recebeu)
    * `forma_pagamento_id` (Dinheiro, PIX, Cartão, etc.)
    * `valor_pago`
    * `data_pagamento`
    * `observacao`
  * O valor pago é automaticamente debitado do `valorAberto`. Se o saldo zerar, status muda para `PAGO`; caso contrário, `PARCIAL`.
  * Criação automática de `CaixaMovimento` do tipo `RECEBIMENTO_FIADO` / `ENTRADA` no caixa aberto.
* **Contas a Pagar Corporativas**:
  * Controle de despesas fixas da ótica (aluguel, condomínio, internet, salários, energia) e despesas variáveis de fornecedores (faturas de laboratórios de lentes e distribuidores de armações).
  * Vínculo direto com fornecedor, data de competência, data de vencimento e comprovante de pagamento.
* **Hub Unificado de Contas**:
  * Interface com toggle no topo: **[ A Receber ]** vs **[ A Pagar ]**.
  * Métricas no topo: Total a Receber no Mês, Total a Pagar no Mês, Títulos Vencidos hoje e Saldo Projetado.

---

### 3.4. Compras de Fornecedores & Importação de XML NF-e
No Outbox ERP (`Compra.java`, `CompraItem.java`, `CompraWebController.java`), a entrada de mercadorias é automatizada.

* **Upload de XML de Entrada**:
  * Leitura automática do arquivo XML da NF-e emitida pelo fornecedor da ótica (ex: Essilor, Hoya, Zeiss, distribuidores de armações).
* **De-Para Inteligente e Carga de Estoque**:
  * Extração dos itens do XML: descrição, NCM, código do fornecedor, quantidade, valor de custo e código de barras (EAN).
  * Associação com produtos existentes no catálogo ou pré-cadastro automático.
  * Atualização instantânea da quantidade em estoque.
* **Geração Automática de Contas a Pagar**:
  * Extração das duplicatas/faturas do XML, gerando automaticamente os títulos no Contas a Pagar com datas de vencimento e valores fiéis à nota fiscal.

---

### 3.5. Maquininhas de Cartão & Apuração Líquida (Taxas MDR)
No Outbox ERP (`MaquininhaCartao.java`, `VendaPagamento.java`), o lojista tem clareza da margem líquida.

* **Cadastro de Maquininhas e Taxas**:
  * Cadastro de adquirentes (Stone, Cielo, PagBank, Rede, etc.).
  * Taxa percentual (%) e taxa fixa (R$) para Débito e Crédito (1x, 2x a 6x, 7x a 12x).
* **Cálculo Líquido no Pagamento**:
  * Ao registrar um pagamento em cartão no PDV ou na baixa de título:
    * `taxaValor = valor * (taxaPercentual / 100) + taxaFixa`
    * `valorLiquido = valor - taxaValor`
  * Permite relatórios de conciliação bancária e previsão precisa de recebimentos líquidos.

---

### 3.6. Comissões de Vendedores
No Outbox ERP (`ComissaoConfig.java`, `ComissaoLancamento.java`), cada venda gera apuração de incentivo.

* **Regras de Comissão**:
  * Percentual geral sobre o total da venda, ou percentuais diferenciados por categoria de produto (ex: lentes oftálmicas vs armações solares).
* **Lançamento e Fechamento**:
  * Registro de `ComissaoLancamento` vinculado à venda e ao consultor ótico/vendedor.
  * Relatório de fechamento de comissões por período para pagamento na folha ou vale.

---

### 3.7. Controle de Lotes e Validades ANVISA (Lentes de Contato e Soluções)
No Outbox ERP (`LoteProduto.java`, `ValidadeService.java`), há controle estrito de rastreabilidade de validade.

* **Relevância para Óticas**:
  * Lentes de contato de descarte diário/quinzenal/mensal e soluções higienizadoras (Renu, Opti-Free, Biotrue) possuem **data de validade** e **lote da ANVISA**. Vender produto vencido gera autuações graves de Procon/Vigilância Sanitária.
* **Algoritmo FIFO/FEFO (First-Expired, First-Out)**:
  * Ao adicionar lente de contato ou solução na venda, o sistema consome/reserva automaticamente as unidades do lote com vencimento mais próximo.
* **Painel de Validades**:
  * Alertas preventivos de lotes a vencer nos próximos 30/60 dias e bloqueio de venda para lotes expirados.

---

### 3.8. Impressão de Etiquetas de Código de Barras (Óculos e Vitrine)
No Outbox ERP (`EtiquetaPreset.java`, `EtiquetaController.java`), existe um gerador de etiquetas configurável.

* **Relevância para Óticas**:
  * Toda armação receituário ou solar exposta na ótica exige **etiqueta com código de barras (estilo borboleta/rabicho para ponte/haste)** contendo: Código/SKU, Código de Barras EAN-13, Grife/Marca, Modelo, Cor e Preço à vista/parcelado.
* **Presets Térmicos e Gráficos**:
  * Suporte a impressoras térmicas de etiquetas (Zebra, Argox, Elgin) e folhas adesivas padrão A4 (Pimaco).
  * Seleção de produtos em lote e geração direta de PDF para impressão no tamanho exato das etiquetas da loja.

---

### 3.9. Sugestão Inteligente de Compras & Previsão de Demanda
No Outbox ERP (`SugestaoCompraService.java`, `DemandaPrevisaoService.java`), há um motor de reposição analítica.

* **Relevância para Óticas**:
  * Armações de grife e blocos de lentes representam alto custo de capital parado. O lojista não pode ter estoque excessivo de armações que não giram nem ficar sem os modelos mais procurados.
* **Motor Analítico**:
  * Cruza histórico de vendas dos últimos 30/60/90 dias com estoque atual e tempo de reposição (lead time) do distribuidor.
  * Classifica prioridade em: `CRITICA`, `SEM_ESTOQUE` e `NORMAL`.
  * Gera lista de compras sugerida pronta para envio aos fornecedores.

---

### 3.10. Baixas de Estoque por Avaria, Quebra e Uso Interno
No Outbox ERP (`BaixaEstoque.java`, `MotivoBaixaEstoque.java`), as saídas não-venda são rigorosamente auditadas.

* **Relevância para Óticas**:
  * No laboratório de montagem, lentes podem trincar ou riscar durante o corte/bisote (`AVARIA_PERDA`).
  * No balcão, a loja consome flanelas e sprays de limpeza (`USO_INTERNO`) e oferece estojos ou cordões de brinde (`BRINDE_AMOSTRA`).
* **Rastreabilidade**:
  * Registro de cada saída com motivo padronizado, quantidade, custo unitário e operador responsável, evitando furos e discrepâncias no inventário.

---

### 3.11. Inventário Rápido com Scanner por Celular (Sem Fio)
No Outbox ERP (`ScannerSession.java`, `ScannerController.java`), qualquer smartphone vira um coletor de dados.

* **Relevância para Óticas**:
  * Fazer inventário das vitrines com leitor USB com fio preso ao computador é inviável em lojas grandes.
* **Operação Wireless via SSE (Server-Sent Events)**:
  * O sistema exibe um QR Code na tela do computador. O operador aponta a câmera do celular, abre a página de bipagem e passa bipando os códigos de barra das armações expostas nas vitrines.
  * As leituras entram em tempo real no ERP, alimentando a contagem de estoque e acusando divergências de inventário.

---

### 3.12. Tabelas de Preços Diferenciadas & Convênios
No Outbox ERP (`TabelaPreco.java`, `TabelaPrecoItem.java`), os preços não são estáticos.

* **Relevância para Óticas**:
  * Quase toda ótica opera com **convênios e parcerias locais** (OAB, sindicatos de classe, empresas da região, clínicas oftalmológicas parceiras) que garantem tabelas com descontos negociados.
* **Regras de Tabela**:
  * Criação de tabelas com período de vigência e preços específicos por produto/marca.
  * Ao selecionar o cliente no PDV, o sistema aplica automaticamente a tabela vinculada ao seu convênio.

---

### 3.13. Programa de Fidelidade, Cashback e Pontos de Recompra
No Outbox ERP (`FidelidadeConfig.java`, `FidelidadeMovimento.java`), há retenção ativa de clientes.

* **Relevância para Óticas**:
  * O ciclo de troca de óculos e nova receita médica varia de 12 a 24 meses. Manter o vínculo com o cliente é vital.
* **Mecanismos**:
  * Acúmulo de pontos a cada R$ gasto no balcão.
  * Bonificação automática de pontos de presente no mês de aniversário do cliente (notificado via WhatsApp).
  * Resgate dos pontos como desconto no PDV para a compra do próximo par de óculos.

---

### 3.14. Orçamento Online com Link WhatsApp + PIN de Acesso LGPD
No Outbox ERP (`OrcamentoPublicoController.java`), o orçamento sai do papel físico.

* **Relevância para Óticas**:
  * O cliente pesquisa armações e lentes, mas quer decidir em casa com a família ou comparar preços.
* **Privacidade & Praticidade**:
  * O vendedor envia um link personalizado via WhatsApp.
  * Ao acessar, uma tela solicita um **PIN de 4 dígitos** (protegendo dados pessoais conforme LGPD).
  * O cliente visualiza a proposta completa com fotos das armações, tratamentos de lentes escolhidos, valor à vista com desconto e simulação de parcelamento sem juros.

---

### 3.15. Kits e Combos Óticos Promocionais
No Outbox ERP (`Kit.java`, `KitItem.java`), múltiplos produtos formam um pacote fechado.

* **Relevância para Óticas**:
  * Criação de combos comerciais populares: *"Combo Óculos Completo: Armação da Coleção + Par de Lentes Antirreflexo + Estojo Premium + Kit Limpeza por R$ 399,00"*.
* **Gestão de Estoque**:
  * Na venda do kit, o sistema deduz individualmente a armação, as lentes e o estojo do estoque, mantendo o custo e a margem calculados com precisão.

---

### 3.16. Auditoria Antifraude de Vendas & Alertas via Telegram ao Gestor
No Outbox ERP (`AnomaliaVendaService.java`, `AuditoriaPreco.java`, `TelegramService.java`), a segurança operacional é ativa.

* **Auditoria de Preços e Descontos**:
  * Rastreia quem alterou o preço de custo ou venda de cada item no catálogo.
  * Algoritmo de detecção de anomalias (descontos muito acima da curva média do operador ou vendas com margem zerada).
* **Alertas no Telegram para o Gestor**:
  * Notificação imediata no smartphone do gestor quando:
    * Ocorre uma sangria expressiva no caixa.
    * Há quebra de caixa no fechamento de turno.
    * Ordens de serviço de laboratório entram em atraso de entrega.
    * Fechamento do dia com resumo de faturamento e vendas.

---

---

## 4. Controle de Módulos e Planos pelo Painel do Desenvolvedor (SaaS Feature Flagging)

> **DIRETRIZ MANDATÓRIA DO PROJETO:**  
> Assim como no **Outbox ERP** (`ModuloConfiguracao.java`, `ModuloSistema.java`, `DesenvolvedorWebController.java`), **todos os módulos do VisionBox devem ser estritamente controlados pelo Painel do Desenvolvedor** (`/desenvolvedor`). Os clientes terão planos comerciais específicos e os recursos serão liberados ou bloqueados conforme o plano contratado ou ativação avulsa.

### 4.1. Enumeração dos Módulos do VisionBox (`ModuloSistema`)
O sistema adotará o enum canônico de módulos que mapeia identificador, nome de exibição, ícone e prefixos de rotas:

| Código do Módulo | Nome de Exibição | Descrição | Prefixos de Rota |
|---|---|---|---|
| `PDV_BALCAO` | PDV & Frente de Caixa | Vendas de balcão, caixa diário e recibos térmicos 80mm | `/pdv`, `/api/v1/vendas` |
| `ORDEM_SERVICO` | Ordem de Serviço Ótica | Máquina de 12 status, armações, lentes e laboratório | `/os`, `/api/v1/ordens-servico` |
| `RECEITAS_CLINICAS` | Receitas Oftálmicas | Gestão de receitas, esférico, cilíndrico, eixo e DNP | `/receitas`, `/api/v1/receitas` |
| `CENTRAL_VENDAS` | Central de Vendas & Cupons | Histórico de vendas, reimpressão térmica/DANFE e SEFAZ | `/vendas`, `/api/v1/vendas/historico` |
| `CAIXA_TURNOS` | Gestão de Caixa & Turnos | Turnos por operador, sangria, suprimento e fechamento cego | `/caixas`, `/api/v1/caixa` |
| `FINANCEIRO_COMPLETO`| Financeiro & DRE | Contas a receber (baixas parciais), a pagar, DRE e OFX | `/financeiro`, `/api/v1/financeiro` |
| `FISCAL_FLOWBOX` | Emissão Fiscal (NFC-e/NF-e) | Transmissão de notas fiscais integrada ao Flowbox | `/configuracoes/fiscal`, `/api/v1/fiscal` |
| `COMPRAS_XML` | Compras & Importação XML | Entrada de notas de distribuidores e carga de estoque | `/compras`, `/api/v1/compras` |
| `ESTOQUE_LOTES` | Lotes & Validades ANVISA | Rastreio FEFO/FIFO de lentes de contato e soluções | `/lotes`, `/api/v1/lotes` |
| `ETIQUETAS` | Impressão de Etiquetas | Impressão de etiquetas para óculos e código de barras | `/etiquetas`, `/api/v1/etiquetas` |
| `SUGESTAO_COMPRAS` | Previsão & Sugestão Compras | Cálculo inteligente de giro e reposição de estoque | `/sugestao-compras`, `/api/v1/sugestao-compras` |
| `SCANNER_MOVEL` | Coletor Móvel / Scanner | Bipagem por celular via QR Code e SSE | `/scanner`, `/api/v1/scanner` |
| `TABELAS_PRECO` | Tabelas de Preço & Convênios | Preços diferenciados para sindicatos, empresas e parcerias | `/tabelas-preco`, `/api/v1/tabelas-preco` |
| `FIDELIDADE_PONTOS` | Programa de Fidelidade | Acúmulo de pontos, presentes de aniversário e cashback | `/fidelidade`, `/api/v1/fidelidade` |
| `ORCAMENTO_ONLINE` | Orçamento WhatsApp + PIN | Visualização de proposta no celular com PIN de segurança | `/orcamentos`, `/api/v1/orcamentos` |
| `KITS_COMBOS` | Kits & Combos Promocionais | Pacotes comerciais com baixa automática dos insumos | `/kits`, `/api/v1/kits` |
| `LAB_PORTAL` | Portal do Laboratório | Portal de terceirização e tracking para montadores | `/lab`, `/api/v1/lab` |
| `RASTREIO_CLIENTE` | Rastreio PWA do Cliente | Acompanhamento do status dos óculos pelo cliente final | `/rastreio`, `/api/v1/rastreio` |
| `ALERTAS_TELEGRAM` | Notificações no Telegram | Alertas operacionais de fechamento e sangria no celular | `/configuracoes/telegram`, `/api/v1/telegram` |

---

### 4.2. Matriz de Planos Comerciais Sugerida

Para facilitar a comercialização do VisionBox no modelo SaaS pela TECHBOXBR, os módulos são empacotados em planos progressivos:

```
[ Plano Start / PDV ]
  ├── PDV_BALCAO, CENTRAL_VENDAS, CAIXA_TURNOS (Básico)
  └── Catálogo e Gestão de Clientes

[ Plano Pro / Ótica Especializada ]
  ├── Tudo do Plano Start
  ├── ORDEM_SERVICO (12 status), RECEITAS_CLINICAS
  ├── LAB_PORTAL, RASTREIO_CLIENTE
  ├── FINANCEIRO_COMPLETO (Baixas parciais + Contas a Pagar + DRE)
  ├── FISCAL_FLOWBOX (NFC-e e NF-e)
  └── ESTOQUE_LOTES (Validades ANVISA para lentes de contato)

[ Plano Enterprise / Redes & Alta Performance ]
  ├── Tudo do Plano Pro
  ├── COMPRAS_XML (Importação de XML de distribuidores)
  ├── ETIQUETAS (Impressão de etiquetas de código de barras para armações)
  ├── SUGESTAO_COMPRAS (Previsão de demanda analítica)
  ├── SCANNER_MOVEL (Inventário por celular)
  ├── TABELAS_PRECO (Convênios e parcerias)
  ├── FIDELIDADE_PONTOS (Cashback e pontos de aniversário)
  ├── ORCAMENTO_ONLINE (Proposta no WhatsApp com PIN)
  ├── KITS_COMBOS (Combos óculos completo)
  └── ALERTAS_TELEGRAM (Auditoria antifraude e alertas no celular)
```

---

### 4.3. Interface no Painel do Desenvolvedor (`/desenvolvedor`)

No frontend do Painel do Desenvolvedor, teremos:
1. **Seletor de Loja (Tenant)**:
   - Permite ao desenvolvedor escolher qual ótica está configurando.
2. **Seletor Rápido de Plano**:
   - Um dropdown/select com: `[ Start ]`, `[ Pro ]`, `[ Enterprise ]` e `[ Personalizado ]`.
   - Ao selecionar um plano, o sistema marca automaticamente os checkboxes dos módulos daquele plano.
3. **Grade de Toggles Granulares por Módulo**:
   - Cada módulo da tabela 4.1 tem um switch (Toggle Switch On/Off) individual com ícone, nome e badge de status.
   - Permite **overriding granular**: a TECHBOXBR pode vender um plano *Start* ou *Pro* e ativar módulos adicionais como add-on avulso (ex: ativar apenas o módulo de *Etiquetas* para um cliente Pro).
4. **Persistência Imediata com Auditoria**:
   - As alterações disparam `PUT /api/v1/dev/lojas/{lojaId}/modulos` e registram auditoria com quem alterou e quando.

---

### 4.4. Enforcement Rígido no Frontend e Backend

* **No Frontend (React)**:
  * O estado de módulos ativos da loja é carregado no login e mantido em `useEmpresaStore` / `useModulosStore`.
  * **Sidebar (`AppShell.tsx`)**: Menus e submenus de rotas de módulos inativos **não são renderizados** (ex: se `ETIQUETAS` estiver desativado para a loja, o item "Etiquetas" simplesmente não aparece na navegação).
  * **Proteção de Rota (`GuardaModulo.tsx`)**: Se o usuário digitar a URL diretamente no navegador (ex: `/etiquetas`), um wrapper de rota intercepta e exibe uma tela amigável:
    > *"Recurso Bloqueado: Este módulo não está ativo no plano da sua ótica. Entre em contato com a TECHBOXBR para realizar o upgrade."*
* **No Backend (Spring Boot)**:
  * Anotação de segurança `@RequerModulo(ModuloSistema.ETIQUETAS)` nos controllers e endpoints correspondentes.
  * Um interceptor (`ModuloTenantInterceptor`) verifica se a `loja_id` do `TenantContext` possui o módulo habilitado na tabela `modulo_configuracao_loja`. Caso negativo, responde imediatamente `403 FORBIDDEN` com payload padronizado:
    ```json
    {
      "status": 403,
      "codigo": "MODULO_NAO_CONTRATADO",
      "modulo": "ETIQUETAS",
      "mensagem": "O módulo de Impressão de Etiquetas não está liberado no plano contratado para esta loja."
    }
    ```

---

## 5. Arquitetura Técnica & Regras Rígidas (VisionBox)

Ao implementar as novas funcionalidades, é **terminantemente obrigatório** seguir as regras de ouro do `AGENTS.md`:

| Regra | Diretriz Técnica |
|---|---|
| **R1 — Multi-Tenancy** | Toda nova tabela DEVE ter `loja_id UUID NOT NULL` com RLS habilitado (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY; FORCE ROW LEVEL SECURITY`). Repositórios devem sempre consultar com `lojaId` (`findByIdAndLojaId`). |
| **R2 — Criptografia** | Dados pessoais (CPF do cliente) e sensíveis sempre criptografados com `AES-GCM + HMAC`. |
| **R3 — Fiscal** | Nenhuma alíquota hard-coded. Emissão fiscal integrada centralizadamente ao **Flowbox** (`ADR-004`). |
| **R4 — Idempotência** | Toda finalização de venda e baixa financeira deve suportar cabeçalho `Idempotency-Key`. |
| **R5 — Design System** | Proibido inventar hexadecimais no JSX. Utilizar estritamente os tokens de `theme-visionbox.css` e o UI Kit em `apps/web/src/components/ui`. |
| **R6 — Transições de OS** | As Ordens de Serviço continuam orquestradas pelo `TransicaoOSRegistry`. Vendas do balcão PDV nascem confirmadas (`PEDIDO_CONFIRMADO`). |
| **R8 — Progresso** | Registrar todo avanço em `docs/PROGRESS.md` e `.visionbox/state.json`. |
| **R10 — Processos** | Proibido subir processos desacoplados em segundo plano ou ocupar portas desnecessárias. |
| **R11 — Modulação SaaS** | Todo novo recurso ou tela deve estar mapeado no enum `ModuloSistema` e condicionado ao `ModuloTenantInterceptor` / `GuardaModulo`. |

---

## 6. Roteiro de Implementação em Fases (Roadmap)

### Fase 1: Central de Vendas & Histórico de Pedidos (`/vendas`)
* [ ] **Backend**:
  * Endpoint `GET /api/v1/vendas` (com paginação e filtros: dataInicio, dataFim, cliente, numero, status).
  * Endpoint `GET /api/v1/vendas/{id}` (detalhes completos da venda com itens e pagamentos).
  * Endpoint `POST /api/v1/vendas/{id}/cancelar` (cancelamento de venda com estorno de estoque e caixa).
* [ ] **Frontend**:
  * Criar página `apps/web/src/pages/Vendas.tsx`.
  * Filtros dinâmicos (cliente, número, período, status de venda e fiscal).
  * Tabela com paginação e badges coloridos com tokens do sistema.
  * Modal `DetalhesVendaModal.tsx` com visão completa do pedido.
  * Ações rápidas: Reimprimir Recibo (80mm), Reimprimir NFC-e (80mm), Imprimir DANFE (A4), Consultar na SEFAZ e Cancelar Venda.
  * Incluir rota `/vendas` no `App.tsx` e atalho no menu lateral em `AppShell.tsx`.

### Fase 2: Gestão de Caixa & Turnos (`/caixas`)
* [ ] **Backend**:
  * Enriquecer `CaixaService` com relatório consolidado de fechamento e apuração por forma de pagamento.
  * Validação de fechamento cego e apuração de diferença de caixa (`diferencaFechamento`).
  * Endpoints para sangria, suprimento e emissão de extrato.
* [ ] **Frontend**:
  * Criar página `apps/web/src/pages/CaixaTurnos.tsx`.
  * Cards de resumo no topo: Turno Atual (Aberto/Fechado), Saldo em Gaveta, Total Entradas, Total Saídas.
  * Tabela com histórico de turnos anteriores.
  * Modais para: Abrir Caixa, Sangria/Suprimento, Fechar Caixa com conferência cega e Imprimir Extrato de Fechamento (80mm).
  * Incluir rota `/caixas` no `App.tsx` e submenu em `AppShell.tsx`.

### Fase 3: Financeiro Completo com Baixas Parciais (`/financeiro`)
* [ ] **Backend**:
  * Migration Flyway criando a tabela `conta_receber_pagamento` (com `loja_id`, `conta_receber_id`, `caixa_id`, `forma_pagamento_id`, `valor_pago`, etc.).
  * Criar entidade `ContaReceberPagamento` e repositório com suporte a multi-tenancy.
  * Atualizar `ContaReceberService.baixar` para receber valor parcial, registrar o pagamento histórico e lançar movimento no caixa aberto.
  * Implementar módulo de Fornecedores e Contas a Pagar estruturado.
* [ ] **Frontend**:
  * Reformular `Financeiro.tsx` com Toggle fluido: **[ A Receber ]** vs **[ A Pagar ]**.
  * Modal `BaixaContaModal.tsx` permitindo informar valor pago, forma de pagamento, desconto/juros e observação.
  * Visualização do histórico de pagamentos dentro dos detalhes da conta.

### Fase 4: Compras (XML NF-e), Maquininhas & Comissões
* [ ] **Backend & Frontend**:
  * Módulo de Compras com parser de XML de entrada de NF-e e entrada em estoque.
  * Módulo de Maquininhas com cadastro de taxas MDR e apuração de valor líquido.
  * Módulo de Comissões com apuração por vendedor.

### Fase 5: Gestor SaaS de Módulos & Planos no Painel do Desenvolvedor
* [ ] **Backend & Frontend**:
  * Migration Flyway criando a tabela `modulo_configuracao_loja` (com `loja_id`, `modulo_codigo`, `ativo`, `plano_nome`).
  * Atualizar `PainelDesenvolvedor.tsx` com seletor de planos (Start, Pro, Enterprise) e grade de switches individuais para cada módulo.
  * Criação do `GuardaModulo.tsx` no frontend e `@RequerModulo` no backend.

## 7. Checklist de Leitura Obrigatória para Próximos Agentes

Antes de iniciar qualquer tarefa relativa a Vendas, Caixa, Financeiro, Compras ou Módulos:
1. Ler este documento (`docs/PLANO_ROBUSTEZ_ERP_REFERENCIA_OUTBOX.md`).
2. Consultar a entidade correspondente em `D:\TECHBOXBR\CLIENTES\I LOVE MIMOS\OUTBOX ERP\sistema\src\main\java\com\outbox\sistema\entity\`.
3. Consultar a lógica de negócio em `D:\TECHBOXBR\CLIENTES\I LOVE MIMOS\OUTBOX ERP\sistema\src\main\java\com\outbox\sistema\service\impl\`.
4. Consultar a experiência do usuário nos templates correspondentes em `D:\TECHBOXBR\CLIENTES\I LOVE MIMOS\OUTBOX ERP\sistema\src\main\resources\templates\`.
5. Garantir que todo novo recurso pertença a um `ModuloSistema` com controle de ativação pelo Painel do Desenvolvedor.
6. Garantir que a implementação no VisionBox utilize os tokens de `theme-visionbox.css` e o padrão multi-tenant `loja_id`.

