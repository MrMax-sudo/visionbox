# VisionBox — Progresso e Evidências

> **Atualizado em:** 2026-10-15 — **Orçamentos no PDV (CRUD/Carregar), Prazo de Entrega Estipulado na OS, Central de Notificações de OS Atrasadas/Sem Movimentação, Preview 1:1 de Documentos e Correção da Timeline Concluídos** ✅. Suíte de testes e Build Frontend (Vite) 100% verdes.

## Melhorias de Orçamentos, Prazo de OS, Notificações e Layout de Timeline (2026-10-15, ✅ concluído)

| Item | Solicitação | Solução Implementada | Evidência / Status |
|---|---|---|---|
| **Timeline da OS** | Correção do layout com bolinha do semáforo sobreposta ao badge de data/hora (`13/10/2026, 16:55`). | Substituído posicionamento absoluto solto por coluna vertical flex dedicada (`items-start gap-3.5`), círculo protetor centrado `h-5 w-5 bg-card border border-border` e linha conectora vertical fluida `w-0.5 grow bg-border my-1`. Zero sobreposição. | `OsTimeline.tsx` ✅ |
| **Preview de Documentos** | Preview incorreto nos tipos A4 vs 80mm em `ComprovanteImpressao.tsx`. | Renderizador dinâmico isolado via `iframe` (`srcDoc={htmlDocument}`) com suporte aos templates oficiais: Proposta Comercial A4, DANFE A4, NFC-e 80mm e Recibo Térmico 80mm com proporções fiéis e dados da empresa. | `ComprovanteImpressao.tsx`, `reciboPrint.ts` ✅ |
| **Orçamentos (CRUD e PDV)** | CRUD de orçamentos criados, detalhes, botão carregar no PDV e persistência de status no banco. | `Orcamentos.tsx` reformulado com ações: Visualizar Detalhes (modal rico), Carregar no PDV (`/pdv?orcamentoId=...`), Editar Orçamento, Excluir e Imprimir A4. Endpoints `PUT` e `DELETE /api/v1/orcamentos/{id}` criados no backend. O PDV carrega cliente, itens e descontos e converte o status para `CONVERTIDO` na venda. | `Orcamentos.tsx`, `PDV.tsx`, `OrcamentoController.java`, `OrcamentoService.java` ✅ |
| **Prazo da OS pelo Usuário** | Prazo de entrega estipulado pelo próprio usuário do sistema para exatidão. | Campo `datetime-local` no modal de finalização de venda do PDV (`FinalizarVendaModal.tsx`); botão e modal de "Alterar Prazo" no cabeçalho da OS (`OSDetail.tsx`) disparando `PATCH /v1/ordens-servico/{id}/previsao-entrega` com motivo auditável na timeline e reflexo em tempo real no portal do cliente. | `FinalizarVendaModal.tsx`, `OSDetail.tsx`, `OrdemServicoController.java` ✅ |
| **Notificações de OS** | Notificar OS atrasadas ou sem movimentação há mais de 1 dia. | Endpoint `GET /api/v1/ordens-servico/alertas` que identifica OS com prazo vencido e OS paradas > 24h sem evento. O `NotificationBell` em `Layout.tsx` exibe badge vermelho pulsante e popover detalhado com atalhos diretos para cada OS. | `Layout.tsx`, `OrdemServicoRepository.java`, `OrdemServicoService.java` ✅ |


## Ajustes de Usabilidade, Governança de Roles e Documentos (2026-10-15, ✅ concluído)

> **Resumo da Entrega:** Implementação dos ajustes solicitados pelo usuário cobrindo arquitetura de navegação, RBAC, persistência de identidade visual e fidelidade aos templates oficiais de documentos.

| Item | Solicitação | Solução Implementada | Evidência / Status |
|---|---|---|---|
| **Sidebar & Submenus** | Ordem: Dashboard, PDV, Operacional (Receitas, OS), Financeiro (Caixas, Vendas, Compras, Maquininhas, Comissões), Estoque (Catálogo), Administrativo (Usuários, Fiscal, Painel Dev, Configurações). Ocultar se módulo inativo no Painel Dev. | Submenus colapsáveis padronizados (incluindo Administrativo com abertura de modal de Configurações); cor clara corrigida no tema Light (`bg-card`, `border-border`, texto `text-foreground`); atalho F4 removido do PDV. | `Layout.tsx`, `App.tsx`; build Vite ✅ |
| **Ícone do Pix (PDV)** | Ícone do Pix distorcido no painel de pagamento. | Substituído pelo SVG vetorial oficial do Banco Central do Brasil. | `ResumoVendaPanel.tsx` ✅ |
| **Indicador "Online"** | Desnecessário se está operando normal na web. | Removido indicador redundante da sidebar e barra superior (mantido apenas alerta reativo quando offline ou sincronizando). | `Layout.tsx` limpo |
| **Identidade Visual & Scroll** | Logo maior na sidebar; camuflar barra de rolagem. | Largura do logo ampliada para 175px (expandido) e 44px (recolhido); classe `.scrollbar-none` adicionada ao CSS e sidebar. | `index.css` e `Layout.tsx` ✅ |
| **Templates de Documentos** | Seguir estritamente `templates recibos` e invocar a logo persistida no banco (`/api/v1/empresa/logo.png`). | `reciboPrint.ts` reimplementado com os 4 templates (Recibo 80mm com marca óptica SVG, NFC-e 80mm, DANFE A4 oficial e Orçamento A4 luxo). Todos invocam `/api/v1/empresa/logo.png`. | `reciboPrint.ts`, `ComprovanteImpressao.tsx`, `DetalhesVendaModal.tsx` |
| **Fluxo de Orçamentos no PDV** | Ao clicar em Orçamento no PDV, gerar proposta comercial A4 sem vincular a fiscal/SEFAZ. | `PDV.tsx` gera orçamento com código único (`ORC-...`), seta `tipoDocumento: 'ORCAMENTO'`, e abre modal com visualização direta do Orçamento A4 e emissão fiscal suprimida. | `PDV.tsx`, `VendaConcluidaDialog.tsx`, `ComprovanteImpressao.tsx` ✅ |
| **Configurações & Empresa** | Remover UUID cru de loja em preferências; adicionar upload de logotipo persistido no banco; remover aba A1 duplicada de Configurações. | Substituted UUID por Nome Fantasia da loja; componente de upload/revisão com preview e persistência (`V50__loja_logo_base64.sql`, `POST /api/v1/empresa/logo`, `GET /api/v1/empresa/logo.png`). Aba Fiscal A1 removida do diálogo de configurações. | V50 aplicada, `EmpresaController.java`, `EmpresaConfig.tsx` |
| **Texto /fiscal** | Remover menção a "outbox" institucionalmente. | Atualizado para texto de segurança institucional do VisionBox. | `FiscalConfig.tsx`, `PilotReadinessPanel.tsx` |
| **Receitas (CRUD)** | Faltava CRUD completo de receitas. | Criado CRUD completo com listagem, busca, filtros de anexo, criação, edição com pré-preenchimento e exclusão com diálogo de confirmação. | `Receitas.tsx`, `ReceitaCard.tsx`, `ReceitaFormDialog.tsx` |
| **Roles & Segurança** | Admin: tudo exceto DEV; Desenvolvedor: DEV, Usuários, Fiscal; Fiscal somente Admin e Desenvolvedor. | Atualizada matriz de rotas do `SecurityConfig.java`, testes `SecurityConfigRbacRouteTest.java` e guardas de rota do React. | 42 testes backend ✅ (`BUILD SUCCESS`), frontend build ✅ |

## Flowbox — Escopo de API key por CNPJ (multi-cliente) (2026-10-15, ✅ concluída)

> **Pedido do cliente:** "adicione o escopo sim, iremos ter vários clientes". Hoje qualquer API key válida opera em qualquer CNPJ (`README.md:525`); o container é único e o isolamento só é por coluna `cnpj`.

| Decisão (validada com o cliente) | Escolha |
|---|---|
| Quem vincula CNPJ ao usuário | **Admin provisiona por API** — endpoints novos `GET/POST/DELETE /api/v1/admin/usuarios/**` (ROLE_ADMIN); registro público continua, conta nova fica sem escopo até vincular |
| Usuário sem nenhum CNPJ vinculado | **Nega tudo** (403 fail-closed) — listagem sem `cnpj` explícito devolve 200 vazio; detalhe/emissão/`?cnpj=` fora do escopo → 403 `ESCOPO_NAO_PERMITIDO` |
| Abrangência da validação | **Núcleo fiscal**: documentos (lista/detalhe/XML/DANFE/métricas), empresas, certificados, emitir NFC-e/NF-e, cancelar, inutilizar, consultar, fila, contingência, SAT/SAF. Config global, webhooks e logs ficam como estão |
| Chave global (`OUTBOX_FISCAL_API_KEY`) e `ROLE_ADMIN` | Sem restrição (operador/admin provisiona e enxerga tudo) |

**Resultado (2026-10-15):** implementado em 7 frentes paralelas + suíte única. Migration `V7__vinculo_usuario_empresa` (`tb_usuario_empresa usuario_id+cnpj`, índice em `cnpj` + índice `idx_documento_cnpj`), `UsuarioEmpresaEntity/Repository`, `EscopoService` (`exigir(cnpj)`/`cnpjsPermitidos()`/`exigirAdministrador()`; flag `outbox.fiscal.escopo.habilitado` default true), enforcement em 11 controllers, admin API, `EscopoCnpjIntegrationTest` (9 cenários de isolamento). **391 testes verdes** (`mvn test`, 0 falhas). Commit Flowbox `a786b17` (push). Deploy VPS: V7 aplicada ("now at version v7"), `/admin/usuarios` 200. Validação em produção: usuário novo sem vínculo → lista vazia e 403 em `?cnpj=` fora do escopo; admin vincula `40187613000102` → efeito imediato (200); chave VisionBox `fb_Hc85...` é do `admin@flowbox.com.br` (ROLE_ADMIN → irrestrito, nenhuma provisionamento necessário, emissão nunca bloqueada). Usuário de teste `escopo-e2e@flowbox.com.br` criado na validação (sem emissão de nota — cliente orientou que validação não gera documento fiscal).

## Fiscal — Produção: NF-e 55 E2E (emitida + cancelada) e consulta de chave (2026-10-15, ✅ concluída)

> **Marco:** NF-e modelo 55 emitida **e** cancelada em PRODUCAO pela mesma cadeia VisionBox → Flowbox → SEFAZ-SP. Cada correção saiu da resposta crua da SEFAZ ou da referência OUTBOX — nada deduzido.

| Frente | Resultado | Evidência |
|---|---|---|
| Emissão NF-e 55 | Série 090 nº 3 → **cStat 100** | chave `35261040187613000102550900000000031819584004`, protocolo `135264369800195`, `status=AUTORIZADO`; `xml_retorno` gravado como **`<nfeProc>`** (NFe + protNFe), não mais `enviNFe` |
| Cancelamento NF-e 55 | Evento 110111 → **cStat 135** "Evento registrado e vinculado a NF-e" | protocolo do evento `135264369947092`, `CANCELADO` nos **dois** sistemas, HTTP 200 |
| Rejeição 388 (IPI) | Grupo IPI era emitido sem cadastro (`IPINT` CST 55 + `cEnq 999`) → "CST do IPI incompatível com o enquadramento" | Flowbox `e797458`: item sem IPI → grupo **fora** da nota e `vIPI 0.00` nos totais (mesmo do OUTBOX, que zera vIPI); com IPI tributado no cadastro o grupo entra |
| Rejeição 618 (cancelamento) | `detectarModeloChave` varria os **primeiros 44 dígitos** do XML do evento (`versao`, `idLote`, `Id ID110111`) e o evento de NF-e caía no endpoint de NFC-e | Flowbox `5ed35ea`: chave lida de `ID110111`/`<chNFe>`; regressão `NfceSoapClientModeloEventoTest` |
| Consulta de chave | 3 defeitos: SOAP 1.1 (fault `VersionMismatch` HTTP 500), `consSitNFe` sem `tpAmb`/`versao` (cStat 215), `SOAPAction` com aspas | Flowbox `8616110`: SOAP 1.2 + `tpAmb` + `versao="4.00"` → **cStat 100**, protocolo `13526007063048832`, HTTP 200 |
| `motivoSefaz` | resposta traz `cStat - xMotivo` da SEFAZ; `erro` só preenchido em falha real | `FiscalCoreService.consultarChave` |
| Rota de cancelamento NF-e 55 | `POST /api/v1/nfe/cancelar` no VisionBox; o Flowbox roteia o evento pelo modelo da chave | `NfeRestController` + `FlowboxFiscalProvider` |
| Destinatário NF-e 55 | Endereço completo obrigatório (CEP 8 dígitos, logradouro, nº, bairro, município, UF) | `NfceEmitirRequest.DestinatarioRequest` + `FlowboxFiscalProvider` |
| Tela `/fiscal` | Página própria no menu lateral (pedido do cliente: igual OUTBOX) + botão **Cancelar NFC-e** no `VendaConcluidaDialog` (aviso da janela de 30 min) + pulo do cStat 539 (até 5 pulos) | VisionBox `52f4335`, no ar em produção |
| Nota órfã 090/1 | Registrada em `documento_fiscal` (AUTORIZADO, proto `13526007062662399`); 090/3 e 090/4 agora mostram **539** real em vez de 503 mascarado | INSERT de evidência + `lerRespostaFlowbox` |
| Testes | Flowbox `mvn test` ✅ (380, inclui `NfceSoapClientModeloEventoTest`) · VisionBox ✅ (439) | executados neste ciclo |

**Commits:** VisionBox `52f4335` · Flowbox `8616110`, `5ed35ea`, `e797458` — todos pushados e deployados na VPS.

## Fiscal — Produção: NFC-e autorizada (cStat 100) + cancelamento (cStat 135) (2026-10-14, ✅ emissão / 🔄 cancelamento)

> **Marco:** primeiro E2E completo em **PRODUCAO** (`tpAmb=1`) — `POST /api/v1/fiscal/nfce/emitir` → Flowbox → SEFAZ-SP → autorização gravada no `documento_fiscal`. Referência canônica: OUTBOX ERP; **nunca adivinhar** — todo valor abaixo veio da resposta crua da SEFAZ ou do banco.

| Frente | Resultado | Evidência |
|---|---|---|
| Emissão autorizada | Série 090 nº 2 → **cStat 100** | chave `35261040187613000102650900000000021624523010`, protocolo `13526007063048832`, HTTP 201, `status=AUTORIZADO`, `codigoStatus=100`, linha em `documento_fiscal` (serie 090, numero 2, ambiente 1) |
| Protocolo de 17 dígitos | `nProt` real da SEFAZ-SP é de **17 dígitos** (autorização **e** evento), não 15 do XSD `TProt` | `13526007062662399`, `13526007063048832`, `13526007064496914`; V49 `documento_fiscal.protocolo VARCHAR(20)` + `REGEX_PROTOCOLO`/`@Pattern` → `\d{1,20}` |
| Cancelamento | Evento 110111 autorizado → **cStat 135** "Evento registrado e vinculado a NF-e" | nota 090/5 emitida 15:07:40 e cancelada **15:07:41**; protocolo do evento `13526007064496914`; Flowbox `status=CANCELADO` |
| Cancelamento E2E pela cadeia | `POST /api/v1/fiscal/nfce/cancelar` (novo) → Flowbox → SEFAZ → `CANCELADO` nos **dois** sistemas | nota 090/6 autorizada 20:21:14, cancelada **20:37:45** (+16,5 min), cStat 135, evento `13526007075279469`, HTTP 200; commit `d39f433` |
| Janela de cancelamento | NFC-e (65): **30 min** após autorização (Ajuste SINIEF 07/2018 / NT Confaz, obrigatório em todas as UFs desde 2019); NF-e (55) segue 24 h | medido: +1 s e +16,5 min → 135; +36/+38/+48/+60 min → 501. Referência OUTBOX confirma: os 6 cancelamentos da história foram a +1..+9 min |
| cStat real na resposta | Rejeição do Flowbox (HTTP 4xx) expõe o cStat verdadeiro (539, 501) em vez de mascarar como `503 Flowbox indisponível` | `FlowboxFiscalProvider.lerRespostaFlowbox`, vale para emissão e cancelamento |
| Parser de evento | `lerProtocolos` lia `protEvento` (tag inexistente) e reportava o **cStat 128 do lote**; agora lê `retEvento/infEvento` | Flowbox `5500adc` |
| Conteúdo do XML | `<infRespTec>` completo (CNPJ `40.187.613/0001-02`, contato, email, fone), `<tpAmb>1`, `<card><tpIntegra>2` | XML devolvido pelo Flowbox |
| Fuso | `TZ=America/Sao_Paulo` nos containers `app` e `flowbox` | logs `-03:00`; XMLs já eram `ZonedDateTime.now(America/Sao_Paulo)` (independentes do TZ do host) |
| Rejeições superadas | 209 → 373 → 742 → 391 → 245 → **100** | commits `f64b7a5`, `3f67971`, `c1e8d6b`, `c223e24`, `5d12f0b`, `0bb4a8f` |
| Testes | VisionBox `mvn test -Punit-only` ✅ · Flowbox `mvn test` ✅ | executados neste ciclo |

**Descobertas que mudam a numeração:** série 090 nº **3 e 4 já usados por outro sistema na SEFAZ desde setembro/2026** → cStat 539 "Duplicidade de NF-e com diferença na Chave de Acesso". A numeração local `max(numero)+1` não conhece o histórico da SEFAZ.

**Pendências abertas:**
1. ~~cStat 501 sem causa~~ **Resolvido**: janela de 30 min para NFC-e (Ajuste SINIEF 07/2018) — notas 090/1 e 090/2 ficaram fora da janela e **não são mais canceláveis por evento** (ficam AUTORIZADAS; só NF-e 55 de devolução referenciando a chave ou cancelamento extemporâneo na SEFAZ-SP).
2. ~~`POST /cancelar` inexistente~~ **Resolvido** (`d39f433`): endpoint + payload completo do Flowbox (emitente, ambiente, certificado, protocolo da emissão; sem protocolo gravado, busca no Flowbox).
3. ~~UI sem ação de cancelar~~ **Resolvido** (`52f4335`): tela `/fiscal` própria no menu + botão "Cancelar NFC-e" no `VendaConcluidaDialog` do PDV.
4. ~~Gravar `nfeProc` em `xml_retorno`~~ **Resolvido** (Flowbox `5ed35ea`): resposta agora monta `<nfeProc>` = NFe + protNFe.
5. ~~cStat 503 mascarando o real~~ **Resolvido** (`d39f433`): 4xx do Flowbox devolve o cStat verdadeiro (539/501).
6. ~~Consulta de chave HTTP 500~~ **Resolvido** (Flowbox `8616110`): SOAP 1.2 + `tpAmb`/`versao` → cStat 100, HTTP 200.
7. ~~Nota 090/1 órfã~~ **Resolvido**: linha gravada em `documento_fiscal` (AUTORIZADO, protocolo `13526007062662399`).
8. Decisões do cliente: série/limite novo (090 nº 3 e 4 ocupados na SEFAZ desde setembro/2026); série 090 → 001 ao consolidar; TZ do host (sudo).

**Commits deste ciclo:** VisionBox `0bb4a8f` (V49) e `1fe5d38` (TZ app) · Flowbox `5500adc` (parser + regex) e `a2331db` (TZ) — todos pushados e deployados na VPS.

## Fiscal — Produção: numeração configurável + `<infRespTec>` (2026-10-14, ✅ concluída — ver seção acima)

> Pedido do cliente: série e número **não podem ser fixos** — têm de ficar configuráveis, e o número usado vem do **maior já usado na série + 1**, para não dar duplicidade.
> Ambiente trocado para **PRODUCAO**, igual ao OUTBOX ERP. Evidência de que o `cStat 245` não era credenciamento da empresa: o OUTBOX emite **todo dia** com o mesmo CNPJ `40.187.613/0001-02`, mesma IE `151957359112`, mesmo CRT `1` e mesmo endereço — só que com `ambiente=PRODUCAO`. O cStat 245 em `tpAmb=2` significa **ausência de credenciamento no ambiente de homologação** da SEFAZ-SP, que é um processo separado do de produção.

| Item | O quê |
|---|---|
| Numeração | `V48`: `fiscal_serie_nfce`, `fiscal_serie_nfe`, `fiscal_numero_inicial_nfce`, `fiscal_numero_inicial_nfe` em `loja`. `FiscalService` abandona o `ThreadLocalRandom 1..999999` e passa a usar `max(numero) da série no mesmo ambiente + 1`, com fallback para o número inicial configurado (hoje: 14 linhas aleatórias entre 8.992 e 791.265, todas em homologação) |
| `<infRespTec>` | obrigatório em produção e rejeitado em homologação (exceto PR) — regra e campos copiados do OUTBOX ERP (`NfceXmlBuilder:447-463`). Flowbox hoje **não emite**: `CNPJ` = CNPJ do emitente, `xContato` = "Suporte Tecnico", `email`/`telefone` = dados da loja. Sem o grupo a SEFAZ-SP rejeita a emissão em produção |
| Dados aprovados pelo cliente | `fiscal_ambiente=PRODUCAO` · CSC `2d977230-481a-4b1c-8426-89fcb74cca73` / CSC Id `000001` (os mesmos do `fiscal_config` do OUTBOX) · `nome=I LOVE MIMOS` (razão social que vai no `<xNome>`) · logradouro `Rua Vinte e Cinco de Março` |

## Fiscal — Correção da Emissão NFC-e (2026-10-14, ✅ código concluído · ⛔ bloqueio cadastral na SEFAZ-SP)

> Investigação a pedido do cliente: "não está rolando a emissão de notas fiscais". **Nove causas empilhadas + cadastro de emitente por loja**, todas corrigidas.
> A cadeia VisionBox → Flowbox → SEFAZ hoje **transmite, é aceita, assinada, passa no leiaute 4.00, no QR Code, no emitente e na forma de pagamento**. A última rejeição é **cStat 245 — CNPJ Emitente não cadastrado**: o CNPJ `40187613000102` **não tem credenciamento de emissão NFC-e na SEFAZ-SP, nem em homologação**. É credenciamento cadastral, não código.

| Bloqueio | Causa raiz | Correção |
|---|---|---|
| API do VisionBox fora do ar | `visionbox-app` morto (`exit 255` em 2026-10-14 02:17 UTC, `HikariPool thread starvation` prévio) e **sem `restart:`** no serviço `app`, enquanto `web`/`postgres` tinham `unless-stopped` — por isso só o app ficou morto após o reboot do host | `docker-compose.yml`: `app` ganha `restart: unless-stopped` |
| `400 VALIDACAO` no Flowbox (`emitente` + `itens` ausentes) | `FlowboxFiscalProvider` em produção (`3ff268a`) enviava **só** `lojaId/modelo/serie/numero/chaveAcesso/xmlAssinado` — o `EmitirNfceRequest` do Flowbox exige `emitente`, `itens`, `certificado` | Diff local pendente finalizado e commitado: payload com `emitente`, `itens`, `pagamentos` e `destinatário`; `FiscalProvider.emitir(doc, xml, req)` passa o request da venda; `NfceEmitirRequest` ganha os DTOs de item/pagamento/destinatário |
| `certificado: Certificado A1 e obrigatorio` | `EmitirNfceRequest` exigia **PFX + senha inline em cada emissão**, mas o certificado A1 válido já está cadastrado cifrado no Flowbox (`id=1`, CNPJ `40187613000102`, válido até 2026-12-23) e `GET /api/v1/certificados/{id}` não devolve o PFX (sanitizado). O VisionBox não guarda certificado algum | **Flowbox**: `certificadoId` aceito em emitir NFC-e/NF-e, cancelar e inutilizar — `FiscalCoreService.resolverCertificado` resolve do cadastro e decifra a senha, PFX nunca sai do motor fiscal. **VisionBox**: `loja.flowbox_certificado_id` (`V45`), exposto no Painel Fiscal (vazio preserva / `0` limpa) e enviado no payload |
| `motivo varchar(500)` (SQLState 22001) gerava **409** que mascarava o erro real | Coluna `motivo` curta demais para a mensagem da SEFAZ; o INSERT do documento falhava e o VisionBox via `400` em vez do motivo verdadeiro | VisionBox `72bf0d5` (`motivo TEXT` + `limitarMotivo`) + `ALTER TABLE` manual na VPS |
| `400 - corpo vazio` (envelope SOAP malformado) | `documentToString` emitia `<?xml?>` e `montarEnvelopeSoap` embutia o payload cru dentro de `<nfeDadosMsg>` | Strip da declaração XML, `<soap12:Header/>` e header `SOAPAction`, mesmo formato do `NfceSoapClient` do Outbox ERP; regressão `NfceSoapClientEnvelopeTest` |
| `cStat 452` (resposta assíncrona em lote de 1) | `indSinc="0"` | `indSinc="1"` para modelos 65 e 55; resposta síncrona reusada sem consultar recibo; fluxo 103/104/105 mantido como fallback; `NfceXmlBuilderTest.lotePedeRespostaSincrona` |
| `cStat 225` — Falha no Schema XML do lote | **4 violações do leiaute 4.00**, achadas validando o XML gerado contra `enviNFe_v4.00.xsd` + `leiauteNFe_v4.00.xsd` oficiais (portal SVRS): `<serie>` zerado (`001`) e `<nNF>` zerado (`000000100`) quebravam `TSerie`/`TNF` — zero à esquerda vale só na chave de acesso; `<tpNFC>` **não existe** no leiaute; `<indIntermed>` antes de `<indPres>`; `<IPI>` sem o obrigatório `<cEnq>`; QR Code no formato `chave\|2\|tpAmb\|tpEmis\|cscId\|hash` com campo extra e CSC id zerado (padrão é `chave\|2\|tpAmb\|cIdToken\|hash40`) | Corrigido no `NfceXmlBuilder` alinhado ao Outbox ERP; validador local `VALIDATION=OK`; regressão de ordem `indPres`/`indIntermed` e ausência de `tpNFC` |
| `cStat 104` reportado como "layout não reconhecido" | (a) resposta síncrona traz **lote `cStat=104` + `protNFe/infProt` com o status real do documento**, e `lerRetEnviNFe` lia o primeiro `cStat` do documento; (b) `lerProtocolos` passava os filhos diretos de `protNFe` (só `infProt`) ao `preencher`, então `cStat`/`xMotivo`/`nProt` nunca eram lidos | `transmitir` reconhece o protocolo no próprio envio e o prioriza, como o Outbox ERP; `camposDoProtocolo` desce um nível (afeta também `protEvento`/`protInut`) |
| Insert do documento quebrando com a mensagem integral da SEFAZ | `tb_documentos_fiscais.motivo` era `varchar(255)` no Flowbox (mesma classe do bug do VisionBox) | `DocumentoFiscalEntity` corta `motivo` em 255 em `@PrePersist`/`@PreUpdate`; resposta integral passa a logar em `WARN` |
| `cStat 209` — IE do emitente inválida | O emitente era remontado com valores **fixos** em `FlowboxFiscalProvider` (IE `123456789110`, CSC `0123456789`, CSC Id `000001`, município `3550308`, CRT `1`) e `Loja` não tinha nenhum campo fiscal | Opção A escolhida pelo cliente: **`V47__loja_cadastro_fiscal.sql`** cria `inscricao_estadual`, `csc`, `csc_id`, `codigo_municipio`, `crt` e `fiscal_ambiente` em `loja`; `FiscalConfigService` persiste (null preserva / vazio limpa) com validação de CRT, ambiente e IBGE; `FlowboxFiscalProvider` lê da loja e **recusa antes de transmitir** quando falta IE (ou CSC na NFC-e), com mensagem apontando o Painel Fiscal; Painel Fiscal ganha a seção **Cadastro Fiscal do Emitente**. Gravados a partir do cadastro real: IE `151957359112`, município `3550308`, CRT `1`, endereço `VINTE E CINCO DE MARCO 641 — CENTRO, SAO PAULO/SP, 01021900` |
| `cStat 373` — descrição do primeiro item diferente de `NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL` | Em homologação a SEFAZ exige esse texto literal em todo `<xProd>` | `xProd` forçado quando `ctx.homologacao`; produção mantém a descrição real do item. Mesma regra do Outbox ERP (`NfceXmlBuilder:225`) |
| `cStat 742` — NFC-e com DANFE Simplificado Tipo 2 com grupo do IPI | `montarIpiItem` criava `<IPI>` **sempre**, inclusive no modelo 65 | Modelo 65 **não emite o grupo IPI** (e zera `vIPI`/`vIPIDevol` nos totais para não quebrar a regra W16); modelo 55 mantém. Testes de IPI migrados para NF-e 55 |
| `cStat 391` — não informados os dados do cartão de crédito / débito | Regra **YA04-10** (NT 2023.004): `tPag` `03`, `04` **e `17` (PIX dinâmico)** exigem o grupo `<card>` | `<card><tpIntegra>2</tpIntegra></card>` para 03/04/17, idêntico ao Outbox ERP (`NfceXmlBuilder:409-413`) |

**Validação:** Flowbox `mvn test` → **372/372 verdes** · validador local contra o XSD oficial da SEFAZ → `VALIDATION=OK` · VisionBox `mvn -q test -Punit-only` → **423/423** · `npm run typecheck` ✅ · `npm run build` ✅ · **E2E real na VPS** avançou `cStat 209 → 373 → 742 → 391 → 245`, sempre um passo mais fundo, com `chaveAcesso` e `qrCodeUrl` preenchidos.

**Bloqueio final (não é código):** `cStat 245 — CNPJ Emitente não cadastrado`. O CNPJ `40187613000102` é o do certificado A1 cadastrado (`GET /api/v1/certificados` confirma) e a IE `151957359112` foi aceita, ou seja, a SEFAZ-SP conhece a empresa — ela **não está credenciada para emissão de NFC-e**. O credenciamento é feito pelo contador/empresa na SEFAZ-SP, primeiro em homologação e depois em produção. Enquanto não existir, nenhuma emissão será autorizada, em nenhum sistema.

**Pendência de dado (bloqueia antes do 245):** `csc` e `csc_id` da NFC-e estão **vazios** na loja — sem eles o provedor recusa a emissão com mensagem apontando o Painel Fiscal. O CSC é emitido no portal da NF-e da UF e não tem consulta pública.

**Regra nova no workspace (R12):** `AGENTS.md` proíbe adivinhar — dado, regra ou comportamento não trivial vem do usuário ou de referência oficial (Outbox ERP, XSD/MOC da SEFAZ), nunca de suposição.

## Fase 4 — Refator Total do Frontend (2026-10-11, em andamento)

> **Objetivo:** eliminar `index.css` legado (1.038 linhas de hacks: zoom/altura fixa/`!important`), páginas monolíticas e 131 hex hard-coded. Nova base: Tailwind 1:1 nos tokens de `theme-visionbox.css`, UI kit shadcn/ui, AppShell com `h-dvh`. **Preservar** `lib/`, `stores/`, `App.tsx`, logo oficial e `login-optica.png`; demais assets antigos removidos na limpeza.

| Onda | Escopo | Status | Evidência |
|---|---|---|---|
| Onda 1 | Tema + UI kit shadcn + AppShell | ✅ Concluída | `tailwind.config.ts` 1:1 nos tokens (darkMode selector), 20 componentes em `components/ui/`, `AppShell.tsx` (grid `h-dvh`, sidebar colapsável persistida, Toaster); typecheck+build verdes |
| Onda 2 | 14 telas reescritas (5 agentes paralelos) | ✅ Concluída | Login (module.css 57/43), PDV (977→~400 + 8 componentes `components/pdv/`), Dashboard (595→277) + OSDetail (413→356 + 14 comp. `components/os/`), Clientes (765→355)/Receitas (907→201)/Catálogo (752→303 + `components/pessoas/` e `catalogo/`), Financeiro/Usuários/Config (`ConfiguracoesDialog` único plugado no AppShell + `components/financeiro/`), LabPortal/RastreioPortal/PainelDev (`components/portal/`); lógica de negócio e contratos API 1:1 |
| Onda 3 | Limpeza e verificação | ✅ Concluída | `index.css` reduzido para base reset (1.226→48 linhas, zero classes legadas); assets: mantidos logos + `logo_.png` + `login-optica.png` + ícones PWA; removidos banners/referências antigas/produtos demo (referências substituídas por placeholder token); **grep hex = 0** fora do tema (R5); `typecheck` ✅ + `build` ✅ (1.65s, entry 238.47 kB / gzip 74.78 kB) |
| Ajuste Visual | Tela de Login 1:1 Oficial | ✅ Concluído | Restauração 1:1 da tela de login exatamente conforme mockup oficial (`login-banner-left.png`, `logo_.png`, `login-arcos.png`), inputs com ícones, checkbox, botão café e rodapé com assinatura; `npm run build` verde (13.5s) |
| Fixes & Deploy | Sidebar Claro + Dev Guard + CSV + Fiscal + 500 Catálogo | ✅ Concluído | Sidebar adaptada ao modo claro (`bg-card`); Painel Dev restrito a `DESENVOLVEDOR`; Download de Modelo CSV adicionado em Clientes e Catálogo; Nova aba Módulo Fiscal & Flowbox (A1) em Configurações; Fix JPQL em `ProdutoRepository` (`cast(:q as string)`) eliminando 500 no Catálogo/PDV |
| Varredura Real | Eliminação de Mocks e Status Fictícios (Flowbox, Caixa, Comprovante) | ✅ Concluído | Status de Flowbox corrigido para transparente (Pendente/Desconectado quando offline); chip do Painel Dev ajustado para refletir o status real; cabeçalho de bobina térmica agora consome dados persistidos em `useEmpresaStore` (removido CNPJ e telefone inventados); defaults artificiais de caixa removidos; agrupamento temporal do gráfico expurgou fallback arbitrário |
| Automação Deploy | Script Direto PowerShell + SSH VPS (`deploy.ps1`) | ✅ Concluído | Script `deploy.ps1` (e atalho `npm run deploy` em web): push automático para `main` no GitHub e execução remota segura via `ssh vps` (`git pull` + `docker compose up -d --build app web` + `prune`); `deploy.yml` desacoplado de push automático para evitar concorrência |
| Profile Produção | Transição VPS para `SPRING_PROFILES_ACTIVE=prod,flowbox` | ✅ Concluído | Servidor configurado para rodar em produção real com FlowboxProvider; credenciais de produção injetadas; `application-prod.yml` ajustado com `baseline-on-migrate: true` e `ddl-auto: update` para preservação do banco |
| Painel Flowbox | Painel Interativo de Gestão e Conexão Fiscal | ✅ Concluído | Painel completo em `FiscalConfig.tsx`: inputs dinâmicos de URL API, API Key (show/hide), URL Frontend do Flowbox, botão 'Testar Conexão (Ping)' em tempo real com latência em ms, botão de atalho 'Abrir Painel Flowbox' e endpoints REST (`/v1/fiscal/config`, `/v1/fiscal/config/testar-conexao`) |
| UI & Catálogo | Nova Ordem Sidebar + Avatar Dropdown + SKU/EAN Automáticos | ✅ Concluído | Ordem estrita na Sidebar (Dashboard, PDV, Receitas, OS, Financeiro, Administrativo com submenu Clientes e Catálogo); Topbar enxuta com apenas avatar circular e DropdownMenu para baixo (Configurações, Usuários, Sair); SKU (PRD-000001...) e EAN-13 (GS1 Modulo 10) gerados de forma 100% automática e sequencial por loja sem duplicidade (`ProdutoSkuEanTest` 5/5 ✅, typecheck e build verdes) |
| Carga de Dados | Suporte Total a Planilhas Excel (.xlsx/.xls) e CSV | ✅ Concluído | Processamento unificado via Apache POI e `PlanilhaImportHelper` para importação e download de modelos estilizados de Clientes e Produtos tanto em Excel (.xlsx) quanto em CSV; detecção automática de colunas, cabeçalhos e preenchimento de SKU/EAN sequencial (`PlanilhaImportHelperTest` 2/2 ✅, `ProdutoSkuEanTest` 5/5 ✅, build verde) |
| Documentação Master | Apresentação Comercial, Guia Dev e Gestão do MinIO | ✅ Concluído | Criado MANUAL_GERAL_VISIONBOX.md cobrindo: 1) Pitch comercial e roteiro de demonstração para clientes; 2) Arquitetura técnica DDD, segurança AES-GCM, multi-tenancy R1, Flowbox fiscal R9; 3) Manual completo de operação do MinIO S3 (console :9101, buckets, CORS, retenção); 4) Roteiro de deploy e troubleshooting na VPS |
| PDV & Tipos de Cupom | Ativar/Desativar Fiscal + Seletor de Modelo (Cupom, NFC-e, DANFE) | ✅ Concluído | Suporte a 3 modalidades de emissão no PDV: 'Cupom' (Não-Fiscal/recibo de garantia), 'NFC-e' (Mod. 65) e 'DANFE' (Mod. 55); seletor no painel de venda, modal de pagamento e conclusão; ComprovanteImpressao renderiza layout visual fiel de cada modalidade com alternador instantâneo; atalhos de Carga de Demonstração em 1 clique |
| Catálogo & Categorias | CRUD Completo de Categorias de Produtos (Backend & Frontend) | ✅ Concluído | Tabela `categoria` persistida no PostgreSQL multi-tenant; CRUD REST completo (`/api/v1/categorias`, `/todas`, `buscarFiltrado`, DTOs, Service com soft-delete e validação de duplicidade, Controller); UI kit com `CategoriasModal.tsx` integrado no Catálogo; filtros dinâmicos de categoria; vinculação de `categoriaId` nos produtos; 246/246 testes unitários verdes |
| Seed & Rota Categorias | Persistência de Categorias Pré-existentes no Banco & Fix 404 | ✅ Concluído | Resolução de endpoint no frontend `categoriaService.ts` ajustando `/api/v1` para `/v1` (baseURL `/api`); Migration `V31__seed_categorias_padrao.sql` com seed idempotente das 6 categorias de ótica (*Armações*, *Lentes*, *Óculos de Sol*, *Lentes de Contato*, *Acessórios*, *Serviços*); auto-seed resiliente em runtime no `CategoriaService.java` (`garantirCategoriasPadrao`) ao listar categorias; `npm run build` verde (5.48s) |
| Fix Venda Cupom & Pagamentos | Fix Hibernate JSONB em EventoOS, Ocultação de Tags SEFAZ e Filtro Ativo no PDV | ✅ Concluído | 1) Correção de erro 500 ao finalizar venda com cupom: adicionado `@JdbcTypeCode(SqlTypes.JSON)` em `EventoOS` (`metadataJson`) e `LogAuditoria` (`detalheJson`) resolvendo incompatibilidade `jsonb` no PostgreSQL; 2) Removida a exibição e edição de 'Código NFC-e (tPag)' e tags SEFAZ da UI de configurações, com resolução técnica delegada automaticamente ao backend; 3) Formas de pagamento no PDV blindadas para exibir e permitir seleção apenas de métodos ativos (`formasAtivas`); 4) Migration `V32__fix_forma_pagamento_tpag.sql`; 246/246 testes verdes; build web verde (1.89s) |
| Trava Caixa PDV & Auto-Estoque | Sinalizador de Caixa, Bloqueio de Venda Caixa Fechado, Formas Ativas Dinâmicas e Auto-Estoque Resiliente | ✅ Concluído | 1) Trava rigorosa 'só faz venda com caixa aberto' no PDV: botão 'Finalizar' substituído por 'Abrir Caixa para Vender', atalho F8 e clique bloqueados com aviso de erro e acionamento automático de `ControleCaixaModal`; 2) Sinalizador visual destacado no topo do PDV com status em tempo real (`Caixa Aberto`/`Caixa Fechado`) e banner de alerta; 3) Formas de pagamento no resumo do PDV 100% dinâmicas do banco (`/v1/financeiro/formas-pagamento`, filtrando `ativo = true`), remoção do botão 'Outros'; 4) Auto-criação de registro de estoque em `EstoqueService.obterOuCriar` evitando `EntityNotFoundException` e marcação silenciosa de `rollback-only` no Spring ao vender produtos sem estoque prévio; 52 testes OS/Estoque verdes; `npm run build` verde (4.16s) |
| Fidelidade Recibos & Status Venda PDV | Cupom Térmico 80mm Isolado (recibo.html), Status PEDIDO_CONFIRMADO e Unificação do Indicador de Caixa | ✅ Concluído | 1) Recibo Não-Fiscal e NFC-e reestruturados 1:1 com base nos templates reais (`templates recibos/recibo.html` e `cupom-fiscal.html`); impressão via iframe isolado (`executarImpressao`) e CSS `@media print` eliminando vazamento do modal e bordas da janela; 2) Venda no PDV concluída agora nasce com status `StatusOS.PEDIDO_CONFIRMADO` (eliminando a necessidade de aprovação como orçamento) e contas a receber descrita como 'Venda OS ...'; 3) Removidos os avisos redundantes de caixa fechado, mantendo apenas 1 sinalizador elegante no cabeçalho do PDV; 52 testes OS verdes; build Vite verde (19.16s) |
| Robustez ERP | Benchmark Outbox ERP & Guia Obrigatório de Robustez Comercial | ✅ Concluído | Concluído mapeamento analítico completo de `D:\TECHBOXBR\CLIENTES\I LOVE MIMOS\OUTBOX ERP\sistema\src`; criado `docs/PLANO_ROBUSTEZ_ERP_REFERENCIA_OUTBOX.md` cobrindo Central de Vendas (`/vendas`), Gestão de Turnos de Caixa (`/caixas`), Baixas Parciais (`ContaReceberPagamento`), Compras por XML de Fornecedor e Taxas de Maquininha (MDR líquido); definido como **LEITURA OBRIGATÓRIA** em `AGENTS.md` |
| Integração Flowbox & Emissão PDV | Auto-emissão NFC-e no PDV, remoção de chaves fake e fix FlowboxFiscalProvider | 🔄 Em andamento | 1) Auto-emissão no PDV ao concluir venda fiscal; 2) reciboPrint.ts expurga fallback fake de 44 dígitos; 3) FiscalService salva ordemServicoId; 4) FlowboxFiscalProvider alinhado com /api/v1/nfce/emitir e API Key real |
| Central de Vendas & Histórico | Central de Vendas & Histórico de Pedidos (/vendas) | ✅ Concluído | Implementação completa do benchmark Outbox ERP |

**Pendências sinalizadas:** `components/Layout.tsx` (antigo, não roteado) permanece no repo — não removido sem ordem explícita; `nextStatusByCurrent` do front diverge de `TransicaoOSRegistry` (backend) — requer alinhamento; impressão do DANFE sem isolamento `@media print` (fiscal-engineer).

## Fase 4 — Onda Simultânea Robustez ERP Fases 2–5 + P1 (2026-10-13, ✅ concluída)

> **Objetivo:** executar em paralelo as Fases 2–5 do `docs/PLANO_ROBUSTEZ_ERP_REFERENCIA_OUTBOX.md` + finalização do draft P1. Slots de migration aplicados sem colisão: **V33** caixa, **V34** financeiro, **V35** compras/MDR/comissões, **V36** modulo_configuracao_loja. Arquivos compartilhados (`SecurityConfig`, `App.tsx`, `AppShell.tsx`) integrados pelo orquestrador.

| Frente | Escopo | Status | Evidência |
|---|---|---|---|
| Fase 2 | Caixa & Turnos: extrato, fechamento cego, apuração por forma, `CaixaTurnos.tsx` (V33) | ✅ Concluído | `V33` (valor_fechamento_sistema + CHECK motivo + índices); `CaixaService` sangria/suprimento/extrato/relatório + fechamento cego SOBRA/QUEBRA/EXATO; endpoints `/api/v1/caixa/{sangria,suprimento,extrato,fechamento,historico,fechar}`; frontend `CaixaTurnos.tsx` + 5 modais (`AbrirCaixa`, `SangriaSuprimento`, `FecharCaixa` 2 etapas, `ExtratoCaixa`) + `caixaPrint.ts` 80mm iframe isolado; `ControleCaixaModal` migrado para endpoints dedicados com Idempotency-Key; `CaixaServiceTest` 9 novos |
| Fase 3 | Financeiro: `ContaReceberPagamento` baixas parciais, Fornecedores (CNPJ cipher), Contas a Pagar (V34) | ✅ Concluído | `V34` (conta_receber_pagamento + fornecedor cnpj_cipher/hash + valor_aberto GENERATED + conta_pagar fornecedor/competencia + CHECK caixa_movimento ENTRADA/RECEBIMENTO_FIADO); `baixar` parcial→PARCIAL/total→PAGO com movimento no caixa aberto + histórico `GET /{id}/pagamentos`; CRUD `/fornecedores` CNPJ AES-GCM+HMAC mascarado; frontend hub `Financeiro.tsx` (toggle A Receber/A Pagar/Crediário/Fornecedores/DRE) + `BaixaContaModal` (Idempotency-Key estável entre retries) + `PagamentosTimeline` + `FornecedorPanel` + `ContaPagarFormModal`; 20 testes novos |
| Fase 4 | Compras XML NF-e + Maquininhas MDR + Comissões (V35) | ✅ Concluído | `V35` (compra/compra_item/maquininha_cartao/comissao_config/comissao_lancamento, RLS FORCE, idempotência por chave 44); parser XML DOM JDK **zero dependência nova** com hardening XXE; de-para EAN→SKU→pré-cadastro + entrada estoque + ContaPagar por duplicata; MDR `calcular-liquido` HALF_EVEN por faixa 1x/2-6x/7-12x; comissão GERAL/CATEGORIA com apuração idempotente; frontend `Compras.tsx` (upload drag&drop) + `Maquininhas.tsx` (CRUD+simulador) + `Comissoes.tsx` (regras+fechamento); 4 testes + fixture NF-e |
| Fase 5 | `ModuloSistema` 19 códigos + `modulo_configuracao_loja` + `@RequerModulo`/interceptor + `GuardaModulo.tsx` + Painel Dev planos (V36) | ✅ Concluído | `V36` (modulo_configuracao_loja RLS); enum 19 módulos + `PlanoSaaS` START⊂PRO⊂ENTERPRISE; interceptor 403 `MODULO_NAO_CONTRATADO` fail-closed sem TenantContext; `/api/v1/dev/lojas/{id}/modulos` + `/modulos/plano` com auditoria; `GET /api/v1/modulos` (loja do JWT); default sem registro = tudo ativo (D-014); frontend `GuardaModulo.tsx` + `modulosStore.ts` + Painel Dev com seletor loja/planos/19 toggles; **rotas `App.tsx` envoltas em GuardaModulo (pdv/vendas/caixas/receitas/os/compras/maquininhas/comissoes/financeiro) + menu `AppShell.tsx` filtrado por módulo** |
| P1 | db-admin finaliza `docs/p1-migrations-draft/` (sem execução — sem Docker) | ✅ Concluído | Draft validado 1:1 contra entidades JPA (zero divergência colunas/tipos); `item_pedido` sem loja_id = impedimento técnico documentado (ItemPedido não estende EntidadeBase; mitigação: RLS policy parent-join); CHECK usuario.perfil **já resolvido pela V27** (doc `CORRECAO_CHECK_USUARIO_PERFIL.md`); cenários banco limpo (V1→V1_1→V2→V3-V5→V11+) vs existente (`flyway repair` + `outOfOrder=true` one-shot); zero SQL executado |
| Integração | SecurityConfig + rotas + menu | ✅ Concluído | `SecurityConfig` +`/api/v1/compras/**` (ADMIN/GERENTE/FINANCEIRO) +`/api/v1/modulos/**` (authenticated); `App.tsx` 4 rotas novas com `GuardaModulo`; `AppShell.tsx` 4 itens (Caixas/Compras/Maquininhas/Comissões) filtráveis por `useModulosStore` |

**Validação da onda:** `mvn -q test -Punit-only` → **344/344 verdes** (era 246; +98 testes) · `npm run typecheck` ✅ 0 erros · `npm run build` ✅ (2.29s, code split; CaixaTurnos 41.56kB/Compras 20.09kB/Maquininhas 14.72kB/Comissoes 23.17kB gzip) · hex fora do tema = 0 (só templates de impressão 80mm `caixaPrint`/`reciboPrint`, papel térmico — exceção documentada) · `docs/decisions.md` +D-012/D-013/D-014/D-015/D-016.

**Pendências sinalizadas (pós-onda):** estorno de baixa/reabertura de título (D-012); OFX conciliar via `baixar`; MDR ainda não plugado no pagamento do PDV; apuração de comissão automática no `PedidoVendaService` (hoje explícita); `CompraResponse` sem flag `preCadastrado` por item; fechamento de comissões agrega por vendedor (sem linha por venda); select de vendedores indisponível p/ GERENTE/FINANCEIRO (`/v1/usuarios` é ADMIN-only — sugerir `/v1/financeiro/comissoes/vendedores`); baixa sem desconto/juros; fornecedor sem reativação; métricas financeiras sobre 1 página (size=100); `flyway outOfOrder` p/ V35 em banco já na V36; `nextStatusByCurrent` front × `TransicaoOSRegistry` (pré-existente); DANFE `@media print` (pré-existente).

## Fase 4 — Onda 2: Fechamento das Pendências Robustez (2026-10-13, ✅ concluída)

> 3 agentes simultâneos + orquestrador. Migrations: **V37** MDR/comissão no fluxo de venda; **V38/V39 não necessárias** (ESTORNO já no CHECK V34; preCadastrado sem DDL — D-018/D-019).

| Frente | Escopo | Status | Evidência |
|---|---|---|---|
| A — MDR + Comissão auto | `MdrCalculoService` plugado no pagamento do PDV + apuração automática na finalização | ✅ Concluído | `V37` (ordem_servico_pagamento +taxa_valor/valor_liquido/maquininha_id com FK real); resolução 3 níveis (`maquininhaId` explícito → auto-resolve 1 POS ativa → null+WARN, nunca chuta taxa); tipo de cartão do enum da forma + `parcelas` novo (débito força 1, clamp por `permiteParcelar`); tri-state: isento 0,00/valor, cartão taxa+líquido HALF_EVEN, pendente null/null; comissão apurada pós-ContaReceber com try/catch (falha nunca quebra venda) + desconto rateado por categoria; `OrdemServicoMdrComissaoTest` 8/8 (com `MdrCalculoServiceImpl` REAL); D-017 |
| B — Estorno + OFX | Estorno de baixa (reabre título + `CaixaMovimento ESTORNO`) + OFX via `baixar` + botão estorno na UI | ✅ Concluído | `POST /contas-receber/{id}/pagamentos/{pagamentoId}/estornar` (ADMIN/GERENTE/FINANCEIRO + `@PreAuthorize`); SOFT-DELETE preserva evidência (D-019); `valor_aberto` GENERATED recalcula sozinho; 404 composto R1; 422 CANCELADA; OFX conciliado chama `baixar` na mesma transação (FITID na observação, forma: request→padrão da loja→DINHEIRO, lote nunca aborta); `ContaReceberServiceEstornoTest` 8/8 + OfxConciliacaoServiceTest +5; UI `PagamentosTimeline` botão Estornar com confirmação + Idempotency-Key |
| C — Contratos | `preCadastrado` por item + fechamento por venda + endpoint vendedores + front | ✅ Concluído | flag `@Transient` sem DDL (recomputar é impossível — produto criado passa a casar; D-018): true/false na resposta da importação, null em listar/buscar; `CompraItensTable` coluna "Origem" com Badge; fechamento com `lancamentos[]` (venda/vendedor/categoria/base/%/valor/status) derivado da MESMA lista do agregado (totais batem garantidos); `GET /financeiro/comissoes/vendedores` (id+nome, VENDEDOR/OTICO ativos, LGPD mínimo) para ADMIN/GERENTE/FINANCEIRO — `useVendedores` sem degradação; `ApurarComissaoDialog` sem fallback manual; 4 testes novos |
| Orquestrador — Caixa | RBAC fino + **correção de gap real nos agregados do turno** + gating front | ✅ Concluído | `SecurityConfig`: `POST /caixa/{sangria,suprimento,fechar}` → ADMIN/GERENTE/FINANCEIRO (matcher específico ANTES do wildcard); `CaixaService.movimentar`: **ENTRADA soma `saldoEsperado`** (baixa em dinheiro na gaveta — sem isso fechamento cego apurava QUEBRA falsa), RECEBIMENTO_FIADO só entradas, ESTORNO dinheiro tira da gaveta / não-dinheiro saída de papel (javadoc + D-019 corrigidos); +4 testes `CaixaServiceTest` (17 total); front `CaixaTurnos` + `ControleCaixaModal` escondem Sangria/Suprimento/Fechar de VENDEDOR; D-017 duplicado renumerado → **D-019** (decisions.md consistente) |

**Validação da onda 2:** `mvn -q test -Punit-only` → **374/374 verdes** (era 344; +30) · `npm run typecheck` ✅ 0 erros · `npm run build` ✅ · decisions.md +D-017/D-018/D-019 sem duplicatas.

## Fase 4 — Onda 3: Pendências Restantes Robustez (2026-10-13, ✅ concluída)

> 3 agentes simultâneos. Migrations: **V40** parcelas (ordem_servico_pagamento) + **V41** desconto/juros (conta_receber_pagamento) — slots resolvidos sem colisão. P1 e Testcontainers seguem bloqueados (sem Docker).

| Frente | Escopo | Status | Evidência |
|---|---|---|---|
| A — Contrato OS + comissão | `OrdemServicoResponse.pagamentos[]` (taxa/líquido/parcelas/maquininha) + cancelamento estorna comissão PENDENTE | ✅ Concluído | `pagamentos[]` no single sem N+1 (queries em lote `findByOrdemServicoIdIn`); V40 `parcelas INT NOT NULL` + backfill (fonte única MDR: `aplicarMdr` lê `osp.getParcelas()`); `ComissaoService.cancelarPorVenda` plugado nos DOIS caminhos de cancelamento (OS + Central de Vendas) com try/catch WARN — falha nunca quebra cancelamento; PAGO intocado; D-020 |
| B — Financeiro completo | Baixa com desconto/juros (V41), reativação de fornecedor, endpoint de totais agregados + front | ✅ Concluído | Semântica (D-021): `valorPago+desconto` abate `valor_aberto` (via `valor_pago` GENERATED), `juros` só entra no caixa junto com `valorPago`; estorno simétrico; validações 400 (`pago+desconto>aberto`, negativos); `POST /fornecedores/{id}/reativar` idempotente (404 R1, 409 CNPJ ativo, cifra intacta) + `?incluirInativos=true`; `GET /financeiro/totais` 5 SUMs (fim do workaround size=100) e `Financeiro.tsx` consome com fallback; `BaixaContaModal` +Desconto/Juros com preview; `FornecedorPanel` toggle inativos + Reativar; `PagamentosTimeline` badges; +22 testes (`ContaReceberServiceBaixaTest` 7, `EstornoTest` 3, `FornecedorServiceTest` 6, `FinanceiroTotaisServiceTest` 6); D-021 |
| C — Front PDV/OS/Vendas | `FinalizarVendaModal` maquininha/parcelas + preview `calcular-liquido`; OS detalhe e Central de Vendas exibem pagamentos com taxa/líquido | ✅ Concluído | `MdrPreview.tsx` (debounce+abort) por linha de cartão; select Maquininha (ativas, placeholder "Sem maquininha — conciliar depois") + Parcelas 1–12 só crédito; payload: cartão → `maquininhaId`/`parcelas` (débito força 1); `PagamentosTable.tsx` compartilhado OS/Vendas com badge "Taxa pendente"; `PDV.tsx` copia pagamentos MDR p/ outbox offline; typecheck 0 erros |

**Validação da onda 3:** `mvn -q test -Punit-only` → **418/418 verdes** (era 374; +44) · `npm run typecheck` ✅ 0 erros · `npm run build` ✅ 3.33s · decisions.md D-019/D-020/D-021 sem duplicatas · colisão de slots resolvida (A pegou V40, B deslocou p/ V41).

**Correção de integração do orquestrador:** helper `pagamentoComDescontoJuros` (5 params) × 2 chamadas com 4 args — assinatura alinhada em `ContaReceberServiceEstornoTest`.

## P1 — Aplicação das Migrations Ausentes em Postgres Real (2026-10-13, ✅ concluída)

> Bloqueio histórico P1 destravado: servidor Postgres real `192.168.15.90:5432` (dev), banco novo `visionbox_p1`.

| Etapa | Resultado |
|---|---|
| Draft movido p/ `db/migration` | `V1_1__legacy_foundation.sql`, `V3__catalogo.sql`, `V4__pedido_venda.sql`, `V5__ordem_servico_colunas.sql` |
| `flyway migrate` (banco limpo) | ✅ **V1→V1_1→V2→V3→V4→V5→V11→…→V41 completa, 0 falhas** — warnings benignos (`IF NOT EXISTS`) |
| `flyway validate` | ✅ 35 migrations validadas |
| Verificação JDBC | history `1.1/3/4/5/37/40/41` success=true · 0 failed · RLS ENABLE+FORCE em produto/marca/categoria/pedido_venda/item_pedido/ordem_servico_pagamento/conta_receber_pagamento · colunas V37/V40/V41 presentes · 39 tabelas |
| Bug 1ª execução | **V19** índice parcial `WHERE validade < CURRENT_DATE` → 42P17 (função não-IMMUTABLE em predicado de índice; e ficaria obsoleto todo dia) — linha removida (redundante com `idx_estoque_lote_validade`) |

**Ainda pendente do checklist P1:** `mvn test -Pintegration` (Testcontainers = Docker); adoção out-of-order em banco legado real (quando houver um apontar o host).

### Boot real da aplicação × schema Flyway (2026-10-13, ✅)

Primeira validação do contrato Hibernate (`ddl-auto: validate`) × cadeia Flyway em Postgres real. Subida contra `visionbox_p1` expôs e corrigiu **4 divergências entidade × schema** (criadas as migrations aditivas — V23/V1/V2 já têm checksum em bancos legados):

| Divergência (1ª falha do validate) | Correção |
|---|---|
| `caixa_sessao` sem `ativo` (entity estende `EntidadeBase` + `@SQLRestriction`) | **V42** ADD COLUMN ativo |
| `cliente.uf` `CHAR(2)` × entity espera `VARCHAR(2)` | **V43** ALTER TYPE |
| `loja` sem `flowbox_url/api_key/web_url` (R9/ADR-004) | **V44** ADD COLUMN ×3 |
| `ordem_servico_pagamento` sem `ativo` (`extends EntidadeBase`) | **V44** ADD COLUMN ativo |

Metodologia: varredura completa entities × `information_schema` (script) + boot iterativo. Resultado final: **`Started VisionBoxApplication in 33.063s`, Tomcat :8080, 0 ERROR no log**, porta liberada após teste (R10). Redis/Rabbit ausentes na máquina não bloquearam o boot (conexões lazy).

### Docker Compose ajustado ao uso real (2026-10-13, ✅)

Investigado a pedido do cliente: **zero uso de Redis/RabbitMQ/MinIO no código** (grep: sem `RedisTemplate`/`@Cacheable`/`RabbitTemplate`/`@RabbitListener`; outbox é 100% banco — tabela `outbox_message`; anexos de receita em storage local `data/uploads`, não S3). Composes reescritos:

| Arquivo | Mudança |
|---|---|
| `docker-compose.dev.yml` | −redis/−rabbitmq/−minio; `app` depende só do PG; serviço `app` perde `SPRING_PROFILES_ACTIVE: dev` (perfil dev = `ddl-auto: create` + flyway off, caminho obsoleto pós-P1 — app agora migra/valida via Flyway no boot); observability (Prometheus/Grafana) mantido opt-in (implementado de verdade); YAML validado |
| `docker-compose.yml` (deploy) | −redis/−rabbitmq/−minio + envs correspondentes; app/web/cloudflared mantidos; YAML validado |
| `AGENTS.md` §5.3 | DoD atualizado (compose sobe só PG) |

`application.yml` mantém `spring.data.redis/rabbitmq` como preparo (lazy, inofensivo — re-adicionar containers quando a camada de eventos existir). Stack congelada (`AGENTS.md` §3 / PROJECT_CONTEXT) intocada — mudar exigiria ADR.

**Pendências remanescentes (pós-onda 3 + P1):** `nextStatusByCurrent` × `TransicaoOSRegistry` (pré-existente); DANFE `@media print` (pré-existente); Testcontainers/Docker; adoção out-of-order no banco legado real; 409 de CNPJ na reativação retorna detail genérico (mensagem específica só no log WARN — handler ProblemDetail compartilhado fora de escopo).






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
