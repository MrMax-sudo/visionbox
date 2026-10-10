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

## Sinalizações para outros agentes

- **security-auditor:** (1) P8 concluiu enforcement server-side de alçada de desconto em `OrdemServicoService.criar`; (2) token de rastreio público stateless `rpub1` opera com HMAC-SHA256 e expiração de 30 dias.
- **qa-engineer:** suíte ampliada para 230 testes com `OrdemServicoDescontoTest` e `OrdemServicoControllerTest`.
- **db-admin / devops-infra:** D-005 (1) e (2) (migrations V3-V10 / Postgres real) permanecem como o próximo marco estrutural.

