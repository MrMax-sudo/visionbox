package com.visionbox.modules.pessoa.empresaconfig.service;

import com.visionbox.modules.pessoa.domain.Loja;
import com.visionbox.modules.pessoa.empresaconfig.dto.EmpresaRequest;
import com.visionbox.modules.pessoa.empresaconfig.dto.EmpresaResponse;
import com.visionbox.modules.pessoa.repository.LojaRepository;
import com.visionbox.shared.tenant.TenantContext;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class EmpresaConfigService {

    private final LojaRepository lojaRepository;

    @Transactional(readOnly = true)
    public EmpresaResponse buscarAtual() {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        return lojaRepository.findById(lojaId)
                .map(EmpresaResponse::from)
                .orElseThrow(() -> new EntityNotFoundException("Empresa não encontrada"));
    }

    @Transactional
    public EmpresaResponse atualizar(EmpresaRequest req) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        Loja loja = lojaRepository.findById(lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Empresa não encontrada"));

        if (req.getNome() != null && !req.getNome().isBlank()) {
            loja.setNome(req.getNome().trim());
        }
        loja.setCnpj(normalizar(req.getCnpj()));
        loja.setTelefone(normalizar(req.getTelefone()));
        loja.setWhatsapp(normalizar(req.getWhatsapp()));
        loja.setEmailContato(campoOuNulo(req.getEmailContato()));
        loja.setEndereco(campoOuNulo(req.getEndereco()));
        loja.setNumero(campoOuNulo(req.getNumero()));
        loja.setComplemento(campoOuNulo(req.getComplemento()));
        loja.setBairro(campoOuNulo(req.getBairro()));
        loja.setCidade(campoOuNulo(req.getCidade()));
        loja.setUf(campoOuNulo(req.getUf()));
        loja.setCep(campoOuNulo(req.getCep()));
        loja.setSite(campoOuNulo(req.getSite()));
        loja.setLogoUrl(campoOuNulo(req.getLogoUrl()));
        if (req.getLogoBase64() != null) {
            loja.setLogoBase64(campoOuNulo(req.getLogoBase64()));
        }

        return EmpresaResponse.from(lojaRepository.save(loja));
    }

    @Transactional
    public EmpresaResponse salvarLogo(String base64Data) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        Loja loja = lojaRepository.findById(lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Empresa não encontrada"));

        loja.setLogoBase64(base64Data);
        loja.setLogoUrl("/api/v1/empresa/logo.png");
        return EmpresaResponse.from(lojaRepository.save(loja));
    }

    @Transactional(readOnly = true)
    public byte[] buscarLogoBytes() {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        Loja loja = lojaRepository.findById(lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Empresa não encontrada"));

        String base64 = loja.getLogoBase64();
        if (base64 == null || base64.isBlank()) {
            return new byte[0];
        }
        if (base64.contains(",")) {
            base64 = base64.substring(base64.indexOf(",") + 1);
        }
        try {
            return java.util.Base64.getDecoder().decode(base64.trim());
        } catch (IllegalArgumentException e) {
            return new byte[0];
        }
    }

    private String normalizar(String valor) {
        if (valor == null) return null;
        String s = valor.trim();
        return s.isEmpty() ? null : s;
    }

    private String campoOuNulo(String valor) {
        return normalizar(valor);
    }
}