# VisionBox — Sistema de Gestão para Óticas (Especificação Técnica)

> **Nome do produto:** `VisionBox` — segue a nomenclatura da TECHBOXBR (Outbox, Pointbox, Finbox, Cashbox)
> **Objetivo:** ERP vertical para óticas (loja única ou rede), cobrindo vendas, ordens de serviço, laboratório, financeiro, estoque e relacionamento com o cliente — com diferenciais que os sistemas de mercado (Óticas World, Sistema Ótica Fácil, SóOtica, GestãoClick adaptado, Bling + planilhas) não oferecem hoje.

---

## 1. Visão Geral

Uma ótica não é apenas um varejo de produtos — é uma combinação de **varejo + serviço de saúde + manufatura sob encomenda** (montagem de lentes). O sistema precisa modelar três fluxos que caminham juntos:

1. **Comercial** — cliente entra, escolhe armação, faz exame/traz receita, fecha pedido.
2. **Produção (Ordem de Serviço)** — receita vira especificação técnica de lente, vai para laboratório (interno ou terceirizado), volta para montagem, some para controle de qualidade, é entregue.
3. **Financeiro/Relacionamento** — parcelamento, convênios, garantia, recall de troca de lente/receita vencida, pós-venda.

A maioria dos sistemas de mercado resolve bem o passo 1 (PDV) e razoavelmente o passo 3 (financeiro), mas trata o passo 2 — a Ordem de Serviço — como um campo de observação em texto livre, sem rastreabilidade real. É o principal ponto de melhoria deste projeto.

---

## 2. Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Linguagem | Java 17 (LTS) |
| Framework | Spring Boot 3.x |
| Persistência | Spring Data JPA + Hibernate 6 |
| Banco de dados | PostgreSQL 15+ (multi-schema para multi-loja) |
| Boilerplate | Lombok (`@Data`, `@Builder`, `@Slf4j`, etc.) |
| Migração de schema | Flyway |
| Mapeamento DTO ↔ Entidade | MapStruct |
| Validação | Bean Validation (Jakarta Validation) |
| Segurança | Spring Security + JWT (access/refresh token) |
| Documentação de API | springdoc-openapi (Swagger UI) |
| Mensageria/eventos internos | Spring Events (síncrono) + RabbitMQ (assíncrono, para integrações e outbox pattern) |
| Cache | Redis (sessão, cache de catálogo, rate-limit) |
| Fila de jobs agendados | Spring Scheduler + Quartz (para recall de receita, cobrança recorrente) |
| Armazenamento de arquivo | S3-compatible (MinIO on-premise ou AWS S3) — fotos de receita, laudos, imagens de armação |
| Frontend (sugestão) | React + Tailwind (reaproveitando padrão já usado no OUTBOXERP) ou Angular, dependendo da equipe |
| Fiscal | Integração NFC-e/NF-e via biblioteca própria ou parceiro (Focus NFe, Nuvem Fiscal) |
| Testes | JUnit 5, Testcontainers (Postgres real em teste de integração), Mockito |
| Observabilidade | Micrometer + Prometheus + Grafana; logs estruturados (Logback + JSON) |
| Containerização | Docker + Docker Compose (dev) / Kubernetes ou Docker Swarm (produção) |

---

## 3. Arquitetura

Arquitetura em camadas (hexagonal-light), separando domínio de infraestrutura para facilitar testes e trocar integrações externas (laboratórios, fiscal, pagamento) sem reescrever regra de negócio.

```
com.visionbox
├── config/              # Security, CORS, OpenAPI, Beans
├── shared/              # Exceptions, utils, base entities, auditoria
├── modules/
│   ├── pessoa/          # Cliente, Fornecedor, Colaborador (base comum "Pessoa")
│   ├── clinico/         # Receita, Exame, Histórico Clínico do cliente
│   ├── catalogo/        # Produto, Armação, Lente, Kit, Categoria, Marca
│   ├── estoque/         # Estoque, Movimentação, Transferência entre lojas
│   ns.compras/          # Pedido de compra, Fornecedor, Recebimento
│   ├── vendas/          # Pedido de Venda, Orçamento, Item de Pedido
│   ├── ordemservico/    # OS — núcleo do diferencial (ver seção 6)
│   ├── laboratorio/     # Integração com laboratórios externos, roteamento de OS
│   ├── financeiro/      # Contas a receber/pagar, formas de pagamento, comissão
│   ├── convenio/        # Planos de saúde/convênios óticos, tabelas de reembolso
│   ├── fiscal/          # Emissão NFC-e/NF-e, contingência offline
│   ├── crm/             # Recall, campanhas, satisfação, indicação
│   ├── agenda/          # Agendamento de exame/consulta/prova
│   ├── usuario/         # Autenticação, perfis, permissões (RBAC)
│   └── relatorios/      # BI, dashboards, exportações
└── api/                 # Controllers REST por módulo
```

Cada módulo segue: `domain` (entidades + regras) → `repository` (Spring Data JPA) → `service` (regra de negócio, transações) → `controller` (REST) → `dto` (contratos de entrada/saída, mapeados via MapStruct).

**Multi-loja / multi-tenant:** modelo *shared database, discriminator column* (`loja_id` em todas as tabelas operacionais) para redes pequenas/médias, com opção de evoluir para *schema por tenant* se um cliente exigir isolamento total. Isso evita o problema comum dos sistemas de mercado, que tratam "filial" como um recurso pago à parte e mal integrado ao estoque central.

---

## 4. Modelagem de Domínio (Entidades JPA principais)

### 4.1 Base comum

```java
@MappedSuperclass
@Getter @Setter
public abstract class EntidadeBase {

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @CreationTimestamp
    private LocalDateTime criadoEm;

    @UpdateTimestamp
    private LocalDateTime atualizadoEm;

    @Version
    private Long versao; // controle de concorrência otimista

    private boolean ativo = true;
}
```

### 4.2 Pessoa / Cliente

```java
@Entity
@Table(name = "cliente")
@Getter @Setter @NoArgsConstructor @SuperBuilder
public class Cliente extends EntidadeBase {

    @Column(nullable = false)
    private String nome;

    @Column(unique = true)
    private String cpf;

    private LocalDate dataNascimento;

    @Embedded
    private Contato contato; // telefone, whatsapp, email — @Embeddable

    @Embedded
    private Endereco endereco;

    @OneToMany(mappedBy = "cliente", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Receita> receitas = new ArrayList<>();

    @OneToMany(mappedBy = "cliente")
    private List<OrdemServico> ordensServico = new ArrayList<>();

    @ManyToOne
    private Convenio convenioPadrao;

    // diferencial: preferências de contato para recall (whatsapp, sms, email)
    @Enumerated(EnumType.STRING)
    private CanalPreferido canalPreferido;

    // diferencial: score de propensão a recompra calculado por job
    private Integer scoreRecompra;
}
```

### 4.3 Receita (núcleo clínico)

```java
@Entity
@Table(name = "receita")
@Getter @Setter @NoArgsConstructor @SuperBuilder
public class Receita extends EntidadeBase {

    @ManyToOne(optional = false)
    private Cliente cliente;

    private LocalDate dataEmissao;
    private LocalDate dataValidade; // usado para recall automático

    private String nomeMedico;
    private String crmMedico;

    @Embedded
    private GrauOlho olhoDireito; // esférico, cilíndrico, eixo, adição, DNP
    @Embedded
    private GrauOlho olhoEsquerdo;

    private Double distanciaPupilar;

    @Enumerated(EnumType.STRING)
    private TipoReceita tipo; // VISAO_SIMPLES, MULTIFOCAL, BIFOCAL, LENTE_CONTATO

    @Lob
    private byte[] anexoDigitalizado; // ou referência para storage externo (S3 key)

    @OneToMany(mappedBy = "receita")
    private List<OrdemServico> ordensServico = new ArrayList<>();
}

@Embeddable
@Getter @Setter
public class GrauOlho {
    private Double esferico;
    private Double cilindrico;
    private Integer eixo;
    private Double adicao;
}
```

### 4.4 Catálogo (Produto)

```java
@Entity
@Inheritance(strategy = InheritanceType.SINGLE_TABLE)
@DiscriminatorColumn(name = "tipo_produto")
@Getter @Setter @NoArgsConstructor @SuperBuilder
public abstract class Produto extends EntidadeBase {

    private String sku;
    private String descricao;
    @ManyToOne private Marca marca;
    @ManyToOne private Categoria categoria;
    private BigDecimal precoCusto;
    private BigDecimal precoVenda;
    private BigDecimal ncm; // classificação fiscal
}

@Entity
@DiscriminatorValue("ARMACAO")
@Getter @Setter @NoArgsConstructor @SuperBuilder
public class Armacao extends Produto {
    private String material;      // acetato, metal, TR90
    private String formato;       // quadrada, redonda, aviador...
    private String corAro;
    private Double larguraPonte;
    private Double comprimentoHaste;
    // diferencial: compatibilidade com prova virtual (ver seção 6)
    private String modelo3dUrl;
}

@Entity
@DiscriminatorValue("LENTE")
@Getter @Setter @NoArgsConstructor @SuperBuilder
public class Lente extends Produto {
    @Enumerated(EnumType.STRING) private TipoLente tipoLente; // VISAO_SIMPLES, MULTIFOCAL...
    @Enumerated(EnumType.STRING) private MaterialLente material; // resina, policarbonato, cristal
    private boolean antirreflexo;
    private boolean fotossensivel;
    private boolean filtroLuzAzul;
    private String indiceRefracao;
    @ManyToOne private Laboratorio laboratorioPadrao;
}
```

### 4.5 Ordem de Serviço — o coração do diferencial

```java
@Entity
@Table(name = "ordem_servico")
@Getter @Setter @NoArgsConstructor @SuperBuilder
public class OrdemServico extends EntidadeBase {

    private String numero; // sequencial amigável, ex: OS-2026-00123

    @ManyToOne(optional = false) private Cliente cliente;
    @ManyToOne private Receita receita;
    @ManyToOne private PedidoVenda pedidoVenda;
    @ManyToOne private Armacao armacao;
    @ManyToOne private Lente lenteEsquerda;
    @ManyToOne private Lente lenteDireita;
    @ManyToOne private Laboratorio laboratorio;

    @Enumerated(EnumType.STRING)
    private StatusOS status; // ver máquina de estados abaixo

    @OneToMany(mappedBy = "ordemServico", cascade = CascadeType.ALL, orderBy = "dataHora ASC")
    private List<EventoOS> historico = new ArrayList<>();

    private LocalDateTime previsaoEntrega;
    private LocalDateTime dataEntregaReal;

    // diferencial: SLA e alerta de atraso
    private boolean alertaAtrasoDisparado;
}
```

**Máquina de estados de `StatusOS`** (diferencial central — a maioria dos sistemas trata isso como um campo livre "em andamento/pronto"):

```
ORCAMENTO → PEDIDO_CONFIRMADO → ENVIADO_LABORATORIO → EM_PRODUCAO
   → LENTE_PRONTA → MONTAGEM → CONTROLE_QUALIDADE → PRONTO_PARA_RETIRADA
   → ENTREGUE
   (ramificações: CANCELADO, DEVOLVIDO_GARANTIA, RETRABALHO)
```

Cada transição gera um `EventoOS` (auditoria + timeline), e cada evento pode disparar uma notificação automática ao cliente (WhatsApp/SMS/e-mail) — replicando a experiência de "rastreamento de encomenda" que o e-commerce já popularizou, mas que nenhum sistema de ótica nacional oferece de forma nativa hoje.

```java
@Entity
@Getter @Setter @NoArgsConstructor @SuperBuilder
public class EventoOS extends EntidadeBase {
    @ManyToOne private OrdemServico ordemServico;
    @Enumerated(EnumType.STRING) private StatusOS statusAnterior;
    @Enumerated(EnumType.STRING) private StatusOS statusNovo;
    private LocalDateTime dataHora;
    private String responsavel;
    private String observacao;
}
```

### 4.6 Financeiro, Estoque, Convênio, Agenda

Seguem o padrão clássico de ERP (não detalhado por extenso aqui para não inflar o documento, mas fazem parte do escopo):

- `ContaReceber` / `ContaPagar` / `FormaPagamento` / `Comissao`
- `Estoque` (por loja) / `MovimentacaoEstoque` / `TransferenciaEstoque`
- `Convenio` / `TabelaReembolso` / `GuiaConvenio`
- `Agendamento` (exame, consulta, prova de óculos, entrega agendada)
- `PedidoCompra` / `Fornecedor` / `Recebimento`

---

## 5. Comparativo com Sistemas de Mercado

| Funcionalidade | Sistemas de mercado (típico) | VisionBox |
|---|---|---|
| PDV / venda balcão | ✅ Presente, geralmente bom | ✅ Presente |
| Cadastro de receita | ✅ Campos básicos | ✅ Estruturado + digitalização + validação de coerência entre olhos |
| Rastreamento de OS | ⚠️ Status genérico, sem timeline | ✅ Máquina de estados + timeline + notificações automáticas |
| Integração com laboratório | ⚠️ Manual (e-mail/telefone) | ✅ API/EDI padronizado + roteamento automático por tipo de lente |
| Recall de receita vencida | ❌ Raro ou manual | ✅ Job automático + campanha de recontato |
| Multi-loja | ⚠️ Módulo pago à parte, mal integrado | ✅ Nativo, com transferência de estoque entre lojas |
| Prova virtual de óculos | ❌ Inexistente | ✅ Opcional via WebAR (ver seção 6) |
| Portal/app do cliente | ❌ Inexistente | ✅ Acompanhamento de OS, histórico de receitas, assinatura de lentes de contato |
| Fiscal (NFC-e/NF-e) | ✅ Presente | ✅ Presente + modo de contingência offline |
| BI / dashboards | ⚠️ Relatórios estáticos | ✅ Dashboards + indicadores de SLA de laboratório |
| Assinatura recorrente (lentes de contato) | ❌ Raro | ✅ Nativo, com cobrança recorrente |
| Garantia e pós-venda | ⚠️ Controle manual | ✅ Workflow de garantia vinculado à OS original |

---

## 6. Diferenciais Propostos (o que o mercado não tem)

1. **Timeline de Ordem de Serviço com notificação automática** — cliente recebe WhatsApp a cada mudança de status (lente pronta, na montagem, pronto para retirada), reduzindo ligações para a loja.
2. **Integração padronizada com laboratórios** — API/webhook para enviar especificação de lente e receber status de produção, eliminando planilhas e e-mails manuais. Onde o laboratório não tiver API, fallback para geração de PDF/EDI padrão do setor.
3. **Recall inteligente** — job agendado identifica receitas próximas do vencimento (ex: 2 anos) e clientes sem compra há X meses, disparando campanha segmentada por canal preferido.
4. **Prova virtual de armação (WebAR)** — módulo opcional que usa a webcam do cliente (via app ou totem na loja) para sobrepor modelos 3D de armação, reduzindo a etapa de prova física para pré-seleção.
5. **Assinatura de lentes de contato** — modelo de receita recorrente (cobrança mensal/trimestral via gateway), algo raro em sistemas de ótica nacionais, mas comum em óticas digitais internacionais.
6. **Estoque multi-loja de verdade** — transferência entre lojas com rastreabilidade, reserva de item para OS em andamento, sugestão automática de reposição baseada em giro.
7. **SLA de laboratório mensurável** — o sistema registra tempo médio de cada laboratório por tipo de lente e alerta quando uma OS está em risco de atraso, permitindo à loja avisar o cliente proativamente.
8. **Modo offline/contingência no PDV** — reaproveitando a experiência de outros projetos (padrão outbox + fila local), a venda continua funcionando mesmo com internet instável, sincronizando e emitindo a nota fiscal quando a conexão retorna.
9. **Portal do cliente** — histórico de receitas, OS em andamento, garantia ativa, e opção de reagendar prova/entrega.
10. **Compliance LGPD nativo** — dado clínico (receita) tratado com criptografia em repouso e trilha de auditoria de acesso, algo que sistemas genéricos de varejo adaptados para ótica costumam negligenciar.

---

## 7. Segurança e Auditoria

- Autenticação JWT (access + refresh token), RBAC por perfil: Vendedor, Ótico/Técnico, Gerente, Financeiro, Administrador.
- Dados clínicos (receita) com campo sensível auditado — toda leitura/gravação registrada em `LogAuditoria` (quem, quando, o quê).
- Criptografia em repouso para CPF e dados de receita (coluna criptografada ou `pgcrypto`).
- Conformidade LGPD: consentimento de uso de dado para campanha de recall, direito de exclusão/anonimização.

---

## 8. Roadmap Sugerido

**Fase 1 — MVP (loja única):**
Cliente, Receita, Catálogo, PDV, Ordem de Serviço com máquina de estados básica, Financeiro simples, Fiscal (NFC-e).

**Fase 2 — Diferenciação:**
Timeline com notificação automática, integração com laboratório, recall automático, dashboards de SLA.

**Fase 3 — Escala:**
Multi-loja, portal do cliente, assinatura de lentes de contato, prova virtual (WebAR).

**Fase 4 — Expansão:**
App mobile nativo, marketplace de laboratórios parceiros, IA de recomendação de armação por formato de rosto.

---

## 9. Paleta de Cores (Design System)

Arquivo completo em `theme-visionbox.css` (variáveis CSS, modo claro e escuro).

| Token | Cor | Uso |
|---|---|---|
| `--color-primary` | `#1D4E6B` (azul confiança) | Marca, header, sidebar, botão primário |
| `--color-secondary` | `#3FA6A0` (verde-água lente) | Ação secundária, status positivo |
| `--color-warning` | `#E8A33D` (âmbar armação) | Atenção, prazo próximo, pendência |
| `--color-danger` | `#D9564A` (coral) | Erro, atraso de SLA, retrabalho, cancelamento |
| `--color-bg-page` / `--color-bg-card` | `#F4F6F8` / `#FFFFFF` | Fundo de tela e de card |
| `--color-text-primary` | `#1A2733` | Texto principal |

O arquivo já inclui:
- Variante `[data-theme="dark"]` completa, pensada para PDV usado em turno noturno ou loja com pouca luz.
- Classes semânticas (`.status-*`) mapeando cada estado da Ordem de Serviço (seção 4.5) para uma cor — a mesma lógica de "semáforo" pode ser usada tanto no painel interno da loja quanto no portal do cliente.
- Pares fundo/texto pensados para contraste mínimo AA (4.5:1).

---

## 10. Observações de Reaproveitamento

Este projeto pode reaproveitar diretamente da experiência do **OUTBOXERP**:
- Padrão de sincronização offline (outbox pattern + RabbitMQ + fila local) para o PDV.
- Abordagem de contingência fiscal SEFAZ.
- Estrutura de multi-tenant já validada em outro domínio.

Isso reduz o risco técnico do MVP, já que os pontos mais delicados (fiscal e offline) já têm um caminho testado em outro projeto da mesma stack.
