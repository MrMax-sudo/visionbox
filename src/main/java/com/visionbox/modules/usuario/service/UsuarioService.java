package com.visionbox.modules.usuario.service;

import com.visionbox.modules.usuario.domain.Perfil;
import com.visionbox.modules.usuario.domain.Usuario;
import com.visionbox.modules.usuario.dto.UsuarioResponse;
import com.visionbox.modules.usuario.repository.UsuarioRepository;
import com.visionbox.shared.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UsuarioService {

    private final UsuarioRepository repository;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public Usuario criar(String nome, String email, String senhaPura, Perfil perfil, UUID lojaId) {
        if (nome == null || nome.isBlank() || nome.trim().length() < 2) {
            throw new IllegalArgumentException("Nome deve ter ao menos 2 caracteres");
        }
        if (email == null || email.isBlank() || !email.contains("@")) {
            throw new IllegalArgumentException("Email inválido");
        }
        if (senhaPura == null || senhaPura.length() < 6) {
            throw new IllegalArgumentException("Senha deve ter ao menos 6 caracteres");
        }
        String emailNorm = email.trim().toLowerCase();
        UUID loja = lojaId != null ? lojaId : TenantContext.requireCurrentLojaId();
        if (repository.existsByEmailAndLojaId(emailNorm, loja)) {
            throw new IllegalArgumentException("Email já cadastrado nesta loja");
        }
        Perfil p = perfil != null ? perfil : Perfil.VENDEDOR;
        Usuario u = Usuario.builder()
                .lojaId(loja)
                .nome(nome.trim())
                .email(emailNorm)
                .senhaHash(passwordEncoder.encode(senhaPura))
                .perfil(p)
                .build();
        return repository.save(u);
    }

    @Transactional(readOnly = true)
    public Optional<Usuario> findByEmail(String email) {
        if (email == null) return Optional.empty();
        return repository.findByEmail(email.trim().toLowerCase());
    }

    @Transactional(readOnly = true)
    public Optional<Usuario> findByEmailAndLojaId(String email, UUID lojaId) {
        if (email == null || lojaId == null) return Optional.empty();
        return repository.findByEmailAndLojaId(email.trim().toLowerCase(), lojaId);
    }

    @Transactional(readOnly = true)
    public Optional<Usuario> findByIdAndLojaId(UUID id, UUID lojaId) {
        return repository.findByIdAndLojaId(id, lojaId);
    }

    @Transactional(readOnly = true)
    public Usuario buscarPorId(UUID id) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        return repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new jakarta.persistence.EntityNotFoundException("Usuário não encontrado"));
    }

    @Transactional(readOnly = true)
    public Page<UsuarioResponse> listar(Pageable pageable) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        return repository.findAllByLojaId(lojaId, pageable).map(this::toResponse);
    }

    @Transactional
    public UsuarioResponse criar(String nome, String email, String senhaPura, Perfil perfil) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        return toResponse(criar(nome, email, senhaPura, perfil, lojaId));
    }

    @Transactional
    public UsuarioResponse atualizar(UUID id, String nome, String senhaPura, Perfil perfil, Boolean ativo) {
        Usuario usuario = buscarPorId(id);
        if (nome != null && !nome.isBlank() && nome.trim().length() >= 2) {
            usuario.setNome(nome.trim());
        }
        if (perfil != null) {
            usuario.setPerfil(perfil);
        }
        if (ativo != null) {
            usuario.setAtivo(ativo);
        }
        if (senhaPura != null && !senhaPura.isBlank()) {
            if (senhaPura.length() < 6) {
                throw new IllegalArgumentException("Senha deve ter ao menos 6 caracteres");
            }
            usuario.setSenhaHash(passwordEncoder.encode(senhaPura));
        }
        return toResponse(repository.save(usuario));
    }

    @Transactional
    public UsuarioResponse atualizar(UUID id, String senhaPura, Perfil perfil) {
        return atualizar(id, null, senhaPura, perfil, null);
    }

    @Transactional
    public void desativar(UUID id) {
        Usuario usuario = buscarPorId(id);
        usuario.setAtivo(false);
        repository.save(usuario);
    }

    public boolean verificarSenha(String senhaPura, String senhaHash) {
        return passwordEncoder.matches(senhaPura, senhaHash);
    }

    public UsuarioResponse toResponse(Usuario u) {
        return UsuarioResponse.builder()
                .id(u.getId())
                .lojaId(u.getLojaId())
                .nome(u.getNome())
                .email(u.getEmail())
                .perfil(u.getPerfil() != null ? u.getPerfil().name() : null)
                .criadoEm(u.getCriadoEm())
                .ativo(u.isAtivo())
                .build();
    }
}
