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

## Sinalizações para outros agentes

- **security-auditor:** remoção de `@SQLRestriction` em `Usuario` depende do check `isAtivo()`
  em `AuthController` (login + refresh). Vale um teste de segurança: conta desativada não deve
  obter refresh nem logar; token de acesso já emitido segue válido até expirar (15 min) — aceito,
  mas registrar.
- **qa-engineer:** pontos de teste em `ReceitaRequestJsonTest` (7 casos: payload real do frontend,
  campo desconhecido, UUID inválido, tipo errado, JSON malformado) e `ReceitaServiceTest`
  (+5 casos: default de datas, normalização MONOFOCAL, data inválida, tipo inválido, `clienteNome`
  sem N+1). E2E HTTP e `flyway validate` pendentes de ambiente com Postgres.
- **db-admin / devops-infra:** D-005 (1) e (2).

