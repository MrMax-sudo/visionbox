package com.visionbox.modules.compras.service;

import com.visionbox.modules.compras.domain.Compra;
import com.visionbox.modules.compras.domain.CompraItem;
import com.visionbox.modules.compras.dto.CompraItemResponse;
import com.visionbox.modules.compras.dto.CompraResponse;
import com.visionbox.modules.compras.repository.CompraRepository;
import com.visionbox.modules.catalogo.domain.Produto;
import com.visionbox.modules.catalogo.repository.ProdutoRepository;
import com.visionbox.modules.estoque.service.EstoqueService;
import com.visionbox.modules.financeiro.domain.ContaPagar;
import com.visionbox.modules.financeiro.repository.ContaPagarRepository;
import com.visionbox.shared.tenant.TenantContext;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

/**
 * Importação de XML de NF-e de ENTRADA (§3.4 — Compras de Fornecedores).
 * <p>
 * Fluxo (transação única — ou entra tudo, ou nada):
 * <ol>
 *   <li>parse do XML (NfeXmlParser);</li>
 *   <li>idempotência por chave de acesso (44 dígitos) por loja;</li>
 *   <li>de-para item → produto por EAN, depois SKU do fornecedor, senão pré-cadastro automático
 *       (item pré-cadastrado responde {@code preCadastrado=true}; item casado no catálogo, {@code false});</li>
 *   <li>custo do produto atualizado com o último preço de compra + NCM se vazio;</li>
 *   <li>entrada em estoque ({@link EstoqueService#adicionar});</li>
 *   <li>geração de ContaPagar: uma por duplicata do XML; sem duplicata → título único na data de emissão.</li>
 * </ol>
 * Emissão fiscal não é daqui — o XML é consumido, o Flowbox emite (R3).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CompraImportacaoService {

    private final CompraRepository compraRepository;
    private final ProdutoRepository produtoRepository;
    private final EstoqueService estoqueService;
    private final ContaPagarRepository contaPagarRepository;
    private final NfeXmlParser parser;

    /**
     * Importa o XML da NF-e para a loja corrente do TenantContext.
     *
     * @param xml       conteúdo do arquivo XML
     * @param usuarioId id derivado do JWT de quem importou (nullable)
     * @return compra criada com itens e ids dos títulos gerados
     * @throws IllegalArgumentException XML inválido
     * @throws IllegalStateException    NF-e já importada nesta loja
     */
    @Transactional
    public CompraResponse importarXml(String xml, UUID usuarioId) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        NfeXmlParser.NfeDocumento doc = parser.parse(xml);

        if (compraRepository.existsByLojaIdAndChaveAcessoAndAtivoTrue(lojaId, doc.chaveAcesso())) {
            throw new IllegalStateException(
                    "NF-e já importada nesta loja (chave de acesso " + doc.chaveAcesso() + ")");
        }

        List<ProdutoResultado> resolvidos = new ArrayList<>();
        for (NfeXmlParser.ItemNfe item : doc.itens()) {
            Optional<Produto> existente = buscarNoCatalogo(lojaId, item);
            Produto produto = existente.orElseGet(() -> preCadastroAutomatico(lojaId, item));
            produto = atualizarCustoEItemCatalogo(lojaId, produto, item);
            resolvidos.add(new ProdutoResultado(item, produto, existente.isEmpty()));
        }

        BigDecimal subtotalItens = doc.itens().stream()
                .map(NfeXmlParser.ItemNfe::valorTotal)
                .filter(v -> v != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_EVEN);

        Compra compra = Compra.builder()
                .lojaId(lojaId)
                .numero(doc.numero())
                .serie(doc.serie())
                .chaveAcesso(doc.chaveAcesso())
                .dataEmissao(doc.dataEmissao())
                .fornecedorNome(doc.emitenteNome())
                .fornecedorCnpj(doc.emitenteCnpj())
                .valorSubtotal(subtotalItens)
                .desconto(doc.desconto())
                .frete(doc.frete())
                .valorTotal(doc.valorTotal())
                .status(Compra.StatusCompra.IMPORTADA)
                .xmlFiscal(xml)
                .usuarioId(usuarioId)
                .build();

        for (ProdutoResultado r : resolvidos) {
            NfeXmlParser.ItemNfe item = r.item();
            compra.addItem(CompraItem.builder()
                    .lojaId(lojaId)
                    .produtoId(r.produto().getId())
                    .descricao(item.descricao())
                    .ncm(item.ncm())
                    .ean(item.ean())
                    .codigoFornecedor(item.codigoFornecedor())
                    .unidade(item.unidade())
                    .quantidade(item.quantidade())
                    .custoUnitario(item.custoUnitario())
                    .valorTotal(item.valorTotal() != null
                            ? item.valorTotal()
                            : item.custoUnitario().multiply(item.quantidade()).setScale(2, RoundingMode.HALF_EVEN))
                    .preCadastrado(r.preCadastrado())
                    .build());
        }
        compra = compraRepository.save(compra);

        // Entrada de estoque (unidades inteiras — frações são arredondadas e logadas).
        for (ProdutoResultado r : resolvidos) {
            int qtd = quantidadeInteira(r.item());
            if (qtd > 0) {
                estoqueService.adicionar(r.produto().getId(), qtd);
            }
        }

        List<UUID> contaIds = gerarContasPagar(lojaId, compra, doc);

        log.info("NF-e importada loja={} chave={} numero={}/{} itens={} contasPagar={} preCadastros={}",
                lojaId, doc.chaveAcesso(), doc.numero(), doc.serie(), resolvidos.size(), contaIds.size(),
                resolvidos.stream().filter(ProdutoResultado::preCadastrado).count());
        return toResponse(compra, contaIds, true, true);
    }

    @Transactional(readOnly = true)
    public Page<CompraResponse> listar(Pageable pageable) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        return compraRepository.findAllByLojaId(lojaId, pageable).map(c -> toResponse(c, null, false, false));
    }

    @Transactional(readOnly = true)
    public CompraResponse buscar(UUID id) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        Compra compra = compraRepository.findByIdComItens(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Compra não encontrada"));
        return toResponse(compra, null, true, false);
    }

    // ------------------------------------------------------------------
    // De-para produto: EAN → SKU do fornecedor → pré-cadastro automático
    // ------------------------------------------------------------------

    /** Procura o item no catálogo por EAN, depois por SKU/código do fornecedor. */
    private Optional<Produto> buscarNoCatalogo(UUID lojaId, NfeXmlParser.ItemNfe item) {
        if (item.ean() != null) {
            Optional<Produto> porEan = produtoRepository.findByCodigoBarrasAndLojaId(item.ean(), lojaId);
            if (porEan.isPresent()) return porEan;
        }
        if (item.codigoFornecedor() != null && !item.codigoFornecedor().isBlank()) {
            Optional<Produto> porSku = produtoRepository.findBySkuAndLojaId(item.codigoFornecedor().trim(), lojaId);
            if (porSku.isPresent()) return porSku;
            // fornecedor às vezes usa o EAN como código interno
            Optional<Produto> porCodBarras = produtoRepository
                    .findByCodigoBarrasAndLojaId(item.codigoFornecedor().trim(), lojaId);
            if (porCodBarras.isPresent()) return porCodBarras;
        }
        return Optional.empty();
    }

    private Produto preCadastroAutomatico(UUID lojaId, NfeXmlParser.ItemNfe item) {
        String nome = item.descricao().trim();
        if (nome.length() > 200) nome = nome.substring(0, 200);

        String sku = escolherSkuLivre(lojaId, item);
        Produto novo = Produto.builder()
                .lojaId(lojaId)
                .sku(sku)
                .codigoBarras(item.ean())
                .nome(nome)
                .ncm(item.ncm() != null && item.ncm().matches("\\d{8}") ? item.ncm() : null)
                .custo(item.custoUnitario())
                // Sem regra de markup na importação: preço de venda nasce em 0 e o lojista
                // define depois (mesmo critério do criarProdutoNovo do Outbox ERP).
                .precoVenda(BigDecimal.ZERO)
                .build();
        Produto salvo = produtoRepository.save(novo);
        log.info("Pré-cadastro automático de produto por XML loja={} sku={} nome={} ean={}",
                lojaId, sku, nome, item.ean());
        return salvo;
    }

    /** Escolhe SKU livre: código do fornecedor → EAN → fallback XML-<chave curta>-<n>. */
    private String escolherSkuLivre(UUID lojaId, NfeXmlParser.ItemNfe item) {
        List<String> candidatos = new ArrayList<>();
        if (item.codigoFornecedor() != null) {
            String san = sanitizarSku(item.codigoFornecedor());
            if (san != null) candidatos.add(san);
        }
        if (item.ean() != null) candidatos.add(item.ean());
        for (String c : candidatos) {
            if (!produtoRepository.existsBySkuAndLojaId(c, lojaId)) return c;
        }
        String san = item.codigoFornecedor() != null ? sanitizarSku(item.codigoFornecedor()) : null;
        String base;
        if (san != null) {
            base = "XML-" + san;
        } else if (item.ean() != null) {
            base = "XML-" + item.ean();
        } else {
            base = "XML-ITEM";
        }
        String candidato = base;
        int n = 1;
        while (produtoRepository.existsBySkuAndLojaId(candidato, lojaId)) {
            candidato = base + "-" + n++;
            if (n > 1000) {
                throw new IllegalStateException("Não foi possível gerar SKU único para pré-cadastro: " + base);
            }
        }
        return candidato;
    }

    /** Último custo de compra vira o custo do produto; NCM preenchido se o catálogo estiver vazio. */
    private Produto atualizarCustoEItemCatalogo(UUID lojaId, Produto produto, NfeXmlParser.ItemNfe item) {
        boolean mudou = false;
        if (item.custoUnitario() != null && item.custoUnitario().compareTo(BigDecimal.ZERO) >= 0
                && (produto.getCusto() == null || produto.getCusto().compareTo(item.custoUnitario()) != 0)) {
            produto.setCusto(item.custoUnitario());
            mudou = true;
        }
        if ((produto.getNcm() == null || produto.getNcm().isBlank())
                && item.ncm() != null && item.ncm().matches("\\d{8}")) {
            produto.setNcm(item.ncm());
            mudou = true;
        }
        if (mudou) {
            return produtoRepository.save(produto);
        }
        return produto;
    }

    // ------------------------------------------------------------------
    // Contas a pagar (§3.4): duplicatas do XML → títulos; sem duplicata → título único
    // ------------------------------------------------------------------

    private List<UUID> gerarContasPagar(UUID lojaId, Compra compra, NfeXmlParser.NfeDocumento doc) {
        List<UUID> ids = new ArrayList<>();
        if (!doc.duplicatas().isEmpty()) {
            int total = doc.duplicatas().size();
            int i = 1;
            for (NfeXmlParser.DuplicataNfe dup : doc.duplicatas()) {
                UUID id = salvarTitulo(lojaId, compra, doc, dup.vencimento(), dup.valor(),
                        dup.numero(), i, total);
                if (id != null) ids.add(id);
                i++;
            }
        } else {
            // XML sem cobr/dup → título único com data de emissão (regra do escopo Fase 4).
            UUID id = salvarTitulo(lojaId, compra, doc, doc.dataEmissao(), doc.valorTotal(),
                    doc.numero(), null, null);
            if (id != null) ids.add(id);
        }
        return ids;
    }

    private UUID salvarTitulo(UUID lojaId, Compra compra, NfeXmlParser.NfeDocumento doc,
                              LocalDate vencimento, BigDecimal valor, String numeroDocumento,
                              Integer parcela, Integer totalParcelas) {
        if (valor == null || valor.compareTo(BigDecimal.ZERO) <= 0) {
            log.warn("Duplicata com valor <= 0 ignorada loja={} compra={} valor={}", lojaId, compra.getId(), valor);
            return null;
        }
        ContaPagar conta = ContaPagar.builder()
                .lojaId(lojaId)
                .fornecedor(doc.emitenteNome())
                .descricao("NF-e " + doc.numero() + (doc.serie() != null ? "/" + doc.serie() : "")
                        + " - " + doc.emitenteNome())
                .numeroDocumento(numeroDocumento)
                .valor(valor.setScale(2, RoundingMode.HALF_EVEN))
                .valorPago(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_EVEN))
                .vencimento(vencimento)
                .dataCompetencia(doc.dataEmissao())
                .parcela(parcela)
                .totalParcelas(totalParcelas)
                .status(ContaPagar.StatusContaPagar.PENDENTE)
                .build();
        conta.normalizarValor();
        ContaPagar salva = contaPagarRepository.save(conta);
        return salva.getId();
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private int quantidadeInteira(NfeXmlParser.ItemNfe item) {
        BigDecimal q = item.quantidade();
        int inteira = q.setScale(0, RoundingMode.HALF_UP).intValueExact();
        if (q.stripTrailingZeros().scale() > 0) {
            log.warn("Quantidade fracionada no XML arredondada para estoque: item={} qtd={} -> {}",
                    item.descricao(), q, inteira);
        }
        return inteira;
    }

    private String sanitizarSku(String bruto) {
        if (bruto == null) return null;
        String s = bruto.trim().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9_-]", "-");
        s = s.replaceAll("-{2,}", "-");
        if (s.length() > 40) s = s.substring(0, 40);
        s = s.replaceAll("^-+|-+$", "");
        return s.isEmpty() ? null : s;
    }

    /**
     * @param origemImportacao TRUE quando o response é da própria importação — único
     *                         momento em que a origem (pré-cadastro vs catálogo) é
     *                         conhecida; leituras persistidas expõem null.
     */
    private CompraResponse toResponse(Compra c, List<UUID> contaIds, boolean incluirItens,
                                      boolean origemImportacao) {
        return CompraResponse.builder()
                .id(c.getId())
                .lojaId(c.getLojaId())
                .numero(c.getNumero())
                .serie(c.getSerie())
                .chaveAcesso(c.getChaveAcesso())
                .dataEmissao(c.getDataEmissao() != null ? c.getDataEmissao().toString() : null)
                .fornecedorNome(c.getFornecedorNome())
                .fornecedorCnpj(c.getFornecedorCnpj())
                .valorSubtotal(c.getValorSubtotal())
                .desconto(c.getDesconto())
                .frete(c.getFrete())
                .valorTotal(c.getValorTotal())
                .status(c.getStatus() != null ? c.getStatus().name() : null)
                .itens(incluirItens && c.getItens() != null && !c.getItens().isEmpty()
                        ? c.getItens().stream().map(i -> toItemResponse(i, origemImportacao)).toList()
                        : null)
                .contasPagarIds(contaIds)
                .build();
    }

    private CompraItemResponse toItemResponse(CompraItem i, boolean origemImportacao) {
        return CompraItemResponse.builder()
                .id(i.getId())
                .produtoId(i.getProdutoId())
                .descricao(i.getDescricao())
                .ncm(i.getNcm())
                .ean(i.getEan())
                .codigoFornecedor(i.getCodigoFornecedor())
                .unidade(i.getUnidade())
                .quantidade(i.getQuantidade())
                .custoUnitario(i.getCustoUnitario())
                .valorTotal(i.getValorTotal())
                .preCadastrado(origemImportacao ? i.isPreCadastrado() : null)
                .build();
    }

    private record ProdutoResultado(NfeXmlParser.ItemNfe item, Produto produto, boolean preCadastrado) {
    }
}
