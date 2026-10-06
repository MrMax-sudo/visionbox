package com.visionbox.modules.fiscal;

import com.visionbox.modules.fiscal.dto.NfceEmitirRequest;
import com.visionbox.modules.fiscal.dto.NfceEmitirResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/v1/fiscal/nfce")
@RequiredArgsConstructor
public class FiscalController {

    private final FiscalService fiscalService;

    /**
     * POST /api/v1/fiscal/nfce/emitir
     * Header X-Loja-Id obrigatório via TenantFilter.
     * Body: NfceEmitirRequest (pedidoId, serie, numero opcional).
     * Usa FiscalProvider (MockFiscalProvider em dev/test) para gerar DocumentoFiscal mock autorizado.
     * Retorna 201 com chave 44 dígitos, protocolo 15 dígitos, cStat 100.
     */
    @PostMapping("/emitir")
    public ResponseEntity<NfceEmitirResponse> emitir(@Valid @RequestBody NfceEmitirRequest request) {
        log.info("Emitir NFC-e recebido pedidoId={} serie={} numero={} modelo={}",
                request.getPedidoId(), request.getSerie(), request.getNumero(), request.getModelo());
        NfceEmitirResponse resp = fiscalService.emitirNfce(request);
        return ResponseEntity.status(resp.isAutorizado() ? HttpStatus.CREATED : HttpStatus.OK).body(resp);
    }
}
