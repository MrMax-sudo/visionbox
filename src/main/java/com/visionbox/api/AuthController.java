package com.visionbox.api;

import com.visionbox.modules.pessoa.domain.Loja;
import com.visionbox.modules.pessoa.repository.LojaRepository;
import com.visionbox.modules.usuario.domain.Perfil;
import com.visionbox.modules.usuario.domain.Usuario;
import com.visionbox.modules.usuario.domain.UsuarioRefreshToken;
import com.visionbox.modules.usuario.dto.LoginRequest;
import com.visionbox.modules.usuario.dto.LoginResponse;
import com.visionbox.modules.usuario.dto.RegisterRequest;
import com.visionbox.modules.usuario.dto.UsuarioResponse;
import com.visionbox.modules.usuario.repository.UsuarioRefreshTokenRepository;
import com.visionbox.modules.usuario.repository.UsuarioRepository;
import com.visionbox.modules.usuario.service.UsuarioService;
import com.visionbox.shared.security.JwtTokenProvider;
import com.visionbox.shared.tenant.TenantContext;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UsuarioService usuarioService;
    private final UsuarioRepository usuarioRepository;
    private final LojaRepository lojaRepository;
    private final UsuarioRefreshTokenRepository refreshTokenRepository;
    private final JwtTokenProvider jwtTokenProvider;
    private final PasswordEncoder passwordEncoder;
    private final Environment environment;

    @Value("${visionbox.auth.public-register-enabled:true}")
    private boolean publicRegisterEnabled;

    private static final String REFRESH_COOKIE_NAME = "vb_refresh";

    public static final UUID LOJA_MATRIZ_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    @PostMapping("/register")
    @Transactional
    public ResponseEntity<LoginResponse> register(@Valid @RequestBody RegisterRequest req) {
        if (environment.matchesProfiles("prod") && !publicRegisterEnabled) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
        // Resolve loja: prioridade header X-Loja-Id > req.lojaId > matriz default
        UUID lojaId = resolveLojaId(req);

        // Garante que loja existe (cria se não existir para single-tenant dev)
        Loja loja = lojaRepository.findById(lojaId).orElseGet(() -> {
            String nomeLoja = req.getLojaNome() != null && !req.getLojaNome().isBlank()
                    ? req.getLojaNome().trim()
                    : (lojaId.equals(LOJA_MATRIZ_ID) ? "VisionBox Matriz" : "Loja " + lojaId.toString().substring(0, 8));
            String cnpj = req.getCnpj() != null ? req.getCnpj().replaceAll("\\D", "") : "00000000000191";
            if (cnpj != null && cnpj.length() > 14) cnpj = cnpj.substring(0, 14);
            Loja nova = new Loja();
            nova.setId(lojaId);
            nova.setNome(nomeLoja);
            nova.setCnpj(cnpj);
            return lojaRepository.save(nova);
        });

        Perfil perfil = null;
        if (req.getPerfil() != null && !req.getPerfil().isBlank()) {
            try {
                perfil = Perfil.valueOf(req.getPerfil().trim().toUpperCase());
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("perfil inválido: " + req.getPerfil() + ". Use ADMIN, GERENTE, VENDEDOR, OTICO, FINANCEIRO, DESENVOLVEDOR");
            }
        }

        // Cria usuário dentro do contexto da loja
        Usuario usuario;
        UUID previous = TenantContext.getCurrentTenant().orElse(null);
        try {
            TenantContext.setCurrentTenant(loja.getId());
            usuario = usuarioService.criar(req.getNome(), req.getEmail(), req.getSenha(), perfil, loja.getId());
        } finally {
            if (previous == null) TenantContext.clear();
            else TenantContext.setCurrentTenant(previous);
        }

        String access = jwtTokenProvider.generateAccessToken(usuario);
        String refresh = jwtTokenProvider.generateRefreshToken(usuario);
        persistRefreshToken(usuario, refresh);

        LoginResponse resp = buildLoginResponse(usuario, access);
        return ResponseEntity.status(HttpStatus.CREATED)
                .header(HttpHeaders.SET_COOKIE, refreshCookie(refresh).toString())
                .body(resp);
    }

    @PostMapping("/login")
    @Transactional
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest req) {
        String emailNorm = req.getEmail().trim().toLowerCase();
        Usuario usuario = usuarioRepository.findByEmail(emailNorm)
                .orElseThrow(() -> new org.springframework.security.authentication.BadCredentialsException("Credenciais inválidas"));

        if (!passwordEncoder.matches(req.getSenha(), usuario.getSenhaHash())) {
            throw new org.springframework.security.authentication.BadCredentialsException("Credenciais inválidas");
        }

        if (!usuario.isAtivo()) {
            throw new org.springframework.security.authentication.DisabledException("Usuário desativado");
        }

        String access = jwtTokenProvider.generateAccessToken(usuario);
        String refresh = jwtTokenProvider.generateRefreshToken(usuario);
        persistRefreshToken(usuario, refresh);

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshCookie(refresh).toString())
                .body(buildLoginResponse(usuario, access));
    }

    @PostMapping("/refresh")
    @Transactional
    public ResponseEntity<LoginResponse> refresh(@CookieValue(name = REFRESH_COOKIE_NAME, required = false) String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        JwtTokenProvider.RefreshTokenClaims claims;
        try {
            claims = jwtTokenProvider.parseRefreshToken(refreshToken);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        OffsetDateTime now = OffsetDateTime.now();
        String oldJtiHash = hashJti(claims.jti());
        UsuarioRefreshToken stored = refreshTokenRepository.findByJtiHashAndLojaId(oldJtiHash, claims.lojaId())
                .orElse(null);
        if (stored == null || !stored.isUsable(now)) {
            refreshTokenRepository.revokeAllActiveForUser(claims.lojaId(), claims.usuarioId(), now);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .header(HttpHeaders.SET_COOKIE, expiredRefreshCookie().toString())
                    .build();
        }

        Usuario usuario = usuarioRepository.findByIdAndLojaId(claims.usuarioId(), claims.lojaId())
                .orElseThrow(() -> new org.springframework.security.authentication.BadCredentialsException("Refresh inválido"));
        if (!usuario.isAtivo()) {
            throw new org.springframework.security.authentication.DisabledException("Usuário desativado");
        }

        String access = jwtTokenProvider.generateAccessToken(usuario);
        String rotatedRefresh = jwtTokenProvider.generateRefreshToken(usuario);
        JwtTokenProvider.RefreshTokenClaims rotatedClaims = jwtTokenProvider.parseRefreshToken(rotatedRefresh);
        String newJtiHash = hashJti(rotatedClaims.jti());

        stored.setLastUsedAt(now);
        stored.setRevokedAt(now);
        stored.setReplacedByJtiHash(newJtiHash);
        refreshTokenRepository.save(stored);
        persistRefreshToken(usuario, rotatedRefresh);

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshCookie(rotatedRefresh).toString())
                .body(buildLoginResponse(usuario, access));
    }

    @PostMapping("/logout")
    @Transactional
    public ResponseEntity<Void> logout(@CookieValue(name = REFRESH_COOKIE_NAME, required = false) String refreshToken) {
        if (refreshToken != null && !refreshToken.isBlank()) {
            try {
                JwtTokenProvider.RefreshTokenClaims claims = jwtTokenProvider.parseRefreshToken(refreshToken);
                refreshTokenRepository.findByJtiHashAndLojaId(hashJti(claims.jti()), claims.lojaId())
                        .ifPresent(token -> {
                            token.setRevokedAt(OffsetDateTime.now());
                            refreshTokenRepository.save(token);
                        });
            } catch (Exception ignored) {
                // Cookie inválido ainda deve ser limpo no cliente.
            }
        }
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, expiredRefreshCookie().toString())
                .build();
    }

    private LoginResponse buildLoginResponse(Usuario usuario, String access) {
        return LoginResponse.builder()
                .accessToken(access)
                .refreshToken(null)
                .tokenType("Bearer")
                .expiresIn(jwtTokenProvider.getExpirationMinutes() * 60)
                .usuario(LoginResponse.UsuarioDTO.builder()
                        .id(usuario.getId())
                        .lojaId(usuario.getLojaId())
                        .nome(usuario.getNome())
                        .email(usuario.getEmail())
                        .perfil(usuario.getPerfil().name())
                        .build())
                .build();
    }

    private ResponseCookie refreshCookie(String token) {
        return ResponseCookie.from(REFRESH_COOKIE_NAME, token)
                .httpOnly(true)
                .secure(environment.matchesProfiles("prod"))
                .sameSite("Strict")
                .path("/")
                .maxAge(jwtTokenProvider.getRefreshDays() * 24 * 60 * 60)
                .build();
    }

    private ResponseCookie expiredRefreshCookie() {
        return ResponseCookie.from(REFRESH_COOKIE_NAME, "")
                .httpOnly(true)
                .secure(environment.matchesProfiles("prod"))
                .sameSite("Strict")
                .path("/")
                .maxAge(0)
                .build();
    }

    private void persistRefreshToken(Usuario usuario, String token) {
        JwtTokenProvider.RefreshTokenClaims claims = jwtTokenProvider.parseRefreshToken(token);
        refreshTokenRepository.save(UsuarioRefreshToken.builder()
                .lojaId(usuario.getLojaId())
                .usuarioId(usuario.getId())
                .jtiHash(hashJti(claims.jti()))
                .expiresAt(OffsetDateTime.now().plusDays(jwtTokenProvider.getRefreshDays()))
                .build());
    }

    private static String hashJti(String jti) {
        if (jti == null || jti.isBlank()) {
            throw new IllegalArgumentException("Refresh token sem jti");
        }
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(jti.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception e) {
            throw new IllegalStateException("Falha ao gerar hash do refresh jti", e);
        }
    }

    @GetMapping("/me")
    public ResponseEntity<UsuarioResponse> me(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        UUID usuarioId;
        UUID lojaId;
        String email = null;
        String perfil = null;

        if (authentication instanceof JwtAuthenticationToken jwtAuth) {
            Jwt jwt = jwtAuth.getToken();
            usuarioId = UUID.fromString(jwt.getSubject());
            lojaId = extractLojaId(jwt);
            email = jwt.getClaimAsString("email");
            perfil = jwt.getClaimAsString("perfil");
        } else if (authentication.getPrincipal() instanceof Jwt jwt) {
            usuarioId = UUID.fromString(jwt.getSubject());
            lojaId = extractLojaId(jwt);
            email = jwt.getClaimAsString("email");
            perfil = jwt.getClaimAsString("perfil");
        } else {
            // fallback: tenta buscar por nome (email)
            String name = authentication.getName();
            Usuario u = usuarioRepository.findByEmail(name.toLowerCase())
                    .orElseThrow(() -> new jakarta.persistence.EntityNotFoundException("Usuário não encontrado"));
            return ResponseEntity.ok(toResponse(u));
        }

        // Busca entidade para dados atualizados; usa lojaId do token para isolamento
        final String emailForLookup = email;
        final UUID uid = usuarioId;
        final UUID lid = lojaId;
        Usuario usuario = usuarioRepository.findByIdAndLojaId(uid, lid)
                .orElseGet(() -> usuarioRepository.findByEmail(emailForLookup != null ? emailForLookup.toLowerCase() : "")
                        .orElse(null));

        if (usuario == null) {
            // fallback minimal from token claims
            UsuarioResponse fallback = UsuarioResponse.builder()
                    .id(usuarioId)
                    .lojaId(lojaId)
                    .nome(authentication.getName())
                    .email(email)
                    .perfil(perfil)
                    .ativo(true)
                    .build();
            return ResponseEntity.ok(fallback);
        }

        return ResponseEntity.ok(toResponse(usuario));
    }

    private UUID resolveLojaId(RegisterRequest req) {
        // 1) header X-Loja-Id via TenantContext (se filtro já populou)
        UUID ctx = TenantContext.getCurrentTenant().orElse(null);
        if (ctx != null) return ctx;
        // 2) body
        if (req.getLojaId() != null) return req.getLojaId();
        // 3) matriz default
        return LOJA_MATRIZ_ID;
    }

    private UUID extractLojaId(Jwt jwt) {
        Object v = jwt.getClaims().get("loja_id");
        if (v == null) v = jwt.getClaims().get("lojaId");
        if (v == null) v = jwt.getClaims().get("tenant_id");
        if (v == null) return LOJA_MATRIZ_ID;
        try {
            return UUID.fromString(v.toString());
        } catch (Exception e) {
            return LOJA_MATRIZ_ID;
        }
    }

    private UsuarioResponse toResponse(Usuario u) {
        return UsuarioResponse.builder()
                .id(u.getId())
                .lojaId(u.getLojaId())
                .nome(u.getNome())
                .email(u.getEmail())
                .perfil(u.getPerfil().name())
                .criadoEm(u.getCriadoEm())
                .ativo(u.isAtivo())
                .build();
    }
}
