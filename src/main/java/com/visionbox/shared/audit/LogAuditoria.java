package com.visionbox.shared.audit;

import com.visionbox.shared.domain.EntidadeBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.SQLRestriction;

/**
 * LogAuditoria — append-only, imutável após criação (LGPD art. 37).
 * <p>
 * Registra quem/quando/o que para dados sensíveis (receita, CPF) e
 * toda transição OS. Nunca atualizado nem deletado (apenas anonimização 5a fiscal).
 * Filtrado por @SQLRestriction("ativo = true") mas na prática nunca inativado.
 * <p>
 * Campos:
 * - entidade/entidadeId: alvo (ex: "cliente", uuid)
 * - acao: INSERT | UPDATE | READ_SENSIVEL | TRANSICAO_OS | LOGIN | EXPORT
 * - usuarioId/usuarioNome, ipOrigem, userAgent
 * - detalheJson: diff ou snapshot mascarado (sem plain cpf/grau)
 * - hashAnterior: encadeamento para detecção de tamper (opcional Fase 2)
 */
@Entity
@Table(name = "log_auditoria")
@SQLRestriction("ativo = true")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class LogAuditoria extends EntidadeBase {

    @Column(name = "entidade", nullable = false, length = 100)
    private String entidade;

    @Column(name = "entidade_id", length = 36)
    private String entidadeId;

    @Column(name = "acao", nullable = false, length = 50)
    private String acao;

    @Column(name = "usuario_id", length = 36)
    private String usuarioId;

    @Column(name = "usuario_nome", length = 200)
    private String usuarioNome;

    @Column(name = "ip_origem", length = 45)
    private String ipOrigem;

    @Column(name = "user_agent", length = 500)
    private String userAgent;

    @Column(name = "detalhe_json", columnDefinition = "jsonb")
    private String detalheJson;

    @Column(name = "hash_anterior", length = 128)
    private String hashAnterior;

    // helper factory
    public static LogAuditoria leituraSensivel(String entidade, String entidadeId, String usuarioId, String usuarioNome, String ip) {
        return LogAuditoria.builder()
                .entidade(entidade)
                .entidadeId(entidadeId)
                .acao("READ_SENSIVEL")
                .usuarioId(usuarioId)
                .usuarioNome(usuarioNome)
                .ipOrigem(ip)
                .build();
    }
}
