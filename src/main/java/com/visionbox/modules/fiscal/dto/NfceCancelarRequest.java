package com.visionbox.modules.fiscal.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Payload do cancelamento (evento 110111) de uma NFC-e já autorizada.
 * A justificativa obedece ao mínimo de 15 caracteres da SEFAZ e a chave tem exatamente 44 dígitos.
 * O protocolo de autorização NÃO vem aqui: o documento autorizado já o gravou na emissão
 * (documento_fiscal.protocolo) — pedir de novo abriria margem para cancelar a chave errada.
 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class NfceCancelarRequest {

    @NotBlank(message = "Chave de acesso é obrigatória")
    @Pattern(regexp = "\\d{44}", message = "Chave de acesso deve conter exatamente 44 dígitos")
    private String chaveAcesso;

    @NotBlank(message = "Justificativa do cancelamento é obrigatória")
    @Size(min = 15, max = 255, message = "Justificativa deve ter entre 15 e 255 caracteres, conforme regra da SEFAZ")
    private String justificativa;
}
