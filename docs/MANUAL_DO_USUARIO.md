# Manual do Usuário e Guia de Operação — VisionBox ERP

> **Versão:** 1.1.0 (Produção)  
> **Família:** TECHBOXBR  
> **Público:** Lojistas, Gerentes, Vendedores, Técnicos de Laboratório e Administradores de Óticas  

---

## 1. Visão Geral do Sistema

O **VisionBox** é um ERP verticalizado de alta performance desenvolvido exclusivamente para o varejo óptico. Diferente de sistemas comerciais genéricos, o VisionBox foi desenhado em torno das particularidades de uma ótica:
- **Máquina de Estados de 12 Status de OS:** Rastreamento ponta a ponta desde o balcão até a entrega final ao cliente.
- **Ficha Clínica e Receituário Oftálmico:** Gestão minuciosa de dioptrias (esférico, cilíndrico, eixo, adição, DNP e altura) com proteção e sigilo LGPD.
- **PDV Teclado-First & Alta Velocidade:** Interface com atalhos `F2`, `F3`, `F4`, `F8` para fechamento de venda em segundos, com suporte a multi-pagamentos e contingência offline.
- **Módulo Fiscal Centralizado via Flowbox:** Emissão de NFC-e (modelo 65) e NF-e (modelo 55) com certificado A1 em nuvem.
- **Portais Públicos Especialistas:** Portal externo do laboratório de lentes e Portal PWA de auto-rastreio para o cliente final.

---

## 2. Acesso ao Sistema e Perfis de Usuário

### 2.1 Tela de Login
- **URL de Produção:** Acesse o sistema pelo navegador (Chrome, Edge, Firefox ou Safari).
- Insira seu **E-mail** e **Senha cadastrada**.
- O botão **Lembrar-me** salva a sessão de forma segura nesta máquina.

### 2.2 Níveis de Permissão (RBAC)

| Perfil | Acessos Permitidos |
|---|---|
| **VENDEDOR** | Acesso ao PDV, Catálogo de Produtos, Cadastro e Consulta de Clientes, Receitas, Abertura e Consulta de Ordens de Serviço (OS). Não altera configurações nem autoriza descontos acima de 15%. |
| **GERENTE** | Tudo do vendedor, mais: Abertura e Fechamento de Caixa, autorização de descontos restritos via PIN/senha, gestão financeira e cancelamento de OS. |
| **ADMIN** | Acesso integral: Configurações da Empresa, Módulo Fiscal, Formas de Pagamento, Gestão de Usuários e Importações em Lote (CSV). |
| **LABORATORIO** | Portal técnico de laboratório para atualização de produção e controle de SLA de montagem. |
| **DESENVOLVEDOR** | Perfil técnico exclusivo para diagnósticos do sistema, métricas operacionais e auditoria técnica. Bloqueado para usuários comuns e administradores de loja. |

---

## 3. Ponto de Venda (PDV)

O PDV foi projetado para permitir vendas contínuas mesmo na ausência de mouse.

### 3.1 Atalhos de Teclado no PDV

| Tecla | Ação |
|---|---|
| <kbd>F2</kbd> | Coloca o foco imediatamente no campo de busca de produtos |
| <kbd>F3</kbd> | Abre o seletor / busca de cliente para vincular à venda |
| <kbd>F4</kbd> | Abre o modal de **Finalizar Venda** |
| <kbd>F8</kbd> | Abre o painel de **Controle de Caixa** (Abertura, Sangria, Suprimento e Fechamento) |
| <kbd>Esc</kbd> | Fecha qualquer modal aberto ou limpa a seleção atual |

### 3.2 Passo a Passo de uma Venda no Balcão
1. **Identificar o Cliente (<kbd>F3</kbd>):** Busque pelo nome ou CPF. Se o cliente tiver uma receita cadastrada recente, ela pode ser vinculada diretamente à venda.
2. **Adicionar Itens (<kbd>F2</kbd>):**
   - Digite o nome, marca ou SKU da armação, óculos de sol, lentes oftálmicas ou acessórios.
   - Ajuste a quantidade com as teclas `+` e `-` ou diretamente no teclado.
3. **Aplicar Desconto e Regra de Alçada:**
   - Descontos de até **15%** são liberados diretamente pelo vendedor.
   - Descontos **acima de 15%** exigem autorização: o sistema abrirá o diálogo de liberação onde um **Gerente** ou **Admin** insere sua senha para validação criptografada imediata.
4. **Finalizar Pagamento (<kbd>F4</kbd>):**
   - O VisionBox permite **múltiplas formas de pagamento** na mesma venda (ex.: R$ 200 em Dinheiro + R$ 600 em 3x no Cartão de Crédito).
   - O saldo restante é calculado em tempo real até atingir R$ 0,00.
   - Clique em **Confirmar Venda**.
5. **Comprovante e Impressão:** Ao concluir, o sistema gera o comprovante de venda térmico (80mm/58mm) e o DANFE da NFC-e.

### 3.3 Contingência Offline
Se a internet da loja oscilar ou cair, o botão **Finalizar Venda** permanece **ativo**. A venda é armazenada localmente de forma segura e sincronizada automaticamente com o servidor assim que a conexão retornar.

---

## 4. Gestão de Ordens de Serviço (OS) & Kanban

As ordens de serviço representam a fabricação e entrega dos óculos dos clientes.

### 4.1 As 12 Etapas da Máquina de Estados de OS

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
[10. ENTREGUE] ➔ (Pós-venda: [12. GARANTIA])
      └── (A qualquer momento com justificativa: [11. CANCELADA])
```

1. **Criada:** Abertura inicial da OS vinculada à venda.
2. **Aguardando Receita:** Venda iniciada, aguardando o envio ou medição da receita médica.
3. **Aguardando Pagamento:** Sinal ou entrada financeira pendente para envio ao laboratório.
4. **Em Produção:** Separação de armação e bloco na ótica.
5. **Enviado ao Laboratório:** Óculos ou lentes despachados para surfaçagem/montagem externa.
6. **No Laboratório:** Confirmado pelo laboratório de montagem (SLA de fabricação iniciado).
7. **Retorno do Laboratório:** Peça finalizada recebida na loja física.
8. **Controle de Qualidade:** Conferência de dioptria no lensômetro e alinhamento da armação.
9. **Pronto para Retirada:** Óculos prontos. O cliente recebe notificação no WhatsApp.
10. **Entregue:** Cliente provou, ajustou e retirou os óculos na loja.
11. **Cancelada:** Estorno ou cancelamento auditado com motivo registrado.
12. **Garantia:** Retorno de peça ou lente para troca dentro do prazo legal/comercial.

### 4.2 Alertas Visuais de SLA
No painel **Kanban de OS**, cada cartão exibe:
- Tempo decorrido na etapa atual.
- Tag verde (Dentro do prazo), amarela (Atenção) e vermelha pulsante (SLA Estourado).

### 4.3 Portal do Laboratório
- Para cada OS enviada a um laboratório terceirizado, é gerado um link seguro único (sem necessidade de usuário e senha no ERP).
- O técnico do laboratório abre a página no celular ou computador e altera o status para *Recebido*, *Em Montagem* ou *Pronto para Envio*.

### 4.4 Rastreio PWA do Cliente & Disparo WhatsApp
- Na tela de detalhes da OS (<kbd>Ver OS</kbd>), clique no botão **Rastreio do Cliente**.
- Você pode enviar diretamente para o WhatsApp do cliente uma mensagem automática contendo o link exclusivo onde ele acompanha o progresso dos seus óculos em tempo real.

---

## 5. Clientes & Receitas Oftálmicas

### 5.1 Cadastro de Clientes
- Cadastro completo: Nome, CPF, Telefone/WhatsApp, E-mail, CEP e Endereço.
- O campo de WhatsApp é utilizado pelo sistema para disparar contatos com um clique.

### 5.2 Importação em Massa de Clientes (CSV)
Para migrar clientes do seu sistema antigo para o VisionBox:
1. Acesse o menu **Clientes**.
2. Clique no botão **Importar CSV**.
3. Clique no botão **Baixar Modelo (.csv)** para baixar a planilha modelo oficial com todas as colunas corretas.
4. Preencha seus clientes no formato do arquivo e anexe o arquivo no diálogo.
5. O sistema valida os CPFs e números automaticamente e efetua a carga em lote.

### 5.3 Ficha Técnica de Receitas (Dioptrias)
Cada receita é vinculada a um cliente e possui:
- **Olho Direito (OD)** e **Olho Esquerdo (OE)**:
  - **Esférico (ESF):** Grau para miopia (-) ou hipermetropia (+).
  - **Cilíndrico (CIL):** Grau para astigmatismo.
  - **Eixo (°):** De 0° a 180°.
  - **Adição (AD):** Grau de perto para lentes multifocais/bifocais.
  - **DNP / DP (mm):** Distância naso-pupilar.
  - **Altura (mm):** Altura de montagem da pupila no aro da armação.
- **Dados do Prescritor:** Nome do Médico Oftalmologista ou Optometrista e número do CRM/CROO.
- **Data da Consulta e Data de Validade:** Permite ao sistema avisar quando o cliente precisa de retorno anual.

---

## 6. Catálogo de Produtos & Controle de Estoque

### 6.1 Categorias de Produtos
- **Armações:** Grau masculino, feminino, infantil, acetato, titânio, metal e fio de nylon.
- **Óculos de Sol:** Solares com proteção UV400 e polarizados.
- **Lentes Oftálmicas:** Monofocais, Multifocais, Anti-reflexo, Fotossensíveis (Transitions/Photochromic), Blue Light.
- **Lentes de Contato:** Descartáveis, tóricas e soluções de higienização.
- **Acessórios & Serviços:** Estojos, flanelas, correntes, montagens e soldas.

### 6.2 Importação em Massa de Produtos (CSV)
1. Acesse o menu **Catálogo**.
2. Clique no botão **Importar CSV**.
3. Clique em **Baixar Modelo (.csv)** para obter a planilha pré-configurada.
4. Cabeçalho esperado: `sku,nome,precoVenda,tipoProduto,precoCusto,estoqueQuantidade,ncm`.
5. Salve e carregue o arquivo. Todos os produtos serão indexados imediatamente para busca instantânea no PDV.

---

## 7. Controle Financeiro & Fechamento de Caixa

### 7.1 Operações de Caixa (<kbd>F8</kbd>)
- **Abertura de Caixa:** O operador informa o valor do fundo de troco inicial.
- **Suprimento:** Entrada avulsa de dinheiro para troco.
- **Sangria:** Retirada de segurança de valores em dinheiro para o cofre.
- **Fechamento de Caixa:** Conferência cega onde o operador declara os valores apurados por forma de pagamento (Dinheiro, Cartões, PIX).

### 7.2 Conciliação Bancária OFX
- Na tela **Financeiro**, importe o arquivo `.OFX` emitido pelo internet banking do seu banco para conciliar entradas e taxas de cartão automaticamente.

---

## 8. Configurações da Empresa, Formas de Pagamento & Módulo Fiscal

Para acessar as configurações, clique no ícone de **Engrenagem (Configurações)** no menu lateral esquerdo.

### 8.1 Aba "Preferências"
- Alternância entre **Tema Claro** e **Tema Escuro**.
- Consulta dos dados da conta atual e botão de encerramento de sessão.

### 8.2 Aba "Formas de Pagamento"
- Ativação/Desativação de bandeiras e métodos (PIX, Dinheiro, Cartão de Crédito 1x a 12x, Cartão de Débito, Convênio).
- Configuração de taxa da maquininha e prazo de compensação em dias para cálculo automático no fluxo de caixa.

### 8.3 Aba "Empresa"
Nesta aba, o Administrador cadastra e edita todos os dados cadastrais da loja física:
- **Razão Social e Nome Fantasia:** Impressos nos comprovantes e no cabeçalho das ordens de serviço.
- **CNPJ e Inscrição Estadual:** Utilizados para a emissão fiscal.
- **Telefone e WhatsApp de Suporte:** O número cadastrado aqui alimenta automaticamente todos os botões de suporte e contato da aplicação.
- **Endereço Completo:** Cidade, UF, Logradouro, Bairro e CEP.
- **URL da Logomarca:** Imagem da marca exibida nos documentos e no topo do sistema.

### 8.4 Aba "Módulo Fiscal (A1) & Flowbox"
O VisionBox adota a arquitetura de alta segurança **Flowbox Fiscal Gateway**:
- **Onde fica o Certificado Digital A1 (.pfx)?**  
  O certificado A1 e sua senha são armazenados com criptografia de ponta no microsserviço **Flowbox** (família TECHBOXBR). Isso garante que o arquivo digital nunca fique vulnerável nos computadores do balcão e permite que múltiplos caixas emitam notas em paralelo sem conflito.
- **Documentos Suportados:**
  - **NFC-e (Nota Fiscal de Consumidor Eletrônica - Modelo 65):** Emitida no momento da venda no PDV.
  - **NF-e (Nota Fiscal Eletrônica - Modelo 55):** Emitida para vendas interestaduais ou devoluções/remessas para laboratórios.
- **Regras Fiscais Óticas pré-configuradas:**
  - Armações: NCM `9003.11.00` ou `9003.19.00`
  - Óculos de Sol: NCM `9004.10.00`
  - Lentes Oftálmicas: NCM `9001.40.00` / `9001.50.00`
- **Contingência Automática:** Em caso de indisponibilidade da SEFAZ, o PDV opera em contingência offline e transmite os lotes assim que o servidor da Receita responder.

---

## 9. Dúvidas Frequentes & Suporte Técnico

- **Como cadastrar novos vendedores e gerentes?**  
  Acesse o menu **Usuários** (disponível para perfis ADMIN), clique em **Novo Usuário**, defina o perfil de acesso e forneça as credenciais de login.
- **Como imprimir um comprovante de OS antiga?**  
  No menu **OS**, localize o cartão da ordem de serviço, clique em **Ver Detalhes** e selecione o botão de **Imprimir Comprovante**.
- **Onde obtenho suporte direto?**  
  Em qualquer tela do VisionBox, basta clicar no botão **Suporte via WhatsApp** no rodapé do menu lateral para abrir um atendimento direto com a equipe técnica TECHBOXBR.
