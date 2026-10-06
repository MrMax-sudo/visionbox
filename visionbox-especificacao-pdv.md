# VisionBox --- Especificação da Tela PDV / Frente de Caixa

> **Objetivo:** reproduzir no frontend a tela de **PDV --- Frente de
> caixa** apresentada na referência visual com máxima fidelidade.\
> A imagem fornecida é a **fonte de verdade visual**. Não reinterpretar
> o layout e não adicionar elementos que não existam na referência.

------------------------------------------------------------------------

## 1. Visão geral

A tela é o PDV principal do **VisionBox**, sistema para óticas. O design
é desktop-first, horizontal, clean e premium, seguindo a identidade
visual em tons quentes de marrom, café, areia, bege e creme.

A composição é dividida em:

1.  **Sidebar fixa à esquerda**
2.  **Topbar no topo da área principal**
3.  **Área operacional do PDV à esquerda/centro**
4.  **Resumo da venda fixo visualmente à direita**
5.  **Rodapé discreto**

Em desktop, a tela deve aproveitar praticamente toda a viewport e evitar
scroll vertical em condições normais de operação.

------------------------------------------------------------------------

# 2. Estrutura macro

Em uma viewport de referência de aproximadamente **1920 × 1080**:

``` text
┌───────────────┬─────────────────────────────────────────────────────────────┐
│               │                        TOPBAR                               │
│               ├───────────────────────────────────────────┬─────────────────┤
│               │                                           │                 │
│   SIDEBAR     │         ÁREA OPERACIONAL DO PDV           │ RESUMO DA VENDA │
│               │                                           │                 │
│               │                                           │                 │
│               ├───────────────────────────────────────────┴─────────────────┤
│               │                         FOOTER                              │
└───────────────┴─────────────────────────────────────────────────────────────┘
```

Proporções aproximadas:

``` css
:root {
  --sidebar-width: 290px;
  --summary-width: 555px;
  --topbar-height: 80px;
  --footer-height: 55px;
}
```

A sidebar ocupa aproximadamente **15% da largura total**.

A área principal restante ocupa aproximadamente **85%**.

Dentro da área principal, o conteúdo operacional usa cerca de
**63--65%**, enquanto o resumo da venda utiliza aproximadamente
**35--37%**.

------------------------------------------------------------------------

# 3. Paleta visual

Usar como base:

``` css
:root {
  --coffee-950: #301B10;
  --coffee-900: #3B2416;
  --coffee-800: #50301D;
  --coffee-700: #674128;
  --coffee-600: #795033;

  --brown-primary: #75482B;
  --brown-hover: #633B24;

  --cream-page: #F4ECE2;
  --cream-surface: #FBF8F4;
  --cream-soft: #F7F1EA;
  --sand: #EDE1D3;
  --sand-soft: #F2E8DD;

  --border: #DDCDBD;
  --border-soft: #E8DDD2;

  --text: #2F241D;
  --text-secondary: #67584D;
  --text-muted: #918276;

  --success: #47754B;
  --success-bg: #E6EFE4;

  --info-bg: #E1EEF1;
  --white: #FFFFFF;
}
```

Evitar cores saturadas. O aspecto geral deve ser quente, elegante e
confortável.

------------------------------------------------------------------------

# 4. Tipografia

Usar preferencialmente:

``` css
font-family: "Inter", sans-serif;
```

Hierarquia aproximada:

``` text
Título principal:         28–32px / 700
Título de card:           20–22px / 700
Texto normal:             15–17px / 400
Labels:                   14–16px / 500
Valores importantes:     22–28px / 700
Texto auxiliar:           13–14px / 400
Sidebar:                  16–18px / 500
```

A interface não deve usar fontes excessivamente pesadas. O destaque deve
vir principalmente de tamanho, contraste e espaçamento.

------------------------------------------------------------------------

# 5. Sidebar

A sidebar ocupa toda a altura da viewport.

Background em marrom café escuro com uma leve variação/gradiente
vertical:

``` css
.sidebar {
  width: 290px;
  min-height: 100vh;
  background: linear-gradient(
    180deg,
    #3A2113 0%,
    #4A2A17 55%,
    #352013 100%
  );
  color: #fff;
}
```

## Logo

No topo, centralizado, aparece o logo completo VisionBox em branco:

``` text
[símbolo]
VisionBox
UM NOVO OLHAR EM GESTÃO
```

Usar o **asset oficial do logo**, e não reconstruí-lo em HTML.

Dimensão visual aproximada:

``` css
.sidebar-logo {
  width: 175px;
  margin: 18px auto 35px;
}
```

------------------------------------------------------------------------

# 6. Navegação lateral

Itens:

``` text
Dashboard
Clientes
Receitas
Catálogo
PDV
OS
Financeiro
```

Depois existe uma linha divisória.

Título:

``` text
ADMINISTRATIVO
```

Itens:

``` text
Usuários
Configurações
```

Cada item possui:

-   ícone linear à esquerda;
-   texto;
-   altura aproximada de 52--58 px;
-   padding horizontal de 18--22 px;
-   radius de aproximadamente 10--12 px.

O item ativo é **PDV**.

``` css
.sidebar-item.active {
  background: rgba(181, 126, 82, .42);
  color: #fff;
}
```

No PDV aparece também uma pequena badge:

``` text
F8
```

alinhada à direita.

------------------------------------------------------------------------

# 7. Ajuda e versão

Na região inferior da sidebar existe um card:

``` text
🎧  Precisa de ajuda?
    Suporte via WhatsApp        >
```

O card utiliza marrom ligeiramente mais claro e bordas arredondadas.

Abaixo, próximo ao rodapé:

``` text
VisionBox v0.1.0
```

em tamanho pequeno e baixa opacidade.

------------------------------------------------------------------------

# 8. Topbar

A topbar começa imediatamente depois da sidebar.

``` css
.topbar {
  height: 80px;
  background: rgba(250, 247, 242, .95);
  border-bottom: 1px solid var(--border-soft);
}
```

## Título

Centralizado visualmente:

``` text
PDV - Frente de caixa
```

Fonte grande, preta/marrom muito escura, bold.

## Controles à direita

Na sequência:

``` text
[● Online]    [lua]    [sino + badge 3]    Admin    [A]
                                      Loja 00000000
```

### Online

Badge verde clara:

``` css
.status-online {
  background: #E6EFE4;
  color: #365F3A;
  border-radius: 999px;
}
```

### Usuário

Texto:

``` text
Admin
Loja 00000000
```

À direita há avatar circular marrom com:

``` text
A
```

------------------------------------------------------------------------

# 9. Área principal

Background:

``` css
.main {
  background: #F4ECE2;
}
```

O conteúdo deve possuir aproximadamente:

``` css
padding: 32px 28px;
gap: 20px;
```

Layout:

``` css
.pdv-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 555px;
  gap: 20px;
}
```

------------------------------------------------------------------------

# 10. Card Cliente

Primeiro card da coluna esquerda.

Background creme/branco, borda fina bege e radius de aproximadamente
10--12 px.

``` css
.card {
  background: rgba(255,255,255,.72);
  border: 1px solid #DDCDBD;
  border-radius: 11px;
}
```

Cabeçalho:

``` text
[ícone usuário]  Cliente                           [+ Novo cliente]
```

Título bold.

Botão **Novo cliente** outlined.

## Busca

Logo abaixo:

``` text
🔍  Buscar por nome, CPF, telefone...
```

Input largo, aproximadamente 50 px de altura.

## Cliente selecionado

Na referência existe um cliente selecionado:

``` text
(JS)   Juliana Silva                 CPF: 123.456.789-00
       (11) 98765-4321               Nascimento: 14/05/1990
                                      Última compra: 22/08/2026

                                      [Ver dados >]
```

O bloco possui background bege muito claro.

Avatar:

``` text
JS
```

em círculo marrom.

Existe um pequeno **×** no canto superior direito para
remover/desvincular o cliente.

O botão **Ver dados** fica no lado direito.

------------------------------------------------------------------------

# 11. Card Produto / SKU

Segundo card.

Cabeçalho:

``` text
[ícone caixa] Produto / SKU                      [+ Novo produto]
```

Busca:

``` text
🔍 Buscar por produto, SKU, código de barras...
```

Abaixo existe uma barra de filtros em formato pill:

``` text
[Todos] [Armações] [Lentes] [Óculos de Sol] [Acessórios] [Serviços]
```

**Todos** é o filtro ativo.

``` css
.category.active {
  background: #6A4329;
  color: white;
}
```

Demais filtros:

``` css
.category {
  background: #F0E8DF;
  color: #33271F;
  border-radius: 999px;
}
```

------------------------------------------------------------------------

# 12. Carrinho

Terceiro card e maior bloco da coluna esquerda.

Cabeçalho:

``` text
[ícone carrinho] Carrinho — 0 itens                  [🗑 Limpar carrinho]
```

O botão limpar carrinho é discreto, outlined/bege.

## Cabeçalho da tabela

Colunas:

``` text
# | Produto | Qtd | Unitário | Desconto | Subtotal | Ações
```

Utilizar background creme/bege muito suave.

A coluna **Produto** é a mais larga.

## Estado vazio

Na referência:

``` text
        [ícone carrinho]

        Carrinho vazio

Busque um produto acima para adicionar ao carrinho.
```

Centralizado vertical e horizontalmente.

Ícone e textos em tons neutros.

O carrinho deve crescer para aproveitar o restante da altura disponível.

------------------------------------------------------------------------

# 13. Painel Resumo da venda

O painel direito é um único card grande.

``` css
.sale-summary {
  background: rgba(255,255,255,.76);
  border: 1px solid #DDCDBD;
  border-radius: 11px;
}
```

Padding aproximado:

``` css
padding: 24px 26px;
```

Cabeçalho:

``` text
[ícone] Resumo da venda                         #000123
```

------------------------------------------------------------------------

# 14. Valores

Primeira linha:

``` text
Subtotal                                      R$ 0,00
```

Depois:

``` text
Desconto                 [%] [ 0,00 ] [R$] [%]
```

A referência possui um controle segmentado para selecionar se o desconto
é em **R\$** ou **%**.

O segmento **R\$** aparece ativo em marrom.

Após uma divisória:

``` text
Total                                         R$ 0,00
```

O total deve ser visualmente forte:

``` css
.total-value {
  font-size: 27px;
  font-weight: 700;
}
```

------------------------------------------------------------------------

# 15. Pagamento

Título:

``` text
[ícone carteira] Pagamento
```

Abaixo, quatro opções em uma única linha:

``` text
[ Dinheiro ] [ Cartão ] [ PIX ] [ Outros ]
```

Cada opção é um card/botão.

**Dinheiro** está selecionado na referência:

``` css
.payment-method.active {
  background: #75482B;
  color: white;
}
```

Demais:

``` css
.payment-method {
  background: #F5EFE9;
  color: #3A2A20;
}
```

Cada opção possui ícone centralizado acima do texto.

------------------------------------------------------------------------

# 16. Valor recebido

Linha:

``` text
Valor recebido                           [ R$ 0,00 ]
```

O campo fica alinhado à direita.

Abaixo:

``` text
Troco                                      R$ 0,00
```

O valor do troco aparece em **verde oliva** e bold.

``` css
.change-value {
  color: #47754B;
  font-weight: 700;
}
```

------------------------------------------------------------------------

# 17. Finalizar

Grande botão marrom:

``` text
🔒 Finalizar
```

Ocupa praticamente toda a largura do painel.

``` css
.finish-button {
  width: 100%;
  height: 62px;
  background: #75482B;
  color: #fff;
  border: 0;
  border-radius: 9px;
  font-size: 19px;
  font-weight: 600;
}
```

Na referência, como não há itens/valor, o botão apresenta visual
ligeiramente desabilitado, mas mantém a identidade marrom.

------------------------------------------------------------------------

# 18. Card "Próximo passo"

Logo abaixo:

``` text
●  Próximo passo
   Ao finalizar, a OS nasce em ORÇAMENTO e aparece na fila.
```

Background bege suave.

A palavra:

``` text
ORÇAMENTO
```

aparece dentro de uma pill azul-acinzentada muito clara.

Esse card é informativo e não deve competir visualmente com o botão
Finalizar.

------------------------------------------------------------------------

# 19. Ações inferiores

No rodapé do painel de resumo:

``` text
[📄 Orçamento]   [🖨 Imprimir]   [...]
```

Os dois primeiros botões ocupam quase todo o espaço.

O último é um botão quadrado/compacto para menu adicional.

Todos outlined, com background creme/branco.

------------------------------------------------------------------------

# 20. Footer

O rodapé da aplicação fica abaixo do conteúdo principal.

À esquerda:

``` text
VisionBox • Um novo olhar em gestão.
```

À direita:

``` text
Desenvolvido por TechboxBR 2026
```

Fonte pequena, aproximadamente 12--14 px, cor marrom/cinza suave.

``` css
.footer {
  border-top: 1px solid #E5D9CD;
  color: #77695E;
}
```

------------------------------------------------------------------------

# 21. Dimensões e espaçamentos de referência

Para uma tela Full HD:

``` text
Sidebar:
  largura:                         ~290 px

Topbar:
  altura:                          ~80 px

Área principal:
  padding horizontal:             ~28 px
  padding vertical:               ~32 px

Gap entre coluna e resumo:        ~20 px

Resumo:
  largura:                         ~550–560 px

Cards:
  radius:                          ~10–12 px
  border:                          ~1 px
  padding interno:                ~20–24 px

Inputs:
  altura:                          ~48–52 px
  radius:                          ~8–10 px

Botões:
  altura normal:                   ~42–48 px

Botão finalizar:
  altura:                          ~60–64 px

Pills:
  altura:                          ~34–38 px
  radius:                          999 px
```

------------------------------------------------------------------------

# 22. Hierarquia de componentes sugerida

``` text
VisionBoxPDV
├── Sidebar
│   ├── Logo
│   ├── MainNavigation
│   ├── AdministrativeNavigation
│   ├── SupportCard
│   └── Version
│
├── AppShell
│   ├── Topbar
│   │   ├── PageTitle
│   │   ├── OnlineStatus
│   │   ├── ThemeButton
│   │   ├── Notifications
│   │   └── UserMenu
│   │
│   ├── PDVContent
│   │   ├── OperationalColumn
│   │   │   ├── CustomerCard
│   │   │   │   ├── CustomerSearch
│   │   │   │   └── SelectedCustomer
│   │   │   │
│   │   │   ├── ProductCard
│   │   │   │   ├── ProductSearch
│   │   │   │   └── CategoryFilters
│   │   │   │
│   │   │   └── CartCard
│   │   │       ├── CartHeader
│   │   │       ├── CartTable
│   │   │       └── EmptyCartState
│   │   │
│   │   └── SaleSummary
│   │       ├── SummaryHeader
│   │       ├── Totals
│   │       ├── DiscountControl
│   │       ├── PaymentMethods
│   │       ├── ReceivedValue
│   │       ├── Change
│   │       ├── FinishButton
│   │       ├── NextStepInfo
│   │       └── SecondaryActions
│   │
│   └── Footer
```

------------------------------------------------------------------------

# 23. Estados funcionais que devem preservar o layout

A implementação deve suportar estados reais sem alterar a estrutura
visual.

### Cliente não selecionado

Manter o card Cliente, mas trocar o bloco de Juliana Silva por estado
vazio.

### Cliente selecionado

Mostrar avatar, nome, telefone, CPF, nascimento, última compra, botão
**Ver dados** e opção de remover.

### Carrinho vazio

Mostrar exatamente o empty state da referência.

### Carrinho com itens

Substituir o empty state pelas linhas da tabela sem alterar cabeçalho ou
dimensões gerais do card.

### Forma de pagamento selecionada

Somente uma opção deve receber o preenchimento marrom ativo.

### Finalização indisponível

Quando não houver itens ou total válido, manter o botão visualmente
presente, porém desabilitado.

### Finalização disponível

Aumentar levemente contraste do botão, sem mudar dimensões ou posição.

------------------------------------------------------------------------

# 24. Responsividade

A referência principal é **desktop** e deve ser priorizada.

## ≥ 1440 px

Manter o layout exatamente como a referência:

``` text
sidebar | operação | resumo
```

## 1100--1439 px

Reduzir sidebar e resumo moderadamente:

``` css
@media (max-width: 1439px) {
  :root {
    --sidebar-width: 240px;
    --summary-width: 430px;
  }
}
```

Não remover informações importantes.

## \< 1100 px

Permitir que o resumo seja movido para baixo da área operacional.

## Mobile

No mobile, a fidelidade 1:1 deixa de ser prioridade. A operação deve se
transformar em fluxo vertical utilizável.

------------------------------------------------------------------------

# 25. Ícones

Usar uma única biblioteca de ícones lineares, preferencialmente
**Lucide**, com:

``` css
stroke-width: 1.8;
```

Ícones necessários incluem aproximadamente:

``` text
LayoutGrid
Users
Eye
Package
ShoppingCart
ClipboardList
Wallet
Settings
Headphones
UserRound
Plus
Search
ChevronRight
X
Trash2
Banknote
CreditCard
BadgeDollarSign / Pix equivalente
MoreHorizontal
Lock
FileText
Printer
Moon
Bell
```

Evitar misturar estilos diferentes de ícones.

------------------------------------------------------------------------

# 26. Bordas e sombras

A interface utiliza **bordas muito mais do que sombras**.

Evitar cards flutuantes com sombras pesadas.

Quando necessário:

``` css
box-shadow: 0 2px 8px rgba(65, 42, 26, .025);
```

Bordas:

``` css
border: 1px solid rgba(172, 143, 118, .40);
```

O resultado deve permanecer plano, sofisticado e limpo.

------------------------------------------------------------------------

# 27. Regras de fidelidade visual

1.  **Não transformar a tela em dashboard genérico.**
2.  **Não alterar a posição do resumo da venda.**
3.  **Não adicionar atalhos F1/F2/F4 etc. que não estejam nesta
    referência.**
4.  **Não adicionar gráficos, métricas ou cards extras.**
5.  **Não adicionar glassmorphism.**
6.  **Não usar sombras fortes.**
7.  **Não substituir a paleta quente por azul, roxo ou cinza
    corporativo.**
8.  **Não exagerar nos border-radius.**
9.  **Não aumentar desnecessariamente a altura dos componentes.**
10. **Não esconder informações da venda para "simplificar" a
    interface.**
11. **Preservar o grande espaço destinado ao carrinho.**
12. **Preservar o painel de pagamento permanentemente visível no
    desktop.**
13. **Usar o logo oficial VisionBox como asset.**
14. **Manter a densidade visual da referência: compacta, mas
    confortável.**
15. **O objetivo é reprodução, não redesign.**

------------------------------------------------------------------------

# 28. Instrução final para o agente de frontend

> **A imagem de referência fornecida é a fonte de verdade visual.
> Desenvolva esta tela de PDV do VisionBox buscando correspondência
> visual 1:1. Não "melhore", reinterprete ou reorganize o design.
> Preserve exatamente a hierarquia: sidebar fixa à esquerda, topbar
> superior, coluna operacional contendo Cliente → Produto/SKU → Carrinho
> e painel Resumo da venda à direita. Reproduza proporções,
> alinhamentos, espaçamentos, cores, tipografia, bordas, estados ativos
> e densidade visual da referência.**
>
> **Use componentes reutilizáveis apenas internamente; a componentização
> não pode modificar o resultado visual. O layout deve ser comparado
> lado a lado com a imagem de referência durante a implementação.**
>
> **Priorize primeiro a fidelidade em 1920×1080. Depois implemente a
> responsividade sem comprometer a versão desktop. Não acrescente
> atalhos, funcionalidades, textos ou elementos visuais que não estejam
> previstos na referência ou nos requisitos funcionais existentes do
> sistema.**
