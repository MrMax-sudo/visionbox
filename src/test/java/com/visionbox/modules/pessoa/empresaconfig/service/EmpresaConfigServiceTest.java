package com.visionbox.modules.pessoa.empresaconfig.service;

import com.visionbox.modules.pessoa.domain.Loja;
import com.visionbox.modules.pessoa.empresaconfig.dto.EmpresaRequest;
import com.visionbox.modules.pessoa.empresaconfig.dto.EmpresaResponse;
import com.visionbox.modules.pessoa.repository.LojaRepository;
import com.visionbox.shared.tenant.TenantContext;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class EmpresaConfigServiceTest {

    private static final UUID LOJA = UUID.fromString("00000000-0000-0000-0000-000000000001");

    private LojaRepository repository;
    private EmpresaConfigService service;

    @BeforeEach
    void setUp() {
        repository = mock(LojaRepository.class);
        service = new EmpresaConfigService(repository);
        TenantContext.setCurrentLojaId(LOJA);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void buscarAtual_mapeiaDadosParaResponse() {
        Loja loja = loja("Ótica VisionBox Matriz");
        when(repository.findById(LOJA)).thenReturn(Optional.of(loja));

        EmpresaResponse res = service.buscarAtual();

        assertThat(res.getId()).isEqualTo(LOJA);
        assertThat(res.getNome()).isEqualTo("Ótica VisionBox Matriz");
        assertThat(res.getWhatsapp()).isEqualTo("5511984987382");
        assertThat(res.getUf()).isEqualTo("SP");
        assertThat(res.getCidade()).isEqualTo("São Paulo");
    }

    @Test
    void buscarAtual_lojaInexistente_lancaEntityNotFound() {
        when(repository.findById(LOJA)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.buscarAtual())
                .isInstanceOf(EntityNotFoundException.class)
                .hasMessageContaining("Empresa não encontrada");
    }

    @Test
    void atualizar_preencheCamposRecebidos() {
        Loja loja = loja("Antiga");
        when(repository.findById(LOJA)).thenReturn(Optional.of(loja));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        EmpresaRequest req = EmpresaRequest.builder()
                .nome("  Nova Visão Ótica  ")
                .cnpj("00112233000100")
                .whatsapp("5511987654321")
                .cidade("Campinas")
                .uf("SP")
                .logoUrl("https://cdn.example.com/logo.png")
                .build();

        EmpresaResponse res = service.atualizar(req);

        assertThat(res.getNome()).isEqualTo("Nova Visão Ótica");
        assertThat(res.getWhatsapp()).isEqualTo("5511987654321");
        assertThat(loja.getNome()).isEqualTo("Nova Visão Ótica");
        assertThat(loja.getCidade()).isEqualTo("Campinas");
        assertThat(loja.getLogoUrl()).isEqualTo("https://cdn.example.com/logo.png");
        verify(repository).save(loja);
    }

    @Test
    void atualizar_camposVaziosNormalizadosParaNull() {
        Loja loja = loja("Loja");
        when(repository.findById(LOJA)).thenReturn(Optional.of(loja));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        EmpresaRequest req = EmpresaRequest.builder()
                .nome("Loja")
                .whatsapp("  ")
                .site("  ")
                .build();

        service.atualizar(req);

        assertThat(loja.getWhatsapp()).isNull();
        assertThat(loja.getSite()).isNull();
    }

    @Test
    void atualizar_nomeNaoPodeFicarVazio() {
        Loja loja = loja("Loja");
        when(repository.findById(LOJA)).thenReturn(Optional.of(loja));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        EmpresaRequest req = EmpresaRequest.builder()
                .nome("   ")
                .build();

        EmpresaResponse res = service.atualizar(req);

        assertThat(res.getNome()).isEqualTo("Loja");
    }

    private Loja loja(String nome) {
        return Loja.builder()
                .id(LOJA)
                .nome(nome)
                .cnpj("00000000000191")
                .whatsapp("5511984987382")
                .endereco("Av. Paulista, 1000")
                .cidade("São Paulo")
                .uf("SP")
                .build();
    }
}