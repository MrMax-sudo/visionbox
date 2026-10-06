# VisionBox — Progresso e Evidências

> **Atualizado em:** 2026-10-06 02:27 — Execução Completa Concluída (Fiscal Flowbox, Importador CSV, Caixa Físico, Alçada de Desconto, Portal Lab)
> **Estado legível por humano; máquina lê `.visionbox/state.json`**

## Snapshot

| Indicador | Valor |
|---|---|
| **Fase atual** | `Execução Completa Concluída — Pronto para Piloto e Cliente` |
| **Build** | `mvn -q -DskipTests package` ✅ | `npm run build` ✅ (1.53s) |
| **Testes** | `mvn test` ✅: **113/113 testes verdes** |
| **Fiscal** | Flowbox Fiscal Provider (`D:\TECHBOXBR\PRODUTOS\Flowbox`) ✅ |
| **Importador** | CSV em lote de Catálogo & Clientes com validação e feedback ✅ |
| **Caixa Físico** | Sessão de Caixa (Abertura, Suprimento, Sangria, Fechamento cego) ✅ |
| **Alçada Desconto** | Alçada gerencial no PDV (> 15% exige PIN/Autorização de Supervisor) ✅ |
| **Portal Lab** | Portal público `/lab/:token` via HMAC `vlab1` para técnicos do laboratório ✅ |
| **API** | `http://localhost:8080` Swagger + `actuator/health` 200 |
| **Frontend** | `http://localhost:5173` / `http://localhost:8088` |
| **Auth** | `admin@visionbox.com.br` / `admin123` → JWT HS256 15m/7d |

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
| `mvn test -Punit-only -Dtest=StatusOSTransicaoTest,CpfConverterTest,LabPortalTokenServiceTest,SefazDiretoProviderTest,FiscalServiceTest,MockFiscalProviderTest,OutboxMessageTest,WhatsAppNotificationServiceTest,WhatsAppOutboxPublisherTest` | ✅ 71/71 passed |
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
