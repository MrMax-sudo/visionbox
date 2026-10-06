package com.visionbox.api;

import com.visionbox.modules.pessoa.repository.LojaRepository;
import com.visionbox.modules.usuario.domain.Perfil;
import com.visionbox.modules.usuario.domain.Usuario;
import com.visionbox.modules.usuario.domain.UsuarioRefreshToken;
import com.visionbox.modules.usuario.dto.LoginRequest;
import com.visionbox.modules.usuario.repository.UsuarioRefreshTokenRepository;
import com.visionbox.modules.usuario.repository.UsuarioRepository;
import com.visionbox.modules.usuario.service.UsuarioService;
import com.visionbox.shared.security.JwtTokenProvider;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AuthControllerTest {

    private static final UUID USUARIO_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID LOJA_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");

    private final UsuarioRepository usuarioRepository = mock(UsuarioRepository.class);
    private final UsuarioRefreshTokenRepository refreshTokenRepository = mock(UsuarioRefreshTokenRepository.class);
    private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
    private final JwtTokenProvider tokenProvider = new JwtTokenProvider(
            "test_jwt_secret_32_chars_minimo_para_hs256",
            15,
            7);
    private final AuthController controller = new AuthController(
            mock(UsuarioService.class),
            usuarioRepository,
            mock(LojaRepository.class),
            refreshTokenRepository,
            tokenProvider,
            passwordEncoder,
            new MockEnvironment());

    @Test
    @DisplayName("Login devolve access token e refresh somente em cookie HttpOnly")
    void loginEmiteRefreshCookieHttpOnly() {
        Usuario usuario = usuario();
        when(usuarioRepository.findByEmail("admin@visionbox.com.br")).thenReturn(Optional.of(usuario));
        when(passwordEncoder.matches("admin123", "hash")).thenReturn(true);
        when(refreshTokenRepository.save(any(UsuarioRefreshToken.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = controller.login(LoginRequest.builder()
                .email("admin@visionbox.com.br")
                .senha("admin123")
                .build());

        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getAccessToken()).isNotBlank();
        assertThat(response.getBody().getRefreshToken()).isNull();
        assertThat(response.getHeaders().getFirst(HttpHeaders.SET_COOKIE))
                .contains("vb_refresh=")
                .contains("HttpOnly")
                .contains("SameSite=Strict");
    }

    @Test
    @DisplayName("Refresh usa cookie, rotaciona refresh e não devolve refresh no body")
    void refreshRotacionaCookie() {
        Usuario usuario = usuario();
        String refresh = tokenProvider.generateRefreshToken(usuario);
        when(usuarioRepository.findByIdAndLojaId(USUARIO_ID, LOJA_ID)).thenReturn(Optional.of(usuario));
        when(refreshTokenRepository.findByJtiHashAndLojaId(anyString(), any(UUID.class)))
                .thenReturn(Optional.of(UsuarioRefreshToken.builder()
                        .lojaId(LOJA_ID)
                        .usuarioId(USUARIO_ID)
                        .jtiHash("hash")
                        .expiresAt(java.time.OffsetDateTime.now().plusDays(1))
                        .build()));
        when(refreshTokenRepository.save(any(UsuarioRefreshToken.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = controller.refresh(refresh);

        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getAccessToken()).isNotBlank();
        assertThat(response.getBody().getRefreshToken()).isNull();
        assertThat(response.getHeaders().getFirst(HttpHeaders.SET_COOKIE))
                .contains("vb_refresh=")
                .contains("HttpOnly");
    }

    @Test
    @DisplayName("Register público fica indisponível em prod quando flag está desligada")
    void registerProdDesligadoRetorna404() {
        MockEnvironment prod = new MockEnvironment();
        prod.setActiveProfiles("prod");
        AuthController prodController = new AuthController(
                mock(UsuarioService.class),
                usuarioRepository,
                mock(LojaRepository.class),
                refreshTokenRepository,
                tokenProvider,
                passwordEncoder,
                prod);
        ReflectionTestUtils.setField(prodController, "publicRegisterEnabled", false);

        var response = prodController.register(com.visionbox.modules.usuario.dto.RegisterRequest.builder()
                .nome("Admin")
                .email("admin@visionbox.com.br")
                .senha("admin123")
                .build());

        assertThat(response.getStatusCode().value()).isEqualTo(404);
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
