package com.visionbox.modules.financeiro.controller;

import com.visionbox.modules.financeiro.dto.BaixaContaReceberRequest;
import com.visionbox.modules.financeiro.dto.ContaReceberPagamentoResponse;
import com.visionbox.modules.financeiro.dto.ContaReceberRequest;
import com.visionbox.modules.financeiro.dto.ContaReceberResponse;
import com.visionbox.modules.financeiro.dto.EstornoPagamentoRequest;
import com.visionbox.modules.financeiro.service.ContaReceberService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/financeiro/contas-receber")
@RequiredArgsConstructor
public class ContaReceberController {

    private final ContaReceberService service;

    @PostMapping
    public ResponseEntity<ContaReceberResponse> criar(@Valid @RequestBody ContaReceberRequest req) {
        ContaReceberResponse r = service.gerar(req);
        return ResponseEntity.status(HttpStatus.CREATED).body(r);
    }

    @GetMapping
    public Page<ContaReceberResponse> listar(@RequestParam(required = false) String status,
                                             @PageableDefault(size = 20, sort = "vencimento") Pageable pageable) {
        return service.listar(status, pageable);
    }

    @GetMapping("/{id}")
    public ContaReceberResponse buscar(@PathVariable UUID id) {
        return service.buscar(id);
    }

    /**
     * Baixa parcial ou total (§3.3). Body opcional: sem body baixa o saldo integral;
     * com body usa valorPago/formaPagamentoId/observacao. Idempotência (R4): header
     * {@code Idempotency-Key} (UUID v4) — replay coberto pelo IdempotencyFilter global.
     */
    @PostMapping("/{id}/baixar")
    public ContaReceberResponse baixar(@PathVariable UUID id,
                                       @RequestBody(required = false) BaixaContaReceberRequest req) {
        BaixaContaReceberRequest payload = req != null ? req : new BaixaContaReceberRequest();
        return service.baixar(id, payload);
    }

    /** Histórico de baixas da conta (parciais e totais) — timeline do §3.3. */
    @GetMapping("/{id}/pagamentos")
    public List<ContaReceberPagamentoResponse> listarPagamentos(@PathVariable UUID id) {
        return service.listarPagamentos(id);
    }

    /**
     * Estorno de baixa (§3.3 — reabre o título): soft-delete da linha de pagamento,
     * recálculo de valor_pago (valor_aberto é GENERATED), status PENDENTE/PARCIAL e
     * movimento ESTORNO no caixa aberto (se houver). Body opcional {observacao}.
     * Idempotência (R4): header {@code Idempotency-Key} (UUID v4) — replay coberto
     * pelo IdempotencyFilter global. RBAC: /financeiro/** já exige ADMIN/GERENTE/
     * FINANCEIRO no SecurityConfig; @PreAuthorize abaixo é defesa em profundidade
     * (mesmo padrão do ProducaoController).
     */
    @PreAuthorize("hasAnyRole('ADMIN','GERENTE','FINANCEIRO')")
    @PostMapping("/{id}/pagamentos/{pagamentoId}/estornar")
    public ContaReceberResponse estornarPagamento(@PathVariable UUID id,
                                                   @PathVariable UUID pagamentoId,
                                                   @RequestBody(required = false) EstornoPagamentoRequest req) {
        return service.estornarPagamento(id, pagamentoId, req != null ? req.getObservacao() : null);
    }

    @PostMapping("/{id}/cancelar")
    public ContaReceberResponse cancelar(@PathVariable UUID id) {
        return service.cancelar(id);
    }
}
