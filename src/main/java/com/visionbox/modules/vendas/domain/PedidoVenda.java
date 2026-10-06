package com.visionbox.modules.vendas.domain;

import com.visionbox.shared.domain.EntidadeBase;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.SQLRestriction;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "pedido_venda", uniqueConstraints = @UniqueConstraint(columnNames = {"loja_id","numero"}))
@SQLRestriction("ativo = true")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @SuperBuilder
public class PedidoVenda extends EntidadeBase {

    @Column(nullable = false, length = 20)
    private String numero;

    @Column(name = "cliente_id")
    private java.util.UUID clienteId;

    @Column(name = "cliente_nome", nullable = false)
    private String clienteNome;

    @Column(name = "status", nullable = false, length = 30)
    @lombok.Builder.Default
    private String status = "CRIADO";

    @Column(name = "observacao", length = 500)
    private String observacao;

    @Column(name = "valor_total", precision = 12, scale = 2, nullable = false)
    @lombok.Builder.Default
    private BigDecimal valorTotal = BigDecimal.ZERO;

    @OneToMany(mappedBy = "pedido", cascade = CascadeType.ALL, orphanRemoval = true)
    @lombok.Builder.Default
    private List<ItemPedido> itens = new ArrayList<>();

    public void addItem(ItemPedido item) {
        itens.add(item);
        item.setPedido(this);
    }

    @Entity
    @Table(name = "item_pedido")
    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @SuperBuilder
    public static class ItemPedido {
        @Id
        @GeneratedValue(strategy = GenerationType.UUID)
        private java.util.UUID id;
        @ManyToOne(fetch = FetchType.LAZY)
        @JoinColumn(name = "pedido_id", nullable = false)
        private PedidoVenda pedido;
        @Column(nullable = false, length = 50)
        private String sku;
        @Column(nullable = false)
        private Integer quantidade;
        @Column(name = "preco_unitario", precision = 12, scale = 2, nullable = false)
        private BigDecimal precoUnitario;
        @Column(name = "subtotal", precision = 12, scale = 2, nullable = false)
        private BigDecimal subtotal;
    }
}
