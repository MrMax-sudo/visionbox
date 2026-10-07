package com.visionbox.modules.usuario.domain;

import com.visionbox.shared.domain.EntidadeBase;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

/**
 * Usuário (conta de acesso à loja).
 * <p>
 * SEM {@code @SQLRestriction("ativo = true")} de propósito: diferente de cliente/produto,
 * a listagem de usuários precisa exibir os inativos (UI renderiza badge "Inativo" e o
 * {@code PATCH /usuarios/{id}} aceita {@code ativo} para REATIVAR). Com a restriction, o
 * desativado sumia da lista e nunca mais era encontrado (reativação impossível) e o
 * {@code existsByEmailAndLojaId} não enxergava a linha inativa, deixando o INSERT estourar
 * a unique {@code uq_usuario_loja_email} com 400 "Registro duplicado".
 * <p>
 * Login/refresh continuam bloqueando conta inativa com check explícito
 * ({@code AuthController} → {@code DisabledException "Usuário desativado"}).
 * O email continua único por loja (independente de ativo) — vaza de {@code uq_usuario_loja_email}.
 *
 * @see com.visionbox.modules.usuario.service.UsuarioService
 */
@Entity
@Table(name = "usuario", uniqueConstraints = @UniqueConstraint(columnNames = {"loja_id", "email"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @SuperBuilder
public class Usuario extends EntidadeBase {

    @Column(nullable = false, length = 150)
    private String nome;

    @Column(nullable = false, length = 255)
    private String email;

    @Column(name = "senha_hash", nullable = false, length = 255)
    private String senhaHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @lombok.Builder.Default
    private Perfil perfil = Perfil.VENDEDOR;
}
