package com.visionbox.modules.clinico.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.visionbox.modules.clinico.domain.Receita;
import com.visionbox.modules.clinico.dto.GrauDto;
import com.visionbox.modules.clinico.dto.ReceitaRequest;
import com.visionbox.modules.clinico.dto.ReceitaResponse;
import com.visionbox.modules.clinico.mapper.ReceitaMapper;
import com.visionbox.modules.clinico.repository.ReceitaRepository;
import com.visionbox.modules.pessoa.domain.Cliente;
import com.visionbox.modules.pessoa.repository.ClienteRepository;
import com.visionbox.shared.crypto.CryptoService;
import com.visionbox.shared.tenant.TenantContext;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReceitaService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final DateTimeFormatter FORMATO_DATA = DateTimeFormatter.ISO_LOCAL_DATE;
    /** Enviado pelo frontend como MONOFOCAL; domínio (V2__cliente_receita.sql) usa VISAO_SIMPLES. */
    private static final String TIPO_PADRAO = "VISAO_SIMPLES";
    private static final String MSG_DATA_INVALIDA =
            " com formato inválido: informe a data no formato yyyy-MM-dd (ex: 2026-10-07)";

    private final ReceitaRepository repository;
    private final ClienteRepository clienteRepository;
    private final ReceitaMapper mapper;
    private final CryptoService cryptoService;

    @Transactional(readOnly = true)
    public Page<ReceitaResponse> listar(UUID clienteId, Pageable pageable) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        Page<Receita> page;
        if (clienteId != null) {
            page = repository.findByLojaIdAndClienteId(lojaId, clienteId, pageable);
        } else {
            page = repository.findAllByLojaId(lojaId, pageable);
        }
        Map<UUID, String> nomes = nomesClientes(lojaId, page.getContent());
        return page.map(r -> montarResponse(r, nomes.get(r.getClienteId())));
    }

    @Transactional(readOnly = true)
    public ReceitaResponse buscar(UUID id) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        Receita r = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Receita não encontrada"));
        return montarResponse(r, lojaId);
    }

    @Transactional
    public ReceitaResponse criar(ReceitaRequest req) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        // valida cliente pertence à loja (tenant isolation R1) — reutiliza para evitar 2ª consulta
        Cliente cliente = clienteRepository.findByIdAndLojaId(req.getClienteId(), lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Cliente não encontrado para esta loja"));

        LocalDate emissao = resolverDataEmissao(req.getDataEmissao());
        LocalDate validade = resolverDataValidade(req.getDataValidade(), emissao);

        String tipo = normalizarTipo(req.getTipo());
        GrauDto od = normalizarGrau(req.getOd());
        GrauDto oe = normalizarGrau(req.getOe());
        validarGrau(od, "OD", tipo);
        validarGrau(oe, "OE", tipo);

        Receita e = Receita.builder()
                .lojaId(lojaId)
                .clienteId(req.getClienteId())
                .dataEmissao(emissao)
                .dataValidade(validade)
                .nomeMedico(req.getNomeMedico())
                .crmMedico(req.getCrmMedico())
                .odEsferico(null)
                .odCilindrico(null)
                .odEixo(null)
                .odAdicao(null)
                .odDnp(null)
                .oeEsferico(null)
                .oeCilindrico(null)
                .oeEixo(null)
                .oeAdicao(null)
                .oeDnp(null)
                .dp(parseDp(req.getDp()))
                .tipo(tipo)
                .observacao(req.getObservacao())
                .anexoS3Key(req.getAnexoS3Key())
                .anexoS3Bucket(req.getAnexoS3Bucket())
                .odCipher(encryptGrau(od))
                .oeCipher(encryptGrau(oe))
                .build();
        e = repository.save(e);
        return montarResponse(e, cliente.getNome());
    }

    @Transactional
    public ReceitaResponse atualizar(UUID id, ReceitaRequest req) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        Receita e = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Receita não encontrada"));
        if (req.getClienteId() != null) {
            clienteRepository.findByIdAndLojaId(req.getClienteId(), lojaId)
                    .orElseThrow(() -> new EntityNotFoundException("Cliente não encontrado"));
            e.setClienteId(req.getClienteId());
        }
        if (req.getDataEmissao() != null && !req.getDataEmissao().isBlank())
            e.setDataEmissao(parseData(req.getDataEmissao(), "dataEmissao"));
        if (req.getDataValidade() != null && !req.getDataValidade().isBlank())
            e.setDataValidade(parseData(req.getDataValidade(), "dataValidade"));
        if (e.getDataValidade() != null && e.getDataEmissao() != null && e.getDataValidade().isBefore(e.getDataEmissao()))
            throw new IllegalArgumentException("dataValidade não pode ser anterior à dataEmissao");
        if (req.getNomeMedico() != null) e.setNomeMedico(req.getNomeMedico());
        if (req.getCrmMedico() != null) e.setCrmMedico(req.getCrmMedico());

        // tipo efetivo para validação de adição (normalizado: MONOFOCAL -> VISAO_SIMPLES)
        String tipoEfetivo = normalizarTipo(req.getTipo() != null && !req.getTipo().isBlank() ? req.getTipo() : e.getTipo());

        if (req.getOd() != null) {
            GrauDto od = normalizarGrau(req.getOd());
            validarGrau(od, "OD", tipoEfetivo);
            e.setOdEsferico(null);
            e.setOdCilindrico(null);
            e.setOdEixo(null);
            e.setOdAdicao(null);
            e.setOdDnp(null);
            e.setOdCipher(encryptGrau(od));
        }
        if (req.getOe() != null) {
            GrauDto oe = normalizarGrau(req.getOe());
            validarGrau(oe, "OE", tipoEfetivo);
            e.setOeEsferico(null);
            e.setOeCilindrico(null);
            e.setOeEixo(null);
            e.setOeAdicao(null);
            e.setOeDnp(null);
            e.setOeCipher(encryptGrau(oe));
        }
        if (req.getTipo() != null && !req.getTipo().isBlank()) {
            // se mudou tipo, revalida graus existentes quanto à regra de adição
            validarGrau(resolveOd(e), "OD", tipoEfetivo);
            validarGrau(resolveOe(e), "OE", tipoEfetivo);
            e.setTipo(tipoEfetivo);
        }
        if (req.getObservacao() != null) e.setObservacao(req.getObservacao());
        if (req.getAnexoS3Key() != null) e.setAnexoS3Key(req.getAnexoS3Key());
        if (req.getAnexoS3Bucket() != null) e.setAnexoS3Bucket(req.getAnexoS3Bucket());
        if (req.getDp() != null) e.setDp(parseDp(req.getDp()));
        repository.save(e);
        return montarResponse(e, lojaId);
    }

    @Transactional
    public void remover(UUID id) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        Receita e = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Receita não encontrada"));
        e.setAtivo(false);
        repository.save(e);
    }

    // ---------------------------------------------------------------------
    // Normalização / parsing do payload do frontend
    // ---------------------------------------------------------------------

    /**
     * Normaliza o tipo da receita para o domínio do banco.
     * <p>
     * O frontend envia {@code MONOFOCAL}, mas o CHECK de {@code V2__cliente_receita.sql} aceita
     * apenas {@code VISAO_SIMPLES | MULTIFOCAL | BIFOCAL | LENTE_CONTATO}. Sem esta normalização,
     * a inserção estourava violação de CHECK (500).
     */
    String normalizarTipo(String tipo) {
        String valor = (tipo == null || tipo.isBlank()) ? TIPO_PADRAO : tipo.trim().toUpperCase(Locale.ROOT);
        return switch (valor) {
            case "MONOFOCAL", "SIMPLES", "VISAO_SIMPLES" -> "VISAO_SIMPLES";
            case "MULTIFOCAL" -> "MULTIFOCAL";
            case "BIFOCAL" -> "BIFOCAL";
            case "LENTE_CONTATO", "LENTEDECONTATO" -> "LENTE_CONTATO";
            default -> throw new IllegalArgumentException("tipoLente inválido: '" + tipo
                    + "'. Valores aceitos: MONOFOCAL (VISAO_SIMPLES), MULTIFOCAL, BIFOCAL, LENTE_CONTATO");
        };
    }

    /**
     * O frontend envia {@code adicao: 0} mesmo quando o tipo não é multifocal.
     * Tratamos 0 como "sem adição" para não violar a regra
     * "adicao só permitida quando tipo é MULTIFOCAL ou BIFOCAL".
     */
    GrauDto normalizarGrau(GrauDto grau) {
        if (grau == null) return null;
        if (grau.getAdicao() != null && grau.getAdicao().signum() == 0) {
            grau.setAdicao(null);
        }
        return grau;
    }

    private LocalDate resolverDataEmissao(String valor) {
        return (valor == null || valor.isBlank()) ? LocalDate.now() : parseData(valor, "dataEmissao");
    }

    private LocalDate resolverDataValidade(String valor, LocalDate emissao) {
        LocalDate validade = (valor == null || valor.isBlank()) ? emissao.plusYears(2) : parseData(valor, "dataValidade");
        if (validade.isBefore(emissao)) {
            throw new IllegalArgumentException("dataValidade não pode ser anterior à dataEmissao");
        }
        return validade;
    }

    private LocalDate parseData(String valor, String campo) {
        try {
            return LocalDate.parse(valor.trim(), FORMATO_DATA);
        } catch (DateTimeParseException ex) {
            // mensagem legível (400 via ProblemDetailHandler) em vez de 500
            throw new IllegalArgumentException(campo + MSG_DATA_INVALIDA);
        }
    }

    /** dp aceita número (62) ou texto ("62"); fora da faixa 1..100 → 400 legível. */
    private BigDecimal parseDp(String valor) {
        if (valor == null || valor.isBlank()) return null;
        BigDecimal dp;
        try {
            dp = new BigDecimal(valor.trim());
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException("dp inválido: informe um número (ex: 62)");
        }
        if (dp.compareTo(BigDecimal.ONE) < 0 || dp.compareTo(new BigDecimal("100")) > 0) {
            throw new IllegalArgumentException("dp fora do intervalo aceito: 1..100 mm");
        }
        return dp;
    }

    // ---------------------------------------------------------------------
    // Montagem de resposta (clienteNome sem N+1)
    // ---------------------------------------------------------------------

    private ReceitaResponse montarResponse(Receita receita, String clienteNome) {
        ReceitaResponse response = mapper.toResponse(receita);
        response.setOd(resolveOd(receita));
        response.setOe(resolveOe(receita));
        response.setClienteNome(clienteNome);
        return response;
    }

    private ReceitaResponse montarResponse(Receita receita, UUID lojaId) {
        return montarResponse(receita, nomeCliente(receita.getClienteId(), lojaId));
    }

    private String nomeCliente(UUID clienteId, UUID lojaId) {
        if (clienteId == null || lojaId == null) return null;
        return clienteRepository.findByIdAndLojaId(clienteId, lojaId).map(Cliente::getNome).orElse(null);
    }

    /** Uma única consulta para todos os clientes da página (evita N+1 no list). */
    private Map<UUID, String> nomesClientes(UUID lojaId, List<Receita> receitas) {
        if (receitas == null || receitas.isEmpty()) return Map.of();
        Set<UUID> ids = receitas.stream()
                .map(Receita::getClienteId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (ids.isEmpty()) return Map.of();
        return clienteRepository.findByLojaIdAndIdIn(lojaId, ids).stream()
                .filter(c -> c.getId() != null && c.getNome() != null)
                .collect(Collectors.toMap(Cliente::getId, Cliente::getNome, (a, b) -> a));
    }

    /**
     * Validação de grau conforme spec:
     * - esférico -30..30
     * - cilíndrico -10..0
     * - eixo 0..180 obrigatório se cilíndrico != 0
     * - adição 0..6 só se tipo MULTIFOCAL/BIFOCAL
     */
    void validarGrau(GrauDto g, String olho, String tipo) {
        if (g == null) return;
        if (g.getEsferico() != null) {
            if (g.getEsferico().compareTo(new BigDecimal("-30")) < 0 || g.getEsferico().compareTo(new BigDecimal("30")) > 0) {
                throw new IllegalArgumentException(olho + " esferico fora do intervalo -30..30");
            }
        }
        if (g.getCilindrico() != null) {
            if (g.getCilindrico().compareTo(new BigDecimal("-10")) < 0 || g.getCilindrico().compareTo(BigDecimal.ZERO) > 0) {
                throw new IllegalArgumentException(olho + " cilindrico fora do intervalo -10..0");
            }
        }
        // eixo obrigatório quando cilíndrico != 0
        if (g.getCilindrico() != null && g.getCilindrico().compareTo(BigDecimal.ZERO) != 0) {
            if (g.getEixo() == null) throw new IllegalArgumentException(olho + " eixo obrigatório quando cilindrico != 0");
            if (g.getEixo() < 0 || g.getEixo() > 180) throw new IllegalArgumentException(olho + " eixo deve estar 0-180");
        } else {
            // se eixo informado mesmo com cil 0, valida intervalo
            if (g.getEixo() != null && (g.getEixo() < 0 || g.getEixo() > 180)) {
                throw new IllegalArgumentException(olho + " eixo deve estar 0-180");
            }
        }
        if (g.getAdicao() != null) {
            if (g.getAdicao().compareTo(BigDecimal.ZERO) < 0 || g.getAdicao().compareTo(new BigDecimal("6")) > 0) {
                throw new IllegalArgumentException(olho + " adicao fora do intervalo 0..6");
            }
            boolean isMultifocal = "MULTIFOCAL".equalsIgnoreCase(tipo) || "BIFOCAL".equalsIgnoreCase(tipo);
            if (!isMultifocal) {
                throw new IllegalArgumentException(olho + " adicao só permitida quando tipo é MULTIFOCAL ou BIFOCAL (tipo atual: " + tipo + ")");
            }
        }
    }

    /** Compat overload sem tipo (assume VISAO_SIMPLES) para testes legados. */
    void validarGrau(GrauDto g, String olho) {
        validarGrau(g, olho, "VISAO_SIMPLES");
    }

    /**
     * Criptografa GrauDto em JSON AES-256-GCM via CryptoService para odCipher/oeCipher (ADR-002).
     * Retorna null se grau vazio.
     */
    private byte[] encryptGrau(GrauDto g) {
        if (g == null) return null;
        boolean allNull = g.getEsferico() == null && g.getCilindrico() == null && g.getEixo() == null && g.getAdicao() == null && g.getDnp() == null;
        if (allNull) return null;
        // monta JSON determinístico sem depender de ObjectMapper para evitar ciclo
        String json = "{\"esferico\":" + toJsonVal(g.getEsferico())
                + ",\"cilindrico\":" + toJsonVal(g.getCilindrico())
                + ",\"eixo\":" + (g.getEixo() != null ? g.getEixo().toString() : "null")
                + ",\"adicao\":" + toJsonVal(g.getAdicao())
                + ",\"dnp\":" + toJsonVal(g.getDnp()) + "}";
        return cryptoService.encrypt(json);
    }

    private static String toJsonVal(BigDecimal v) {
        return v != null ? v.toPlainString() : "null";
    }

    private GrauDto resolveOd(Receita receita) {
        GrauDto cipher = decryptGrau(receita.getOdCipher());
        if (cipher != null) {
            return normalizarGrau(cipher);
        }
        if (receita.getOdEsferico()==null && receita.getOdCilindrico()==null && receita.getOdEixo()==null && receita.getOdAdicao()==null && receita.getOdDnp()==null) {
            return null;
        }
        return normalizarGrau(GrauDto.builder()
                .esferico(receita.getOdEsferico())
                .cilindrico(receita.getOdCilindrico())
                .eixo(receita.getOdEixo())
                .adicao(receita.getOdAdicao())
                .dnp(receita.getOdDnp())
                .build());
    }

    private GrauDto resolveOe(Receita receita) {
        GrauDto cipher = decryptGrau(receita.getOeCipher());
        if (cipher != null) {
            return normalizarGrau(cipher);
        }
        if (receita.getOeEsferico()==null && receita.getOeCilindrico()==null && receita.getOeEixo()==null && receita.getOeAdicao()==null && receita.getOeDnp()==null) {
            return null;
        }
        return normalizarGrau(GrauDto.builder()
                .esferico(receita.getOeEsferico())
                .cilindrico(receita.getOeCilindrico())
                .eixo(receita.getOeEixo())
                .adicao(receita.getOeAdicao())
                .dnp(receita.getOeDnp())
                .build());
    }

    private GrauDto decryptGrau(byte[] cipher) {
        if (cipher == null || cipher.length == 0) {
            return null;
        }
        try {
            JsonNode json = OBJECT_MAPPER.readTree(cryptoService.decrypt(cipher));
            return GrauDto.builder()
                    .esferico(decimalOrNull(json, "esferico"))
                    .cilindrico(decimalOrNull(json, "cilindrico"))
                    .eixo(intOrNull(json, "eixo"))
                    .adicao(decimalOrNull(json, "adicao"))
                    .dnp(decimalOrNull(json, "dnp"))
                    .build();
        } catch (Exception e) {
            throw new IllegalStateException("Falha ao descriptografar grau clínico", e);
        }
    }

    private static BigDecimal decimalOrNull(JsonNode json, String field) {
        JsonNode value = json.get(field);
        return value == null || value.isNull() ? null : new BigDecimal(value.asText());
    }

    private static Integer intOrNull(JsonNode json, String field) {
        JsonNode value = json.get(field);
        return value == null || value.isNull() ? null : value.asInt();
    }
}
