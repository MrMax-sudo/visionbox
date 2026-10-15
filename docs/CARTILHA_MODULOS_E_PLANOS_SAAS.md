# VisionBox — Cartilha Comercial de Módulos e Planos SaaS

> **Documento Oficial de Engenharia de Produto e Comercial — TECHBOXBR**  
> **Versão:** 1.0 (Compatível com o Painel do Desenvolvedor `/desenvolvedor` e `ModuloSistema.java`)  
> **Atualizado em:** 15 de Outubro de 2026

---

## 1. Visão Geral da Arquitetura SaaS

O **VisionBox** foi concebido como um ERP vertical especializado para o mercado ótico, com arquitetura multi-tenant nativa e modulação dinâmica de recursos (Regra R11). 

Diferente de sistemas legados rígidos, no VisionBox cada ótica cliente (tenant) tem acesso aos recursos conforme o plano contratado ou módulos avulsos adicionados. Essa modulação atua em **três camadas de segurança**:
1. **Interface do Usuário (UI):** Menus e rotas inacessíveis são ocultados automaticamente da barra lateral.
2. **Navegação (Guarda de Rota):** O componente `<GuardaModulo />` intercepta acessos diretos por URL e apresenta a tela oficial de upgrade da TECHBOXBR.
3. **Backend & Banco de Dados (API Guard):** O interceptor `@RequerModulo` valida a chave da loja autenticada no token JWT e bloqueia qualquer chamada não autorizada com código HTTP `403 Forbidden`.

---

## 2. Divisão dos Planos de Contratação

Os 19 módulos do sistema são empacotados em **três planos comerciais progressivos** (`START` ⊂ `PRO` ⊂ `ENTERPRISE`), além do modo **`PERSONALIZADO`**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PLANO ENTERPRISE (19 Módulos)                   │
│  Tudo do Pro + Compras XML, Etiquetas, Orçamentos WhatsApp,            │
│  Sugestão Compras, Scanner Móvel, Fidelidade, Combos, Convênios e Bot  │
├────────────────────────────────────────────────────────────────────────┤
│                           PLANO PRO (10 Módulos)                       │
│  Tudo do Start + Núcleo Ótico (OS 12 Status, Receitas, Portal Lab,    │
│  Rastreio PWA Cliente, Financeiro DRE, Emissão Fiscal, Lotes ANVISA)   │
├────────────────────────────────────────────────────────────────────────┤
│                          PLANO START (3 Módulos)                       │
│  Frente de Caixa (PDV Balcão) + Central de Vendas + Gestão de Caixas   │
│  (Inclui Catálogo de Produtos e Gestão de Clientes)                    │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 2.1. Matriz Comparativa de Planos

| Módulo | Código Canônico | Plano Start | Plano Pro | Plano Enterprise |
|---|---|:---:|:---:|:---:|
| **PDV & Frente de Caixa** | `PDV_BALCAO` | ✅ | ✅ | ✅ |
| **Central de Vendas & Cupons** | `CENTRAL_VENDAS` | ✅ | ✅ | ✅ |
| **Gestão de Caixa & Turnos** | `CAIXA_TURNOS` | ✅ | ✅ | ✅ |
| **Ordem de Serviço Ótica** | `ORDEM_SERVICO` | ❌ | ✅ | ✅ |
| **Receitas Oftálmicas** | `RECEITAS_CLINICAS` | ❌ | ✅ | ✅ |
| **Portal do Laboratório** | `LAB_PORTAL` | ❌ | ✅ | ✅ |
| **Rastreio PWA do Cliente** | `RASTREIO_CLIENTE` | ❌ | ✅ | ✅ |
| **Financeiro & DRE** | `FINANCEIRO_COMPLETO` | ❌ | ✅ | ✅ |
| **Emissão Fiscal (NFC-e/NF-e)** | `FISCAL_FLOWBOX` | ❌ | ✅ | ✅ |
| **Lotes & Validades ANVISA** | `ESTOQUE_LOTES` | ❌ | ✅ | ✅ |
| **Compras & Importação XML** | `COMPRAS_XML` | ❌ | ❌ | ✅ |
| **Impressão de Etiquetas** | `ETIQUETAS` | ❌ | ❌ | ✅ |
| **Orçamento WhatsApp + PIN** | `ORCAMENTO_ONLINE` | ❌ | ❌ | ✅ |
| **Previsão & Sugestão Compras** | `SUGESTAO_COMPRAS` | ❌ | ❌ | ✅ |
| **Coletor Móvel / Scanner** | `SCANNER_MOVEL` | ❌ | ❌ | ✅ |
| **Tabelas de Preço & Convênios** | `TABELAS_PRECO` | ❌ | ❌ | ✅ |
| **Programa de Fidelidade** | `FIDELIDADE_PONTOS` | ❌ | ❌ | ✅ |
| **Kits & Combos Promocionais** | `KITS_COMBOS` | ❌ | ❌ | ✅ |
| **Notificações no Telegram** | `ALERTAS_TELEGRAM` | ❌ | ❌ | ✅ |

---

## 3. Detalhamento dos Planos Comerciais

### 🔹 Plano START (Frente de Caixa & Balcão)
* **Perfil do Cliente:** Óticas recém-abertas, quiosques de óculos de sol/acessórios ou comércios que precisam emitir vendas com agilidade sem complexidade laboratorial.
* **Foco:** Rapidez de atendimento no balcão, múltiplos meios de pagamento e controle rígido do caixa diário por operador.
* **Módulos inclusos (3):** `PDV_BALCAO`, `CENTRAL_VENDAS`, `CAIXA_TURNOS` (com Clientes e Produtos liberados na base).

### 🔹 Plano PRO (O Coração da Ótica Especializada)
* **Perfil do Cliente:** Óticas tradicionais e consultórios com ótica própria que operam receituários médicos, montagem em laboratório e precisam de conformidade fiscal e financeira.
* **Foco:** Controle de ponta a ponta da Ordem de Serviço (12 status), SLA de montagem, portal do cliente e do laboratório, emissão fiscal automática e controle de recebíveis/crediário.
* **Módulos inclusos (10):** Todos do Start + `ORDEM_SERVICO`, `RECEITAS_CLINICAS`, `LAB_PORTAL`, `RASTREIO_CLIENTE`, `FINANCEIRO_COMPLETO`, `FISCAL_FLOWBOX`, `ESTOQUE_LOTES`.

### 🔹 Plano ENTERPRISE (Alta Performance & Redes)
* **Perfil do Cliente:** Redes de óticas, lojas de grande movimento e empresários focados em automação máxima, compras inteligentes, fidelização e redução drástica de erros operacionais.
* **Foco:** Importação rápida de XML de fornecedores, inventário móvel, etiquetas de armação em massa, comissões avançadas, propostas comerciais de luxo no WhatsApp e alertas de gestão antifraude no celular.
* **Módulos inclusos (19):** Todos os 19 módulos do sistema ativados sem restrições.

### 🔹 Plano PERSONALIZADO
* **Aplicação:** Permite à TECHBOXBR compor pacotes customizados para clientes corporativos (exemplo: uma ótica no Plano Start que queira contratar apenas o módulo de *Orçamentos* ou *Etiquetas* como add-on avulso). O controle é feito via switches no Painel do Desenvolvedor.

---

## 4. Catálogo Detalhado dos 19 Módulos

---

### Módulo 01: PDV & Frente de Caixa
* **Identificador:** `PDV_BALCAO`
* **Rotas:** `/pdv` | `/api/v1/vendas`
* **Descrição:** Terminal de vendas de balcão teclado-first de alta velocidade (<100ms), busca instantânea de clientes e armações/lentes, carrinho interativo, cálculo de descontos com alçada e múltiplos meios de pagamento (Pix com QRCode oficial BACEN, Dinheiro com troco, Cartão de Crédito e Débito).
* **Valor para a Ótica:** Elimina filas no caixa, agiliza a finalização da compra e gera na hora recibos térmicos 80mm ou propostas de venda.

---

### Módulo 02: Ordem de Serviço Ótica
* **Identificador:** `ORDEM_SERVICO`
* **Rotas:** `/os` | `/os/:id` | `/api/v1/ordens-servico`
* **Descrição:** Máquina de estados com 12 status do ciclo de vida da OS ótica (`ORCAMENTO` → `LAB_ENVIO` → `LAB_PRODUCAO` → `LAB_MONTAGEM` → `CONTROLE_QUALIDADE` → `PRONTO` → `ENTREGUE`). Possui semáforo visual de SLA, alertas de atraso, linha do tempo auditável de eventos e estipulação de prazo pelo operador.
* **Valor para a Ótica:** Visibilidade total do status de cada óculos, evitando atrasos de laboratório e reclamações de clientes.

---

### Módulo 03: Receitas Oftálmicas
* **Identificador:** `RECEITAS_CLINICAS`
* **Rotas:** `/receitas` | `/api/v1/receitas`
* **Descrição:** Gestão e arquivamento digital de receitas médicas oftalmológicas. Registra dados de Longe, Perto e Multifocal (Grau Esférico, Cilíndrico, Eixo, Adição, DNP de olho direito e esquerdo, altura de montagem, médico e CRM), com alerta de expiração após 1 ano.
* **Valor para a Ótica:** Segurança técnica na montagem, histórico visual do cliente ao longo dos anos e gatilho automático de recall anual para nova consulta.

---

### Módulo 04: Central de Vendas & Cupons
* **Identificador:** `CENTRAL_VENDAS`
* **Rotas:** `/vendas` | `/api/v1/vendas/historico`
* **Descrição:** Painel centralizado de todas as operações de venda realizadas na loja com filtros por período, cliente e status. Permite reimpressão de comprovantes térmicos 80mm, DANFE modelo 55, e processo de cancelamento com estorno físico automático das armações para o estoque.
* **Valor para a Ótica:** Auditoria rápida do faturamento diário e resolução de trocas ou devoluções em segundos com reposição automática de estoque.

---

### Módulo 05: Gestão de Caixa & Turnos
* **Identificador:** `CAIXA_TURNOS`
* **Rotas:** `/caixas` | `/api/v1/caixa`
* **Descrição:** Controle financeiro de turnos de operadores de caixa. Inclui valor de fundo de troco na abertura, lançamentos auditados de sangria (retirada de dinheiro) e suprimento (reforço de troco), e fechamento cego onde o operador declara os valores físicos antes da conciliação do sistema.
* **Valor para a Ótica:** Prevenção contra desvios, segurança operacional para donos ausentes e conciliação precisa entre dinheiro físico, cartão e Pix.

---

### Módulo 06: Financeiro & DRE
* **Identificador:** `FINANCEIRO_COMPLETO`
* **Rotas:** `/financeiro` | `/maquininhas` | `/comissoes` | `/api/v1/financeiro`
* **Descrição:** Gestão financeira completa com Contas a Receber (suporte a carnê/crediário e baixas parciais de parcelas), Contas a Pagar a fornecedores, DRE gerencial, cadastro de taxas de maquininhas por bandeira e cálculo automatizado de comissões por vendedor.
* **Valor para a Ótica:** Controle da inadimplência do crediário próprio, visão clara do lucro líquido da ótica e eliminação de cálculos manuais de comissões no final do mês.

---

### Módulo 07: Emissão Fiscal Integrada
* **Identificador:** `FISCAL_FLOWBOX`
* **Rotas:** `/fiscal` | `/api/v1/fiscal`
* **Descrição:** Motor fiscal de alta performance integrado ao Flowbox da TECHBOXBR. Emite NFC-e (modelo 65) no balcão e NF-e (modelo 55), gerencia certificados digitais A1, alíquotas tributárias por NCM e possui contingência offline automática com transmissão retroativa.
* **Valor para a Ótica:** Conformidade tributária completa perante a SEFAZ estadual, sem travamentos no caixa caso a internet caia temporariamente.

---

### Módulo 08: Compras & Importação XML
* **Identificador:** `COMPRAS_XML`
* **Rotas:** `/compras` | `/api/v1/compras`
* **Descrição:** Módulo de entrada de notas fiscais de compra através do upload direto do arquivo XML da NF-e emitida pelos distribuidores e fabricantes de armações/lentes. O sistema lê os produtos, confronta o código do fornecedor com o código interno e atualiza os custos e o estoque físico.
* **Valor para a Ótica:** Economia de horas de digitação manual de notas de 50 ou 100 armações, além de atualização automática do custo médio dos produtos.

---

### Módulo 09: Lotes & Validades ANVISA
* **Identificador:** `ESTOQUE_LOTES`
* **Rotas:** `/lotes` | `/api/v1/lotes`
* **Descrição:** Controle de rastreabilidade de produtos que exigem controle sanitário, como caixas de lentes de contato descartáveis e soluções de assepsia/limpeza. Opera sob a política FEFO (primeiro que vence é o primeiro que sai).
* **Valor para a Ótica:** Cumprimento das normas de fiscalização da ANVISA e Procon, eliminando prejuízos com produtos vencidos na gaveta.

---

### Módulo 10: Impressão de Etiquetas
* **Identificador:** `ETIQUETAS`
* **Rotas:** `/etiquetas` | `/api/v1/etiquetas`
* **Descrição:** Gerador de etiquetas adesivas com código de barras, SKU, marca, modelo e preço de venda. Suporta formato especial tipo "borboleta/gravata" (próprio para hastes de armações e óculos solares) e etiquetas de gôndola em impressoras térmicas (Zebra, Argox, Elgin) ou folhas A4.
* **Valor para a Ótica:** Padronização visual da loja, organização das vitrines e agilidade na bipagem dos óculos direto no leitor do PDV.

---

### Módulo 11: Previsão & Sugestão de Compras
* **Identificador:** `SUGESTAO_COMPRAS`
* **Rotas:** `/sugestao-compras` | `/api/v1/sugestao-compras`
* **Descrição:** Algoritmo analítico que cruza o histórico de vendas, sazonalidade e giro de estoque para sugerir a quantidade ideal de reposição de cada modelo de armação e tipo de lente, evitando ruptura de estoque ou excesso de capital parado.
* **Valor para a Ótica:** Otimização do capital de giro e certeza de comprar os modelos e marcas que realmente mais vendem.

---

### Módulo 12: Coletor Móvel / Scanner
* **Identificador:** `SCANNER_MOVEL`
* **Rotas:** `/scanner` | `/api/v1/scanner`
* **Descrição:** Interface web progressiva que transforma qualquer smartphone em um leitor de código de barras sem fio. A câmera do celular faz a leitura e comunica instantaneamente com o sistema via conexão SSE (Server-Sent Events).
* **Valor para a Ótica:** Dispensa a compra de coletores de dados caros, permitindo que a equipe faça inventário de estoque andando pelos corredores da loja apenas com o celular.

---

### Módulo 13: Tabelas de Preço & Convênios
* **Identificador:** `TABELAS_PRECO`
* **Rotas:** `/tabelas-preco` | `/api/v1/tabelas-preco`
* **Descrição:** Cadastro de precificações diferenciadas e regras de desconto automáticas para clientes vinculados a sindicatos, associações de classe, empresas conveniadas ou estudantes.
* **Valor para a Ótica:** Facilidade para fechar parcerias comerciais e convênios corporativos que trazem clientes em massa para a loja com regras de desconto pré-fixadas.

---

### Módulo 14: Programa de Fidelidade
* **Identificador:** `FIDELIDADE_PONTOS`
* **Rotas:** `/fidelidade` | `/api/v1/fidelidade`
* **Descrição:** Sistema de pontuação e cashback onde cada real gasto na ótica acumula pontos para abatimento em compras futuras. Inclui lembrete e bônus de pontos no mês de aniversário do cliente.
* **Valor para a Ótica:** Fidelização do cliente, aumento da taxa de retorno (LTV) e estímulo para que a família inteira compre na mesma ótica.

---

### Módulo 15: Orçamento WhatsApp + PIN
* **Identificador:** `ORCAMENTO_ONLINE`
* **Rotas:** `/orcamentos` | `/api/v1/orcamentos`
* **Descrição:** Geração de propostas comerciais elegantes em formato A4 e envio de link seguro via WhatsApp. A proposta pode ser visualizada pelo cliente no celular com proteção de PIN e, quando aprovada, é carregada no PDV com 1 clique para fechamento da venda.
* **Valor para a Ótica:** Atendimento moderno e profissional para o cliente indeciso que prefere cotar e decidir em casa, aumentando drasticamente a taxa de conversão de orçamentos.

---

### Módulo 16: Kits & Combos Promocionais
* **Identificador:** `KITS_COMBOS`
* **Rotas:** `/kits` | `/api/v1/kits`
* **Descrição:** Agrupamento promocional de produtos com preço promocional unificado (exemplo: *"Armação Ray-Ban + Lente Antirreflexo + Estojo Premium por R$ 799"*). Ao vender o combo no caixa, o sistema baixa automaticamente os itens individuais do estoque.
* **Valor para a Ótica:** Aumento do ticket médio das vendas e criação de campanhas de marketing agressivas em datas comemorativas (Dia das Mães, Black Friday, etc.).

---

### Módulo 17: Portal do Laboratório
* **Identificador:** `LAB_PORTAL`
* **Rotas:** `/lab/:token` | `/api/v1/laboratorios`
* **Descrição:** Portal web externo seguro para laboratórios de surfaçagem e montagem terceirizados. O laboratório acessa a ficha técnica completa da OS via link com token HMAC (sem senha e sem expor dados financeiros ou LGPD do cliente) e pode atualizar o status da produção direto pelo navegador.
* **Valor para a Ótica:** Comunicação limpa e sem erros com o laboratório parceiro, eliminando mensagens soltas no WhatsApp e pedidos de papel perdidos.

---

### Módulo 18: Rastreio PWA do Cliente
* **Identificador:** `RASTREIO_CLIENTE`
* **Rotas:** `/rastreio/:token` | `/api/v1/ordens-servico/rastreio`
* **Descrição:** Aplicativo web leve (PWA) no qual o cliente final da ótica acompanha em tempo real cada etapa dos seus óculos (Em Análise, No Laboratório, Montagem Concluída, Pronto para Retirada na Loja).
* **Valor para a Ótica:** Encantamento do cliente, experiência digital de alto padrão e redução de mais de 70% das ligações e mensagens na loja perguntando se os óculos já chegaram.

---

### Módulo 19: Notificações no Telegram
* **Identificador:** `ALERTAS_TELEGRAM`
* **Rotas:** `/configuracoes/telegram` | `/api/v1/telegram`
* **Descrição:** Bot integrado ao Telegram que envia mensagens instantâneas e discretas no celular do proprietário da ótica informando: abertura de caixa, valor de cada sangria realizada, descontos concedidos acima do padrão e resumo do fechamento financeiro do dia.
* **Valor para a Ótica:** Gestão à distância em tempo real, tranquilidade para o empresário acompanhar múltiplas lojas e prevenção imediata contra fraudes operacionais.

---

## 5. Como Operar no Painel do Desenvolvedor (`/desenvolvedor`)

Para aplicar um plano ou ajustar os módulos de uma ótica cliente:

1. Acesse o sistema com o perfil **`DESENVOLVEDOR`** e clique em **Painel Dev** no menu lateral ou no avatar do usuário.
2. Selecione a ótica no seletor **Loja (tenant)** no topo da tela.
3. Utilize os botões de **Plano Rápido** para definir o pacote em 1 clique:
   * **`Start`**: Ativa os 3 módulos essenciais de balcão.
   * **`Pro`**: Ativa os 10 módulos do núcleo ótico profissional.
   * **`Enterprise`**: Ativa todos os 19 módulos do sistema.
4. Caso o cliente queira módulos avulsos, clique individualmente nos **interruptores (switches)** de cada cartão para ligar ou desligar o recurso instantaneamente (o status mudará para *Personalizado*).
5. O sistema salva a configuração imediatamente na tabela `modulo_configuracao_loja`, e os usuários daquela loja já passam a operar com as permissões atualizadas sem necessidade de reiniciar servidores.

---

## 6. Tabela de Precificação e Políticas Comerciais Sugeridas

> **Estratégia de Monetização SaaS:** Precificação benchmark baseada nos líderes do mercado nacional de ERPs óticos, desenhada para garantir barreira de entrada quase nula no Plano Start, alta conversão no Plano Pro (carro-chefe) e margens expressivas no Plano Enterprise e redes.

### 6.1. Grade de Preços (Mensalidade por Loja)

| Plano | Módulos Inclusos | Mensal Recorrente | Plano Anual *(com desconto)* | Taxa de Implantação *(Setup único)* |
|---|:---:|:---:|:---:|:---:|
| 🔹 **START** | **3 módulos** *(PDV, Caixa, Vendas)* | **R$ 119,00** /mês | **R$ 99,00** /mês *(R$ 1.188/ano)* | R$ 190,00 |
| 🔸 **PRO** *(Carro-Chefe)* | **10 módulos** *(Start + OS 12 status, Lab, Receitas, Fiscal, Financeiro)* | **R$ 249,00** /mês | **R$ 199,00** /mês *(R$ 2.388/ano)* | R$ 390,00 |
| 👑 **ENTERPRISE** | **19 módulos** *(Todos: XML, Etiquetas, Orçamento WhatsApp, Alertas)* | **R$ 449,00** /mês | **R$ 379,00** /mês *(R$ 4.548/ano)* | R$ 590,00 |

---

### 6.2. Políticas Comerciais e Condições Especiais

#### 🏢 Redes e Múltiplas Lojas (Filiais)
* **Loja Matriz:** Valor integral do plano contratado.
* **Filiais (a partir da 2ª loja do mesmo grupo/CNPJ):** **40% de desconto** na mensalidade da filial.
  * *Exemplo:* Uma ótica com 3 lojas no Plano Pro paga: R$ 249 (Matriz) + R$ 149 (Filial 1) + R$ 149 (Filial 2) = **R$ 547,00/mês total**.

#### 🧩 Add-ons Avulsos (Modo Personalizado)
Para clientes no Plano Start ou Pro que desejam contratar funcionalidades pontuais sem migrar de pacote:
* **Módulo Emissão Fiscal (Flowbox):** + R$ 69,00/mês
* **Módulo Compras & Importação XML:** + R$ 49,00/mês
* **Módulo Impressão de Etiquetas:** + R$ 39,00/mês
* **Módulo Orçamento WhatsApp + PIN:** + R$ 39,00/mês
* **Módulo Alertas no Telegram:** + R$ 29,00/mês

#### 🛠️ Taxa de Implantação e Onboarding (Setup)
* Cobre a parametrização do certificado digital, modelos de recibos oficiais, carga inicial de cadastros e treinamento da equipe.
* **Gatilho Comercial:** Pode ser concedida como **isenção promocional** para fechamento imediato no contrato de pagamento anual.

