package com.visionbox.modules.clinico.service;

import com.visionbox.modules.clinico.domain.Receita;
import com.visionbox.modules.clinico.dto.GrauDto;
import com.visionbox.modules.clinico.dto.ReceitaRequest;
import com.visionbox.modules.clinico.dto.ReceitaResponse;
import com.visionbox.modules.clinico.mapper.ReceitaMapper;
import com.visionbox.modules.clinico.repository.ReceitaRepository;
import com.visionbox.modules.pessoa.domain.Cliente;
import com.visionbox.modules.pessoa.repository.ClienteRepository;
import com.visionbox.shared.crypto.CryptoService;
import com.visionbox.shared.tenant.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ReceitaServiceTest {

    private static final UUID LOJA_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID CLIENTE_ID = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    @DisplayName("Criar receita salva grau apenas cifrado e responde descriptografado")
    void criarReceitaSalvaGrauCipherOnly() {
        TenantContext.setCurrentLojaId(LOJA_ID);
        ReceitaRepository receitaRepository = mock(ReceitaRepository.class);
        ClienteRepository clienteRepository = mock(ClienteRepository.class);
        ReceitaMapper mapper = mock(ReceitaMapper.class);
        CryptoService cryptoService = new CryptoService(
                "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
                "dev_hmac_pepper_change_in_prod");
        ReceitaService service = new ReceitaService(receitaRepository, clienteRepository, mapper, cryptoService);
        AtomicReference<Receita> saved = new AtomicReference<>();

        when(clienteRepository.findByIdAndLojaId(CLIENTE_ID, LOJA_ID))
                .thenReturn(Optional.of(Cliente.builder().lojaId(LOJA_ID).nome("Cliente").build()));
        when(receitaRepository.save(any(Receita.class))).thenAnswer(invocation -> {
            Receita receita = invocation.getArgument(0);
            saved.set(receita);
            return receita;
        });
        when(mapper.toResponse(any(Receita.class))).thenAnswer(invocation -> {
            Receita receita = invocation.getArgument(0);
            return ReceitaResponse.builder()
                    .lojaId(receita.getLojaId())
                    .clienteId(receita.getClienteId())
                    .tipo(receita.getTipo())
                    .build();
        });

        ReceitaResponse response = service.criar(ReceitaRequest.builder()
                .clienteId(CLIENTE_ID)
                .dataEmissao("2026-09-05")
                .dataValidade("2027-09-05")
                .tipo("VISAO_SIMPLES")
                .od(GrauDto.builder()
                        .esferico(new BigDecimal("-1.25"))
                        .cilindrico(new BigDecimal("-0.50"))
                        .eixo(90)
                        .dnp(new BigDecimal("31.5"))
                        .build())
                .build());

        Receita receita = saved.get();
        assertThat(receita.getOdEsferico()).isNull();
        assertThat(receita.getOdCilindrico()).isNull();
        assertThat(receita.getOdEixo()).isNull();
        assertThat(receita.getOdDnp()).isNull();
        assertThat(receita.getOdCipher()).isNotEmpty();
        assertThat(response.getOd().getEsferico()).isEqualByComparingTo("-1.25");
        assertThat(response.getOd().getCilindrico()).isEqualByComparingTo("-0.50");
        assertThat(response.getOd().getEixo()).isEqualTo(90);
        assertThat(response.getOd().getDnp()).isEqualByComparingTo("31.5");
    }
}
