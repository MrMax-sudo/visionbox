package com.visionbox.shared.security;

import com.visionbox.modules.usuario.domain.Perfil;
import com.visionbox.modules.usuario.domain.Usuario;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtTokenProviderTest {

    private static final UUID USUARIO_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID LOJA_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");

    private final JwtTokenProvider provider = new JwtTokenProvider(
            "test_jwt_secret_32_chars_minimo_para_hs256",
            15,
            7);

    @Test
    @DisplayName("Refresh token válido expõe usuário, loja e jti")
    void parseRefreshTokenValido() {
        String token = provider.generateRefreshToken(usuario());

        JwtTokenProvider.RefreshTokenClaims claims = provider.parseRefreshToken(token);

        assertThat(claims.usuarioId()).isEqualTo(USUARIO_ID);
        assertThat(claims.lojaId()).isEqualTo(LOJA_ID);
        assertThat(claims.jti()).isNotBlank();
    }

    @Test
    @DisplayName("Access token não pode ser usado como refresh")
    void accessTokenNaoServeComoRefresh() {
        String token = provider.generateAccessToken(usuario());

        assertThatThrownBy(() -> provider.parseRefreshToken(token))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("refresh");
    }

    private Usuario usuario() {
        Usuario usuario = Usuario.builder()
                .lojaId(LOJA_ID)
                .nome("Admin")
                .email("admin@visionbox.com.br")
                .senhaHash("hash")
                .perfil(Perfil.ADMIN)
                .build();
        usuario.setId(USUARIO_ID);
        usuario.setAtivo(true);
        return usuario;
    }
}
