# VisionBox — Progresso e Evidências

> **Atualizado em:** 2026-10-10 — Fix crítico BeanCreationException no RastreioController (MeterRegistry via construtor) + Enforcement server-side alçada (P8) + Token rastreio US17. **232 testes verdes**
> **Estado legível por humano; máquina lê `.visionbox/state.json`**

## Fase 3.6 — Enforcement Alçada Server-Side & Rastreio US17 (2026-10-10)

| Frente | Status | Evidência |
|---|---|---|
| Ajustes UI: Layout 100% Altura, Sidebar Óculos & Carrinho PDV | ✅ Concluído | Remoção do zoom forçado que causava lacuna inferior; containers html/body/#root e layout ajustados para 100% da viewport (zero espaço em branco); Header h-14 + Footer h-9; Sidebar colapsa no logo de óculos; Carrinho enxuto e centralizado (Item, Cliente, input Qtd com botões +/-, Preço total); bloco 'Próximo passo' removido |
| Fix crítico inicialização Spring Boot | ✅ Concluído | `RastreioController` injeta `MeterRegistry` no construtor (removido `@PostConstruct` com parâmetro que impedia startup da API em prod), `RastreioControllerTest` (2/2) |
| P8 — Enforcement server-side de desconto | ✅ Concluído | `OrdemServicoService.criar` valida `desconto > 15%` com `AutorizacaoDescontoService` (BCrypt Gerente/Admin), `OrdemServicoDescontoTest` (3/3), `PDV.tsx` injeta `senhaAutorizacao` (D-011) |
| US17 — Token e Modal de Rastreio do Cliente | ✅ Concluído | `GET /api/v1/ordens-servico/{id}/rastreio-token`, `OrdemServicoResponse.tokenRastreio`, `OSDetail.tsx` (botão/modal Rastreio do Cliente PWA + envio WhatsApp `wa.me`), `OrdemServicoControllerTest` (2/2) |
| P6/P7 — Alçada de desconto no backend | ✅ Concluído | `POST /api/v1/autorizacoes-desconto`, `modules/seguranca/desconto/**`, PIN = senha BCrypt de GERENTE/ADMIN ativos da loja, `RateLimiterAlcada` em memória (15min/5), auditoria `log_auditoria`. **Sem migration** (D-010) |
| US13 — Conciliação OFX + DRE por loja/OS | ✅ Concluído | `V29__conciliacao_ofx.sql`, `OfxParser` (SGML/XML), `OfxConciliacaoService`, `OfxController`, `DREService`; ~46 testes |
| US11 — Fila de produção + CQ com foto | ✅ Concluído | `V28__producao_cq.sql`, `modules/producao/**`; `ProducaoService` reescrito pela orquestração |
| US16 — BI giro/margem/ABC | ✅ Concluído | `V30__relatorios_bi.sql` (índices), `modules/relatorios/**`, `ADR-006` (sem view materializada), `SecurityConfig` +`/api/v1/relatorios/**` |
| US17 — Portal do cliente PWA | ✅ Concluído | `RastreioPortal.tsx`, `lib/rastreioApi.ts`, `lib/pwa.ts`, `manifest.webmanifest`, `sw.js`, ícones; rotas `/rastreio[/:token]` |
| Observabilidade + CI | ✅ Concluído | `shared/metrics/SlaMetrics`, `LojaObservationConvention`, `ops/prometheus`, `ops/grafana`, `.github/workflows/ci.yml` (flyway-validate + web-build), `docker-compose.dev.yml`, `pom.xml` flyway-database-postgresql |
| US12/US14/US15 — Reescopo sob D-009 | ✅ Concluído (docs) | `docs/BACKLOG.md`, `docs/RISK_REGISTER.md` R3 — WhatsApp só link manual `wa.me` no MVP; auto (Cloud API) adiado pós-piloto |
| P1 — Migrations `V3–V10` ausentes | ⛔ **Bloqueado (draft pronto p/ db-admin)** | Não há `CREATE TABLE produto/marca/categoria/pedido_venda/item_pedido` em nenhum lugar; **V2 também referencia** `perfil`/`usuario`/`usuario_loja`/`sequencia_numeracao`/`fn_next_sequencia`/`fn_set_atualizado_em` inexistentes. **Draft de reconstrução em `docs/p1-migrations-draft/`** (`V1_1` fundação antes da V2 + `V3` catálogo + `V4` pedido_venda + `V5` colunas OS). Requer db-admin + Postgres real (sem Docker aqui) para validar |

**Validação:** `mvn clean test -Punit-only` → **232/232 verdes** · `npm run build` ✅ (22.8s) · `mvn -q -DskipTests compile` ✅

### P1 — Draft de reconstrução das migrations ausentes (2026-10-08)

> **NÃO são migrations prontas** — são especificação revisável para o **db-admin** validar em Postgres real. Ficam em `docs/p1-migrations-draft/` (fora de `db/migration/`).

| Arquivo | Versão | Conteúdo | Resolve |
|---|---|---|---|
| `V1_1__legacy_foundation.sql` | **1.1** | `fn_set_atualizado_em`, `sequencia_numeracao`+`fn_next_sequencia`, `perfil`, `usuario`, `usuario_loja` | quebra da **V2** num banco limpo (roda `1 < 1.1 < 2`, sem tocar na V2) |
| `V3__catalogo.sql` | 3 | `produto`, `marca`, `categoria` (SKU único parcial via `uq_produto_loja_sku_ativo`) | 3 das 5 tabelas sem `CREATE TABLE` |
| `V4__pedido_venda.sql` | 4 | `pedido_venda`, `item_pedido` | 2 tabelas restantes |
| `V5__ordem_servico_colunas.sql` | 5 | `ALTER ordem_servico ADD cliente_id/receita_id/armacao_id/lente_id/laboratorio_id` | colunas exigidas por `OrdemServico` e pelo BI |

**Decisões pendentes p/ db-admin** (ver `docs/p1-migrations-draft/README.md`): numeração final; `item_pedido` **sem `loja_id`** (viola R1); tabelas legadas `perfil`/`usuario_loja`; CHECK de `usuario.perfil` sem `DESENVOLVEDOR` na V13 (**bug latente** já corrigido no draft); aplicação em banco existente exige `flyway repair`. **Zero SQL executado** (máquina sem Docker).

## Fase 3 — Config Empresa + WhatsApp + Profile Desenvolvedor (Em Validação)

> **Objetivo:** Configurações da empresa (Loja), WhatsApp dinâmico (wa.me a partir do telefone da empresa), logo oficial no sidebar e perfil `DESENVOLVEDOR` com Painel Dev.

| Tarefa | Status | Evidência |
|---|---|---|
| Backend: Perfil `DESENVOLVEDOR` no enum + RBAC | ✅ Concluído | `Perfil.java`, `SecurityConfig` (empresa/** + dev/**), `V27__empresa_config.sql` (CHECK inclui DESENVOLVEDOR) |
| Backend: Config Empresa (Loja) — migration V27 + endpoint GET/PUT | ✅ Concluído | `V27__empresa_config.sql`, `modules/pessoa/empresaconfig/**` (`GET/PUT /api/v1/empresa`), `EmpresaConfigServiceTest` 6/6 |
| Backend: OS expõe `clienteNome`/`clienteWhatsapp` (wa.me do cliente) | ✅ Concluído | `OrdemServicoResponse` + `OrdemServicoService` enriquece single/lista sem N+1 (`findByLojaIdAndIdIn`) |
| Backend: Painel Dev Info | ✅ Concluído | `DevInfoController` (`GET /api/v1/dev/info`), sanitizado, fiscal provider por profile |
| Frontend: Painel Desenvolvedor (`/desenvolvedor` gated por perfil) | ✅ Concluído | `PainelDesenvolvedor.tsx` + rota lazy `/desenvolvedor` (DESENVOLVEDOR/ADMIN) |
| Frontend: Config Empresa em Configurações | ✅ Concluído | `components/config/EmpresaConfig.tsx` (nome/cnpj/contato/endereço/whatsapp/logo) no `ConfiguracoesDialog` (ADMIN/DESENVOLVEDOR) |
| Frontend: wa.me dinâmico (sidebar footer + OSDetail) | ✅ Concluído | `stores/empresaStore.ts` carrega `/v1/empresa`; footer usa `whatsappSuporteUrl()` com fallback |
| Frontend: logo oficial no sidebar (extrair para classe token) | ✅ Concluído | `Layout.tsx` classe `.vision-sidebar-logo` (silhueta branca) + `logo-icon.png` p/ estado colapsado |

**Validação Fase 3:** `mvn clean test -Punit-only` → **145/145 verdes** (era 126) · `npm run typecheck` ✅ · `npm run build` ✅ (1.85s, chunk `PainelDesenvolvedor` 6.69 kB)

## Fase 2 — PDV Repaginação & Financeiro Base (Em Andamento)

> **Objetivo:** Novo layout PDV 3-colunas, fluxo de pagamento multi-forma e base do módulo de Formas de Pagamento.

| Tarefa | Status | Evidência |
|---|---|---|
| Backend: Módulo FormaPagamento (Domain, Repo, Service, Controller) | ✅ Concluído | `modules/financeiro/formapagamento/**`, controller `/api/v1/financeiro/formas-pagamento` |
| DB: Migration V25__forma_pagamento.sql + Seeds | ✅ Concluído | `V25__forma_pagamento.sql` + RLS + 5 seeds (Dinheiro/PIX/Débito/Crédito/Crediário) |
| Frontend: PDV 3-colunas (Produtos \| Carrinho \| Resumo) | ✅ Concluído | `PDV.tsx` `.pdv-col-products`/`.pdv-col-cart` + `.pdv-summary`; CSS breakpoints 1439/1199/1100/760 |
| Frontend: Modal Finalizar Venda (Multi-pagamento) | ✅ Concluído | `FinalizarVendaModal.tsx` (saldo em tempo real, validação, múltiplas formas) |
| Backend: OrdemServico → Suporte a múltiplos pagamentos | ✅ Concluído | `OrdemServicoRequest.pagamentos`, `OrdemServicoPagamento`, `V26__ordem_servico_pagamento.sql` |
| Frontend: CRUD Formas Pagamento em Configurações | ✅ Concluído | `components/config/FormasPagamentoConfig.tsx` (listar/criar/editar/soft-delete) + seção no `ConfiguracoesDialog` |
| Backend: Testes FormaPagamentoService | ✅ Concluído | `FormaPagamentoServiceTest` 6/6 (padrão único, soft-delete, taxas/prazos, erros) |

**Validação:** `mvn test -Punit-only` → **126/126** verdes · `npm run typecheck` ✅ · `npm run build` ✅ · `mvn -DskipTests compile` ✅ <!--- no-break -->



| Indicador | Valor |
|---|---|
| **Fase atual** | `Execução Completa Concluída — Pronto para Piloto e Cliente` |
| **Build** | `mvn -q -DskipTests package` ✅ | `npm run build` ✅ (1.53s) |
| **Testes** | `mvn test` ✅: **125/125 testes verdes** |
| **Fiscal** | Flowbox Fiscal Provider (`D:\TECHBOXBR\PRODUTOS\Flowbox`) ✅ |
| **Importador** | CSV em lote de Catálogo & Clientes com validação e feedback ✅ |
| **Caixa Físico** | Sessão de Caixa (Abertura, Suprimento, Sangria, Fechamento cego) ✅ |
| **Alçada Desconto** | Alçada gerencial no PDV (> 15% exige PIN/Autorização de Supervisor) ✅ |
| **Portal Lab** | Portal público `/lab/:token` via HMAC `vlab1` para técnicos do laboratório ✅ |
| **API** | `http://localhost:8080` Swagger + `actuator/health` 200 |
| **Frontend** | `http://localhost:5173` / `http://localhost:8088` |
| **Auth** | `admin@visionbox.com.br` / `admin123` → JWT HS256 15m/7d |

## Backend — Contrato Receitas/Usuários/Produtos (2026-10-07)

> Escopo: corrigir `POST /api/v1/receitas` (retornava "Corpo da requisição inválido ou JSON malformado.")
> e validar CRUD de usuários e produtos de ponta a ponta. Só backend — `apps/web` não foi alterado.

| Área | Bug real (antes) | Correção | Evidência |
|---|---|---|---|
| Jackson | `JacksonConfig` injetava `ObjectMapper` cru e **substituía** o do Boot: `spring.jackson.*` do `application.yml` era config morta (`FAIL_ON_UNKNOWN_PROPERTIES=true`) → qualquer campo extra do payload (ex.: `tipoLente`) caía em 400 genérico | `mapper.disable(FAIL_ON_UNKNOWN_PROPERTIES)` no bean da aplicação | `JacksonConfig`, `ReceitaRequestJsonTest.camposDesconhecidosSaoIgnorados` |
| Payload receitas | `ReceitaRequest` não conhecia `tipoLente` e exigia `dataEmissao`/`dataValidade` (`@NotNull`), mas o frontend não envia datas e usa `tipoLente` | `@JsonAlias("tipoLente")`, datas viraram opcionais com default (hoje / hoje+2 anos) | `ReceitaRequest`, `ReceitaServiceTest.criarSemDatasDefaultaHojeMaisDoisAnos` |
| `dp` numérico | Frontend envia `"dp": 62` (número) para `String dp` → `MismatchedInputException` → 400 genérico | `LenientStringDeserializer` (número/bool/texto → String) | `shared/json/LenientStringDeserializer`, `ReceitaRequestJsonTest` |
| Mensagens de erro | Todo erro de leitura do Jackson virava "Corpo da requisição inválido ou JSON malformado." | `ProblemDetailHandler` desembrulha a causa: campo desconhecido / UUID (`clienteId inválido: informe o UUID do cliente.`) / tipo esperado; sem ecoar valor (LGPD) | `ProblemDetailHandler`, 4 testes em `ReceitaRequestJsonTest` |
| Domínio receita | Frontend envia `MONOFOCAL`; CHECK de `V2__cliente_receita.sql` aceita só `VISAO_SIMPLES` (→ 500 em Flyway) e `adicao: 0` em MONOFOCAL violava a regra "só MULTIFOCAL/BIFOCAL" (→ 400) | `normalizarTipo` (`MONOFOCAL→VISAO_SIMPLES`) + `normalizarGrau` (`adicao 0 → sem adição`) | `ReceitaServiceTest.criarMonofocalNormalizaTipoEAdicao` |
| Datas | `LocalDate.parse` solto → `DateTimeParseException` = 500 | parse com mensagem PT-BR (`yyyy-MM-dd`) → 400 | `ReceitaServiceTest.criarComDataInvalidaGeraMensagemLegivel` |
| Listagem receitas | Resposta sem `clienteNome` (UI precisa) e 1 query de cliente por receita (N+1) | `ReceitaResponse.clienteNome` + lookup em lote `findByLojaIdAndIdIn` | `ClienteRepository`, `ReceitaServiceTest.listarPreencheClienteNomeSemN1` |
| Soft-delete usuário | `Usuario` tinha `@SQLRestriction(ativo=true)`: inativos sumiam da lista (badge "Inativo" da UI nunca aparecia), `PATCH ativo` não reativava (404) e `existsByEmailAndLojaId` não via a linha inativa → INSERT estourava `uq_usuario_loja_email` = 400 "Registro duplicado" | `@SQLRestriction` removido de `Usuario` (login/refresh seguem com check explícito `isAtivo()` → `DisabledException`) | `Usuario.java`, `AuthController` |
| Soft-delete produto | Mesmo problema em `produto(loja_id, sku)`: excluir e recriar o mesmo SKU dava 400 "Registro duplicado" | Índice **parcial** `WHERE ativo = true` (unicidade só entre ativos) + `@Table` sem unique | `V21__unicidade_parcial_produto_sku.sql`, `Produto.java` |
| Catálogo | Frontend envia `?search=` e `?categoria=`; backend só aceitava `q` e não filtrava categoria (paginação/totais errados) | alias `search` + filtro `categoria` (rótulo → `TipoProduto`, fallback coluna texto) | `ProdutoController`, `ProdutoRepository.buscarFiltrado` |
| Produto | `custo` era `@NotNull` no DTO enquanto o service já defaulta `ZERO` | `@NotNull` removido de `custo` | `ProdutoRequest` |

| Verificação | Resultado |
|---|---|
| `mvn -q -DskipTests compile` | ✅ EXIT 0 |
| `mvn test` | ✅ **125/125** (13 de receitas/JSON, 112 pré-existentes, 0 falha) |
| `mvn test -Dtest=ReceitaServiceTest,ReceitaRequestJsonTest` | ✅ 13/13 |
| `mvn flyway:validate` / e2e HTTP | ⚠️ **não executados**: sem banco (portas 8080/5432 fechadas) e `docker` não instalado nesta máquina |

> **Pendências sinalizadas (não alteradas):** `db/migration` tem versões duplicadas
> (`V12` ×3 e `V15` ×2) → Flyway 10.20.1 falha com "Found more than one migration with version" no
> boot com Flyway ligado; e `V3–V10` (criação de `produto`, `marca`, `categoria`…) não existem no
> histórico. Itens para **db-admin** + **devops-infra** (ver `docs/decisions.md`).

## Frontend — Correção de Bugs (2026-10-07)

> Escopo: o cliente reportou "CRUD usuários não funciona", "CRUD produtos / +Novo produto não
> funciona", "nenhum botão do PDV funciona", "tema escuro com textos ilegíveis" e
> "Corpo da requisição inválido" ao salvar receita. Todos tratados + demais defeitos achados.

| Área | Bug real (antes) | Correção | Arquivo |
|---|---|---|---|
| **CRUD Usuários** | `usuarioSchema` exigia `lojaId` **UUID opcional** mas `defaultValues.lojaId = ''` → zod falhava silenciosamente e **todo submit era bloqueado** (nenhum erro visível) | `lojaId` removido do schema e dos defaults (o backend resolve pelo JWT) | `UserManagement.tsx` |
| **CRUD Usuários** | paginação com `total` inexistente + `alert()` em erro | `size = 20`, `unwrapPage`, `actionError` exibido no dialog, `ApiError` no catch, `OfflineBanner` | idem |
| **CRUD Produtos** | **não existia UI de CRUD**; botão `+Novo produto` sem `onClick`; SKU nunca podia ser editado | dialog criar/editar (SKU, nome, categoria, marca, custo, preço, estoque, NCM, EAN), dialog de exclusão, `saveMutation`/`deleteMutation` | `Catalogo.tsx` |
| **Catálogo** | filtro "Marca" era botão inerte; paginação `disabled` errado (`filtered.length < size`); `bg-white`/`border-gray-100` | input de marca com debounce (envia `?marca=`), `disabled` usa o conteúdo da página, tokens de cor | idem |
| **PDV** | Novo cliente / Ver dados / Novo produto / Orçamento / Mais ações sem `onClick`; `window.location.href`; filtro de categoria nunca aplicado; coluna Desconto fixa em `R$ 0,00` | 3 modais novos (`NovoClienteModal`, `DadosClienteModal`, `MaisAcoesModal`), `useNavigate`, filtro por categoria, desconto calculado | `PDV.tsx`, `components/pdv/*` |
| **Receitas** | `clienteId` era texto livre não-UUID → 400 do backend (D-002) | combobox com busca `GET /v1/clientes?nome=`, só envia UUID, chip selecionado e tratamento de `ApiError.problem.detail` | `Receitas.tsx` |
| **Financeiro** | `financeiroMutation` sem `onError` → falha silenciosa | `onError`/sucesso com estados visíveis (substitui `alert`) | `Financeiro.tsx` |
| **Tema escuro** | sidebar inteira com `--color-text-on-primary` (vira marrom escuro) sobre gradiente escuro → **invisível** | novo token `--color-sidebar-text` fixo branco | `theme-visionbox.css`, `index.css`, `Layout.tsx` |
| **Tema escuro** | botão "Finalizar" e formas de pagamento usavam `--color-login-button` (fixo marrom) com `--color-text-on-primary` (escuro no dark) → ilegível | novo token `--color-text-on-action` fixo branco | `theme-visionbox.css`, `index.css` |
| **Tema escuro** | `Button destructive` e badge de notificação com `text-white` sobre `--color-danger` (coral claro no dark) | novo token `--color-text-on-danger` | `button.tsx`, `Layout.tsx` |
| **Tema escuro** | cores da paleta Tailwind direto no fundo do card (`text-teal-700`, `text-indigo-600`, `bg-amber-50`, `text-gray-500`, `bg-[#E8DDD2]`) | convertidas para `var(--color-*)` | `LabPortal`, `OSDetail`, `ControleCaixaModal`, `AutorizacaoDescontoModal`, `PDV`, `DashboardKanban`, `Receitas` |
| **Tema escuro** | `<select>`/scrollbar nativos continuavam claros | `color-scheme: light` em `:root`, `color-scheme: dark` no dark | `theme-visionbox.css` |
| **Controles mortos** | sino (contador fixo "3"), Configurações (`<div>`), logout com ícone de chevron, "Filtros" em Dashboard/Clientes | sino lê a fila offline real; Configurações abre dialog com tema/conta; ícone `LogOut`; filtros funcionais | `Layout.tsx`, `DashboardKanban.tsx`, `Clientes.tsx` |
| **Alçada desconto** | `senha.length >= 4` aceitava **qualquer** PIN de 4+ caracteres | valida tamanho **e** lista de PINs, mensagens distintas | `AutorizacaoDescontoModal.tsx` |
| **Caixa** | `err.response?.data?.message` num client que rejeita com `ApiError` → sempre cacia; sem estado de carregamento | `mensagemErro()` sobre `ApiError.problem` + skeleton em `isLoading` | `ControleCaixaModal.tsx` |
| **OS detalhe** | sem `OfflineBanner` (todas as outras páginas têm) | banner adicionado | `OSDetail.tsx` |

| Verificação | Resultado |
|---|---|
| `npm run typecheck` | ✅ EXIT 0 |
| `npm run build` | ✅ EXIT 0 (code split, entry 241.53 kB / gzip 77.38 kB) |
| `mvn -q -DskipTests compile` | ✅ EXIT 0 |
| `mvn test -Dtest=ReceitaServiceTest,ReceitaRequestJsonTest` | ✅ 13/13 |
| `mvn test` (total) | ✅ **125/125** |
| Rodar a aplicação / `flyway:validate` | ⚠️ **não executados**: sem Docker/Postgres e portas 8080/5432 fechadas |

> **Restos conhecidos (fora deste passe):** `ComprovanteImpressao` mantém `bg-white`/`gray-*`
> de propósito (é papel de impressão); `Login.tsx` mantém a paleta fixa (não há toggle nessa rota);
> migração do PIN de alçada para backend (D-007).

## Execução Paralela — Especialistas (2026-09-05 20:55)

| Agente | Resultado | Evidência |
|---|---|---|
| **product-manager** | Plano M2 para piloto 2 óticas + backlog pós-MVP | `docs/PILOTO_M2.md`, `docs/BACKLOG.md` |
| **backend-engineer** | Endpoint `POST /api/v1/laboratorios/portal-tokens` com token `vlab1` HMAC stateless | `src/main/java/com/visionbox/modules/laboratorio/**`, `LabPortalTokenServiceTest` |
| **integration-engineer** | WhatsApp provider configurável `MOCK/ZAPI/META`, outbox `CRM_WHATSAPP`, retry/backoff/circuit settings | `src/main/java/com/visionbox/modules/crm/notificacao/**`, `application.yml` |
| **fiscal-engineer** | `SefazDiretoProvider` atrás do profile `sefaz-direto`; mock continua primário em dev/test/default | `src/main/java/com/visionbox/modules/fiscal/SefazDiretoProvider.java`, `SefazDiretoProviderTest` |
| **frontend-engineer** | Painel de prontidão M2 no Dashboard/Kanban e correção de build em Usuários | `apps/web/src/pages/DashboardKanban.tsx`, `UserManagement.tsx` |
| **qa-engineer** | Testes fiscal/outbox + smoke k6 fiscal + plano QA M2 | `FiscalServiceTest`, `MockFiscalProviderTest`, `OutboxMessageTest`, `docs/QA_M2.md` |
| **devops-infra** | Runbook deploy produção/piloto com rollback, backup e observabilidade | `docs/runbooks/deploy-producao.md` |
| **security-auditor** | **No-Go M2** por blockers de tenant, RLS, RBAC, register público, secrets/profile dev e token storage | relatório no histórico da orquestração |

## Hardening Segurança M2 — Aplicado (2026-09-05 21:12)

| Área | Resultado | Evidência |
|---|---|---|
| Tenant JWT-first | `TenantFilter` usa claim JWT como fonte primária; header divergente retorna `403`; header inválido retorna `400` | `TenantFilterTest` |
| Ordem do filtro | `TenantFilter` registrado após `BearerTokenAuthenticationFilter` e desabilitado como servlet filter duplicado | `SecurityConfig` |
| RLS runtime | `TenantRlsAspect` executa `set_config('app.loja_id', ..., true)` dentro de métodos `@Transactional` quando há `TenantContext` | `TenantRlsAspect` |
| RBAC por rota | JWT `perfil` vira `ROLE_*`; rotas críticas têm `hasRole/hasAnyRole` | `SecurityConfigTest` |
| Register produção | `/auth/register` falha fechado em `prod` quando `visionbox.auth.public-register-enabled=false` | `ProductionSecurityValidatorTest` |
| Profile/secrets prod | `application-prod.yml` exige `ddl-auto=validate`, Flyway ligado, register off; validator bloqueia secrets dev/default em `prod` | `ProductionSecurityValidatorTest` |
| Docker prod-first | Imagem Docker passa a usar `SPRING_PROFILES_ACTIVE=prod`; compose dev continua sobrescrevendo `dev` | `Dockerfile` |
| Token storage web | Tokens não são persistidos no `localStorage`; access fica em memória e refresh é ignorado no client até existir cookie HttpOnly | `authStore.ts`, `authSession.ts` |
| Grau clínico | Novas receitas gravam grau em `od_cipher/oe_cipher`; migration `V17` limpa colunas plain quando há cipher | `ReceitaServiceTest`, `V17__receita_grau_cipher_only.sql` |
| Logs/ProblemDetail | Hibernate bind TRACE removido; ProblemDetail usa tenant validado do contexto, não header bruto | `application.yml`, `ProblemDetailHandler` |
| Dependências web | Vite/React Router atualizados; `npm audit --audit-level=moderate` zerado | `package.json`, `package-lock.json` |

## Hardening Segurança M2 — Segunda Leva (2026-09-05 21:27)

| Área | Resultado | Evidência |
|---|---|---|
| Refresh HttpOnly | Refresh token saiu do contrato persistido em web storage e passou a usar cookie `vb_refresh` HttpOnly/SameSite; endpoint `/refresh` faz rotação persistida por `jti` hash e revoga cadeia suspeita | `AuthControllerTest`, `JwtTokenProviderTest`, `V18__usuario_refresh_token.sql` |
| Revogação de sessão | `/auth/logout` revoga refresh token armazenado e expira cookie | `AuthController` |
| Tenant no frontend | Web não injeta mais `X-Loja-Id` a partir de `localStorage`; tenant autenticado fica no claim JWT | `apps/web/src/lib/apiClient.ts` |
| RBAC negativo/positivo | Matriz inicial por rota validada com 23 testes MockMvc para perfis permitidos e negados | `SecurityConfigRbacRouteTest` |
| Segredo portal lab | Produção agora exige `VISIONBOX_LAB_PORTAL_TOKEN_SECRET`; não herda JWT secret como fallback em `prod` | `ProductionSecurityValidatorTest`, `application-prod.yml` |
| RLS real | Teste Testcontainers cobre policies, `FORCE RLS`, `app.current_loja_id()` e `set_config` via aspecto transacional; execução local bloqueada por Docker ausente | `IsolamentoTenantTest`, `docs/QA_M2.md` |

## Correção Produto/UX — Rotas Reais (2026-09-06 00:05)

| Área | Resultado | Evidência |
|---|---|---|
| Rotas OS | `/os` deixou de redirecionar para ID inventado; menu OS abre a fila real; detalhe `/os/:id` usa `GET /ordens-servico/{id}` | `App.tsx`, `Layout.tsx`, `OSDetail.tsx` |
| Usuários | `GET/POST/PUT/DELETE /api/v1/usuarios` criado no backend; tela usa `apiClient` autenticado | `UsuarioController`, `UsuarioService`, `UserManagement.tsx` |
| Financeiro | Tela deixou de exibir números mockados e consome `contas-receber` + `dre/mes-atual` | `Financeiro.tsx` |
| Performance web | Páginas carregadas sob demanda com `React.lazy`; entrada principal caiu para 224.95kB gzip 72.25kB | `App.tsx`, `npm run build` |
| UX operacional | Textos técnicos/placeholder removidos de PDV, Receitas e footer; indicador de sync lê outbox local real | `PDV.tsx`, `Receitas.tsx`, `Layout.tsx` |
| Mocks | Arquivo `lib/mocks.ts` removido; status OS separado em utilitário de domínio | `osStatus.ts` |

## Identidade Visual — Guia Aplicado (2026-09-06 00:25)

| Área | Resultado | Evidência |
|---|---|---|
| Paleta | Tokens oficiais migrados para marrom café, marrom escuro, areia clara, bege dourado, verde oliva e azul-acinzentado | `theme-visionbox.css`, `apps/web/src/styles/theme-visionbox.css`, `visionbox-guia-visual.md` |
| Tipografia | Interface configurada com Inter/Manrope e display com Sora/Poppins via tokens `--font-sans` e `--font-display` | `apps/web/index.html`, `tailwind.config.ts` |
| Consistência | Raio de cards alinhado em 8px e tema claro/escuro mantido por variáveis CSS, sem hex nos componentes | `theme-visionbox.css`, `apps/web/src/styles/theme-visionbox.css` |

## Correção Telas Operacionais — Aplicada (2026-09-06 00:55)

| Área | Resultado | Evidência |
|---|---|---|
| PDV/Catálogo | Produtos normalizados do contrato real do backend (`precoVenda`, `estoqueQuantidade`, `tipoProduto`), evitando tela branca por campo indefinido | `apps/web/src/lib/types.ts`, `PDV.tsx`, `Catalogo.tsx` |
| Catálogo → PDV | Botão "Adicionar ao PDV" navega para `/pdv?sku=...`; PDV pré-preenche busca do SKU | `Catalogo.tsx`, `PDV.tsx` |
| Clientes | Botões Ver/Editar/Excluir ligados a modais e endpoints reais `GET/PUT/DELETE /clientes`; edição preserva CPF mascarado sem exigir plain text | `Clientes.tsx` |
| Receitas | "Importar" abre fluxo de nova receita com anexo; filtro real por "Todas/Com anexo/Sem anexo"; DTO de grau normalizado | `Receitas.tsx`, `types.ts` |
| Financeiro | Tela ampliada com contas a receber, contas a pagar, crediário, receita, custos/comissão, abas e ações baixar/cancelar | `Financeiro.tsx` |
| Usuários/Layout | Menu "Administrativo"; perfis visíveis reduzidos aos perfis operacionais atuais; suporte WhatsApp com hyperlink | `UserManagement.tsx`, `Layout.tsx` |
| Resiliência UI | ErrorBoundary por rota lazy para não deixar tela branca em erro de render | `App.tsx`, `components/ui/error-boundary.tsx` |

## Limpeza de Dados Fictícios e Dashboard — Aplicada (2026-09-06 21:20)

| Área | Resultado | Evidência |
|---|---|---|
| Seeds | `data.sql` e `db/seed.sql` não inserem mais clientes, produtos, OS, estoque ou financeiro fictícios | `src/main/resources/data.sql`, `src/main/resources/db/seed.sql` |
| Bancos novos/existentes | Migration `V19` inativa apenas os UUIDs/e-mails/SKUs fixos do antigo seed demo histórico, preservando loja/admin | `V19__remove_demo_seed_data.sql` |
| OS/Financeiro | Cálculo de OS não usa mais valores padrão inventados para SKU/produto ausente; conta a receber só nasce com preço real localizado | `OrdemServicoService.java` |
| Dashboard | SLA no prazo deixou de ser número fixo e passou a ser calculado pelas OS abertas carregadas; cliente HTTP envia `X-Loja-Id` persistido como fallback ao JWT para evitar tenant ausente | `DashboardKanban.tsx`, `apiClient.ts` |

## Ajuste Visual por Referência — Aplicado (2026-09-07 00:00)

| Área | Resultado | Evidência |
|---|---|---|
| Login | Tela redesenhada com painel visual lateral, logo VisionBox, campos com ícones, senha exibível e acabamento inspirado na referência | `apps/web/src/pages/Login.tsx`, `apps/web/public/assets/visionbox-logo.png` |
| Layout | Sidebar café com marca grande, navegação densa, suporte WhatsApp e topbar clara com busca global/operador | `apps/web/src/components/Layout.tsx` |
| Dashboard | Rota `/` virou dashboard operacional com métricas, alerta de atraso, gráfico por 7 dias, painel visual e tabela de últimas OS; `/os` mantém Kanban real | `apps/web/src/pages/DashboardKanban.tsx` |
| PDV | Frente de caixa reorganizada em cliente/produto/carrinho à esquerda e resumo/pagamento/finalização à direita, mantendo outbox/offline e atalhos | `apps/web/src/pages/PDV.tsx` |
| Build/Smoke | `npm run build` verde; preview local retornou HTTP 200 e foi encerrado | `apps/web/dist` |

## Correção de Fidelidade Visual — Aplicada (2026-09-07 00:20)

| Área | Resultado | Evidência |
|---|---|---|
| Login | Painel esquerdo passou a usar a foto real `1.png` como fundo, preservando a composição escura/textual da referência | `apps/web/src/pages/Login.tsx`, `apps/web/public/assets/login-optica.png` |
| Sidebar | Removido logo PNG invertido; marca reconstruída com símbolo/wordmark claro, navegação maior e fundo café em gradiente próximo às imagens | `apps/web/src/components/Layout.tsx` |
| Topbar | Busca global removida da barra superior; PDV exibe título centralizado na topbar como a referência | `apps/web/src/components/Layout.tsx`, `apps/web/src/pages/PDV.tsx` |
| Build | `npm run build` verde após correção | `apps/web/dist` |

## Correção de Altura do Login — Aplicada (2026-09-07 00:35)

| Área | Resultado | Evidência |
|---|---|---|
| Login | Removida altura mínima fixa de 720px; paddings, logo, campos e rodapé agora respondem à altura do viewport para caber em 100% de zoom | `apps/web/src/pages/Login.tsx` |
| Build | `npm run build` verde após ajuste | `apps/web/dist` |

## Correção Estrutural do Login — Aplicada (2026-09-07 00:50)

| Área | Resultado | Evidência |
|---|---|---|
| Login | Foto `1.png` agora ocupa o fundo inteiro; painel esquerdo translúcido e card de login direito ficam sobrepostos, como na referência | `apps/web/src/pages/Login.tsx` |
| Tokens | Adicionados tokens RGB para aplicar opacidade sem hard-code nos componentes | `theme-visionbox.css`, `apps/web/src/styles/theme-visionbox.css` |
| Build | `npm run build` verde após ajuste | `apps/web/dist` |

## Login por Especificação Dedicada — Aplicado (2026-09-07 01:05)

| Área | Resultado | Evidência |
|---|---|---|
| Login | Ajustado para a composição 57%/43% da especificação: foto full-screen, overlay marrom graduado à esquerda, card creme à direita | `visionbox-especificacao-tela-login.md`, `apps/web/src/pages/Login.tsx` |
| Cores/ícones | Textos em creme/bege da spec; benefícios com círculo marrom translúcido e ícones lineares claros | `theme-visionbox.css`, `apps/web/src/styles/theme-visionbox.css` |
| Formulário | Inputs 68px/radius 13px, botão café, separador `OU` e botão `Entrar com QR Code` adicionados | `apps/web/src/pages/Login.tsx` |
| Build | `npm run build` verde após ajuste | `apps/web/dist` |

## Login 100% Zoom — Aplicado (2026-09-07 01:20)

| Área | Resultado | Evidência |
|---|---|---|
| Login | Adicionados breakpoints por altura para monitores menores: logo, inputs, botão, espaçamentos e decoração reduzem abaixo de 900px de altura | `apps/web/src/pages/Login.tsx` |
| Conteúdo secundário | Separador/QR e textos auxiliares são ocultados em alturas muito baixas para evitar necessidade de zoom 80% | `apps/web/src/pages/Login.tsx` |
| Build | `npm run build` verde após ajuste | `apps/web/dist` |

## Login Sem Scrollbar — Aplicado (2026-09-07 02:20)

| Área | Resultado | Evidência |
|---|---|---|
| Login | Classes inválidas de breakpoint por altura foram substituídas por CSS real em `@media (max-height: 860px)` | `apps/web/src/pages/Login.tsx`, `apps/web/src/styles/index.css` |
| Scroll | `.login-page` agora usa `position: fixed; inset: 0; height: 100vh; overflow: hidden`, impedindo scrollbar em 100% | `apps/web/src/styles/index.css` |
| Build | `npm run build` verde após ajuste | `apps/web/dist` |

## Login Refinado por Print — Aplicado (2026-09-07 02:30)

| Área | Resultado | Evidência |
|---|---|---|
| Login | Removidos separador `OU`, botão `Entrar com QR Code` e rodapé do painel direito conforme marcação visual | `apps/web/src/pages/Login.tsx` |
| Painel esquerdo | Texto inferior `VISÃO PARA GRANDES CONQUISTAS` volta a aparecer no modo compacto | `apps/web/src/styles/index.css` |
| Formulário | Inputs, botão e logo do modo compacto aumentados para não ficarem pequenos em 100% | `apps/web/src/styles/index.css` |
| Build | `npm run build` verde após ajuste | `apps/web/dist` |

## Login Inputs/Footer — Aplicado (2026-09-07 02:31)

| Área | Resultado | Evidência |
|---|---|---|
| Rodapé | `Desenvolvido por TechboxBR 2026` restaurado e centralizado no painel direito | `apps/web/src/pages/Login.tsx`, `apps/web/src/styles/index.css` |
| Campos | Padding dos inputs de usuário/senha corrigido com seletor específico da tela, evitando texto sobreposto aos ícones | `apps/web/src/styles/index.css` |
| Senha | Campo de senha ganhou espaçamento próprio para o botão de visualizar à direita | `apps/web/src/pages/Login.tsx`, `apps/web/src/styles/index.css` |
| Build | `npm run build` verde após ajuste | `apps/web/dist` |

## PDV por Especificação Dedicada — Aplicado (2026-09-07 02:48)

| Área | Resultado | Evidência |
|---|---|---|
| Shell | Sidebar, topbar e footer ajustados às proporções e hierarquia da referência do PDV | `apps/web/src/components/Layout.tsx` |
| PDV | Tela reestruturada em Cliente, Produto/SKU, Carrinho e Resumo da venda fixo à direita | `visionbox-especificacao-pdv.md`, `apps/web/src/pages/PDV.tsx` |
| Visual | Camada `pdv-*` adicionada para dimensões, densidade, bordas, cards, tabela, pagamento, total e responsividade desktop-first | `apps/web/src/styles/index.css`, `apps/web/src/styles/theme-visionbox.css` |
| Fluxo | Mantidas queries reais, carrinho, desconto, pagamento, finalização de OS e outbox offline; removidos atalhos extras fora da referência | `apps/web/src/pages/PDV.tsx` |
| Build/Smoke | `npm run build` verde; `http://localhost:5173/pdv` respondeu `200` no Vite local ativo | `apps/web/dist` |

## Sidebar PDV — Refinada (2026-09-07 10:38)

| Área | Resultado | Evidência |
|---|---|---|
| Sidebar | Logo reduzido, itens compactados, contraste dos inativos corrigido e badge `F8` alinhada ao item PDV | `apps/web/src/components/Layout.tsx` |
| Ativo | `Dashboard` recebeu `end` para não marcar ativo fora da rota raiz; ativo fica apenas na rota atual | `apps/web/src/components/Layout.tsx` |
| Build | `npm run build` verde após ajuste | `apps/web/dist` |

## Sidebar PDV — Contraste Corrigido (2026-09-07 10:42)

| Área | Resultado | Evidência |
|---|---|---|
| Textos | Links, labels e ícones da sidebar agora usam branco puro com classe dedicada e regra específica | `apps/web/src/components/Layout.tsx`, `apps/web/src/styles/index.css` |
| Badge | Badge `F8` preservada em bege com texto escuro, sem herdar o branco dos links | `apps/web/src/components/Layout.tsx`, `apps/web/src/styles/index.css` |
| Build | `npm run build` verde após ajuste | `apps/web/dist` |

## PDV Escala/Collapse — Aplicado (2026-09-07 10:51)

| Área | Resultado | Evidência |
|---|---|---|
| Sidebar | Adicionado collapse persistido em `localStorage`, com largura compacta e botão abrir/recolher | `apps/web/src/components/Layout.tsx` |
| Topbar | Título `PDV - Frente de caixa` reduzido e forçado para `--font-sans`, centralizado no painel principal | `apps/web/src/components/Layout.tsx` |
| Escala | PDV compactado: padding, cards, inputs, carrinho, resumo, pagamento, botão finalizar e ações inferiores reduzidos para caber melhor em 100% | `apps/web/src/styles/index.css` |
| Build/Smoke | `npm run build` verde; `http://localhost:5173/pdv` respondeu `200` | `apps/web/dist` |

## PDV Contraste/PIX — Corrigido (2026-09-07 10:59)

| Área | Resultado | Evidência |
|---|---|---|
| Contraste | Estados ativos em marrom escuro agora forçam texto e ícones em branco: categorias, desconto, pagamento e finalizar | `apps/web/src/styles/index.css` |
| PIX | Ícone de dólar removido; botão PIX usa símbolo próprio em losangos no mesmo estilo linear | `apps/web/src/pages/PDV.tsx` |
| Build | `npm run build` verde após ajuste | `apps/web/dist` |

## Blockers Go-Live M2

| Severidade | Item | Status |
|---|---|---|
| Crítica | `X-Loja-Id` não pode prevalecer sobre claim JWT; divergência deve gerar `403` | Fechado em unit |
| Crítica | Implementar `SET LOCAL app.loja_id`/`set_config` para RLS real por transação/conexão | Implementado e coberto por teste; execução local bloqueada por Docker ausente |
| Crítica | Aplicar autorização por recurso/perfil (`@PreAuthorize`/authorities) | Fechado por RBAC de rota; matriz fina por recurso fica pós-gate |
| Crítica | Fechar `/api/v1/auth/register` público em produção ou exigir convite/admin | Fechado em prod profile |
| Alta | Produção não pode herdar profile `dev`, `ddl-auto:create`, Flyway desligado ou secrets fallback | Fechado em config/validator; falta teste em ambiente prod real |
| Alta | Refresh token deve sair do `localStorage` e ir para cookie `HttpOnly Secure SameSite` | Fechado: cookie HttpOnly, rotação persistida, logout/revogação |
| Alta | Grau clínico plain deve ser removido, cifrado como fonte primária ou justificado formalmente antes de dado real | Fechado para novos writes; migration limpa dados com cipher |

## Funcionalidades Entregues (MVP Spec §8 Fase 1–3)

| Módulo | Espec § | Status | Evidência |
|---|---|---|---|
| **Auth JWT** | §7 | ✅ | HS256 15m/7d httpOnly, RBAC ADMIN/GERENTE/VENDEDOR/OTICO/TECNICO/FINANCEIRO/LABORATORIO, RLS tenant |
| **Cliente** | §4.2 | ✅ | CPF AES-GCM + HMAC, ViaCEP, consentimento_recall, score recompra, mascarado `***` |
| **Receita Clínica** | §4.3 | ✅ | GrauOlho (esf/cil/eixo/ad/DP), validação cil≠0→eixo, tipo lente, anexo S3 presigned 8MB, data_validade recall |
| **Catálogo** | §4.4 | ✅ | Single-table ARMACAO/LENTE, NCM/CEST/CFOP/CBENEF, tributacao_regra, pg_trgm busca |
| **OS 12 Estados** | §4.5 | ✅ | 12 estados + ramos, TransicaoOSRegistry valida, EventoOS auditável, Timeline semáforo |
| **Estoque** | §4.8 | ✅ | Reserva/baixa/estorno automático OS, EstoqueLote recall lote/validade, transferência multi-loja |
| **Financeiro** | §4.6 | ✅ | ContaReceber/ContaPagar, DRE (receita-custo-comissão 5%), Pix tPag=17, parcelas |
| **Fiscal** | §6.8 | ✅ | MockFiscalProvider NFC-e 65/NF-e 55 autorizado, contingência tpEmis=9, tributacao_regra NCM+UF+CRT |
| **SLA/Recall** | §6.2 | ✅ | SLA job 1min Quartz `/atrasadas`, Recall consentimento_recall job 30d |
| **Outbox/Idempotency** | §6.8 | ✅ | PDV offline-first, Idempotency-Key, outbox_message, RabbitMQ ready |
| **Multi-tenant** | §3 | ✅ | `loja_id` NOT NULL + RLS FORCE + TenantFilter X-Loja-Id/JWT claim |
| **Frontend** | §6 | ✅ | Login/Clientes/Receitas/Catálogo/PDV/Kanban/Financeiro/Usuários (ADMIN), TanStack Query, TanStack Router, shadcn+Tailwind tokens |

## Build & Testes

| Item | Status |
|---|---|
| `mvn -DskipTests compile` | ✅ BUILD SUCCESS (126 sources) |
| `npm run build` | ✅ entrada principal 227.18kB gzip 73.17kB; páginas em chunks sob demanda |
| `mvn test -Dtest=StatusOSTransicaoTest,CpfConverterTest` | ✅ 51/51 passed |
| `mvn test -Punit-only -Dtest=StatusOSTransicaoTest,CpfConverterTest,LabPortalTokenServiceTest,SefazDiretoProviderTest,FiscalServiceTest,MockFiscalProviderTest,OutboxMessageTest` | ✅ 69/69 passed |
| `mvn test -Punit-only` | ✅ 107/107 passed |
| `npm audit --audit-level=moderate` | ✅ 0 vulnerabilities |
| `mvn test -Dtest=IsolamentoTenantTest` | ⚠️ implementado/compila; execução local bloqueada porque `docker` não está instalado |

## Endpoints Principais (API Real)

```
POST   /api/v1/auth/login              → JWT HS256
POST   /api/v1/auth/register           → cria loja+admin
GET    /api/v1/auth/me                 → perfil logado
GET    /api/v1/clientes                → paginado + filtros
POST   /api/v1/clientes                → cria (cpf AES-GCM + hash)
GET    /api/v1/receitas                → paginado + upload anexo S3
POST   /api/v1/receitas                → GrauOlho validação
GET    /api/v1/produtos                → busca pg_trgm + filtros NCM
POST   /api/v1/ordens-servico          → cria OS + reserva estoque + ContaReceber
GET    /api/v1/ordens-servico          → Kanban 5 cols + filtros status
PATCH  /api/v1/ordens-servico/{id}/status → TransicaoOSRegistry + EventoOS
GET    /api/v1/ordens-servico/atrasadas → SLA atrasadas
GET    /api/v1/crm/recall?dias=30      → recall consentimento_recall
POST   /api/v1/laboratorios/portal-tokens → token portal laboratório `vlab1`
GET    /api/v1/financeiro/contas-receber → DRE /api/v1/financeiro/dre
POST   /api/v1/fiscal/nfce/emitir      → MockFiscalProvider NFC-e
GET    /api/v1/usuarios (ADMIN)        → CRUD usuários + Roles
```

## Bootstrap Inicial

```sql
loja 00000000-0000-0000-0000-000000000001 (VisionBox Matriz)
admin@visionbox.com.br / admin123  (BCrypt) — ADMIN
clientes/produtos/OS/estoque/financeiro: cadastrados via UI/API, sem seed ficticio
```

## Pendências (Não Bloqueantes — Pós-MVP)

| Item | Espec | Prioridade |
|---|---|---|
| Notificação WhatsApp real (Z-API/Meta) | §6.2 | P2 — contrato/provider mock pronto |
| Lab API real (surfaçagem) | §6.2 | P2 — token portal inicial pronto |
| Portal Cliente PWA | §6.3 | P3 |
| WebAR prova virtual (MediaPipe) | §6.4 | P3 |
| Assinatura lentes recorrente | §6.5 | P3 |
| Fiscal NFC-e real Sefaz (SefazDiretoProvider) | §6.8 | P2 — stub/profile pronto, homologação pendente |
| Multi-loja transferência estoque + DRE consolidado | §6.3 | P2 |
| App mobile nativo | §6.4 | P4 |

## Evidências

| Item | Link |
|---|---|
| Spec canônica | `visionbox-especificacao.md:1` |
| Tokens UI | `theme-visionbox.css:6` |
| Plano executivo | `arquivo.md:1` |
| ADRs | `docs/adrs/ADR-001..005.md` |
| Testes | `mvn test -Dtest=StatusOSTransicaoTest,CpfConverterTest` → 51/51 |
| Testes M2 focados | `mvn test -Punit-only ...` → 71/71 |
| Hardening M2 | `mvn test -Punit-only` → 107/107 + `npm audit` → 0 |
| Build | `mvn -q -DskipTests package && npm run build` → ✅ |
| Plano M2 | `docs/PILOTO_M2.md:1` |
| QA M2 | `docs/QA_M2.md:1` |
| Deploy produção | `docs/runbooks/deploy-producao.md:1` |

---

> **Atualize** `state.json` + `PROGRESS.md` a cada entrega. Próximo marco: rodar Testcontainers/Flyway/RLS real e reauditar Go-Live M2.
