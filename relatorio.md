# VisionBox — Relatório Executivo e Manual Técnico Completo do Sistema

> **Documento Oficial de Especificação Funcional, Telas, Botões e Arquitetura**  
> **Versão:** 0.1.0-PROD  
> **Atualização:** 2026-10-15  
> **Ambiente de Referência:** Produção VPS (`192.168.15.90`) • Família TECHBOXBR  

---

## 1. Visão Geral do Sistema e Arquitetura

O **VisionBox** é um ERP e Frente de Caixa (PDV) verticalizado de alta performance desenvolvido sob medida para **óticas e laboratórios de montagem óptica**. Ao contrário de sistemas genéricos de varejo, o VisionBox foi desenhado em torno do ciclo de vida oftalmológico e laboratorial: máquina de 12 status de Ordens de Serviço (OS), prescrições ópticas completas com foto de receita, controle de armações com código EAN-13 sequencial, impressão de etiquetas térmicas tipo borboleta com rabicho, gestão de orçamentos comerciais, controle de caixas por turnos e emissão fiscal integrada à API centralizada Flowbox.

### 1.1. Pilares Arquiteturais
- **Backend Robusto:** Java 17, Spring Boot 3.x, Spring Data JPA / Hibernate 6, Spring Security com JWT stateless (Tokens de 15m / 7d httpOnly) e endpoints protegidos com RBAC (*Role-Based Access Control*).
- **Banco de Dados & Multi-Tenant:** PostgreSQL 15 com isolamento rígido multi-loja via Row Level Security (RLS) e `@TenantId` em todas as entidades. Nenhuma consulta é executada sem o `loja_id`. Migrations automáticas via Flyway (da `V1` à `V52`).
- **Segurança e LGPD (ADR-002 e ADR-003):** Criptografia determinística e probabilística (AES-GCM + HMAC SHA-256) para CPF e dados clínicos de grau/prescrição. Mascaramento automático (`***.123.***-**`) para perfil VENDEDOR.
- **Frontend Moderno & Responsivo:** React + TypeScript, Vite, Tailwind CSS com tokens canônicos (`theme-visionbox.css`), TanStack Query para cache e revalidação assíncrona, e interface 100% fluida para **Desktop, Tablets e Smartphones (Mobile First)**.
- **Resiliência e Idempotência:** PDV equipado com `Idempotency-Key` (UUIDv4) e tabela Outbox local, garantindo que vendas offline não sejam duplicadas e continuem operando mesmo com oscilações de conexão.

---

## 2. Estrutura de Navegação Global (Desktop e Mobile)

### 2.1. Sidebar Desktop (Menu Lateral Fixo)
Localizada à esquerda em telas médias e grandes (`md:flex`):
- **Logotipo Interativo:** Logomarca VisionBox com transição de tamanho (expandida 175px / recolhida 44px). Ao clicar no logo, alterna entre modo compacto e expandido (com persistência no `localStorage`).
- **Dashboard:** Link direto para a visão Kanban e KPIs de Ordens de Serviço.
- **PDV (Frente de Caixa):** Link direto para a tela de vendas de balcão (atalho F4 removido conforme especificação para ergonomia limpa).
- **Submenu Operacional (Colapsável com ícone `ChevronDown`):**
  - **Clientes:** Gestão da base de clientes, contatos e histórico.
  - **Receitas:** Gestão de prescrições clínicas e fotos de receitas.
  - **OS:** Ordens de Serviço e fila de produção óptica.
  - **Orçamentos:** Central de propostas comerciais emitidas no balcão.
- **Submenu Financeiro (Colapsável):**
  - **Caixas:** Gestão de turnos, sangrias, suprimentos e fechamento cego.
  - **Vendas:** Histórico completo de vendas, recibos e notas fiscais.
  - **Compras:** Importação de XML de distribuidores e entrada de estoque.
  - **Maquininhas:** Gestão de POS e taxas de cartões.
  - **Comissões:** Acompanhamento de comissão por vendedor.
- **Submenu Estoque (Colapsável):**
  - **Catálogo:** Catálogo geral de armações, lentes, óculos e serviços.
  - **Etiquetas:** Gerador e impressor térmico de etiquetas de código de barras.
- **Submenu Administrativo (Colapsável - apenas ADMIN e DESENVOLVEDOR):**
  - **Usuários:** Gestão de operadores e permissões por perfil.
  - **Fiscal:** Parâmetros de homologação/produção da SEFAZ e Flowbox.
  - **Painel Dev:** Modulação SaaS (R11) para habilitar/desabilitar recursos do plano.
  - **Configurações:** Botão que dispara o modal global de preferências da ótica.
- **Rodapé da Sidebar:** Informações do usuário logado, botão de suporte direto via WhatsApp da TechboxBR e versão do sistema.

### 2.2. Barra Superior (Header)
Fixa no topo da tela com efeito backdrop blur:
- **Botão Hambúrguer Mobile (`md:hidden`):** Ícone de menu que abre o Drawer lateral deslizante no celular.
- **Título Dinâmico:** Exibe o módulo corrente (ex.: "PDV - Frente de caixa").
- **Sinalizador de Sincronização (`SyncIndicator`):** Informa o status de comunicação da loja.
- **Alternador de Tema (Claro / Escuro):** Botão com ícones de Sol/Lua que alterna a paleta de cores entre Light Mode e Dark Mode sem recarregar a página.
- **Sino de Notificações (`NotificationBell`):** Contador e listagem de eventos operacionais e vendas offline pendentes de sincronização.
- **Avatar do Usuário:** Inicial estilizada do operador logado com indicativo de perfil.

### 2.3. Navegação Mobile Fluida (Drawer + Dock Inferior)
Desenvolvida para que operadores e gerentes usem o sistema em qualquer smartphone:
- **`MobileDrawer` (Slide-over Lateral):**
  - Disparado pelo botão hambúrguer do topo ou pelo botão "Mais" da barra inferior.
  - Fundo escurecido com desfoque (*backdrop blur*).
  - Contém **100% de todos os módulos** organizados hierarquicamente por grupos (Principal, Operacional, Financeiro, Estoque, Administrativo).
  - Inclui identificação completa do operador, botão de logout seguro e link direto para suporte WhatsApp.
  - Fecha-se automaticamente ao clicar em qualquer item.
- **`MobileNav` (Dock Inferior Rápido):**
  - Fixado no rodapé de dispositivos móveis.
  - 4 atalhos essenciais: **Início**, **PDV**, **OS**, **Orçamentos**.
  - 5º botão: **"Mais"** (ícone `Menu`), que abre o `MobileDrawer` com acesso total.

### 2.4. Modal Global de Configurações da Loja
Acionado pelo menu Administrativo ou Sidebar:
- **Aba Preferências:**
  - Identificação e nome da ótica.
  - Definição do prazo padrão de validade de orçamentos (ex.: 15 dias).
  - Alíquotas máximas de desconto permitidas sem autorização de gerente.
- **Aba Empresa & Logotipo:**
  - Razão Social, Nome Fantasia, CNPJ, Inscrição Estadual, Endereço e WhatsApp comercial.
  - **Upload de Logotipo da Ótica:** Seleção de arquivo (PNG/JPG) com persistência em Base64 no banco de dados. Este logotipo é renderizado automaticamente em todas as impressões de DANFE (NF-e/NFC-e), recibos térmicos 80mm e propostas de orçamento em A4.
- **Aba Impressão & Recibos:**
  - Configuração do rodapé dos cupons, mensagens promocionais e termos de garantia óptica.
- **Aba Fiscal:**
  - Chaves de integração com o Flowbox, certificados A1 e parâmetros SEFAZ.

---

## 3. Detalhamento Tela a Tela e Funcionalidades

---

### 3.1. Dashboard & Kanban de Ordens de Serviço (`/` e `/os`)

#### Objetivo
Central operacional da ótica para monitoramento do fluxo de atendimento e produção das armações e lentes.

#### Componentes e Indicadores
- **Cards de Métricas Superiores (KPIs):**
  - *Total de OS*: Volume geral de atendimentos ativos.
  - *Em Produção*: Óculos em processo de corte, surfaçagem ou montagem.
  - *No Laboratório*: Pedidos encaminhados para montadores terceirizados.
  - *Prontos para Retirada*: Óculos revisados aguardando o cliente.
  - *Entregues*: Atendimentos finalizados com sucesso.
- **Filtros da Fila de Trabalho:**
  - Campo de busca por número da OS, nome do cliente, CPF ou telefone.
  - Filtro por período (Hoje, Esta Semana, Este Mês, Intervalo Customizado).
  - Filtro por laboratório montador responsável.
- **Quadro Kanban de 12 Status:**
  - Colunas organizadas segundo a máquina de estados canônica do setor óptico:
    1. *Orçamento*
    2. *Pedido Confirmado*
    3. *Aguardando Receita*
    4. *Em Laboratório*
    5. *Montagem*
    6. *Controle de Qualidade*
    7. *Pronto para Retirada*
    8. *Entregue*
    9. *Ajuste Solicitado*
    10. *Cancelado*
    11. *Garantia / Recall*
    12. *Finalizado Fiscal*
- **Card de OS no Kanban:**
  - Número da OS (ex.: `OS-2026-00123`).
  - Nome do cliente e telefone com ícone do WhatsApp.
  - Descrição da armação e tipo de lente.
  - Indicador de prazo prometido (verde para em dia, amarelo para alerta, vermelho para atrasado).
  - Botão de detalhes que abre o prontuário completo da OS.
- **Botões de Ação Rápida:**
  - `Novo Orçamento no PDV`: Redireciona imediatamente para o balcão.
  - `Atualizar Fila`: Revalida os dados em tempo real.

---

### 3.2. Detalhe da Ordem de Serviço (`/os/:id`)

#### Objetivo
Prontuário completo de confecção dos óculos, histórico de alterações, prescrição médica e controle laboratorial.

#### Funcionalidades e Botões
- **Cabeçalho da OS:**
  - Exibe status atual em Badge colorido, cliente vinculado e valor total.
  - Botão `Transicionar Status`: Aciona o seletor de próximo status validado pelo `TransicaoOSRegistry`.
  - Botão `Imprimir OS`: Gera o documento completo de ordem de serviço para fixar na bandeja do laboratório.
  - Botão `WhatsApp Cliente`: Dispara mensagem automática com o link PWA do Portal de Rastreio (`/rastreio/:token`).
- **Aba Prescrição Oftálmica:**
  - Tabela técnica com esférico, cilíndrico, eixo, adição, DNP e altura para OD (Olho Direito) e OE (Olho Esquerdo).
  - Visualização da foto da receita médica anexada com zoom.
- **Aba Produtos & Insumos:**
  - Armação selecionada (código de barras, marca, modelo, cor, tamanho).
  - Lentes especificadas (índice de refração, tratamento antirreflexo, blue cut, fotossensível).
- **Aba Timeline e Auditoria:**
  - Registro cronológico imutável de cada movimentação (`EventoOS`), data/hora exata e usuário que executou a ação.

---

### 3.3. PDV — Frente de Caixa Balcão (`/pdv`)

#### Objetivo
Frente de caixa ultra-rápida, operável tanto via teclado (*keyboard-first*) quanto por toque (*touch-friendly*), com suporte a vendas offline e fechamento ágil.

#### Layout 3 Colunas (Desktop) e Fluido Vertical (Mobile)

#### 1. Coluna de Clientes & Busca de Produtos (Esquerda)
- **Card Cliente:**
  - Campo de busca instantânea com debounce por Nome, CPF ou Telefone.
  - Botão `+ Novo cliente`: Abre modal rápido com nome, WhatsApp e CPF sem sair da venda.
  - Cliente Selecionado: Exibe avatar, nome, telefone e CPF com botão `Ver dados` e botão `X` (remover cliente).
- **Card Produto / SKU:**
  - **Ícone de Lupa Perfeitamente Alinhado:** Encaixado dentro do input de pesquisa com padding dedicado.
  - Campo de entrada com foco automático para leitura de leitor de código de barras USB/Bluetooth ou digitação de SKU/Nome.
  - Pílulas de Categoria: Filtros rápidos para *Todos*, *Armações*, *Lentes*, *Óculos de Sol*, *Acessórios* e *Serviços*.
  - Botão `+ Novo produto`: Abre o formulário completo de cadastro no catálogo.
  - Lista de Resultados: Miniatura da foto do produto, nome, SKU e preço formatado em BRL. Pressionar **Enter** adiciona automaticamente o primeiro item correspondente.

#### 2. Coluna do Carrinho de Compras (Centro)
- Exibe o contador de itens no cabeçalho (ex.: *Carrinho — 3 itens*).
- Botão `Limpar`: Esvazia todos os itens após confirmação.
- Itens do Carrinho:
  - Miniatura da foto do item (ou ícone padrão quando sem imagem).
  - Nome do produto e SKU.
  - Controles de Quantidade: Botões `-` e `+` e campo numérico editável.
  - Preço unitário e subtotal da linha.
  - Botão `Excluir Item` (ícone de lixeira em vermelho).
- Estado Vazio: Ilustração amigável indicando que o operador deve bipar ou buscar um item.

#### 3. Coluna de Resumo da Venda e Pagamentos (Direita)
- **Subtotal:** Soma dos itens em tempo real.
- **Desconto:**
  - Alternador entre Porcentagem (`%`) e Valor (`R$`).
  - Campo para inserção do desconto.
  - Validação de Alçada: Se ultrapassar o teto da loja, abre automaticamente o modal de autorização gerencial com senha.
- **Valor Total:** Tipografia de destaque em negrito e tamanho ampliado.
- **Formas de Pagamento (Pílulas/Botões Selecionáveis):**
  - **PIX Oficial:** Exibe o ícone oficial em vetor do Banco Central do Brasil.
  - **Dinheiro:** Abre campo de *Valor Recebido* e calcula automaticamente o *Troco* a devolver em verde.
  - **Cartão de Débito:** Integração com maquininhas POS/TEF.
  - **Cartão de Crédito:** Com seletor de parcelamento (1x a 12x).
  - **A Prazo / Crediário:** Vinculação com contas a receber da loja.
- **Seletor de Tipo de Documento:**
  - `Cupom Não-Fiscal`: Recibo térmico simplificado de 80mm.
  - `NFC-e (Mod. 65)`: Emissão fiscal de consumidor via Flowbox.
  - `DANFE (Mod. 55)`: Nota fiscal eletrônica completa com destinatário.
  - `Orçamento`: Gera proposta comercial para o cliente sem baixa de caixa.
- **Botão Principal `Finalizar Venda` (Atalho F8):**
  - Botão de alta proeminência visual com ícone de cadeado/conclusão.
  - 100% resiliente: funciona online e offline com gravação em fila Outbox.
- **Ações Secundárias Inferiores:**
  - Botão `Orçamento`: Grava imediatamente a proposta no banco de dados (`POST /api/v1/orcamentos`) com número sequencial e abre o modal de impressão A4.
  - Botão `Ver Cupom`: Exibe pré-visualização instantânea do cupom antes da finalização.
  - Botão `Mais Ações (...)`: Abre modal para copiar o resumo formatado em texto para o WhatsApp do cliente ou cancelar a digitação.

#### Modal de Conclusão e Impressão de Comprovante
- Exibido logo após a venda ser concluída ou o orçamento ser gerado.
- Prévia de impressão correspondente ao documento escolhido:
  - **Orçamento (A4):** Título *ORÇAMENTO COMERCIAL*, validade de 15 dias, termos de proposta, dados do cliente e da ótica, e botão `Imprimir Orçamento (A4)`.
  - **Cupom 80mm:** Layout térmico compacto para impressoras Epson, Elgin, Bematech.
  - **NFC-e:** Com chave de 44 dígitos, protocolo SEFAZ e QR Code de consulta estadual.
  - **DANFE:** Documento auxiliar de NF-e em formato A4.
- Botão `Nova Venda`: Limpa a tela e prepara o PDV para o próximo atendimento.

---

### 3.4. Central de Orçamentos Comerciais (`/orcamentos`)

#### Objetivo
Módulo dedicado para gerenciar, consultar, imprimir e converter orçamentos gerados na loja.

#### Funcionalidades e Botões
- **Cabeçalho:** Título com ícone `FileText`, descrição explicativa e botão `+ Novo Orçamento no PDV` que redireciona à frente de caixa.
- **Filtros e Busca:**
  - Campo de busca instantânea por número do orçamento (`ORC-2026-00001`), nome do cliente, CPF ou telefone.
  - Pílulas de status: *Todos*, *Em Aberto*, *Aprovados*, *Convertidos* (com venda realizada) e *Cancelados*.
- **Tabela de Orçamentos:**
  - Coluna *Número*: Identificador oficial persistido no PostgreSQL.
  - Coluna *Data*: Data e hora de criação no padrão `dd/MM/yyyy HH:mm`.
  - Coluna *Cliente*: Nome do cliente e telefone de contato.
  - Coluna *Itens*: Quantidade total de produtos/serviços contidos na proposta.
  - Coluna *Valor Total*: Valor final com descontos calculados.
  - Coluna *Status*: Badges customizadas (Amarelo para *Em Aberto*, Verde para *Aprovado*, Azul para *Venda Realizada*, Vermelho para *Cancelado*).
- **Ações por Linha:**
  - Botão `Imprimir` (ícone de impressora): Abre o modal com a pré-visualização em formato A4 comercial com cabeçalho da ótica e termos de validade.
  - Botão `Aprovar` (ícone check verde): Marca a proposta comercial como aprovada pelo cliente.
  - Botão `Cancelar` (ícone X vermelho): Invalida o orçamento.
  - Botão `PDV` (ícone de carrinho): Carrega o orçamento diretamente na frente de caixa para fechamento de venda imediato.

---

### 3.5. Catálogo de Produtos & Controle de Estoque (`/catalogo`)

#### Objetivo
Gestão centralizada de todas as mercadorias da ótica (armações de grau, solares, lentes oftálmicas, lentes de contato, estojos, flanelas e serviços de laboratório).

#### Funcionalidades e Botões
- **Barra de Ações do Catálogo:**
  - Botão `+ Novo Produto`: Dispara o formulário de cadastro.
  - Botão `Importar CSV/Excel`: Permite subir planilhas em lote.
  - Botão `Baixar Modelo`: Faz download da planilha modelo (.xlsx ou .csv).
  - Botão `Seed Demonstração`: Carrega produtos ópticos de demonstração para treinamento de equipe.
- **Filtros do Catálogo:**
  - Busca textual com debounce por SKU, nome do produto ou código de barras.
  - Filtro por marca e seletor de categorias em botões de pílula.
- **Grid de Cards de Produto:**
  - Miniatura da foto real com efeito zoom suave no hover.
  - SKU e NCM oficial.
  - Nome completo e marca.
  - Preço de venda formatado em destaque.
  - Indicador de estoque com badge inteligente:
    - *Vermelho*: Estoque crítico (≤ 3 unidades).
    - *Amarelo*: Estoque de atenção (≤ 6 unidades).
    - *Verde*: Estoque seguro (> 6 unidades).
  - Preço de custo e cálculo automático da margem bruta de lucro (%).
  - Botão `Adicionar ao PDV`: Redireciona ao PDV com o SKU pronto para venda.
  - Botão `Editar` (ícone de lápis): Abre o modal de edição.
  - Botão `Excluir` (ícone de lixeira): Abre o diálogo de exclusão segura.

#### Modal de Cadastro e Edição de Produto (`ProdutoFormDialog`)
- **Seção Foto do Produto:**
  - Preview dinâmico da imagem em 80x80 com cantos arredondados.
  - Botão `Enviar foto` / `Trocar foto`: Abre o seletor de arquivos de imagem (PNG, JPG, WebP).
  - **Compressão Automática no Cliente (`imageCompress.ts`):** Redimensiona a foto para no máximo 1024px e comprime em JPEG (~80KB), eliminando qualquer risco do erro `413 Request Entity Too Large` e tornando o upload imediato.
  - Botão `Remover`: Limpa a imagem selecionada.
- **Campos do Formulário:**
  - *SKU*: Código único do item na loja (com botão de recarregar sequência automática).
  - *Nome*: Descrição comercial completa do produto.
  - *Categoria*: Seleção entre Armação, Lente, Lente de contato, Acessório ou Serviço (com suporte a novas categorias do banco).
  - *Marca*: Fabricante ou grife (Ray-Ban, Oakley, Mormaii, etc.).
  - *Custo (R$)*: Valor de compra do fornecedor.
  - *Preço de Venda (R$)*: Preço ao consumidor.
  - *Estoque*: Quantidade física disponível na loja.
  - *NCM*: Código fiscal de 8 dígitos (preenchimento automático pelo padrão da categoria se deixado em branco).
  - *Código de Barras (EAN)*: Código EAN-13 oficial GS1 gerado com cálculo de dígito verificador módulo 10.
- **Botões do Modal:**
  - `Cancelar`: Fecha o modal sem salvar.
  - `Criar Produto` / `Salvar Alterações`: Valida via Zod Schema e grava no banco.

---

### 3.6. Impressão de Etiquetas de Código de Barras (`/etiquetas`)

#### Objetivo
Emissão rápida de etiquetas adesivas para identificação física das armações nas vitrines e gaveteiros da ótica.

#### Funcionalidades e Botões
- **Painel de Seleção de Produtos (Esquerda):**
  - Busca instantânea no catálogo.
  - Lista de produtos com SKU, nome e preço.
  - Botão `+ Adicionar`: Insere o produto na fila de impressão.
- **Painel de Configuração e Fila de Impressão (Direita):**
  - **Seletores de Modelo de Etiqueta:**
    1. *Ótica / Armação (Borboleta)*: Formato especial com aba/rabicho não adesivo para prender na haste dos óculos sem deixar cola na armação. Exibe nome, marca, SKU, código de barras Code128 e preço.
    2. *Gôndola / Caixa*: Formato térmico 50x30mm para estojos e caixas de lentes.
    3. *Folha A4 (Pimaco)*: Grade de etiquetas adesivas em folha A4 com 3 colunas x 10 linhas (30 etiquetas por folha).
  - **Tabela da Fila de Impressão:**
    - Produto, Código de barras, Preço.
    - Campo numérico para ajuste manual da quantidade de cópias de cada etiqueta.
    - Botão de remoção individual da fila.
    - Contador do total acumulado de etiquetas.
    - Botão `Limpar fila`.
- **Botão `Imprimir (X etiquetas)`:**
  - Abre a janela de impressão do navegador já formatada via regras `@media print`, enviando os comandos nativos para impressoras térmicas (Zebra, Argox, Elgin) ou jato de tinta/laser.

---

### 3.7. Gestão de Clientes (`/clientes`)

#### Objetivo
Cadastro detalhado de clientes, histórico oftalmológico e relacionamento pós-venda.

#### Funcionalidades e Botões
- **Busca e Listagem:**
  - Filtro por nome, CPF ou celular.
  - Tabela com nome, telefone, WhatsApp clicável, cidade e data da última compra.
- **Modal de Cadastro / Edição:**
  - Dados pessoais: Nome completo, CPF, RG, Data de Nascimento.
  - Contato: Celular, Telefone fixo, E-mail.
  - Endereço: CEP com busca automática via ViaCEP, Logradouro, Número, Bairro, Cidade e UF.
  - Consentimento LGPD para Recall Óptico (marcação obrigatória para envio de lembretes de revisão de grau).
- **Ações:**
  - Visualizar receitas anexadas ao cliente.
  - Abrir histórico de Ordens de Serviço e vendas anteriores.
  - Botão direto para iniciar atendimento no PDV com o cliente já selecionado.

---

### 3.8. Receitas Clínicas & Prontuário Oftálmico (`/receitas`)

#### Objetivo
Armazenamento das prescrições ópticas emitidas por oftalmologistas ou optometristas.

#### Funcionalidades e Botões
- **Listagem de Prescrições:**
  - Busca por nome do cliente ou data do exame.
  - Indicador de receitas vigentes e vencidas (mais de 1 ano de emissão).
- **Cadastro de Receita:**
  - Seleção do cliente vinculado.
  - Médico Prescritor (Nome e CRM/CROO).
  - Data da consulta e data de validade da receita.
  - **Tabela de Graus:**
    - *Olho Direito (OD)*: Esférico (-25.00 a +25.00), Cilíndrico (-10.00 a 0.00), Eixo (0° a 180°), Adição (+0.50 a +4.00), DNP.
    - *Olho Esquerdo (OE)*: Esférico, Cilíndrico, Eixo, Adição, DNP.
    - Altura de montagem e tipo de lente recomendada (Visão Simples, Multifocal, Bifocal).
  - **Anexo da Foto da Receita:**
    - Upload da foto do receituário físico com visualizador integrado.
- **Botões:**
  - `Adicionar à OS`: Vincula a receita à ordem de serviço do cliente.
  - `Disparar Recall WhatsApp`: Mensagem avisando o cliente sobre o vencimento anual do grau.

---

### 3.9. Central de Vendas & Cupons Fiscais (`/vendas`)

#### Objetivo
Auditoria de vendas realizadas, reimpressão de documentos fiscais e cancelamento com estorno.

#### Funcionalidades e Botões
- **Filtros Avançados:**
  - Período de datas (Data Inicial / Data Final).
  - Status da venda (Concluída, Cancelada, Aguardando Pagamento).
  - Status fiscal (Emitida, Contingência, Rejeitada, Não Fiscal).
  - Busca por número da venda ou nome do comprador.
- **KPIs do Período:**
  - Faturamento bruto no intervalo.
  - Ticket médio por cliente.
  - Volume total de vendas.
- **Tabela de Vendas:**
  - Número do pedido, data/hora, cliente, valor total e forma de pagamento.
  - Ações por linha:
    - `Reimprimir Cupom / DANFE`: Dispara a reimpressão térmica ou A4.
    - `Ver Detalhes`: Modal com os itens vendidos, descontos concedidos e dados fiscais.
    - `Cancelar Venda`: Cancela a venda com estorno automático no estoque e no caixa do dia (sujeito a permissão de ADMIN/GERENTE).

---

### 3.10. Gestão de Caixa & Turnos de Operadores (`/caixas`)

#### Objetivo
Controle financeiro diário da gaveta de dinheiro da ótica, garantindo integridade e prevenindo divergências.

#### Funcionalidades e Botões
- **Sinalizador de Status:** Indicador destacado se o caixa da loja está Aberto ou Fechado.
- **Abertura de Caixa:**
  - Operador informa o valor inicial de fundo de troco (suprimento de abertura).
  - Registra a data/hora exata do início do turno.
- **Operações Durante o Turno:**
  - `Sangria`: Registro de retirada de dinheiro para cofre ou pagamento de despesa, com justificativa obrigatória e comprovante de assinatura.
  - `Suprimento`: Entrada avulsa de valores para reforço de troco.
- **Fechamento Cego de Caixa:**
  - O operador conta o dinheiro da gaveta e digita os totais em espécie, cheques e comprovantes de cartão sem ver o total calculado pelo sistema.
  - O sistema faz o batimento e gera o relatório de conferência (sobra/falta) com assinatura do gerente.
- **Histórico de Turnos:**
  - Tabela com todos os fechamentos passados, operadores e relatórios de auditoria.

---

### 3.11. Compras & Importação de XML (`/compras`)

#### Objetivo
Entrada de notas fiscais de fornecedores com carga automática no estoque e no contas a pagar.

#### Funcionalidades e Botões
- **Área de Upload de XML:**
  - Arraste ou seleção do arquivo XML da NF-e emitida pelo distribuidor.
- **Processamento Inteligente do XML:**
  - Leitura dos dados do fornecedor (Razão Social, CNPJ, Chave de Acesso).
  - Identificação de cada armação/lente contida na nota.
  - De-para de produtos: vincula o código do distribuidor com o produto correspondente no catálogo do VisionBox.
- **Botões:**
  - `Cadastrar Novos Produtos`: Cria os SKUs que ainda não existem no catálogo.
  - `Confirmar Entrada`: Adiciona a quantidade de itens ao estoque e lança os títulos no Contas a Pagar.

---

### 3.12. Financeiro, Contas a Pagar & Receber e DRE (`/financeiro`)

#### Objetivo
Gestão financeira completa da ótica com apuração de lucros e controle de inadimplência.

#### Funcionalidades e Botões
- **Aba Contas a Receber:**
  - Carnês e parcelamentos de clientes.
  - Registro de baixas totais ou parciais.
  - Cálculo de juros e multa por atraso.
- **Aba Contas a Pagar:**
  - Boletos de fornecedores, aluguel, energia, laboratórios parceiros e salários.
  - Controle de vencimentos com alerta visual de contas a vencer hoje ou atrasadas.
- **Aba DRE Gerencial:**
  - Receita bruta de vendas.
  - (-) Deduções e devoluções.
  - (=) Receita líquida.
  - (-) Custo das Mercadorias Vendidas (CMV).
  - (=) Lucro Bruto.
  - (-) Despesas operacionais e laboratoriais.
  - (=) Resultado Líquido do Exercício.

---

### 3.13. Maquininhas de Cartão & Taxas (`/maquininhas`)

#### Objetivo
Parametrização das maquininhas POS e terminais TEF da loja.

#### Funcionalidades e Botões
- **Listagem de Maquininhas:** Exibe maquininhas cadastradas (Cielo, Rede, Stone, PagBank) e status ativo/inativo.
- **Cadastro / Edição de Taxas:**
  - Taxa percentual para débito.
  - Taxa para crédito à vista (1x).
  - Taxas para parcelado de 2x a 6x e de 7x a 12x.
- **Cálculo Líquido:** O sistema abate automaticamente a taxa no resumo de vendas do PDV, informando o valor real líquido a receber pela ótica.

---

### 3.14. Comissões de Vendedores (`/comissoes`)

#### Objetivo
Acompanhamento e acerto de comissões da equipe de vendas da ótica.

#### Funcionalidades e Botões
- **Filtro por Período e Vendedor:** Permite isolar o desempenho de cada consultor óptico.
- **Cálculo de Comissão:** Baseado nas vendas concluídas e não canceladas vinculadas ao operador.
- **Ações:**
  - `Extrato do Vendedor`: Relatório com todas as vendas que geraram comissão.
  - `Marcar como Pago`: Registra a liquidação do pagamento ao funcionário.

---

### 3.15. Gestão de Usuários e Permissões (`/usuarios`)

#### Objetivo
Administração de credenciais e controle de acesso baseado em funções (apenas ADMIN e DESENVOLVEDOR).

#### Funcionalidades e Botões
- **Tabela de Usuários:** Nome, e-mail, perfil, loja vinculada e status ativo.
- **Perfis Suportados (RBAC):**
  - `ADMIN`: Acesso irrestrito a todas as áreas, finanças, configurações e relatórios.
  - `GERENTE`: Acesso a vendas, autorização de descontos, abertura/fechamento de caixa e catálogo.
  - `VENDEDOR`: Acesso ao PDV, orçamentos, clientes e fila de OS (sem visualização de custos ou DRE).
  - `OTICO`: Especialista técnico com foco em receitas, medidas DNP e laboratório.
  - `TECNICO`: Operador de bancada e controle de qualidade.
  - `LABORATORIO`: Usuário restrito para terceirizados.
  - `DESENVOLVEDOR`: Acesso total e painel de modulação de recursos SaaS.
- **Botão `Novo Usuário`:** Formulário para criar login, definir senha inicial e atribuir perfil.
- **Botão `Editar / Redefinir Senha`:** Altera permissões ou atualiza credencial de acesso.

---

### 3.16. Configuração Fiscal Flowbox (`/fiscal`)

#### Objetivo
Parametrização da emissão de NFC-e (modelo 65) e NF-e (modelo 55) integrada ao ecossistema Flowbox (ADR-004).

#### Funcionalidades e Botões
- **Ambiente SEFAZ:** Alternador entre *Homologação (Testes)* e *Produção*.
- **Credenciais SEFAZ:**
  - Número de Série da NFC-e e NF-e.
  - Próximo número de nota fiscal a emitir.
  - Código CSC (Código de Segurança do Contribuinte) e Id do Token CSC estadual.
- **Certificado Digital A1:** Upload do arquivo `.pfx` ou `.p12` com senha criptografada.
- **Integração Flowbox:** Endpoint da API e token de autenticação centralizada.
- **Botão `Testar Comunicação SEFAZ`:** Envia ping de status do serviço da SEFAZ estadual e exibe o retorno oficial (cStat 107 - Serviço em Operação).

---

### 3.17. Painel do Desenvolvedor & Modulação SaaS (`/desenvolvedor`)

#### Objetivo
Governança da arquitetura multi-tenant conforme a regra canônica **R11** (`PLANO_ROBUSTEZ_ERP_REFERENCIA_OUTBOX.md`).

#### Funcionalidades
- Catálogo de 19 módulos SaaS independentes:
  1. `PDV_BALCAO`
  2. `ORDEM_SERVICO`
  3. `RECEITAS_CLINICAS`
  4. `CENTRAL_VENDAS`
  5. `CAIXA_TURNOS`
  6. `FINANCEIRO_COMPLETO`
  7. `FISCAL_FLOWBOX`
  8. `COMPRAS_XML`
  9. `ESTOQUE_LOTES`
  10. `ETIQUETAS`
  11. `SUGESTAO_COMPRAS`
  12. `SCANNER_MOVEL`
  13. `TABELAS_PRECO`
  14. `FIDELIDADE_PONTOS`
  15. `ORCAMENTO_ONLINE`
  16. `KITS_COMBOS`
  17. `LAB_PORTAL`
  18. `RASTREIO_CLIENTE`
  19. `ALERTAS_TELEGRAM`
- **Interruptores (Switches) por Loja:** O desenvolvedor ou administrador master pode ativar ou desativar módulos dinamicamente de acordo com o plano contratado pelo cliente. A interface e as rotas são protegidas em tempo real pelo componente `<GuardaModulo />`.

---

### 3.18. Portais Públicos PWA (Sem Necessidade de Login)

#### 1. Portal de Rastreio do Cliente Final (`/rastreio/:token`)
- Acessado pelo smartphone do cliente via link enviado por WhatsApp ou QR Code impresso no comprovante.
- Exibe o logotipo da ótica e uma timeline interativa com o status de confecção dos óculos:
  - *Recebido pela Loja* ➔ *Lentes em Produção no Laboratório* ➔ *Montagem e Conferência* ➔ *Pronto para Retirada na Loja*.
- Evita que o cliente precise telefonar para a loja para saber se os óculos ficaram prontos.

#### 2. Portal do Laboratório Externo (`/lab/:token`)
- Link seguro fornecido a montadores e laboratórios parceiros.
- Permite visualizar a receita médica, medidas ópticas e especificações da armação.
- Possui botão para que o técnico do laboratório atualize o status para "Montagem Concluída" com 1 clique, notificando a ótica automaticamente.

---

## 4. Matriz de Resumo dos Módulos e Rotas

| Módulo | Rota Frontend | Rota Backend Principal | Perfil Mínimo |
|---|---|---|---|
| Dashboard / Kanban | `/` e `/os` | `/api/v1/ordens-servico` | VENDEDOR |
| PDV (Frente de Caixa) | `/pdv` | `/api/v1/vendas` | VENDEDOR |
| Detalhe da OS | `/os/:id` | `/api/v1/ordens-servico/{id}` | VENDEDOR |
| Orçamentos | `/orcamentos` | `/api/v1/orcamentos` | VENDEDOR |
| Catálogo de Produtos | `/catalogo` | `/api/v1/produtos` | VENDEDOR |
| Impressão de Etiquetas | `/etiquetas` | `/api/v1/produtos` | VENDEDOR |
| Clientes | `/clientes` | `/api/v1/clientes` | VENDEDOR |
| Receitas Clínicas | `/receitas` | `/api/v1/receitas` | OTICO |
| Central de Vendas | `/vendas` | `/api/v1/vendas` | VENDEDOR |
| Caixas & Turnos | `/caixas` | `/api/v1/caixa` | VENDEDOR |
| Compras XML | `/compras` | `/api/v1/compras` | GERENTE |
| Financeiro & DRE | `/financeiro` | `/api/v1/financeiro` | GERENTE |
| Maquininhas POS | `/maquininhas` | `/api/v1/maquininhas` | GERENTE |
| Comissões | `/comissoes` | `/api/v1/comissoes` | GERENTE |
| Gestão de Usuários | `/usuarios` | `/api/v1/usuarios` | ADMIN |
| Configuração Fiscal | `/fiscal` | `/api/v1/fiscal` | ADMIN |
| Painel Desenvolvedor | `/desenvolvedor` | `/api/v1/modulos` | DESENVOLVEDOR |
| Portal de Rastreio | `/rastreio/:token` | `/api/v1/public/rastreio` | PÚBLICO |
| Portal do Laboratório | `/lab/:token` | `/api/v1/public/lab` | PÚBLICO |

---

## 5. Conclusão e Próximos Passos Recomendados

O sistema **VisionBox** encontra-se em estado maduro, com banco de dados PostgreSQL estruturado, migrations consolidadas, testes automatizados e deploy ativo em ambiente de produção com resposta `HTTP 200` no Nginx e `{"status":"UP"}` no Spring Boot Actuator.

### Recomendações Operacionais
1. **Treinamento de Equipe:** Utilizar o botão `Seed Demonstração` no Catálogo para capacitar vendedores no fluxo de abertura de caixa, busca de produtos e fechamento de venda no PDV.
2. **Personalização da Loja:** Acessar o menu Administrativo > Configurações > Empresa e fazer o upload do logotipo oficial da ótica para personalização de todos os impressos.
3. **Equipamentos Homologados:** O sistema opera com leitoras de código de barras USB/Bluetooth padrão HID e impressoras térmicas ESC/POS padrão 80mm ou 58mm sem necessidade de drivers proprietários.

---
*Relatório gerado automaticamente pelo assistente de engenharia do VisionBox — TechboxBR 2026.*
