package com.visionbox.modules.ordemservico.domain;

import com.visionbox.shared.domain.EntidadeBase;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.SQLRestriction;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "ordem_servico")
@SQLRestriction("ativo = true")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @SuperBuilder
public class OrdemServico extends EntidadeBase {

    @Column(nullable = false, unique = false)
    private String numero; // OS-2026-00123 via sequencia_os(loja_id,ano)

    @Column(name = "cliente_id", nullable = false)
    private java.util.UUID clienteId;

    @Column(name = "receita_id")
    private java.util.UUID receitaId;

    @Column(name = "armacao_id")
    private java.util.UUID armacaoId;

    @Column(name = "lente_id")
    private java.util.UUID lenteId;

    @Column(name = "laboratorio_id")
    private java.util.UUID laboratorioId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StatusOS status;

    @OneToMany(mappedBy = "ordemServico", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("dataHora ASC")
    @lombok.Builder.Default
    private List<EventoOS> historico = new ArrayList<>();

    @Column(name = "previsao_entrega", columnDefinition = "timestamptz")
    private OffsetDateTime previsaoEntrega;

    @Column(name = "data_entrega_real", columnDefinition = "timestamptz")
    private OffsetDateTime dataEntregaReal;

    @Column(name = "alerta_atraso_disparado")
    private boolean alertaAtrasoDisparado;

    // Helper para teste sem JPA
    public void addEvento(EventoOS evento) {
        historico.add(evento);
        evento.setOrdemServico(this);
    }
}
