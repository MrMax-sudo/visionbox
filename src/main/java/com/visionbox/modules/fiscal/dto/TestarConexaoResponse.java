package com.visionbox.modules.fiscal.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TestarConexaoResponse {
    private boolean sucesso;
    private Integer statusHttp;
    private long latenciaMs;
    private String mensagem;
    private String urlTestada;
}
