# VisionBox ERP — Manual Completo do Sistema, Guia do Desenvolvedor e Gestão do MinIO

> **Versão do Sistema:** 1.1.0 (Produção)  
> **Ecossistema:** TECHBOXBR  
> **Data de Atualização:** 12 de Outubro de 2026  
> **Status da Versão:** Implantado em Produção na VPS (Containers Docker Ativos)

---

## Sumário Executivo

1. [Apresentação Comercial & Instrução Completa para Clientes](#1-apresentação-comercial--instrução-completa-para-clientes)
   - [1.1 O Que é o VisionBox ERP](#11-o-que-é-o-visionbox-erp)
   - [1.2 Os Problemas Crônicos do Varejo Óptico que Resolvemos](#12-os-problemas-crônicos-do-varejo-óptico-que-resolvemos)
   - [1.3 Principais Módulos e Funcionalidades de Ponta a Ponta](#13-principais-módulos-e-funcionalidades-de-ponta-a-ponta)
   - [1.4 O Diferencial: Máquina de 12 Status de Ordem de Serviço (OS)](#14-o-diferencial-máquina-de-12-status-de-ordem-de-serviço-os)
   - [1.5 Frente de Caixa (PDV) de Alta Velocidade](#15-frente-de-caixa-pdv-de-alta-velocidade)
   - [1.6 Roteiro Sugerido para Demonstração Comercial (Pitch Passo a Passo)](#16-roteiro-sugerido-para-demonstração-comercial-pitch-passo-a-passo)
2. [Guia de Funcionamento e Arquitetura para Desenvolvedores](#2-guia-de-funcionamento-e-arquitetura-para-desenvolvedores)
   - [2.1 Visão Geral da Arquitetura & Stack Tecnológica](#21-visão-geral-da-arquitetura--stack-tecnológica)
   - [2.2 Estrutura Modular DDD no Backend](#22-estrutura-modular-ddd-no-backend)
   - [2.3 Regras Críticas e Invioláveis de Engenharia (R1 a R9)](#23-regras-críticas-e-invioláveis-de-engenharia-r1-a-r9)
   - [2.4 Mecanismo de Multi-Tenancy (Isolamento por Loja)](#24-mecanismo-de-multi-tenancy-isolamento-por-loja)
   - [2.5 Segurança, Criptografia AES-GCM e Blind Index LGPD](#25-segurança-criptografia-aes-gcm-e-blind-index-lgpd)
   - [2.6 Geração Sequencial de SKU e Cálculo EAN-13 GS1 Módulo 10](#26-geração-sequencial-de-sku-e-cálculo-ean-13-gs1-módulo-10)
   - [2.7 Importação Unificada de Dados: Excel (.xlsx / .xls) e CSV](#27-importação-unificada-de-dados-excel-xlsx--xls-e-csv)
   - [2.8 Integração Fiscal Flowbox (NFC-e e NF-e)](#28-integração-fiscal-flowbox-nfc-e-e-nf-e)
   - [2.9 Frontend: Arquitetura React, Vite e Design Tokens](#29-frontend-arquitetura-react-vite-e-design-tokens)
3. [Guia Completo de Gestão e Operação do MinIO (S3 Object Storage)](#3-guia-completo-de-gestão-e-operação-do-minio-s3-object-storage)
   - [3.1 O Que é o MinIO e Por Que Ele é Utilizado no VisionBox](#31-o-que-é-o-minio-e-por-que-ele-é-utilizado-no-visionbox)
   - [3.2 Portas, Endpoints e Acessos](#32-portas-endpoints-e-acessos)
   - [3.3 Estrutura de Buckets e Organização dos Objetos](#33-estrutura-de-buckets-e-organização-dos-objetos)
   - [3.4 Manual Passo a Passo do Console Web do MinIO](#34-manual-passo-a-passo-do-console-web-do-minio)
   - [3.5 Políticas de Acesso, Chaves de API e CORS](#35-políticas-de-acesso-chaves-de-api-e-cors)
   - [3.6 Rotinas de Backup, Volumes e Retenção LGPD](#36-rotinas-de-backup-volumes-e-retenção-lgpd)
4. [Guia de Deploy e Operação em Servidor (VPS)](#4-guia-de-deploy-e-operação-em-servidor-vps)
   - [4.1 Orquestração via Docker Compose](#41-orquestração-via-docker-compose)
   - [4.2 Procedimento Padrão de Atualização e Deploy](#42-procedimento-padrão-de-atualização-e-deploy)
   - [4.3 Variáveis de Ambiente Críticas](#43-variáveis-de-ambiente-críticas)
   - [4.4 Diagnóstico, Monitoramento e Resolução de Problemas](#44-diagnóstico-monitoramento-e-resolução-de-problemas)
5. [Histórico das Últimas Melhorias Entregues](#5-histórico-das-últimas-melhorias-entregues)

---

# 1. Apresentação Comercial & Instrução Completa para Clientes

### 1.1 O Que é o VisionBox ERP
O **VisionBox** é um sistema ERP de gestão verticalizado criado exclusivamente para atender à complexidade do **varejo óptico moderno** — desde óticas independentes até redes de franquias com múltiplas lojas físicas.

Diferente de sistemas comerciais genéricos (que tratam óculos como simples sapatos ou camisetas), o VisionBox foi concebido com a **física óptica e os processos laboratoriais no seu DNA**. Ele conecta a consulta do optometrista/oftalmologista, a escolha da armação no balcão, o controle rigoroso de dioptrias na receita, o envio para o laboratório de surfaçagem e montagem, até a entrega perfeita ao cliente final com aviso automático no WhatsApp.

---

### 1.2 Os Problemas Crônicos do Varejo Óptico que Resolvemos

| Problema Comum nas Óticas | Como o VisionBox Resolve |
|---|---|
| **Clientes ligando cobrando óculos prontos** | Rastreamento em tempo real com 12 etapas de OS, envio de status e link de auto-atendimento via WhatsApp. O cliente sabe exatamente quando o óculos está no laboratório ou pronto para retirada. |
| **Erros na digitação de receitas no balcão** | Ficha clínica completa para dioptrias (esférico, cilíndrico, eixo, DNP, altura, adição) com validações e armazenamento da foto da receita original. |
| **Atrasos e falhas na comunicação com o Laboratório** | Portal exclusivo para o laboratório terceirizado atualizar o status de produção diretamente pelo celular ou computador, sem necessidade de usuário interno no ERP. |
| **Lentidão nas filas do PDV** | Ponto de Venda de alta velocidade operável 100% via teclado (<kbd>F2</kbd>, <kbd>F3</kbd>, <kbd>F4</kbd>, <kbd>F8</kbd>), com multi-pagamento e funcionamento ininterrupto mesmo com oscilações de internet. |
| **Complexidade e multas fiscais (NFC-e / NF-e)** | Módulo fiscal homologado integrado ao motor central Flowbox, calculando impostos por NCM/UF e emitindo cupom fiscal em segundos. |
| **Cadastros manuais cansativos de armações e clientes** | Geração automática sequencial de SKU e códigos de barras EAN-13 oficiais, além de importador de planilhas Excel (.xlsx) e CSV em lote. |

---

### 1.3 Principais Módulos e Funcionalidades de Ponta a Ponta

```
               ┌──────────────────────────────────────────────┐
               │              VISONBOX ERP ENGINE             │
               └──────────────────────┬───────────────────────┘
                                      │
     ┌──────────────────┬─────────────┴──────┬──────────────────┐
     ▼                  ▼                    ▼                  ▼
┌──────────────┐ ┌──────────────┐     ┌──────────────┐   ┌──────────────┐
│  Atendimento │ │   Frente de  │     │  Produção &  │   │  Financeiro  │
│   Clínico    │ │  Caixa (PDV) │     │  Laboratório │   │  & Gestão    │
│  & Receitas  │ │   Teclado-1st│     │  12 Status OS│   │  Multi-Loja  │
└──────────────┘ └──────────────┘     └──────────────┘   └──────────────┘
```

1. **Dashboard Executivo:**
   - Indicadores visuais de faturamento do dia, quantidade de OS em andamento, ticket médio e alertas de óculos com prazo de entrega próximo ou vencido.
2. **Atendimento Clínico & Gestão de Receitas:**
   - Cadastro detalhado de prescrições oftálmicas: Olho Direito (OD) e Olho Esquerdo (OE), Esférico, Cilíndrico, Eixo, Adição, Distância Naso-Pupilar (DNP) e Altura de Montagem.
   - Upload fotográfico da receita médica para validação técnica e histórico vitalício do cliente.
   - Proteção de dados e conformidade integral com a LGPD (dados de saúde criptografados).
3. **Ponto de Venda (PDV Especialista):**
   - Venda de armações, óculos solares, lentes monofocais/multifocais, lentes de contato e serviços de montagem.
   - Venda vinculada instantaneamente à receita oftálmica do cliente.
   - Pagamento fracionado (exemplo: R$ 300 no Pix + R$ 700 em 6x no cartão de crédito).
   - Controle de alçada de desconto: vendedores aplicam até 15%; descontos superiores exigem PIN de gerente.
4. **Ordens de Serviço (OS) & SLA Laboratorial:**
   - Kanban interativo com colunas de status.
   - Alerta visual de SLA com temporizador de tolerância de atraso.
   - Emissão de espelho de OS para enviar à bancada ou anexar à caixinha dos óculos.
5. **Módulo Administrativo & Catálogo:**
   - Gestão de Clientes e Pacientes com histórico de compras e prescrições.
   - Catálogo de Produtos com controle por Marcas, Modelos, Tamanho de Aro, Ponte e Haste.
   - Gerador de SKU (`PRD-000001...`) e EAN-13 com código de barras comercial GS1.
   - Carga em lote por planilhas Excel (.xlsx) ou CSV com modelos prontos para download.
6. **Financeiro & Frente de Caixa:**
   - Abertura de Caixa com suprimento inicial.
   - Registro de sangrias de segurança ao longo do dia.
   - Fechamento cego de caixa e conciliação de comprovantes de cartão.
   - DRE, Curva ABC de produtos e conciliação bancária via extrato OFX.
7. **Portais Especialistas (Sem Custo Adicional de Licença):**
   - **Portal do Laboratório:** Link seguro para o laboratório de lentes registrar recebimento, surfaçagem, montagem e envio à loja física.
   - **Portal do Cliente (PWA):** Link direto recebido no WhatsApp onde o cliente visualiza a barra de progresso dos seus novos óculos em tempo real.

---

### 1.4 O Diferencial: Máquina de 12 Status de Ordem de Serviço (OS)

O grande gargalo de uma ótica é saber exatamente **onde está a armação do cliente** e **se as lentes já chegaram**. O VisionBox possui uma máquina de estados rigorosa:

```
[1. CRIADA] ➔ [2. AGUARDANDO_RECEITA] ➔ [3. AGUARDANDO_PAGAMENTO]
      │
      ▼
[4. EM_PRODUCAO] ➔ [5. ENVIADO_LABORATORIO] ➔ [6. NO_LABORATORIO]
      │
      ▼
[7. RETORNO_LABORATORIO] ➔ [8. CONTROLE_QUALIDADE] ➔ [9. PRONTO_RETIRADA]
      │
      ▼
[10. ENTREGUE] ➔ (Pós-Venda: [12. GARANTIA])
      └── (A qualquer momento com justificativa: [11. CANCELADA])
```

- **Controle de Qualidade (CQ) Obrigatório:** Quando as lentes chegam do laboratório, o técnico ótico confere as dioptrias no lensômetro. Se houver divergência de eixo ou grau, a OS é reprovada no sistema com **exigência obrigatória de anexo de foto** do laudo, notificando o laboratório imediatamente.
- **WhatsApp Automático:** A cada transição de status (ex: "Óculos Pronto para Retirada"), o vendedor pode disparar uma mensagem personalizada pelo WhatsApp em 1 clique com o link de rastreio.

---

### 1.5 Frente de Caixa (PDV) de Alta Velocidade

Projetado para operar em monitores touch ou teclados tradicionais de balcão:
- <kbd>F2</kbd> ➔ Busca de Produtos (por nome, marca, SKU ou leitor de código de barras).
- <kbd>F3</kbd> ➔ Seleção de Cliente / Paciente.
- <kbd>F4</kbd> ➔ Finalizar Venda (modal multi-pagamento).
- <kbd>F8</kbd> ➔ Abertura, Sangria e Fechamento de Caixa.
- <kbd>Esc</kbd> ➔ Cancela operação ou fecha janelas sobrepostas.

---

### 1.6 Roteiro Sugerido para Demonstração Comercial (Pitch Passo a Passo)

Ao apresentar o VisionBox para donos de óticas, gerentes ou compradores, siga este fluxo de 15 minutos:

1. **Abertura (3 min) — A Dor da Ótica:**
   - *"Quantas vezes um cliente já veio à loja no sábado buscar um óculos e ninguém sabia se o laboratório já tinha entregue as lentes?"*
   - Mostre o **Dashboard** com o quadro de OS, alertas de atraso e o status de faturamento do dia.
2. **O Atendimento & Receita (3 min):**
   - Abra o menu **Receitas** ou cadastre uma receita vinculada ao cliente.
   - Mostre a facilidade de preencher o Grau Esférico, Cilíndrico e Eixo de ambos os olhos.
   - Mostre o upload da foto da receita física médica: *"Nunca mais perca a receita em gavetas de papel"*.
3. **A Venda no PDV (3 min):**
   - Pressione <kbd>F3</kbd>, selecione o cliente recém-atendido.
   - Pressione <kbd>F2</kbd>, bipe uma armação de grau e selecione o serviço de lentes oftálmicas.
   - Pressione <kbd>F4</kbd>, divida o pagamento entre Entrada no Pix e Saldo em 3x no Cartão. Finalize.
   - Mostre que a Ordem de Serviço foi gerada automaticamente conectada a essa venda.
4. **O Laboratório e o Cliente Conectados (4 min):**
   - Abra a tela de **OS**. Mostre a mudança de status para *Enviado ao Laboratório*.
   - Abra o **Portal Externo do Laboratório**: mostre o laboratório aceitando a OS e iniciando o SLA.
   - Abra o **Portal do Cliente**: mostre o visual moderno e limpo no smartphone do cliente final informando *"Seus óculos estão em produção"*.
   - Retorne para a loja: mostre a conferência de Qualidade e a mudança para *Pronto para Retirada*.
   - Clique em **WhatsApp**: demonstre a mensagem gerada com o link de retirada.
5. **Fechamento Comercial (2 min):**
   - Mostre a agilidade de cadastros com os novos botões de **Carga Excel/CSV** e a **geração automática de SKU e Código de Barras EAN-13**.
   - Destaque a segurança jurídica e tributária com emissão automática de cupom fiscal pelo motor Flowbox.

---

# 2. Guia de Funcionamento e Arquitetura para Desenvolvedores

### 2.1 Visão Geral da Arquitetura & Stack Tecnológica

O VisionBox foi projetado sob os preceitos de **Domain-Driven Design (DDD)** modular, alta coesão e isolamento rígido multi-inquilino.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (SPA / PWA)                            │
│  React 18 + Vite + TypeScript + Tailwind CSS (Design Tokens CSS puros) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / REST / JSON
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     BACKEND (Spring Boot 3.x / Java 17)                │
│  Spring Security (JWT HttpOnly) │ TenantFilter (Multi-tenant RLS)      │
│  MapStruct │ Bean Validation    │ Transactional Outbox Pattern         │
└───────┬──────────────┬────────────┬─────────────┬──────────────┬───────┘
        │              │            │             │              │
        ▼              ▼            ▼             ▼              ▼
┌──────────────┐ ┌───────────┐ ┌─────────┐ ┌─────────────┐ ┌─────────────┐
│  PostgreSQL  │ │   Redis   │ │RabbitMQ │ │    MinIO    │ │   Flowbox   │
│  15 (RLS)    │ │ 7 (Cache) │ │ 3.13    │ │ S3 Storage  │ │ API Fiscal  │
└──────────────┘ └───────────┘ └─────────┘ └─────────────┘ └─────────────┘
```

- **Backend:** Java 17 LTS, Spring Boot 3.x, Spring Data JPA / Hibernate 6, Flyway Migrations.
- **Segurança:** Spring Security com JWT de 15 minutos e Refresh Token de 7 dias em cookie seguro `HttpOnly`.
- **Banco de Dados:** PostgreSQL 15 com RLS (Row Level Security) nativo em todas as tabelas.
- **Mensageria:** RabbitMQ 3.13 com Transactional Outbox Pattern para garantir entrega garantida de eventos.
- **Armazenamento de Binários:** MinIO (compatível com AWS S3) para fotos de receitas e evidências de CQ.
- **Frontend Web:** React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons.

---

### 2.2 Estrutura Modular DDD no Backend

O código fonte Java reside em `src/main/java/com/visionbox/` organizado estritamente por módulos de domínio de negócio:

```
src/main/java/com/visionbox/
├── modules/
│   ├── catalogo/        # Produtos, Marcas, Categorias, SKU/EAN sequencial, Carga Excel/CSV
│   │   ├── domain/      # Entidades JPA (Produto, Marca, Categoria)
│   │   ├── repository/  # Spring Data JPA Repositories (isolados por lojaId)
│   │   ├── service/     # Regras de negócio, geração sequencial de SKU e EAN-13
│   │   ├── controller/  # REST Controllers (/api/v1/produtos, etc.)
│   │   └── dto/         # Request/Response DTOs e Sugestões
│   ├── cliente/         # Gestão de Clientes, Cifra AES-GCM, Blind Index HMAC, Carga Excel/CSV
│   ├── clinico/         # Receitas oftálmicas, Dioptrias, Upload de fotos via MinIO
│   ├── ordemservico/    # Máquina de 12 Status de OS, TransicaoOSRegistry, Eventos de Domínio
│   ├── pdv/             # Caixa, Vendas, Sangria, Suprimento, Autorização de Desconto por PIN
│   ├── producao/        # Laboratório de Montagem, Controle de Qualidade (CQ), SLAs
│   ├── fiscal/          # Integração centralizada com API Flowbox (NFC-e e NF-e)
│   └── pessoa/          # Configurações da Empresa/Loja, Usuários e Perfis RBAC
└── shared/              # Utilitários compartilhados, TenantContext, Criptografia, Segurança
```

Cada módulo segue o fluxo unidirecional:  
`Controller` ➔ `Service` ➔ `Repository` ➔ `Domain` ➔ `Event / Outbox`

---

### 2.3 Regras Críticas e Invioláveis de Engenharia (R1 a R9)

Em conformidade com o documento de governança [AGENTS.md](file:///d:/TECHBOXBR/PRODUTOS/VisionBox/AGENTS.md):

| Regra | Descrição Técnica | Violação Resultante |
|---|---|---|
| **R1** | `loja_id` NOT NULL em 100% das tabelas. Repositórios NUNCA chamam `findById(id)`. Devem usar obrigatoriamente `findByIdAndLojaId(id, lojaId)`. | Bloqueio imediato de deploy (Risco de vazamento de dados entre óticas). |
| **R2** | CPF e graus nunca trafegam ou são salvos em texto claro. CPF salvo em `cpf_cipher` (AES-256-GCM) e indexado para busca por `cpf_hash` (HMAC-SHA256 blind index). Vendedores só visualizam CPF mascarado (`***.***.123-**`). | Violação gravíssima de LGPD / CISO. |
| **R3** | Nenhuma alíquota fiscal hardcoded no Java ou SQL. Tributação obtida via regras dinâmicas ou consultadas via Flowbox. | Erro de emissão fiscal e inconsistência tributária. |
| **R4** | Operações de venda exigem `Idempotency-Key` no header HTTP. Resiliência do PDV suportada por outbox local. | Duplicidade de cobrança no cliente. |
| **R5** | Proibido cores hexadecimais soltas no JSX/CSS. Todas as cores devem usar as variáveis de tokens declaradas em `theme-visionbox.css`. | Quebra do padrão visual de alto contraste e dark mode. |
| **R6** | Toda transição de OS deve ser validada por `TransicaoOSRegistry` e disparar um `EventoOS` imutável. | Quebra do fluxo de fabricação e rastreio. |
| **R7** | LGPD: Proibido `DELETE` físico em clientes que possuam notas fiscais ou OS emitidas. Utilizar anonimização de dados após 5 anos fiscais. | Violação de legislação fiscal da Receita Federal. |
| **R8** | Sempre registrar o progresso e evidências em `docs/PROGRESS.md` e `.visionbox/state.json` antes de iniciar ou encerrar sprints. | Perda de rastreabilidade de engenharia. |
| **R9** | O módulo fiscal do VisionBox não implementa SEFAZ diretamente; ele consome exclusivamente o barramento de alta disponibilidade do **Flowbox**. | Divergência arquitetural do ecossistema TECHBOXBR. |

---

### 2.4 Mecanismo de Multi-Tenancy (Isolamento por Loja)

1. **Contexto por Thread:**  
   O interceptor `TenantFilter` captura o header HTTP `X-Loja-Id` e o claim `lojaId` do JWT autenticado, injetando o UUID no `TenantContext` (usando `ThreadLocal`).
2. **PostgreSQL RLS (Row Level Security):**  
   O Flyway aplica scripts como `V11__rls_force.sql` e `V23__rls_remaining.sql`, definindo políticas automáticas no banco:
   ```sql
   ALTER TABLE produto ENABLE ROW LEVEL SECURITY;
   CREATE POLICY tenant_isolation_policy ON produto
     FOR ALL
     USING (loja_id = current_setting('app.current_loja_id', true)::uuid);
   ```
3. **Repositórios Spring Data:**  
   Mesmo com RLS, a camada de aplicação aplica dupla defesa:
   ```java
   Optional<Produto> findByIdAndLojaId(UUID id, UUID lojaId);
   ```

---

### 2.5 Segurança, Criptografia AES-GCM e Blind Index LGPD

Para cumprir as diretrizes da LGPD sem perder a capacidade de buscar um cliente pelo CPF no balcão:
1. **Chave Mestra (KEK):** Fornecida via variável de ambiente `VISIONBOX_CRYPTO_KEK_HEX` (256 bits).
2. **Encriptação Reversível:** O CPF real e dados clínicos sensíveis são cifrados com **AES/GCM/NoPadding** e IV aleatório de 12 bytes. O resultado é armazenado em `cpf_cipher`.
3. **Blind Index (Busca Rápida):** Uma função de hash unidirecional **HMAC-SHA256** com segredo pepper (`VISIONBOX_CRYPTO_HMAC_PEPPER`) gera um hash determinístico do CPF sem pontuação. Esse hash é armazenado na coluna indexada `cpf_hash`. Quando o operador busca o CPF `123.456.789-00`, o backend calcula o HMAC desse valor e faz `SELECT ... WHERE cpf_hash = :hash`, mantendo o dado seguro e a busca ultra-rápida.

---

### 2.6 Geração Sequencial de SKU e Cálculo EAN-13 GS1 Módulo 10

Implementado recentemente no [ProdutoService.java](file:///d:/TECHBOXBR/PRODUTOS/VisionBox/src/main/java/com/visionbox/modules/catalogo/service/ProdutoService.java):

1. **SKU Sequencial Automático:**
   - Formato padronizado: `PRD-000001`, `PRD-000002`, etc.
   - O repositório busca os últimos SKUs cadastrados para aquela loja específica via regex, extrai o maior sufixo numérico e incrementa em `+1`.
   - Se o campo de SKU for deixado em branco no cadastro ou importação, o sistema preenche automaticamente.
2. **Código de Barras EAN-13 GS1 Oficial:**
   - Composto por 13 dígitos:  
     - Prefixo Brasil: `789`
     - Sequência Numérica da Loja: 9 dígitos sequenciais (ex: `000000001`)
     - 13º Dígito Verificador: Calculado matematicamente pelo algoritmo **GS1 Módulo 10**:
       ```java
       // Soma ponderada dos primeiros 12 dígitos
       int soma = 0;
       for (int i = 0; i < 12; i++) {
           int digito = Character.getNumericValue(base12.charAt(i));
           soma += (i % 2 == 0) ? digito * 1 : digito * 3;
       }
       int digitoVerificador = (10 - (soma % 10)) % 10;
       ```
   - O endpoint `GET /api/v1/produtos/sugestao-sku-ean` já retorna o próximo par de SKU/EAN livre para pré-carregar na tela de cadastro.

---

### 2.7 Importação Unificada de Dados: Excel (.xlsx / .xls) e CSV

Construído sobre a biblioteca corporativa **Apache POI 5.2.5** e utilitário [PlanilhaImportHelper.java](file:///d:/TECHBOXBR/PRODUTOS/VisionBox/src/main/java/com/visionbox/shared/util/PlanilhaImportHelper.java):

1. **Detecção e Normalização:**  
   O backend detecta o formato do arquivo pela extensão (`.xlsx`, `.xls` ou `.csv`) e pelo `Content-Type`. Células numéricas de código de barras ou CPF são convertidas para texto limpo (eliminando a notação científica ou o sufixo `.0`).
2. **Download de Modelos Estilizados:**  
   - `GET /api/v1/clientes/modelo-importacao?formato=xlsx` ou `csv`
   - `GET /api/v1/produtos/modelo-importacao?formato=xlsx` ou `csv`
   - O modelo Excel é gerado em tempo de execução com cabeçalho azul royal institucional da TECHBOXBR, texto em negrito, colunas auto-ajustadas e linhas de exemplo realistas.
3. **Tolerância a Falhas:**  
   Se uma linha da planilha apresentar inconsistência (ex: CPF inválido), o sistema reporta o erro detalhado daquela linha sem abortar os registros válidos anteriores.

---

### 2.8 Integração Fiscal Flowbox (NFC-e e NF-e)

- **Comunicação REST:** O VisionBox não mantém certificados digitais A1 localmente em cada PDV.
- O cliente de serviço fiscal [FlowboxFiscalClient.java](file:///d:/TECHBOXBR/PRODUTOS/VisionBox/src/main/java/com/visionbox/modules/fiscal/client/FlowboxFiscalClient.java) envia a venda aprovada para a URL do **Flowbox** (`VISIONBOX_FISCAL_FLOWBOX_URL`).
- O Flowbox assina o XML, transmite para a SEFAZ do estado correspondente e retorna a chave de acesso de 44 dígitos, o protocolo de autorização e o QR-Code para impressão do DANFE.

---

### 2.9 Frontend: Arquitetura React, Vite e Design Tokens

Localizado no diretório [apps/web/](file:///d:/TECHBOXBR/PRODUTOS/VisionBox/apps/web/):
- **Design Tokens:** Todo estilo visual utiliza as variáveis CSS de [theme-visionbox.css](file:///d:/TECHBOXBR/PRODUTOS/VisionBox/theme-visionbox.css) (ex: `var(--color-primary-600)`, `var(--color-surface)`). O seletor `[data-theme="dark"]` comuta o modo escuro sem re-renderização de componentes.
- **Estrutura de Layout e Navegação Atualizada:**  
  Em [AppShell.tsx](file:///d:/TECHBOXBR/PRODUTOS/VisionBox/apps/web/src/components/AppShell.tsx):
  - **Sidebar Principal:** Dashboard ➔ PDV ➔ Receitas ➔ OS ➔ Financeiro ➔ **Administrativo** (Submenu colapsável com *Clientes*, *Catálogo* e *Painel Dev*).
  - **Topbar Minimalista:** Apenas o círculo do avatar do usuário logado. Ao clicar, um `DropdownMenu` colapsa para baixo exibindo **Configurações**, **Usuários** e **Sair**, eliminando ruídos visuais.
- **Estados Visuais Mandatórios:** Todas as telas implementam os 4 estados fundamentais: *Loading*, *Empty State* (com ilustração e botão de ação), *Error State* e *Offline Alert*.

---

# 3. Guia Completo de Gestão e Operação do MinIO (S3 Object Storage)

### 3.1 O Que é o MinIO e Por Que Ele é Utilizado no VisionBox
O **MinIO** é um servidor de armazenamento de objetos de alto desempenho, 100% compatível com a API do **Amazon S3**.

No VisionBox, o MinIO é responsável por armazenar com segurança:
1. **Fotos e Documentos de Receitas Oftálmicas:** Imagens escaneadas ou fotos de celulares tiradas no balcão da receita física do médico.
2. **Evidências de Controle de Qualidade (CQ):** Fotos obrigatórias quando o laboratório ou técnico reprova uma montagem de lentes.
3. **Arquivos Anexos Gerais de Clientes e OS.**

#### Por Que Usar MinIO e Não o Próprio PostgreSQL ou Disco Local?
- **Zero Inchaço no Banco de Dados:** Salvar imagens binárias (`bytea` ou `BLOB`) no PostgreSQL infla backups, estraga a memória do cache e deixa as consultas SQL lentas.
- **Portabilidade Total para Nuvem:** Por usar o padrão universal AWS S3, a ótica pode rodar o MinIO na própria VPS local ou, se desejar no futuro, apontar uma variável de ambiente para a **Amazon AWS S3**, **Wasabi** ou **Cloudflare R2** sem alterar uma única linha de código Java!
- **URLs Pré-Assinadas (Presigned URLs):** O sistema pode gerar links temporários e seguros para que o laboratório ou cliente visualize o anexo sem expor credenciais do servidor.

---

### 3.2 Portas, Endpoints e Acessos

Na VPS e no `docker-compose.yml`, o MinIO roda isolado no container `visionbox-minio`:

| Serviço | Porta Externa (Host) | Porta Interna (Docker) | Finalidade |
|---|---|---|---|
| **MinIO S3 API** | `9100` | `9000` | Endpoint de upload e download usado pelo backend Spring Boot (`AWS_S3_ENDPOINT`) |
| **MinIO Web Console** | `9101` | `9001` | Interface gráfica web para administradores e suporte técnico |

- **URL de Acesso ao Console Web:**  
  `http://<IP_DO_SEU_SERVIDOR>:9101`  
  *(Exemplo: se o IP da VPS for `185.123.45.67`, acesse `http://185.123.45.67:9101`)*
- **Credenciais Padrão de Produção:**
  - **Username (Root User):** `visionbox`
  - **Password (Root Password):** `visionbox123`

---

### 3.3 Estrutura de Buckets e Organização dos Objetos

Os dados no MinIO são organizados em **Buckets** (equivalente a unidades de disco) e **Prefixos** (pastas lógicas com o ID da loja para garantir isolamento):

```
MinIO Object Storage
│
├── visionbox-receitas/                     # Bucket de receitas médicas oftálmicas
│   ├── loja-c3f25c78-9e6b-4b2a-.../        # Pasta isolada da Loja A
│   │   └── receitas/
│   │       ├── a1b2c3d4-receita-001.jpg
│   │       └── e5f6a7b8-receita-002.pdf
│   └── loja-98a76b54-1c2d-3e4f-.../        # Pasta isolada da Loja B
│       └── receitas/
│           └── f9e8d7c6-receita-010.jpg
│
└── visionbox-anexos/                       # Bucket de evidências de CQ e laboratório
    └── loja-c3f25c78-9e6b-4b2a-.../
        └── cq/
            └── foto-reprovacao-lente-riscada.jpg
```

---

### 3.4 Manual Passo a Passo do Console Web do MinIO

#### Passo 1: Acessar e Fazer Login
1. Abra o navegador Google Chrome ou Edge e acesse `http://<IP_DO_SERVIDOR>:9101`.
2. Digite o usuário `visionbox` e a senha `visionbox123`.
3. Você entrará no dashboard do MinIO com métricas de uso de disco e lista de buckets.

#### Passo 2: Criar ou Verificar Buckets
1. No menu lateral esquerdo, clique em **Buckets**.
2. Verifique se os dois buckets essenciais existem:
   - `visionbox-receitas`
   - `visionbox-anexos`
3. Se algum deles não existir, clique no botão azul **Create Bucket**:
   - Digite o nome exato (tudo em minúsculo, sem espaços ou acentos).
   - Deixe o *Versioning* e *Object Locking* desativados (ou ative versionamento se desejar histórico de versões).
   - Clique em **Create Bucket**.

#### Passo 3: Navegar e Visualizar Arquivos
1. No menu lateral esquerdo, clique em **Object Browser**.
2. Clique sobre o bucket `visionbox-receitas`.
3. Você verá as pastas divididas por loja (ex: `loja-<UUID>`).
4. Clique nas pastas até chegar aos arquivos `.jpg` ou `.pdf`.
5. Ao clicar em qualquer arquivo, o MinIO abre um painel lateral onde você pode:
   - Clicar em **Preview** para ver a foto da receita diretamente na tela.
   - Clicar em **Download** para salvar no seu computador.
   - Ver o tamanho em KB/MB e a data exata do upload.

#### Passo 4: Criar Access Keys (Chaves de Integração)
Para permitir que outros serviços ou scripts de backup acessem o MinIO sem usar a senha mestre de root:
1. No menu lateral esquerdo, clique em **Access Keys**.
2. Clique em **Create Access Key**.
3. O MinIO gerará automaticamente um `Access Key` e um `Secret Key`.
4. Copie ambos e armazene de forma segura.

---

### 3.5 Políticas de Acesso, Chaves de API e CORS

1. **Privacidade Padrão (Private):**  
   Por conter dados médicos sensíveis, o bucket `visionbox-receitas` deve ser mantido como **Private**. Nenhum anexo pode ser acessado publicamente sem passar pela validação de permissão da API do VisionBox (`GET /api/v1/receitas/{id}/anexo`).
2. **CORS (Cross-Origin Resource Sharing):**  
   Se no futuro o frontend React for configurado para fazer upload direto ao MinIO via presigned URL, crie uma regra de CORS no bucket:
   ```json
   [
     {
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
       "AllowedOrigins": ["*"],
       "ExposeHeaders": ["ETag"]
     }
   ]
   ```

---

### 3.6 Rotinas de Backup, Volumes e Retenção LGPD

1. **Volume Docker Persistente:**  
   Os dados do MinIO ficam gravados no volume persistente `miniodata` no host da VPS:  
   Local físico: `/var/lib/docker/volumes/visionbox_miniodata/_data`.
2. **Backup Rápido via Terminal (Linha de Comando):**  
   Você pode clonar todo o conteúdo do MinIO para uma pasta de backup compactada:
   ```bash
   # Criar pasta de backup datada
   mkdir -p /backups/minio/$(date +%Y-%m-%d)

   # Copiar o volume diretamente com permissões preservadas
   docker run --rm -v visionbox_miniodata:/data -v /backups/minio:/backup \
     alpine tar czf /backup/minio-$(date +%Y-%m-%d).tar.gz /data
   ```
3. **Retenção LGPD (Ciclo de Vida):**  
   Receitas oftálmicas devem ser preservadas pelo período legal de atendimento. O VisionBox possui rotina de anonimização que remove referências após o tempo legal sem prejudicar o histórico fiscal.

---

# 4. Guia de Deploy e Operação em Servidor (VPS)

### 4.1 Orquestração via Docker Compose

O ecossistema VisionBox sobe de forma automatizada com um único arquivo [docker-compose.yml](file:///d:/TECHBOXBR/PRODUTOS/VisionBox/docker-compose.yml).

```
                      ┌────────────────────────────┐
                      │    Cloudflare Tunnel       │ (visionbox-tunnel)
                      └─────────────┬──────────────┘
                                    │
                                    ▼
                      ┌────────────────────────────┐
                      │    Nginx Frontend Web      │ (visionbox-web : 8088)
                      └─────────────┬──────────────┘
                                    │ Proxy reverso /api
                                    ▼
                      ┌────────────────────────────┐
                      │    Spring Boot App         │ (visionbox-app : 8080)
                      └──────┬──────┬──────┬───────┘
                             │      │      │
          ┌──────────────────┘      │      └─────────────────┐
          ▼                         ▼                        ▼
┌──────────────────┐      ┌──────────────────┐     ┌──────────────────┐
│ visionbox-postgres│     │ visionbox-redis  │     │ visionbox-minio  │
│ (Porta 5433)     │      │ (Porta 6380)     │     │ (Portas 9100/9101│
└──────────────────┘      └──────────────────┘     └──────────────────┘
```

---

### 4.2 Procedimento Padrão de Atualização e Deploy

Sempre que novas correções ou funcionalidades forem desenvolvidas localmente, siga o roteiro seguro de deploy:

```bash
# 1. No seu computador local (Windows):
git add .
git commit -m "feat: sua nova feature ou correcao"
git push origin main

# 2. Conectar na VPS via SSH:
ssh vps

# 3. Ir até a pasta do projeto:
cd /caminho/para/VisionBox

# 4. Baixar as novidades do GitHub:
git pull origin main

# 5. Parar e remover os containers de aplicação antigos para evitar colisão:
docker rm -f visionbox-app visionbox-web

# 6. Reconstruir as imagens e subir em segundo plano:
docker compose up -d --build app web

# 7. Verificar se todos os containers subiram saudáveis:
docker compose ps
```

---

### 4.3 Variáveis de Ambiente Críticas

Configuradas no arquivo `.env` da VPS ou declaradas na seção `environment` do `docker-compose.yml`:

```env
SPRING_PROFILES_ACTIVE=prod,flowbox
SPRING_DATASOURCE_URL=jdbc:postgresql://postgres:5432/visionbox
SPRING_DATASOURCE_USERNAME=visionbox
SPRING_DATASOURCE_PASSWORD=visionbox

# Armazenamento de Arquivos S3 / MinIO
AWS_S3_ENDPOINT=http://minio:9000
VISIONBOX_S3_BUCKET=visionbox-receitas

# Chaves Criptográficas de Segurança (Devem possuir 32+ caracteres)
VISIONBOX_JWT_SECRET=vb_prod_jwt_secret_2026_secured_key_32chars
VISIONBOX_CRYPTO_KEK_HEX=c8f3b6127d49e1a85b032c74d9e1f568c8f3b6127d49e1a85b032c74d9e1f568
VISIONBOX_CRYPTO_HMAC_PEPPER=vb_prod_pepper_secure_hash_hmac_2026

# Integração Fiscal com Flowbox
VISIONBOX_FISCAL_FLOWBOX_URL=http://localhost:8085
VISIONBOX_FISCAL_FLOWBOX_API_KEY=flowbox_production_key
```

---

### 4.4 Diagnóstico, Monitoramento e Resolução de Problemas

- **Ver logs em tempo real do Backend:**
  ```bash
  docker logs -f --tail=100 visionbox-app
  ```
- **Ver logs em tempo real do MinIO:**
  ```bash
  docker logs -f --tail=100 visionbox-minio
  ```
- **Erro de Conflito de Nome de Container:**  
  Se ao rodar `docker compose up -d` você receber a mensagem `Conflict. The container name "/visionbox-app" is already in use by container...`, execute:
  ```bash
  docker rm -f visionbox-app visionbox-web
  docker compose up -d app web
  ```
- **Checar Consumo de CPU e Memória:**
  ```bash
  docker stats --no-stream
  ```

---

# 5. Histórico das Últimas Melhorias Entregues

1. **Reorganização Estrutural da Sidebar:**  
   Menu unificado na ordem exata de valor para a ótica:  
   *1) Dashboard ➔ 2) PDV ➔ 3) Receitas ➔ 4) OS ➔ 5) Financeiro ➔ 6) Administrativo*.  
   Dentro do menu *Administrativo*, foi criado um submenu colapsável contendo **Clientes**, **Catálogo** e **Painel Dev**.
2. **Topbar Minimalista & Perfil do Usuário:**  
   Removido o nome textual e o perfil (ROLE) expostos na barra superior. Agora exibe exclusivamente o círculo com o avatar do usuário. Ao clicar no avatar, abre-se um menu suspenso colapsando para baixo com **Configurações**, **Usuários** (para administradores) e **Sair**.
3. **Automação Completa de SKU e Código de Barras EAN-13:**  
   Criação de gerador sequencial por loja (`PRD-000001`) e gerador do código de barras oficial EAN-13 no padrão GS1 Brasil (prefixo `789` + 9 dígitos sequenciais + 13º dígito verificador calculado via Módulo 10). Ao abrir a tela de novo produto, o próximo SKU e EAN já vêm pré-preenchidos.
4. **Carga em Massa com Suporte Unificado a Excel (.xlsx / .xls) e CSV:**  
   Integração do motor corporativo **Apache POI** no backend. Agora o sistema aceita planilhas do Excel diretamente no upload tanto de Clientes quanto do Catálogo de Produtos, e gera modelos oficiais estilizados em `.xlsx` e `.csv` com 1 clique.
5. **Deploy de Produção Concluído com Sucesso na VPS:**  
   Todos os contêineres (`visionbox-app`, `visionbox-web`, `visionbox-postgres`, `visionbox-minio`, `visionbox-redis`, `visionbox-rabbitmq`, `visionbox-tunnel`) atualizados e em execução saudável na infraestrutura de nuvem.

---
*VisionBox ERP — Documento Oficial de Referência e Operação.*
