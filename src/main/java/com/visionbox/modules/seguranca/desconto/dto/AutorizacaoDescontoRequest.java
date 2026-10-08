package com.visionbox.modules.seguranca.desconto.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * Solicitação de autorização de alçada de desconto (P7).
 * <p>
 * {@code senha} é o PIN gerencial: para a opção (a) do D-010, é a senha de login
 * (hash BCrypt) de um usuário ativo com perfil GERENTE/ADMIN da MESMA loja
 * (TenantContext). Opcional apenas quando {@code descontoPercentual} ≤ 15% —
 * nesse caso o endpoint autoriza sem validar PIN.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AutorizacaoDescontoRequest {

    @NotNull(message = "descontoPercentual é obrigatório")
    @DecimalMin(value = "0.0", message = "descontoPercentual deve ser maior ou igual a 0")
    @DecimalMax(value = "100.0", message = "descontoPercentual deve ser menor ou igual a 100")
    private BigDecimal descontoPercentual;

    @Size(min = 4, max = 64, message = "A senha de autorização deve ter entre 4 e 64 caracteres")
    private String senha;
}