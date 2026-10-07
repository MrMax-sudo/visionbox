package com.visionbox.modules.catalogo.service;

import com.visionbox.modules.catalogo.domain.Produto;
import com.visionbox.modules.catalogo.dto.ProdutoRequest;
import com.visionbox.modules.catalogo.dto.ProdutoResponse;
import com.visionbox.modules.catalogo.mapper.ProdutoMapper;
import com.visionbox.modules.catalogo.repository.ProdutoRepository;
import com.visionbox.shared.dto.ImportacaoResultado;
import com.visionbox.shared.tenant.TenantContext;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProdutoService {

    private final ProdutoRepository repository;
    private final ProdutoMapper mapper;

    @Transactional(readOnly = true)
    public Page<ProdutoResponse> listar(String q, String categoria, String marca, Pageable pageable) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        String termo = (q == null || q.isBlank()) ? null : q.trim();
        String categoriaFiltro = (categoria == null || categoria.isBlank()) ? null : categoria.trim();
        String marcaFiltro = (marca == null || marca.isBlank()) ? null : marca.trim();
        Produto.TipoProduto tipo = categoriaFiltro == null ? null : tipoPorRotuloCategoria(categoriaFiltro);
        // rótulo conhecido da UI (Armação/Lente…) → filtra por tipo_produto (sempre preenchido);
        // rótulo desconhecido → casa com a coluna texto categoria (grafia exata, case-insensitive)
        Page<Produto> page = repository.buscarFiltrado(lojaId, termo,
                tipo == null ? categoriaFiltro : null, tipo, marcaFiltro, pageable);
        return page.map(mapper::toResponse);
    }

    /**
     * Mapeia o rótulo de categoria usado na UI para o enum do domínio
     * (sem depender de acento/grafia na coluna texto {@code categoria}).
     * Retorna {@code null} quando o rótulo não é reconhecido.
     */
    static Produto.TipoProduto tipoPorRotuloCategoria(String categoria) {
        if (categoria == null) return null;
        String normalizado = java.text.Normalizer.normalize(categoria, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").trim().toUpperCase(java.util.Locale.ROOT);
        return switch (normalizado) {
            case "ARMACAO", "ARMACOES" -> Produto.TipoProduto.ARMACAO;
            case "LENTE", "LENTES" -> Produto.TipoProduto.LENTE;
            case "LENTEDECONTATO", "LENTESDECONTATO" -> Produto.TipoProduto.LENTE_CONTATO;
            case "ACESSORIO", "ACESSORIOS" -> Produto.TipoProduto.ACESSORIO;
            case "SERVICO", "SERVICOS" -> Produto.TipoProduto.SERVICO;
            default -> null;
        };
    }

    @Transactional(readOnly = true)
    public ProdutoResponse buscar(UUID id) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        Produto p = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Produto não encontrado"));
        return mapper.toResponse(p);
    }

    @Transactional
    public ProdutoResponse criar(ProdutoRequest req) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        if (repository.existsBySkuAndLojaId(req.getSku().trim(), lojaId)) {
            throw new IllegalArgumentException("SKU já cadastrado nesta loja");
        }
        Produto.TipoProduto tipo = parseTipo(req.getTipoProduto());
        String ncmAuto = resolverNcmAutomatico(tipo, req.getNcm());
        String cestAuto = resolverCestAutomatico(tipo, req.getCest());
        String cfopAuto = resolverCfopAutomatico(req.getCfop());

        validarNcm(ncmAuto);
        if (cestAuto != null) validarCest(cestAuto);
        if (cfopAuto != null) validarCfop(cfopAuto);
        if (req.getCbenef() != null) validarCbenef(req.getCbenef());

        Produto p = Produto.builder()
                .lojaId(lojaId)
                .sku(req.getSku().trim())
                .codigoBarras(req.getCodigoBarras())
                .nome(req.getNome().trim())
                .descricao(req.getDescricao())
                .tipoProduto(tipo)
                .marcaId(req.getMarcaId())
                .categoriaId(req.getCategoriaId())
                .marca(req.getMarca())
                .categoria(req.getCategoria())
                .ncm(ncmAuto)
                .cest(cestAuto)
                .cfop(cfopAuto)
                .cbenef(normalizeCbenef(req.getCbenef()))
                .custo(req.getCusto() != null ? req.getCusto() : BigDecimal.ZERO)
                .precoVenda(req.getPrecoVenda())
                .estoqueQuantidade(req.getEstoqueQuantidade() != null ? req.getEstoqueQuantidade() : 0)
                .estoqueReservado(0)
                .ativoVenda(req.getAtivoVenda() != null ? req.getAtivoVenda() : true)
                .build();
        p = repository.save(p);
        return mapper.toResponse(p);
    }

    @Transactional
    public ProdutoResponse atualizar(UUID id, ProdutoRequest req) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        Produto p = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Produto não encontrado"));
        if (req.getSku() != null && !req.getSku().equals(p.getSku())) {
            if (repository.existsBySkuAndLojaId(req.getSku().trim(), lojaId)) throw new IllegalArgumentException("SKU já cadastrado");
            p.setSku(req.getSku().trim());
        }
        if (req.getCodigoBarras() != null) p.setCodigoBarras(req.getCodigoBarras());
        if (req.getNome() != null) p.setNome(req.getNome().trim());
        if (req.getDescricao() != null) p.setDescricao(req.getDescricao());
        if (req.getTipoProduto() != null) p.setTipoProduto(parseTipo(req.getTipoProduto()));
        if (req.getMarcaId() != null) p.setMarcaId(req.getMarcaId());
        if (req.getCategoriaId() != null) p.setCategoriaId(req.getCategoriaId());
        if (req.getMarca() != null) p.setMarca(req.getMarca());
        if (req.getCategoria() != null) p.setCategoria(req.getCategoria());

        String ncmAuto = resolverNcmAutomatico(p.getTipoProduto(), req.getNcm() != null ? req.getNcm() : p.getNcm());
        validarNcm(ncmAuto);
        p.setNcm(ncmAuto);

        if (req.getCest() != null) {
            validarCest(req.getCest());
            p.setCest(normalizeCest(req.getCest()));
        } else if (p.getCest() == null) {
            p.setCest(resolverCestAutomatico(p.getTipoProduto(), null));
        }

        if (req.getCfop() != null) {
            validarCfop(req.getCfop());
            p.setCfop(normalizeCfop(req.getCfop()));
        } else if (p.getCfop() == null) {
            p.setCfop("5102");
        }

        if (req.getCbenef() != null) {
            validarCbenef(req.getCbenef());
            p.setCbenef(normalizeCbenef(req.getCbenef()));
        }
        if (req.getCusto() != null) p.setCusto(req.getCusto());
        if (req.getPrecoVenda() != null) p.setPrecoVenda(req.getPrecoVenda());
        if (req.getEstoqueQuantidade() != null) p.setEstoqueQuantidade(req.getEstoqueQuantidade());
        if (req.getAtivoVenda() != null) p.setAtivoVenda(req.getAtivoVenda());
        repository.save(p);
        return mapper.toResponse(p);
    }

    @Transactional
    public void remover(UUID id) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        Produto p = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Produto não encontrado"));
        p.setAtivo(false);
        repository.save(p);
    }

    private Produto.TipoProduto parseTipo(String s) {
        if (s == null || s.isBlank()) return Produto.TipoProduto.ARMACAO;
        try { return Produto.TipoProduto.valueOf(s.trim().toUpperCase()); }
        catch (Exception e) { throw new IllegalArgumentException("tipoProduto inválido: " + s); }
    }

    public static String resolverNcmAutomatico(Produto.TipoProduto tipo, String ncmInformado) {
        if (ncmInformado != null && !ncmInformado.isBlank()) {
            return ncmInformado.trim().replaceAll("\\D", "");
        }
        if (tipo == null) return "90031100";
        return switch (tipo) {
            case ARMACAO -> "90031100";     // Armações para óculos
            case LENTE -> "90015000";       // Lentes para óculos de outras matérias (resina/policarbonato)
            case LENTE_CONTATO -> "90013000";// Lentes de contato
            case ACESSORIO -> "90039090";   // Partes de armações / acessórios de óculos
            case SERVICO -> "00000000";     // Serviço / montagem
        };
    }

    public static String resolverCestAutomatico(Produto.TipoProduto tipo, String cestInformado) {
        if (cestInformado != null && !cestInformado.isBlank()) {
            return cestInformado.trim().replaceAll("\\D", "");
        }
        if (tipo == null) return "2806400";
        return switch (tipo) {
            case ARMACAO, LENTE -> "2806400"; // CEST Óculos e lentes
            default -> null;
        };
    }

    public static String resolverCfopAutomatico(String cfopInformado) {
        if (cfopInformado != null && !cfopInformado.isBlank()) {
            return cfopInformado.trim().replaceAll("\\D", "");
        }
        return "5102"; // Venda de mercadoria adquirida de terceiros dentro do estado
    }

    private void validarFiscal(ProdutoRequest req) {
        if (req.getNcm() != null) validarNcm(req.getNcm());
        if (req.getCest() != null) validarCest(req.getCest());
        if (req.getCfop() != null) validarCfop(req.getCfop());
        if (req.getCbenef() != null) validarCbenef(req.getCbenef());
    }

    /**
     * Validação fiscal para NCM de ótica.
     * Regra: NCM deve ter 8 dígitos numéricos e pertencer ao capítulo 90 (ótico).
     * Para VisionBox aceita prefixos 9003 (armações), 9004 (óculos) e 9001 (lentes/blocos).
     * Divergência entre estados documentada: ICMS difere por UF mas CSOSN 102 isenta para Simples Nacional CRT 1.
     * <p>
     * NCMs seed: 90031100 (armação de plástico) e 90015000 (lentes oftálmicas) validados com CRT 1 CSOSN 102 via tributacao_regra.
     */
    void validarNcm(String ncm) {
        if (ncm == null || ncm.isBlank()) return;
        String v = ncm.trim();
        if (!v.matches("\\d{8}")) {
            throw new IllegalArgumentException("NCM deve ter 8 dígitos numéricos (ex: 90031100 armação, 90015000 lente)");
        }
        // Validação capítulo 90 ótica: armação 9003, óculos/lente 9004/9001
        if (!(v.startsWith("9003") || v.startsWith("9004") || v.startsWith("9001"))) {
            throw new IllegalArgumentException("NCM inválido para ótica: deve iniciar com 9003 (armações) ou 9001/9004 (lentes/óculos). NCMs suportados seed: 90031100, 90015000");
        }
    }

    void validarCest(String cest) {
        if (cest == null || cest.isBlank()) return;
        String v = cest.trim();
        if (!v.matches("\\d{7}")) {
            throw new IllegalArgumentException("CEST deve ter 7 dígitos numéricos");
        }
    }

    void validarCfop(String cfop) {
        if (cfop == null || cfop.isBlank()) return;
        String v = cfop.trim();
        if (!v.matches("\\d{4}")) {
            throw new IllegalArgumentException("CFOP deve ter 4 dígitos numéricos (ex: 5102 venda dentro UF, 5405 venda ST)");
        }
    }

    void validarCbenef(String cbenef) {
        if (cbenef == null || cbenef.isBlank()) return;
        String v = cbenef.trim();
        // cBenef padrão SEFAZ: até 10 caracteres alfanuméricos (ex: SP12345678); aceitar 6-10
        if (!v.matches("[A-Za-z0-9]{6,10}")) {
            throw new IllegalArgumentException("cBenef deve ter 6 a 10 caracteres alfanuméricos (código benefício fiscal UF)");
        }
        if (v.length() > 10) {
            throw new IllegalArgumentException("cBenef máximo 10 caracteres");
        }
    }

    private String normalizeNcm(String ncm) {
        if (ncm == null) return null;
        String v = ncm.trim();
        return v.isEmpty() ? null : v;
    }

    private String normalizeCest(String cest) {
        if (cest == null) return null;
        String v = cest.trim();
        return v.isEmpty() ? null : v;
    }

    private String normalizeCfop(String cfop) {
        if (cfop == null) return null;
        String v = cfop.trim();
        return v.isEmpty() ? null : v;
    }

    private String normalizeCbenef(String cbenef) {
        if (cbenef == null) return null;
        String v = cbenef.trim();
        return v.isEmpty() ? null : v.toUpperCase();
    }

    @Transactional
    public ImportacaoResultado importarCsv(MultipartFile file) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Arquivo CSV vazio ou ausente");
        }

        List<String> erros = new ArrayList<>();
        int processados = 0;
        int totalLinhas = 0;

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            boolean firstLine = true;

            while ((line = reader.readLine()) != null) {
                if (line.trim().isEmpty()) continue;
                totalLinhas++;

                // Pula cabeçalho se contiver "sku" ou "nome"
                if (firstLine && (line.toLowerCase().contains("sku") || line.toLowerCase().contains("nome"))) {
                    firstLine = false;
                    continue;
                }
                firstLine = false;

                // Suporta delimitador ';' ou ','
                String[] cols = line.contains(";") ? line.split(";") : line.split(",");
                if (cols.length < 3) {
                    erros.add("Linha " + totalLinhas + ": Formato inválido. Esperado no mínimo: sku, nome, precoVenda");
                    continue;
                }

                try {
                    String sku = cols[0].trim();
                    String nome = cols[1].trim();
                    String precoStr = cols[2].trim().replace("R$", "").replace(" ", "").replace(",", ".");
                    BigDecimal precoVenda = new BigDecimal(precoStr);

                    String tipo = cols.length > 3 && !cols[3].isBlank() ? cols[3].trim().toUpperCase() : "ARMACAO";
                    String precoCustoStr = cols.length > 4 && !cols[4].isBlank() ? cols[4].trim().replace(",", ".") : "0";
                    BigDecimal precoCusto = new BigDecimal(precoCustoStr);
                    int estoqueQtd = cols.length > 5 && !cols[5].isBlank() ? Integer.parseInt(cols[5].trim()) : 0;
                    String ncmInformado = cols.length > 6 && !cols[6].isBlank() ? cols[6].trim() : null;

                    Produto.TipoProduto tipoEnum = parseTipo(tipo);
                    String ncmFinal = resolverNcmAutomatico(tipoEnum, ncmInformado);
                    String cestFinal = resolverCestAutomatico(tipoEnum, null);
                    String cfopFinal = resolverCfopAutomatico(null);

                    // Se já existe, atualiza preço e estoque; senão cria novo
                    Produto p = repository.findBySkuAndLojaId(sku, lojaId)
                            .orElseGet(() -> Produto.builder()
                                    .lojaId(lojaId)
                                    .sku(sku)
                                    .ativo(true)
                                    .build());

                    p.setNome(nome);
                    p.setTipoProduto(tipoEnum);
                    p.setPrecoVenda(precoVenda);
                    p.setCusto(precoCusto);
                    p.setEstoqueQuantidade(estoqueQtd);
                    p.setNcm(ncmFinal);
                    if (p.getCest() == null) p.setCest(cestFinal);
                    if (p.getCfop() == null) p.setCfop(cfopFinal);

                    repository.save(p);
                    processados++;
                } catch (Exception e) {
                    erros.add("Linha " + totalLinhas + " (" + line + "): " + e.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("Erro ao processar arquivo CSV de produtos: {}", e.getMessage());
            erros.add("Falha ao ler arquivo CSV: " + e.getMessage());
        }

        return ImportacaoResultado.sucesso(totalLinhas, processados, erros);
    }
}
