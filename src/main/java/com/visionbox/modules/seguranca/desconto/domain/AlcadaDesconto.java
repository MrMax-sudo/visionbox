package com.visionbox.modules.seguranca.desconto.domain;

import com.visionbox.modules.usuario.domain.Perfil;

import java.math.BigDecimal;
import java.util.Set;

/**
 * Regras da alçada de desconto do PDV (D-007 → P7).
 * <p>
 * Centraliza a regra de negócio que ANTES vivia no frontend
 * ({@code AutorizacaoDescontoModal.tsx} comparava com lista hardcoded):
 * <ul>
 *   <li>desconto ≤ 15% dispensa PIN (autorização implícita);</li>
 *   <li>desconto &gt; 15% exige PIN válido de perfil gerencial (GERENTE/ADMIN).</li>
 * </ul>
 * Comparação com {@link BigDecimal} (nada de double) — moeda/percentual exato.
 */
public final class AlcadaDesconto {

    /** Limiar sem alçada: descontos acima deste valor exigem PIN gerencial. */
    public static final BigDecimal LIMITE_SEM_PIN = new BigDecimal("15");

    /** Perfis cujo PIN (senha de login BCrypt) autoriza desconto acima do limiar. */
    public static final Set<Perfil> PERFIS_GERENCIAIS = Set.of(Perfil.GERENTE, Perfil.ADMIN);

    private AlcadaDesconto() {
    }

    /**
     * @param percentual desconto em percentual (0..100), nunca nulo
     * @return {@code true} quando o desconto exige PIN de alçada gerencial
     */
    public static boolean exigePin(BigDecimal percentual) {
        return percentual != null && percentual.compareTo(LIMITE_SEM_PIN) > 0;
    }

    public static BigDecimal limiteSemPin() {
        return LIMITE_SEM_PIN;
    }
}