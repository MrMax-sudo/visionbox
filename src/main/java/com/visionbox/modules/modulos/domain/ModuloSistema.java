package com.visionbox.modules.modulos.domain;

import java.util.Arrays;
import java.util.List;

/**
 * ModuloSistema — catálogo canônico de módulos SaaS do VisionBox (R11).
 * <p>
 * Fonte: {@code docs/PLANO_ROBUSTEZ_ERP_REFERENCIA_OUTBOX.md} §4.1 (tabela de códigos,
 * nome de exibição, descrição e prefixos de rota). Todo novo recurso/tela DEVE estar
 * mapeado aqui antes de nascer (R11) e ser condicionado a
 * {@code @RequerModulo} (backend) / {@code GuardaModulo} (frontend).
 * <p>
 * Obs.: a spec intitula a tabela como "18 módulos", mas a própria tabela §4.1 tem 19 linhas;
 * os 19 códigos foram implementados conforme a tabela (é ela que é canônica).
 */
public enum ModuloSistema {

    PDV_BALCAO("PDV & Frente de Caixa",
            "Vendas de balcão, caixa diário e recibos térmicos 80mm",
            "/pdv", "/api/v1/vendas"),
    ORDEM_SERVICO("Ordem de Serviço Ótica",
            "Máquina de 12 status, armações, lentes e laboratório",
            "/os", "/api/v1/ordens-servico"),
    RECEITAS_CLINICAS("Receitas Oftálmicas",
            "Gestão de receitas, esférico, cilíndrico, eixo e DNP",
            "/receitas", "/api/v1/receitas"),
    CENTRAL_VENDAS("Central de Vendas & Cupons",
            "Histórico de vendas, reimpressão térmica/DANFE e SEFAZ",
            "/vendas", "/api/v1/vendas/historico"),
    CAIXA_TURNOS("Gestão de Caixa & Turnos",
            "Turnos por operador, sangria, suprimento e fechamento cego",
            "/caixas", "/api/v1/caixa"),
    FINANCEIRO_COMPLETO("Financeiro & DRE",
            "Contas a receber (baixas parciais), a pagar, DRE e OFX",
            "/financeiro", "/api/v1/financeiro"),
    FISCAL_FLOWBOX("Emissão Fiscal (NFC-e/NF-e)",
            "Transmissão de notas fiscais integrada ao Flowbox",
            "/configuracoes/fiscal", "/api/v1/fiscal"),
    COMPRAS_XML("Compras & Importação XML",
            "Entrada de notas de distribuidores e carga de estoque",
            "/compras", "/api/v1/compras"),
    ESTOQUE_LOTES("Lotes & Validades ANVISA",
            "Rastreio FEFO/FIFO de lentes de contato e soluções",
            "/lotes", "/api/v1/lotes"),
    ETIQUETAS("Impressão de Etiquetas",
            "Impressão de etiquetas para óculos e código de barras",
            "/etiquetas", "/api/v1/etiquetas"),
    SUGESTAO_COMPRAS("Previsão & Sugestão Compras",
            "Cálculo inteligente de giro e reposição de estoque",
            "/sugestao-compras", "/api/v1/sugestao-compras"),
    SCANNER_MOVEL("Coletor Móvel / Scanner",
            "Bipagem por celular via QR Code e SSE",
            "/scanner", "/api/v1/scanner"),
    TABELAS_PRECO("Tabelas de Preço & Convênios",
            "Preços diferenciados para sindicatos, empresas e parcerias",
            "/tabelas-preco", "/api/v1/tabelas-preco"),
    FIDELIDADE_PONTOS("Programa de Fidelidade",
            "Acúmulo de pontos, presentes de aniversário e cashback",
            "/fidelidade", "/api/v1/fidelidade"),
    ORCAMENTO_ONLINE("Orçamento WhatsApp + PIN",
            "Visualização de proposta no celular com PIN de segurança",
            "/orcamentos", "/api/v1/orcamentos"),
    KITS_COMBOS("Kits & Combos Promocionais",
            "Pacotes comerciais com baixa automática dos insumos",
            "/kits", "/api/v1/kits"),
    LAB_PORTAL("Portal do Laboratório",
            "Portal de terceirização e tracking para montadores",
            "/lab", "/api/v1/lab"),
    RASTREIO_CLIENTE("Rastreio PWA do Cliente",
            "Acompanhamento do status dos óculos pelo cliente final",
            "/rastreio", "/api/v1/rastreio"),
    ALERTAS_TELEGRAM("Notificações no Telegram",
            "Alertas operacionais de fechamento e sangria no celular",
            "/configuracoes/telegram", "/api/v1/telegram");

    private final String nomeExibicao;
    private final String descricao;
    private final List<String> rotas;

    ModuloSistema(String nomeExibicao, String descricao, String... rotas) {
        this.nomeExibicao = nomeExibicao;
        this.descricao = descricao;
        this.rotas = List.of(rotas);
    }

    public String getNomeExibicao() {
        return nomeExibicao;
    }

    public String getDescricao() {
        return descricao;
    }

    /** Prefixos de rota (frontend e API) que este módulo protege. */
    public List<String> getRotas() {
        return rotas;
    }

    /** Código persistido em modulo_configuracao_loja.modulo_codigo (= name() do enum). */
    public String getCodigo() {
        return name();
    }

    /**
     * Resolve o enum a partir do código persistido/recebido na API.
     *
     * @throws IllegalArgumentException com mensagem listando o problema (vira 400 no handler)
     */
    public static ModuloSistema deCodigo(String codigo) {
        if (codigo == null || codigo.isBlank()) {
            throw new IllegalArgumentException("Código de módulo ausente. Use um dos códigos de ModuloSistema.");
        }
        try {
            return valueOf(codigo.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Código de módulo inválido: '" + codigo
                    + "'. Use um dos códigos de ModuloSistema (ex: ETIQUETAS, PDV_BALCAO).");
        }
    }

    /** Todos os códigos válidos — usado em validação de payload e em testes de cobertura. */
    public static List<ModuloSistema> todos() {
        return Arrays.asList(values());
    }
}
