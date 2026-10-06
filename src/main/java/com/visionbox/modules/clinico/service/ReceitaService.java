package com.visionbox.modules.clinico.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.visionbox.modules.clinico.domain.Receita;
import com.visionbox.modules.clinico.dto.GrauDto;
import com.visionbox.modules.clinico.dto.ReceitaRequest;
import com.visionbox.modules.clinico.dto.ReceitaResponse;
import com.visionbox.modules.clinico.mapper.ReceitaMapper;
import com.visionbox.modules.clinico.repository.ReceitaRepository;
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
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ReceitaService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

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
        return page.map(this::toSecureResponse);
    }

    @Transactional(readOnly = true)
    public ReceitaResponse buscar(UUID id) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        Receita r = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Receita não encontrada"));
        return toSecureResponse(r);
    }

    @Transactional
    public ReceitaResponse criar(ReceitaRequest req) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        // valida cliente pertence à loja (tenant isolation R1)
        clienteRepository.findByIdAndLojaId(req.getClienteId(), lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Cliente não encontrado para esta loja"));

        LocalDate emissao = LocalDate.parse(req.getDataEmissao());
        LocalDate validade = LocalDate.parse(req.getDataValidade());
        if (validade.isBefore(emissao)) throw new IllegalArgumentException("dataValidade não pode ser anterior à dataEmissao");

        String tipo = req.getTipo() != null ? req.getTipo() : "VISAO_SIMPLES";
        validarGrau(req.getOd(), "OD", tipo);
        validarGrau(req.getOe(), "OE", tipo);

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
                .dp(req.getDp() != null && !req.getDp().isBlank() ? new BigDecimal(req.getDp()) : null)
                .tipo(tipo)
                .observacao(req.getObservacao())
                .anexoS3Key(req.getAnexoS3Key())
                .anexoS3Bucket(req.getAnexoS3Bucket())
                .odCipher(encryptGrau(req.getOd()))
                .oeCipher(encryptGrau(req.getOe()))
                .build();
        e = repository.save(e);
        return toSecureResponse(e);
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
        if (req.getDataEmissao() != null) e.setDataEmissao(LocalDate.parse(req.getDataEmissao()));
        if (req.getDataValidade() != null) e.setDataValidade(LocalDate.parse(req.getDataValidade()));
        if (e.getDataValidade() != null && e.getDataEmissao() != null && e.getDataValidade().isBefore(e.getDataEmissao()))
            throw new IllegalArgumentException("dataValidade não pode ser anterior à dataEmissao");
        if (req.getNomeMedico() != null) e.setNomeMedico(req.getNomeMedico());
        if (req.getCrmMedico() != null) e.setCrmMedico(req.getCrmMedico());

        // tipo efetivo para validação de adição
        String tipoEfetivo = req.getTipo() != null ? req.getTipo() : e.getTipo();

        if (req.getOd() != null) {
            validarGrau(req.getOd(), "OD", tipoEfetivo);
            e.setOdEsferico(null);
            e.setOdCilindrico(null);
            e.setOdEixo(null);
            e.setOdAdicao(null);
            e.setOdDnp(null);
            e.setOdCipher(encryptGrau(req.getOd()));
        }
        if (req.getOe() != null) {
            validarGrau(req.getOe(), "OE", tipoEfetivo);
            e.setOeEsferico(null);
            e.setOeCilindrico(null);
            e.setOeEixo(null);
            e.setOeAdicao(null);
            e.setOeDnp(null);
            e.setOeCipher(encryptGrau(req.getOe()));
        }
        if (req.getTipo() != null) {
            // se mudou tipo, revalida graus existentes quanto à regra de adição
            validarGrau(resolveOd(e), "OD", req.getTipo());
            validarGrau(resolveOe(e), "OE", req.getTipo());
            e.setTipo(req.getTipo());
        }
        if (req.getObservacao() != null) e.setObservacao(req.getObservacao());
        if (req.getAnexoS3Key() != null) e.setAnexoS3Key(req.getAnexoS3Key());
        if (req.getAnexoS3Bucket() != null) e.setAnexoS3Bucket(req.getAnexoS3Bucket());
        if (req.getDp() != null) e.setDp(req.getDp().isBlank() ? null : new BigDecimal(req.getDp()));
        repository.save(e);
        return toSecureResponse(e);
    }

    @Transactional
    public void remover(UUID id) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        Receita e = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Receita não encontrada"));
        e.setAtivo(false);
        repository.save(e);
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

    private ReceitaResponse toSecureResponse(Receita receita) {
        ReceitaResponse response = mapper.toResponse(receita);
        response.setOd(resolveOd(receita));
        response.setOe(resolveOe(receita));
        return response;
    }

    private GrauDto resolveOd(Receita receita) {
        GrauDto cipher = decryptGrau(receita.getOdCipher());
        if (cipher != null) {
            return cipher;
        }
        if (receita.getOdEsferico()==null && receita.getOdCilindrico()==null && receita.getOdEixo()==null && receita.getOdAdicao()==null && receita.getOdDnp()==null) {
            return null;
        }
        return GrauDto.builder()
                .esferico(receita.getOdEsferico())
                .cilindrico(receita.getOdCilindrico())
                .eixo(receita.getOdEixo())
                .adicao(receita.getOdAdicao())
                .dnp(receita.getOdDnp())
                .build();
    }

    private GrauDto resolveOe(Receita receita) {
        GrauDto cipher = decryptGrau(receita.getOeCipher());
        if (cipher != null) {
            return cipher;
        }
        if (receita.getOeEsferico()==null && receita.getOeCilindrico()==null && receita.getOeEixo()==null && receita.getOeAdicao()==null && receita.getOeDnp()==null) {
            return null;
        }
        return GrauDto.builder()
                .esferico(receita.getOeEsferico())
                .cilindrico(receita.getOeCilindrico())
                .eixo(receita.getOeEixo())
                .adicao(receita.getOeAdicao())
                .dnp(receita.getOeDnp())
                .build();
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
