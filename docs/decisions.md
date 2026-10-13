# decisions.md — VisionBox

> Notas de decisões relevantes do backend (exigido pelo Definition of Done).
> ADRs formais continuam em `docs/adrs/`. Data: 2026-10-07 (backend-engineer).

## D-001 — O `ObjectMapper` do bean é a única fonte das features Jackson

**Contexto:** `spring.jackson.deserialization.fail-on-unknown-properties=false` em `application.yml`
não tinha efeito: o `JacksonConfig` expõe um `ObjectMapper` próprio e o
`MappingJackson2HttpMessageConverter` do Boot 3.4 injeta o **bean**, não o mapper do
auto-config. Resultado: `FAIL_ON_UNKNOWN_PROPERTIES=true` e qualquer campo extra do payload
(ex.: `tipoLente` em `/receitas`) virava 400 "Corpo da requisição inválido ou JSON malformado."

**Decisão:** desabilitar `FAIL_ON_UNKNOWN_PROPERTIES` dentro de `JacksonConfig` (a config do
yml passa a ser apenas documental) e gravar isto no Javadoc do bean.

**Consequência:** payloads com campos desconhecidos são ignorados (compat tolerante com o
frontend). Se um dia precisarmos de strict, será por profile específico.

## D-002 — Erros de payload legíveis em PT-BR, sem ecoar valores

**Contexto:** todo `HttpMessageNotReadableException` retornava a mesma mensagem genérica.

**Decisão:** `ProblemDetailHandler` desembrulha a cadeia de causas do Jackson e devolve
`detail` específico — campo desconhecido, UUID inválido ("clienteId inválido: informe o UUID do
cliente."), tipo esperado. **Nunca** inclui o valor recebido (pode conter CPF/grau → LGPD);
só nome do campo e tipo esperado.

**Consequência:** suporte consegue diagnosticar sem log de servidor. Mensagem genérica
mantida como fallback (JSON malformado de verdade).

## D-003 — Contrato de receita: datas opcionais + normalização no service

**Contexto:** o frontend (`Receitas.tsx`) envia `{clienteId, tipoLente, dp, od, oe, observacao}`
— sem datas, `tipoLente` em vez de `tipo`, `dp` numérico, `adicao: 0` quando não é multifocal e
`MONOFOCAL` como tipo.

**Decisão:**
- `dataEmissao` defaulta **hoje** e `dataValidade` **emissão + 2 anos** (ambas opcionais);
- `@JsonAlias("tipoLente")`; `dp` aceita número ou texto (`LenientStringDeserializer`);
- `normalizarTipo` converte `MONOFOCAL|SIMPLES` → `VISAO_SIMPLES` (CHECK de
  `V2__cliente_receita.sql`); tipo desconhecido → 400 listando os aceitos;
- `normalizarGrau` trata `adicao = 0` como "sem adição" (regra: adição só em MULTIFOCAL/BIFOCAL).

**Consequência:** nenhum dado é perdido; o domínio do banco não muda (nenhuma migration nova
em `receita`). Validação de faixa continua em `validarGrau`.

## D-004 — Soft-delete com semântica por entidade (Usuário × Produto)

**Contexto:** `@SQLRestriction("ativo = true")` + `UNIQUE (loja_id, …)` quebrava o ciclo
excluir → recriar (o `exists…` não via a linha inativa e o INSERT estourava a unique →
400 "Registro duplicado"). Em `Usuario`, a restriction também escondia inativos da listagem
(badge "Inativo" da UI nunca aparecia) e impedia reativação (`PATCH {ativo:true}` → 404).

**Decisão:**
- **`Usuario`:** `@SQLRestriction` **removido**. Lista/inativas/reativação voltam a funcionar e o
  `existsByEmailAndLojaId` passa a enxergar todas as linhas → conflito de e-mail vira 400 legível
  (um e-mail = uma conta; para "recriar", reative a existente). **Login/refresh continuam
  bloqueando conta inativa com check explícito** `usuario.isAtivo()` → `DisabledException`
  (`AuthController`) — a remoção não abre acesso.
- **`Produto`:** restriction **mantida** (catálogo não pode listar item excluído) e a unicidade de
  `(loja_id, sku)` virou **índice parcial** `WHERE ativo = true` via
  `V21__unicidade_parcial_produto_sku.sql` (dropa qualquer unique equivalente, tolera tabela
  ausente com `to_regclass`).

**Consequência:** dev (`ddl-auto: create`) e prod (Flyway) ficam consistentes nas duas entidades.

## D-005 — Fora de escopo nesta entrega (bloqueios estruturais)

Não alterados por exigirem ordem/histórico de produção:

1. **Versões de migration duplicadas** — `V12__estoque.sql`, `V12__seed_rich.sql`,
   `V12__usuario_auth.sql` e `V15__conta_pagar.sql`, `V15__produto_fiscal.sql`. Flyway 10.20.1
   (`CompositeMigrationResolver`) falha com
   *"Found more than one migration with version %s"* → **boot com Flyway ligado (prod) bloqueado**.
2. **`V3–V10` ausentes** — não há `CREATE TABLE produto/marca/categoria` em lugar nenhum do
   histórico (comentário do `V11` cita uma "V5 single-table" inexistente) → banco novo via Flyway
   ficaria incompleto.

Itens para **db-admin** (renomear/ajustar com `flyway repair` no histórico real) + **devops-infra**
(validar em ambiente de staging). `mvn flyway:validate` **não pôde rodar aqui**: sem banco local
(5432 fechado) e sem Docker na máquina.

## D-006 — Tema escuro: tokens "sobre-cor" dedicados em vez de `text-white`

**Contexto:** o modo escuro troca `--color-primary` por uma areia clara e `--color-text-on-primary`
por marrom escuro. Qualquer componente que usasse `text-white` sobre `--color-danger`, ou
`--color-text-on-primary` sobre um fundo que **não** acompanha o primary (gradiente do sidebar,
`--color-login-button`), ficava ilegível no dark (`#2A1C14` sobre `#22150E`).

**Decisão:** três tokens constantes em `theme-visionbox.css` (mesmo valor nos dois temas):

| Token | Fundo que serve | Uso |
|---|---|---|
| `--color-sidebar-text` | gradiente do sidebar (sempre escuro) | `.vision-sidebar-link*`, `<aside>` |
| `--color-text-on-action` | `--color-login-button` (#75482B fixo) | `.pdv-finish-button`, `.pdv-payment-methods button.active` |
| `--color-text-on-danger` | `--color-danger` (vira coral claro no dark) | `Button variant="destructive"`, badge de notificações |

E `color-scheme: light/dark` em `:root`/`[data-theme="dark"]` para os controles nativos
(`<select>`, scrollbar, date picker) seguirem o tema.

**Regra de ouro:** só `--color-text-on-primary` quando o fundo for `--color-primary` (ou seu
hover/`-dark`). Todo o resto usa `--color-sidebar-text` / `--color-text-on-action` /
`--color-text-on-danger` ou `--color-text-primary`.

**Consequência:** classes da paleta Tailwind (`text-teal-700`, `bg-amber-50`, `text-gray-500`)
foram substituídas por tokens em `LabPortal`, `OSDetail`, `ControleCaixaModal`,
`AutorizacaoDescontoModal`, `PDV` e `DashboardKanban` — permanecem apenas no comprovante de
impressão (papel branco) e na tela de Login (design fixo claro, sem toggle).

## D-007 — Alçada de desconto: PIN validado por lista, não por tamanho

**Contexto:** `handleConfirmar` aceitava `senha.length >= 4` **como alternativa** às senhas
mestras — qualquer PIN de 4+ caracteres liberava desconto acima de 15% (falha de segurança de
alçada, e o `||` tornava os valores literais redundantess).

**Decisão:** valida comprimento mínimo (4) **e** pertence à lista de PINs gerenciais
(`1234` / `admin` / `123456`), com mensagens distintas para "curto" e "incorreto".
A comparação passou a usar a senha **sem espaços**.

**Consequência:** a lista continua em cliente (sem backend de alçada). Sinalizado para
**security-auditor**: migrar validação de PIN para endpoint autenticado com rate-limit.

## D-008 — Controles sem `onClick` viraram ação real ou chip estático

**Contexto:** auditagem apontou botões renderizados como `<button>` sem handler — focáveis,
pareciam clicáveis e não faziam nada.

**Decisão:**

| Onde | Antes | Agora |
|---|---|---|
| `Layout` — sino | contador fixo `3`, sem painel | `NotificationBell`: lê `visionbox-outbox`, mostra vendas offline pendentes, fecha no Escape/clique externo |
| `Layout` — Configurações | `<div>` inerte | abre `ConfiguracoesDialog` (tema claro/escuro, conta, sair) |
| `Layout` — sair | ícone `ChevronDown` | ícone `LogOut` + `aria-label` |
| `DashboardKanban` — "Filtros" | sem handler | alterna `apenasAtrasadas` (filtro real sobre o kanban) |
| `DashboardKanban` — "Últimos 7 dias" / "Hoje, dd/mm/aaaa" | `<Button>` inerte | `<span>` com o mesmo visual de chip (informativo, não focável) |
| `Clientes` — "Filtros" | sem handler | "Limpar filtros" (`setQ('')` + `setPage(0)`), desabilitado quando vazio |
| `ControleCaixaModal` | `err.response?.data?.message` (axios) num client baseado em `ApiError` → sempre cacia; status bar sem estado de carregamento | `mensagemErro()` lê `ApiError.problem`; skeleton em `isLoading` |

**Consequência:** nenhum `<button>` focável resta sem `onClick`/`<Link>` nas páginas auditadas
(`DashboardKanban`, `Clientes`, `Receitas`, `PDV`, `Financeiro`, `Layout`).

## D-009 — WhatsApp via link manual `wa.me` (postergando Cloud API para escala)

**Contexto:** avaliação de custos e complexidade da WhatsApp Cloud API / provedores de mensageria para o estágio atual do produto.

**Decisão:** manter o canal de comunicação exclusivamente via botão manual com link `wa.me/55...` e mensagem pré-formatada. Nenhuma integração de API automática externa de WhatsApp será ativada no MVP e fase inicial de piloto; a transição para Cloud API oficial só ocorrerá após validação de tração e volume relevante de clientes ativos.

**Consequência:** custo zero operacional para a ótica e para a plataforma, sem risco de bloqueio de chips, sem necessidade de onboarding no Meta Business Manager e sem dependência de terceiros.

## D-010 — P7: alçada de desconto validada no backend (PIN = senha BCrypt de GERENTE/ADMIN)

**Contexto:** D-007 deixou o PIN em lista hardcoded no frontend (`1234`/`admin`/`123456`),
com sinalização para migrar para endpoint autenticado com rate-limit. P7 executa isso.

**Decisão — fonte do PIN (opção "a"):** validar a `senha` recebida contra o `senhaHash`
(BCrypt via `PasswordEncoder`) dos usuários **ativos** com perfil **GERENTE/ADMIN da MESMA
loja** (`findByLojaIdAndPerfilInAndAtivoTrue`). Não criamos tabela/config de PIN (opção "b")
porque ela exigiria migration V31 + seed de PIN padrão (fraco, repetiria o erro de `1234`) ou
endpoint/UI de gestão — mais superfície. Com a opção (a):
- zero segredo novo para armazenar/cadastrar (senha de login já é BCrypt no banco);
- identificação do autorizador é automática (o usuário que casou o hash → `autorizadoPor*`);
- gerente usa UMA credencial (a própria senha de login) — sem "PIN mágico" compartilhado.

**Contrato:** `POST /api/v1/autorizacoes-desconto` (autenticado, qualquer perfil da loja pode
solicitar), body `{ descontoPercentual, senha }`. Respostas: `200 {autorizado, exigePin,
rateLimitExcedido, descontoPercentual, limiteSemPinPercentual(15), mensagem, autorizadoPor*}`;
PIN inválido → `200` com `autorizado=false` + mensagem **genérica**; estouro de rate-limit →
`429` RFC 7807 (ProblemDetailHandler, nunca loga/ecoia o PIN).

**Rate-limit:** `RateLimiterAlcada` **em memória** (janela fixa 15 min, 5 falhas por
`lojaId:usuarioId`, sucesso zera o contador; lazy expiry — sem job). Config via
`visionbox.alcada.rate-limit-max-tentativas` (5) e `visionbox.alcada.rate-limit-janela-minutos`
(15). Sem Redis de propósito (não assumir infra).

**Auditoria:** cada tentativa com PIN grava `log_auditoria` append-only
(`acao=AUTORIZACAO_DESCONTO`, `usuario_id` = solicitante, `detalhe_json` = % + motivo
`PIN_OK|PIN_INVALIDO|PIN_AUSENTE|RATE_LIMIT` + autorizador quando houve). PIN nunca vai para
log nem para `detalhe_json`. Desconto ≤15% autoriza sem PIN e sem auditoria.

**Migração:** **nenhuma** — a versão reservada `V31__autorizacao_desconto.sql` NÃO foi usada
(nenhuma mudança de schema: `log_auditoria` já tem `acao VARCHAR(50)` sem CHECK e índices
`(loja_id, entidade)` / `(loja_id, criado_em)`).

**Frontend:** `AutorizacaoDescontoModal.tsx` chama o endpoint via `apiClient` e exibe
`ApiError.problem.detail` (429/400). O `<select>` fake de supervisor foi removido — a
identificação de quem autorizou vem do backend (`autorizadoPorNome`).

**Gap sinalizado (fora do escopo de P7):** resolvido em D-011.

## D-011 — Enforcement server-side de alçada de desconto e token público de rastreio (US17)

**Data:** 2026-10-10 (fullstack-engineer).

**Contexto:**
1. A validação de alçada de desconto (> 15%) existia apenas na UI e no endpoint isolado `POST /api/v1/autorizacoes-desconto`.
2. A geração de token de rastreio para cliente final (US17 / Portal PWA) precisava de endpoint autenticado na OS (`GET /api/v1/ordens-servico/{id}/rastreio-token`) e preenchimento automático no `OrdemServicoResponse`.

**Decisões:**
- **Alçada Server-side:** `OrdemServicoService.criar` calcula o percentual de desconto sobre o valor bruto da venda. Se `desconto > 15%`, exige `senhaAutorizacao` e valida contra `AutorizacaoDescontoService` (senha BCrypt de Gerente/Admin da mesma loja). Falha lança `IllegalArgumentException` (400) com mensagem descritiva.
- **Frontend PDV:** `AutorizacaoDescontoModal.tsx` passa a senha/PIN validada para o PDV (`descontoSenha`), que injeta em `CriarOrdemServicoPayload.senhaAutorizacao`.
- **Token de Rastreio US17:** Adicionado `GET /api/v1/ordens-servico/{id}/rastreio-token` e enriquecimento de `tokenRastreio` no `OrdemServicoResponse`. `OSDetail.tsx` ganhou botão e modal dedicado de "Rastreio do Cliente" com mensagem formatada para envio via WhatsApp (`wa.me`).

**Consequência:**
- Fraude ou bypass de desconto por requisição direta é bloqueada no servidor.
- Vendedores e gerentes podem compartilhar tanto o link técnico do laboratório (`/lab/:token`) quanto o link de rastreio limpo com LGPD para o cliente (`/rastreio/:token`).
- 230/230 testes unitários verdes.

## D-012 — Fase 3 (Financeiro): baixa parcial com histórico; `valor_aberto` como coluna generated

**Data:** 2026-10-13 (backend-engineer, Fase 3 Plano Robustez §3.3).

**Contexto:** o plano pede `valorOriginal`/`valorAberto`/status (`ABERTO|PARCIAL|PAGO|CANCELADO`)
em `conta_receber`. A tabela já existia (V15) com `valor` = original, `valor_pago` = total
baixado e status `PENDENTE|PAGO|VENCIDO|CANCELADO|PARCIAL` — renomear PENDENTE→ABERTO quebraria
CHECK, consultas DRE/OFX e o front.

**Decisões:**
- `valor_aberto` criada em `V34` como **`GENERATED ALWAYS AS (valor - valor_pago) STORED`** —
  atende o §3.3 sem coluna persistida duplicada (impossível divergir). Mapeada read-only na
  entidade (`insertable=false, updatable=false`); `getSaldo()` continua a fonte em código.
- Status existentes mantidos (`PENDENTE` ≡ `ABERTO` do plano; `VENCIDO` é derivado).
- `baixar(id, null)` agora baixa o **saldo em aberto** (não mais o valor original) — correção
  necessária para suportar parciais acumulados. Aceita `BaixaContaReceberRequest`
  (`valorPago` com `@JsonAlias("valor")`, `formaPagamentoId`, `observacao`); idempotência R4 via
  `IdempotencyFilter` global (header `Idempotency-Key`).
- Toda baixa grava `conta_receber_pagamento` (histórico) e, **se houver caixa aberto**, lança
  `CaixaMovimento`: `ENTRADA` (dinheiro → soma gaveta) ou `RECEBIMENTO_FIADO` (demais formas →
  só total de entradas). Sem caixa aberto: baixa prossegue, `caixa_id` nulo + log WARN (balcão
  nunca trava). Novos valores de tipo entraram no CHECK via `V34` (constraint recriada).
- Fornecedor: CNPJ cifrado AES-256-GCM + HMAC (`cnpj_cipher`/`cnpj_hash`, dedup parcial por
  loja via índice único), resposta sempre mascarada revelando 2 dígitos — espelho do CPF do
  Cliente (ADR-002). `conta_pagar` ganhou `fornecedor_id`, `data_competencia` (default =
  vencimento) e `comprovante_url`; coluna texto `fornecedor` mantida (denormalizada do cadastro)
  por DRE/compat.

**Consequência:** baixas parciais auditáveis por conta (timeline em
`GET /{id}/pagamentos`); DRE por competência passa a ter base (`data_competencia`). Pendências
para próximas fases: estorno de baixa (reabrir título + movimento `ESTORNO` no caixa) e
conciliação OFX gerando linhas de histórico — listadas no relatório da Fase 3.

## D-013 — Fase 2 (Caixa & Turnos): relatório por modalidade vem de `ordem_servico_pagamento`, não de `caixa_movimento`

**Contexto:** o relatório de fechamento precisa de "Total em Dinheiro/PIX/Débito/Crédito", mas
as vendas do PDV gravam pagamento em `ordem_servico_pagamento` (V26) e nem sempre geram
`CaixaMovimento`. Somar `caixa_movimento.forma_pagamento` (string livre) seria incompleto e
quebraria com hard-code de modalidades (regra do Plano §5).

**Decisão:** (`CaixaService.relatorioFechamento`) totais por modalidade somam
`ordem_servico_pagamento` na janela do turno (`criado_em >= abertoEm AND < fechadoEm`), com
query nova `somarPorFormaPagamentoNoPeriodo` em `OrdemServicoPagamentoRepository` que **exclui
OS canceladas** (sub-`NOT EXISTS`). O resumo é montado a partir de `forma_pagamento` ativo da
loja (banco — zero linhas para formas sem venda); pagamentos de formas desativadas depois do
turno entram como "Forma não cadastrada" (não somem). `totalVendas` = soma do resumo;
`sangrias`/`suprimentos` continuam vindo de `caixa_movimento`. Fechamento cego grava
`valor_fechamento_sistema` (V33) e classifica diferença como SOBRA/QUEBRA/EXATO.

**Consequência:** relatório pode divergir do `saldoEsperado` (que só conta o que passou pela
gaveta) — é esperado e documentado: dinheiro vivo ≠ recebimentos. Turno aberto usa `now()`
como fim da janela. Índice `idx_osp_loja_criado` (V33) cobre a agregação.

## D-014 — Fase 5: default "sem linha = todos os módulos ativos" + `ativo` de negócio

**Contexto:** Fase 5 introduz `modulo_configuracao_loja` (V36) como feature flag por loja. Duas
decisões não óbvias: (1) o que vale quando a loja nunca configurou nada; (2) a coluna `ativo`
da spec significa "módulo liberado", enquanto no `EntidadeBase` `ativo` é soft-delete
(+ `@SQLRestriction("ativo = true")`).

**Decisão:**
- **Default sem registro = todos ativos.** Loja sem linha em `modulo_configuracao_loja` tem os
  19 módulos liberados — retrocompatível: aplicar a V36 não bloqueia nenhuma loja existente e
  não muda comportamento de quem já opera com tudo. Materializar (aplicar plano ou toggle)
  cria as linhas e a partir daí vale o gravado. Mesma regra no frontend (`temModulo` sem dado
  = true, guard fail-open; o backend continua sendo a barreira).
- **`ModuloConfiguracaoLoja` NÃO estenda `EntidadeBase`:** herdar misturaria semântica de
  soft-delete com a flag de negócio e esconderia módulos desligados da listagem. A entidade
  replica os campos (UUID, `loja_id`, `criado_em`/`atualizado_em` timestamptz, `@Version`).
- Aplicação de plano **nunca apaga linha** (apagar reativaria o módulo pelo default acima);
  grava os 19 módulos com `ativo` da matriz (START ⊂ PRO ⊂ ENTERPRISE, spec §4.2).

**Consequência:** materializar um plano Start desliga de fato os demais módulos (a partir daí
o default deixa de valer para aquela loja). Seed da migration: nenhum, de propósito.

## D-015 — Fase 5: escopo cross-tenant do Painel Dev e rota de módulos do usuário comum

**Contexto:** o Painel do Desenvolvedor configura a loja indicada no path
(`/dev/lojas/{lojaId}/modulos`), mas `TenantFilter` só conhece a loja do JWT/header; sem
ajuste, o `TenantRlsAspect` grava `app.loja_id` do operador e a RLS FORCE da V36 esconderia/
rejeitaria as linhas da loja alvo (fail-closed correto, porém errado para o operador
autorizado). Além disso, `/api/v1/dev/**` é restrito a ADMIN/DESENVOLVEDOR e o
`GuardaModulo`/`useModulosStore` rodam em TODOS os perfis.

**Decisão:**
- **`ModuloTenantScope.executar(lojaId, acao)`** troca o `TenantContext` para a loja alvo
  ANTES do proxy `@Transactional` (o aspecto lê o ThreadLocal na entrada da transação) e
  restaura no `finally`. Uso somente após `autorizarAcessoLoja`.
- **Autorização defesa-em-profundidade:** DESENVOLVEDOR acessa qualquer loja; ADMIN apenas a
  própria (`AccessDeniedException` → 403). Vale mesmo que o SecurityConfig já limite
  `/api/v1/dev/**`.
- **Rota nova `GET /api/v1/modulos`** (módulos da loja autenticada, sem path de tenant) fica em
  `anyRequest().authenticated()` do SecurityConfig — necessária porque o store/guard rodam para
  qualquer perfil. Só expõe flags de recurso (código/nome/ativo/plano), sem dado pessoal.

**Consequência:** ALTER requests do Painel Dev com `X-Loja-Id` próprio + path de outra loja
funcionam mesmo com RLS ativa; a auditoria grava `loja_id` da loja alvo. Sinalizado ao
security-auditor: (1) visibilidade de flags de plano para todos os perfis da loja na rota
`/api/v1/modulos`; (2) ADMIN não pode gerenciar outra loja (regra nova, além do RBAC do
SecurityConfig); (3) IP de auditoria vem de `getRemoteAddr()` (atrás de proxy/load balancer
considerar `X-Forwarded-For`).

## D-016 - Fase 4 (Compras XML, MDR, Comissões): V35 sem FK, idempotência por índice e base GERAL sem dupla cobrança

**Contexto:** Fase 4 do Plano de Robustez (§3.4-§3.6) cria 5 tabelas (`compra`, `compra_item`,
`maquininha_cartao`, `comissao_config`, `comissao_lancamento`) e três módulos novos no backend.

**Decisões:**
- **Migration única `V35__compras_maquininha_comissao.sql`**, com `loja_id NOT NULL`,
  `timestamptz`, `numeric(12,2)` e `ENABLE + FORCE ROW LEVEL SECURITY` + policy `loja_isolation`
  copiadas do padrão V25/V34. Sem FK para `produto`/`pedido_venda`/`usuario` — mesmo motivo do
  D-005 (bancos sem V3-V10) e mesmo padrão de `estoque.produto_id` (UUID solto). FK de
  `compra_item → compra` (ON DELETE CASCADE) e das 5 tabelas → `loja` existem.
- **Idempotência por índice único parcial (R4):** uma NF-e por loja via
  `uk_compra_loja_chave(loja_id, chave_acesso) WHERE chave_acesso IS NOT NULL`; apuração de
  comissão por `uk_comissao_lancamento_venda(loja_id, venda_id, vendedor_id, coalesce(categoria,''))`
  `WHERE venda_id IS NOT NULL AND ativo = true` — barre duplicata mesmo em corrida.
- **Base da regra GERAL exclui bases já cobertas por regra de CATEGORIA** (sem dupla cobrança).
  O Outbox ERP somava o global sobre o total E por categoria, contando duas vezes; aqui a GERAL
  incide só sobre `valorTotal - Σ bases de categoria`.
- **XML de ENTRADA só (R3):** parser DOM do JDK com hardening XXE (DOCTYPE recusado), zero
  dependência nova no pom; emissão/contingência continuam no Flowbox.
- **Pré-cadastro automático** nasce com `precoVenda = 0` (markup não é inventado na importação),
  custo sobrescrito pelo último preço da nota, NCM só se vazio e com 8 dígitos.
- **R11:** controllers novos anotados `@RequerModulo` — Compras com `COMPRAS_XML`,
  maquininhas/comissões com `FINANCEIRO_COMPLETO` (default sem linha = ativo, D-014).

**Consequência:** rota nova `/api/v1/compras/**` NÃO está no SecurityConfig — cai em
`anyRequest().authenticated()` até o orquestrador/security-auditor acrescentar
`hasAnyRole("ADMIN","GERENTE","FINANCEIRO")` (listado no relatório da Fase 4). Sinalizado ao
security-auditor: CNPJ do emitente armazenado plain em `compra.fornecedor_cnpj` (dado jurídico
da NF-e, não CPF pessoal) e `xml_fiscal` guarda a nota integral (retenção por obrigação legal).

## D-017 — MDR no pagamento da venda PDV (§3.5) e comissão automática na finalização (§3.6)

**Contexto:** Fase 4 pluga MDR e comissão no fluxo real de venda do PDV —
`OrdemServicoService.criar` (OS `PEDIDO_CONFIRMADO` com `ordem_servico_pagamento` multi-forma).
Migration `V37__pagamento_mdr_comissao.sql` adiciona `taxa_valor`, `valor_liquido` e
`maquininha_id` em `ordem_servico_pagamento`.

**Decisões:**
- **Vinculação maquininha↔pagamento em 3 níveis:** (1) `maquininhaId` explícito no
  `PagamentoRequest` do PDV, validado por loja (`findByIdAndLojaId`, R1); (2) sem id, auto-resolve
  quando a loja tem exatamente uma maquininha ativa; (3) 0 ou >1 ativas sem id → taxa/liquido
  **null** (MDR pendente para conciliação) — nunca escolhe taxa no escuro.
- **Tri-state de `taxa_valor`/`valor_liquido`:** não-cartão identificado (DINHEIRO/PIX/CREDIARIO)
  = `0.00`/`valor` (isento, líquido conhecido); cartão com maquininha = cálculo
  `MdrCalculoService` (HALF_EVEN 2 casas); pendência = `null`. Front mostra
  `valorLiquido ?? valor`.
- **Tipo de cartão vem de `FormaPagamento.tipo`** (DEBITO/CREDITO), não de texto livre; parcelas
  do novo campo `PagamentoRequest.parcelas` (default 1; débito força 1; crédito sem
  `permiteParcelar` clampado a 1 com WARN).
- **Comissão síncrona com try/catch** (mesmo padrão de estoque/ContaReceber — não há barramento
  de eventos no fluxo): `ComissaoService.apurar` com `vendaId=os.id`, vendedor do JWT e itens
  por categoria; **desconto rateado proporcionalmente** nos subtotais (último item absorve o
  arredondamento) para a soma das bases nunca exceder o `valorTotal` da venda. Falha NUNCA
  quebra a venda (WARN). Sem vendedor no JWT: pula apuração com WARN.
- **FK real `fk_osp_maquininha → maquininha_cartao`** (V37 > V35 garante existência; mesmo
  padrão FK de `ordem_servico_pagamento` V26 — sem FK é só para entidades D-005). RLS da tabela
  já existe (V26); colunas herdam grants.

**Consequência:** nenhum endpoint novo; `POST /api/v1/ordens-servico` passa a aceitar
`pagamentos[].maquininhaId/parcelas` (opcionais, compatível). Pendências de MDR (null) são
recalculáveis na conciliação. Venda cancelada deixa comissão `PENDENTE` órfã — cancelamento de
lançamento fica como follow-up (fora do escopo desta onda, dono: fluxo de cancelamento/estorno).

## D-019 — Fase 3: estorno de baixa com soft-delete + conciliação OFX passando pelo fluxo de baixa

**Data:** 2026-10-13 (backend-engineer, pendências listadas no D-012).

**Contexto:** o D-012 deixou duas pendências: (1) estorno de baixa reabrindo título com
movimento `ESTORNO` no caixa; (2) conciliação OFX que marcava PAGO direto sem nascer
linha em `conta_receber_pagamento`.

**Decisões:**
- **Estorno = SOFT-DELETE, não DELETE físico.** `conta_receber_pagamento` tem `ativo`
  (EntidadeBase + `@SQLRestriction("ativo = true")`). A linha é evidência financeira
  (quem recebeu, forma, turno) e o movimento `ENTRADA`/`RECEBIMENTO_FIADO` do turno
  original permanece em `caixa_movimento` — apagar a linha deixaria o extrato do turno
  apontando para uma baixa fantasma. `ativo=false` some da timeline (restriction) e do
  recálculo; o histórico físico permanece para auditoria/LGPD.
- **Recálculo do saldo:** `valor_aberto` é `GENERATED ALWAYS AS (valor - valor_pago)`
  (V34) — o estorno só decrementa `valor_pago` e o banco recalcula. Status: pago restante
  zero → `PENDENTE` (≡ ABERTO, D-012); senão → `PARCIAL`; `data_pagamento` volta a nulo.
- **Movimento `ESTORNO` no caixa ABERTO ATUAL** (o turno da baixa original pode já estar
  fechado): valor da baixa, forma original (tipo; forma removida → fallback `DINHEIRO`),
  motivo "Estorno de baixa: …" + observação do operador, `usuarioNome` do JWT. Sem caixa
  aberto: estorno PROSSEGUE + log WARN — mesmo contrato da baixa (balcão nunca trava).
  Simetria dos agregados do turno em `CaixaService.movimentar` (ajuste do orquestrador,
  ver D-019-nota abaixo): `ENTRADA` (baixa em dinheiro) soma `totalEntradas` **e**
  `saldoEsperado` (dinheiro físico na gaveta); `RECEBIMENTO_FIADO` soma só
  `totalEntradas`; `ESTORNO` em dinheiro subtrai da gaveta (`totalSaidas` +
  `saldoEsperado`), `ESTORNO` de forma não-dinheiro soma só `totalSaidas` (saída de
  papel, gaveta intacta). **Nenhuma migration criada** — `ESTORNO`
  já está no CHECK de V23/V34 e no enum `TipoMovimento`.
- **Regras de rejeição:** conta `CANCELADO` → 422 (BusinessException); pagamento de outra
  loja/conta → 404 composto (`findByIdAndLojaIdAndContaReceberId`, R1); pagamento já
  estornado invisível pela restriction → 404 (replay duplo sem Idempotency-Key não
  estorna duas vezes; com o header, o `IdempotencyFilter` devolve a 1ª resposta).
  Inconsistência (baixa > total pago, só por edição manual) falha alto (422) — clamp
  esconderia bug.
- **OFX conciliado a receber passa pelo `ContaReceberService.baixar`** (mesma transação):
  valor = valor do extrato, observação com FITID (rastreabilidade
  `conta_receber_pagamento` ↔ `conciliacao_ofx`). Baixa impossibilitada (conta já PAGO,
  saldo < extrato) NÃO aborta o lote: linha permanece CONCILIADO como evidência e a
  observação registra o motivo — contagens do relatório preservadas. Contas a PAGAR
  conciliadas continuam evidência (baixa manual) — débito não baixa conta a receber.
- **Forma de pagamento da baixa OFX (OFX não informa):** request `formaPagamentoId`
  (JSON ou query param no corpo cru) tem precedência (inexistente → 404, falha rápida);
  senão forma **PADRÃO da loja** (`forma_pagamento.padrao`, do banco — nada inventado em
  código); senão baixa sem forma → caixa trata como `DINHEIRO` (WARN do fluxo de baixa).
  Configurar um padrão (ex.: PIX) evita baixa bancária virar entrada de gaveta.

**Consequência:** título reaberto volta aos fluxos de cobrança/baixa normalmente;
`POST /api/v1/financeiro/contas-receber/{id}/pagamentos/{pagamentoId}/estornar`
(ADMIN/GERENTE/FINANCEIRO — SecurityConfig `/financeiro/**` + `@PreAuthorize` de defesa
em profundidade). Sinalizações: (1) **security-auditor** — estorno é operação sensível de
dinheiro: cobertura atual é RBAC + auditoria em log + movimento no caixa; avaliar
`log_auditoria` dedicado (como a alçada de desconto do D-010); (2) **qa-engineer** —
Testcontainers deve cobrir CHECK de `ESTORNO` no fluxo real e a divergence
`saldoEsperado` × baixas (D-013) agora com estorno no meio.

## D-018 — Contratos de comissão/pré-cadastro: flag transitória sem DDL, fechamento com linhas e picker de vendedores

**Data:** 2026-10-13 (backend-engineer, follow-up Fase 4 — lacunas de contrato).

**Contexto:** três lacunas da onda anterior: (1) `CompraResponse` não distinguia item
catalogado × pré-cadastrado (nota genérica no modal); (2) `ComissaoService.fechamento`
agregava por vendedor sem linha por venda; (3) `/api/v1/usuarios` é ADMIN-only
(`SecurityConfig` L80) e deixava o picker de apuração/fechamento degradado para
GERENTE/FINANCEIRO (fallback manual de UUID).

**Decisões:**
- **`preCadastrado` sem migration (V37/V38 reservadas aos agentes paralelos — ver D-017).**
  Flag `@Transient boolean preCadastrado` em `CompraItem` + `Boolean preCadastrado` em
  `CompraItemResponse`, preenchida só na resposta da importação (`toResponse(..., origemImportacao)`).
  Leituras persistidas (listar/buscar) expõem **null** de propósito: recomputar o de-para numa
  leitura posterior sempre "casaria" (o pré-cadastro passa a existir no catálogo com aquele
  EAN/SKU) e heurística por `criado_em` é frágil para um dado de auditoria de importação. O
  modal pós-importação — único lugar onde o badge importa — recebe true/false por item.
  Coluna física só quando surgir requisito de relatório histórico (donos: db-admin + PM).
- **Fechamento ganha `lancamentos`** (`List<ComissaoLancamentoResponse>`): mesmos filtros do
  agregado (cancelado/inativo fora, mesmo `vendedorId`), ordenado por `dataLancamento` → nome →
  id. Consistência estrutural: agregado derivado da MESMA lista válida na mesma passada —
  `Σ base = totalBase`, `Σ valor = totalComissao`, `size = quantidadeLancamentos` (testado).
- **`GET /api/v1/financeiro/comissoes/vendedores`** retorna `[{id, nome}]` — usuários ativos
  com perfil **VENDEDOR ou OTICO** (`findByLojaIdAndPerfilInAndAtivoTrue`, ativo explícito
  porque `Usuario` não tem `@SQLRestriction` — D-004). Perfis escolhidos porque o plano §3.6
  vincula o lançamento "à venda e ao **consultor ótico/vendedor**" e D-017 apura com o
  operador do JWT do PDV (VENDEDOR/OTICO são o pessoal de salão; `Perfil.java` idem). A
  apuração em si NÃO restringe perfil — o endpoint é picker, não barreira; comissão de
  GERENTE continua possível via API com `vendedorId` manual. LGPD minimização: só id+nome,
  sem email (o backend resolve o nome pelo id na apuração — frontend deixou de enviar
  `vendedorNome` manual). Liberado pelo matcher existente `/api/v1/financeiro/**`
  (ADMIN/GERENTE/FINANCEIRO) — **SecurityConfig intocado**; `@RequerModulo(FINANCEIRO_COMPLETO)`
  do controller cobre o GET novo.

**Consequência:** frontend `useVendedores` troca a fonte (sem degradação: `bloqueado` e
fallback manual de UUID/nome removidos de `ApurarComissaoDialog`/`FechamentoComissoesPanel`);
`CompraItensTable` mostra badge "Pré-cadastrado"/"No catálogo" por item (coluna só aparece
quando a origem é conhecida); painel de fechamento lista lançamentos por venda abaixo do
agregado. Zero hex novo (R5), TanStack Query, estados Loading/Empty/Error preservados.

## D-020 — Follow-up D-017: pagamentos[] na resposta da OS (parcelas V40) e estorno de comissão no cancelamento da venda

**Data:** 2026-10-13 (backend-engineer, pendências do módulo OS/Comissões).

**Contexto:** duas lacunas do D-017: (1) a resposta da OS não expunha os pagamentos
da venda (taxa/líquido/maquininha/parcelas ficavam só na tabela); (2) a própria
consequência documentada do D-017 — "OS cancelada após venda deixa lançamento
PENDENTE" — o cancelamento nunca estornava comissão.

**Decisões:**
- **`V40__pagamento_parcelas.sql` (coluna `parcelas INT NOT NULL DEFAULT 1`).**
  O payload do PDV já enviava `parcelas` desde V37 e o MDR usava o valor efetivo,
  mas NÃO persistia — o histórico não reconstruía a faixa. Backfill `= 1` para
  linhas V26..V37 (nunca chuta 3 onde não sabe); valor efetivo vem de
  `OrdemServicoService#parcelasEfetivas` — mesma regra do cálculo MDR
  (crédito parcelável = payload; sem `permiteParcelar` clamp 1 + WARN; débito/
  não-cartão = 1), e `aplicarMdr` passou a ler `osp.getParcelas()` — fonte única.
- **Contrato fixo `OrdemServicoResponse.pagamentos[]`** (`id`, `formaPagamentoId`,
  `formaPagamentoNome`, `valor`, `taxaValor`, `valorLiquido`, `maquininhaId`,
  `parcelas`): `taxaValor`/`valorLiquido` serializam null no MDR pendente
  (tri-state V37 preservado — front faz `valorLiquido ?? valor`); OS sem pagamento
  = `[]`. `formaPagamentoNome` prioriza o snapshot da linha (V26, usado no
  relatório de caixa); snapshot ausente resolve em LOTE por `formaPagamentoId`
  (`FormaPagamentoRepository.findByLojaIdAndIdIn` novo, R1).
- **Zero N+1:** `anexarPagamentos` faz UMA query de pagamento
  (`findAllByLojaIdAndOrdemServicoIdIn`) por resposta — single (`criar`/`buscar`/
  `avancar`) e página inteira (`listar`) usam o mesmo caminho; nunca por OS.
  `GET /ordens-servico/atrasadas` (SlaService + mapper direto) segue sem
  pagamentos — lista de SLA não mostra pagamento.
- **`ComissaoService.cancelarPorVenda(lojaId, vendaId, motivo)` → int:** marca
  CANCELADO somente os PENDENTES ativos da venda (uma query `findByLojaIdAndVendaIdAndAtivoTrue`,
  R1, filtro de status em memória); PAGO NÃO é tocado — dinheiro já pago ao vendedor,
  fica WARN com os ids (pendência de folha); sem PENDENTE = 0 sem erro (idempotente).
  `ComissaoLancamento` não tem campo motivo — motivo vai para log; a evidência
  estrutural é status=CANCELADO + o EventoOS da venda cancelada.
- **Plugado nos DOIS caminhos de cancelamento** (ambos try/catch WARN — falha na
  comissão NUNCA quebra o cancelamento, mesmo padrão de estoque/contas a receber):
  (1) `VendaHistoricoService.cancelar` (`POST /vendas/{id}/cancelar`, motivo do
  request, lojaId do TenantContext); (2) `OrdemServicoService.avancarInternal`
  quando `novoStatus == CANCELADO` (`PATCH /ordens-servico/{id}/status`, motivo =
  observação da transição). Idempotente entre os dois caminhos: o segundo a rodar
  não encontra PENDENTE.

**Consequência:** nenhum endpoint novo; front OSDetail/PDV consome
`pagamentos[]` direto; `parcelas` de linhas pré-V40 é sempre 1 (verdade
conservadora). V41 do agente paralelo (baixa desconto/juros) é independente —
V40 é só de `ordem_servico_pagamento`. Testes novos:
`OrdemServicoPagamentosResponseTest` (contrato + N+1 + tri-state + fallback de
nome em lote), `OrdemServicoCancelamentoComissaoTest` e
`VendaCancelamentoComissaoTest` (estorno plugado, falha isolada, rejeição prévia
de venda já cancelada), `ComissaoServiceCancelarVendaTest` (PENDENTE→CANCELADO,
PAGO intocado, no-op, R1). Pendência reportada: venda cancelada com comissão
PAGO exige estorno manual de folha (só WARN hoje).

## Sinalizações para outros agentes

- **security-auditor:** (1) P8 concluiu enforcement server-side de alçada de desconto em `OrdemServicoService.criar`; (2) token de rastreio público stateless `rpub1` opera com HMAC-SHA256 e expiração de 30 dias.
- **qa-engineer:** suíte ampliada para 230 testes com `OrdemServicoDescontoTest` e `OrdemServicoControllerTest`.
- **qa-engineer (D-017):** novos casos em `OrdemServicoMdrComissaoTest` — crédito 3x (faixa 2-6x), débito, PIX isento, cartão sem maquininha (pendente null), comissão 1x por venda, falha de apuração não quebra venda, orçamento não apura. Cobrir integração: `flyway validate` com V37 + venda real com maquininha cadastrada.
- **qa-engineer (D-018):** novos casos — `importar_notaMista_umItemDoCatalogoOutroPreCadastrado`, `buscar_leituraPersistida_expoePreCadastradoNulo`, `fechamento_lancamentosPorVenda_ordenadosPorDataETotaisBatam`, `listarVendedores_retornaSomentePerfisDeVendaAtivosDaLoja` (e asserções novas nos tests existentes). Sugestão de integração: `GET /comissoes/vendedores` com FINANCEIRO logado e `preCadastrado` no payload do `POST /compras/importar-xml`.
- **qa-engineer (D-020):** novos casos — `OrdemServicoPagamentosResponseTest` (contrato pagamentos[], tri-state null, fallback de nome em lote, `verify(times(1))` da query em lote na página), `ComissaoServiceCancelarVendaTest` (PENDENTE→CANCELADO/PAGO intocado/no-op/R1), `OrdemServicoCancelamentoComissaoTest` e `VendaCancelamentoComissaoTest` (estorno plugado nos 2 caminhos, falha não quebra cancelamento). Integração sugerida: `flyway validate` com V40 + `POST /vendas/{id}/cancelar` em venda com comissão PENDENTE e conferir `GET /financeiro/comissoes/fechamento` sem a linha.
- **security-auditor (D-020):** `cancelarPorVenda` é operação de dinheiro disfarçada em fluxo de cancelamento (RBAC vem da rota `/vendas/**` já existente — sem endpoint novo); estorno é audítavel só por log INFO/WARN — se exigir trilha mais forte, cai no `log_auditoria` dedicado sugerido no D-019.
- **db-admin / devops-infra:** D-005 (1) e (2) (migrations V3-V10 / Postgres real) permanecem como o próximo marco estrutural. Nota (D-018): `docs/decisions.md` ficou com DOIS "D-017" (MDR do agente de ordemservico × estorno do agente OFX) — renumber pendente para o orquestrador.


## D-021 - Fase 3 (Financeiro V41): semântica exata de desconto/juros na baixa, reativação de fornecedor via UPDATE nativo e totais agregados SUM

**Contexto:** três pendências do §3.3: (1) baixa precisava registrar desconto concedido e
juros de mora; (2) `DELETE /fornecedores/{id}` era soft-delete sem volta; (3) as métricas do
hub eram calculadas no cliente sobre UMA página `size=100` — loja com mais títulos mentia no
topo da tela.

**Decisão:**
- **Desconto/juros (migration V41)**: o valor efetivamente abatido do `valor_aberto` é
  `valorPago + desconto` — desconto quita parte do título SEM dinheiro entrar (soma ao
  `valor_pago` agregado da conta, fonte da coluna GENERATED `valor_aberto`). `juros` NÃO
  altera `valor_aberto`: é receita extra que entra no caixa somada ao `valorPago`
  (movimento `ENTRADA/RECEBIMENTO_FIADO = valorPago + juros`). Validação:
  `valorPago + desconto <= saldoAberto`, `desconto/juros >= 0` (senão 400). Colunas
  `valor_desconto`/`valor_juros` em `conta_receber_pagamento` (nullable, DEFAULT 0, CHECK
  >= 0); observação da linha registra "desconto R$ X | juros R$ Y" quando > 0. Estorno é
  simétrico: devolve `valorPago + desconto` ao `valor_pago` da conta e tira
  `valorPago + juros` do caixa (ESTORNO).
- **Reativação**: `POST /financeiro/fornecedores/{id}/reativar`. O `@SQLRestriction
  ("ativo = true")` esconde inativos das queries derivadas — reativação e listagem com
  inativos usam queries NATIVAS (bypass) sempre escopando `loja_id` (R1 → 404 em vez de
  vazar existência). Flip é UPDATE nativo `SET ativo=true` (cifra CNPJ intocada); já ativo
  → sucesso idempotente; CNPJ hash em outro fornecedor ATIVO → 409 via
  `DataIntegrityViolationException` (mapeada pelo ProblemDetailHandler; índice único
  parcial da V34 já impede o par (loja, hash) duplicado — check é defesa em profundidade
  para drift manual). `GET ?incluirInativos=true` alimenta o toggle "Mostrar inativos".
- **Totais**: `GET /financeiro/totais?dataInicio&dataFim` — 5 somas `@Query SUM` no banco
  (a receber/a pagar EM ABERTO por vencimento no período, vencidos até HOJE
  (receber+pagar), saldoProjetado = aReceber − aPagar, recebido = SUM(valor_pago) das
  linhas ativas de `conta_receber_pagamento` na janela semiaberta [início, fim+1)).
  CANCELADO excluído; parcialmente pago soma só o aberto. Sem datas → mês corrente.
  Tela consome o endpoint com fallback gracioso para o cálculo legado por página.

**Consequência:** o topo do Financeiro reflete a base inteira, não a primeira página;
`conta_receber_pagamento` vira a fonte única da verdade por baixa (dinheiro × abatimento
× receita extra); DRE ganha insumo de recebimento real. Migration usa **V41** porque
V40 (`pagamento_parcelas`, módulo OS/comissão) já existia no disco — coordenação em
runtime entre agentes paralelos, sem dependência entre as duas.
