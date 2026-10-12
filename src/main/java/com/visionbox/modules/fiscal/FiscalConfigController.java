package com.visionbox.modules.fiscal;

import com.visionbox.modules.fiscal.dto.FiscalConfigRequest;
import com.visionbox.modules.fiscal.dto.FiscalConfigResponse;
import com.visionbox.modules.fiscal.dto.TestarConexaoResponse;
import com.visionbox.shared.tenant.TenantContext;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/v1/fiscal/config")
@RequiredArgsConstructor
public class FiscalConfigController {

    private final FiscalConfigService fiscalConfigService;

    @GetMapping
    public ResponseEntity<FiscalConfigResponse> buscar() {
        UUID lojaId = TenantContext.getLojaId();
        return ResponseEntity.ok(fiscalConfigService.buscarConfig(lojaId));
    }

    @PutMapping
    public ResponseEntity<FiscalConfigResponse> salvar(@Valid @RequestBody FiscalConfigRequest request) {
        UUID lojaId = TenantContext.getLojaId();
        return ResponseEntity.ok(fiscalConfigService.salvarConfig(lojaId, request));
    }

    @PostMapping("/testar-conexao")
    public ResponseEntity<TestarConexaoResponse> testarConexao(@RequestBody(required = false) Map<String, String> body) {
        UUID lojaId = TenantContext.getLojaId();
        FiscalConfigResponse current = fiscalConfigService.buscarConfig(lojaId);

        String url = (body != null && body.containsKey("url")) ? body.get("url") : current.getFlowboxUrl();
        String apiKey = (body != null && body.containsKey("apiKey")) ? body.get("apiKey") : current.getFlowboxApiKey();

        TestarConexaoResponse resp = fiscalConfigService.testarConexao(url, apiKey);
        return ResponseEntity.ok(resp);
    }
}
