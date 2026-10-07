package com.visionbox.modules.clinico.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.visionbox.shared.json.LenientStringDeserializer;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * Payload de criação/atualização de receita.
 * <p>
 * Contrato com o frontend (apps/web/src/pages/Receitas.tsx):
 * <ul>
 *   <li>{@code clienteId}: UUID (o campo aceita "UUID ou CPF mascarado" na UI; no backend só UUID)</li>
 *   <li>{@code tipoLente} (ou {@code tipo}): MONOFOCAL | BIFOCAL | MULTIFOCAL — normalizado no service</li>
 *   <li>{@code dp}: número ou string (JSON numérico {@code 62} é aceito)</li>
 *   <li>datas OPCIONAIS: ausência = hoje (emissão) e hoje + 2 anos (validade)</li>
 * </ul>
 * Campos desconhecidos no payload são ignorados (ver JacksonConfig).
 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ReceitaRequest {

    @NotNull(message = "clienteId é obrigatório")
    private UUID clienteId;

    /** yyyy-MM-dd — opcional na criação (default: hoje). */
    private String dataEmissao;

    /** yyyy-MM-dd — opcional na criação (default: emissão + 2 anos). */
    private String dataValidade;

    private String nomeMedico;
    private String crmMedico;

    @Valid
    private GrauDto od;

    @Valid
    private GrauDto oe;

    @JsonDeserialize(using = LenientStringDeserializer.class)
    private String dp; // aceita 62 ou "62"

    @JsonAlias("tipoLente") // frontend envia "tipoLente"
    private String tipo; // VISAO_SIMPLES etc

    private String observacao;
    private String anexoS3Key;
    private String anexoS3Bucket;
}
