package com.visionbox.modules.ordemservico.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Resposta da busca pública por número de OS (US17).
 * Devolve preferencialmente um {@code token} opaco (link de rastreio) para que o
 * cliente abra {@code /rastreio/{token}}; alternativamente o payload completo em
 * {@code ordem} (contrato aceito pelo frontend — ver {@code RastreioBusca}).
 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class RastreioBuscaResponse {
    private String token;
    private RastreioResponse ordem;
}