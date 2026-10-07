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
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
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

    // ---------------------------------------------------------------------
    // Contrato do frontend (sem datas, MONOFOCAL, adicao 0, dp numérico)
    // ---------------------------------------------------------------------

    private static final String CHAVE = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";

    private CryptoService cryptoService() {
        return new CryptoService(CHAVE, "dev_hmac_pepper_change_in_prod");
    }

    private void setupMocks(ReceitaRepository receitaRepository, ClienteRepository clienteRepository,
                            ReceitaMapper mapper, AtomicReference<Receita> saved) {
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
    }

    @Test
    @DisplayName("Sem datas, criação defaulta emissão=hoje e validade=hoje+2 anos")
    void criarSemDatasDefaultaHojeMaisDoisAnos() {
        TenantContext.setCurrentLojaId(LOJA_ID);
        ReceitaRepository receitaRepository = mock(ReceitaRepository.class);
        ClienteRepository clienteRepository = mock(ClienteRepository.class);
        ReceitaMapper mapper = mock(ReceitaMapper.class);
        AtomicReference<Receita> saved = new AtomicReference<>();
        setupMocks(receitaRepository, clienteRepository, mapper, saved);
        ReceitaService service = new ReceitaService(receitaRepository, clienteRepository, mapper, cryptoService());

        service.criar(ReceitaRequest.builder().clienteId(CLIENTE_ID).build());

        Receita receita = saved.get();
        assertThat(receita.getDataEmissao()).isEqualTo(java.time.LocalDate.now());
        assertThat(receita.getDataValidade()).isEqualTo(java.time.LocalDate.now().plusYears(2));
        assertThat(receita.getTipo()).isEqualTo("VISAO_SIMPLES");
    }

    @Test
    @DisplayName("MONOFOCAL normaliza para VISAO_SIMPLES (CHECK do banco) e adicao 0 vira sem adição")
    void criarMonofocalNormalizaTipoEAdicao() {
        TenantContext.setCurrentLojaId(LOJA_ID);
        ReceitaRepository receitaRepository = mock(ReceitaRepository.class);
        ClienteRepository clienteRepository = mock(ClienteRepository.class);
        ReceitaMapper mapper = mock(ReceitaMapper.class);
        AtomicReference<Receita> saved = new AtomicReference<>();
        setupMocks(receitaRepository, clienteRepository, mapper, saved);
        ReceitaService service = new ReceitaService(receitaRepository, clienteRepository, mapper, cryptoService());

        ReceitaResponse response = service.criar(ReceitaRequest.builder()
                .clienteId(CLIENTE_ID)
                .tipo("MONOFOCAL") // como o frontend envia
                .od(GrauDto.builder()
                        .esferico(new BigDecimal("-2.50"))
                        .cilindrico(new BigDecimal("-1.25"))
                        .eixo(90)
                        .adicao(BigDecimal.ZERO) // frontend manda 0 quando não é multifocal
                        .build())
                .build());

        Receita receita = saved.get();
        assertThat(receita.getTipo()).isEqualTo("VISAO_SIMPLES");
        // grau cifrado sem adicao (regra "adicao só em MULTIFOCAL/BIFOCAL")
        String grauDecifrado = cryptoService().decrypt(receita.getOdCipher());
        assertThat(grauDecifrado).contains("\"adicao\":null");
        assertThat(response.getOd().getAdicao()).isNull();
        assertThat(response.getOd().getEsferico()).isEqualByComparingTo("-2.50");
    }

    @Test
    @DisplayName("Data com formato errado gera 400 legível (não 500 de DateTimeParseException)")
    void criarComDataInvalidaGeraMensagemLegivel() {
        TenantContext.setCurrentLojaId(LOJA_ID);
        ReceitaRepository receitaRepository = mock(ReceitaRepository.class);
        ClienteRepository clienteRepository = mock(ClienteRepository.class);
        ReceitaMapper mapper = mock(ReceitaMapper.class);
        setupMocks(receitaRepository, clienteRepository, mapper, new AtomicReference<>());
        ReceitaService service = new ReceitaService(receitaRepository, clienteRepository, mapper, cryptoService());

        assertThatThrownBy(() -> service.criar(ReceitaRequest.builder()
                .clienteId(CLIENTE_ID)
                .dataEmissao("05/09/2026")
                .build()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("dataEmissao com formato inválido")
                .hasMessageContaining("yyyy-MM-dd");
    }

    @Test
    @DisplayName("Tipo fora do domínio gera 400 legível listando os aceitos")
    void criarComTipoInvalidoGeraMensagemLegivel() {
        TenantContext.setCurrentLojaId(LOJA_ID);
        ReceitaRepository receitaRepository = mock(ReceitaRepository.class);
        ClienteRepository clienteRepository = mock(ClienteRepository.class);
        ReceitaMapper mapper = mock(ReceitaMapper.class);
        setupMocks(receitaRepository, clienteRepository, mapper, new AtomicReference<>());
        ReceitaService service = new ReceitaService(receitaRepository, clienteRepository, mapper, cryptoService());

        assertThatThrownBy(() -> service.criar(ReceitaRequest.builder()
                .clienteId(CLIENTE_ID)
                .tipo("PROGRESSIVO")
                .build()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("tipoLente inválido")
                .hasMessageContaining("MULTIFOCAL");
    }

    @Test
    @DisplayName("Listagem preenche clienteNome com uma consulta só (sem N+1)")
    void listarPreencheClienteNomeSemN1() {
        TenantContext.setCurrentLojaId(LOJA_ID);
        ReceitaRepository receitaRepository = mock(ReceitaRepository.class);
        ClienteRepository clienteRepository = mock(ClienteRepository.class);
        ReceitaMapper mapper = mock(ReceitaMapper.class);

        Receita receita = Receita.builder()
                .lojaId(LOJA_ID)
                .clienteId(CLIENTE_ID)
                .dataEmissao(java.time.LocalDate.now())
                .dataValidade(java.time.LocalDate.now().plusYears(2))
                .tipo("VISAO_SIMPLES")
                .build();
        receita.setId(UUID.randomUUID());

        when(receitaRepository.findAllByLojaId(eq(LOJA_ID), any(Pageable.class)))
                .thenReturn(new org.springframework.data.domain.PageImpl<>(java.util.List.of(receita)));
        when(clienteRepository.findByLojaIdAndIdIn(eq(LOJA_ID), any()))
                .thenReturn(java.util.List.of(Cliente.builder().id(CLIENTE_ID).lojaId(LOJA_ID).nome("Maria").build()));
        when(mapper.toResponse(any(Receita.class))).thenAnswer(invocation -> ReceitaResponse.builder()
                .lojaId(invocation.getArgument(0, Receita.class).getLojaId())
                .clienteId(invocation.getArgument(0, Receita.class).getClienteId())
                .build());

        ReceitaService service = new ReceitaService(receitaRepository, clienteRepository, mapper, cryptoService());
        var page = service.listar(null, org.springframework.data.domain.PageRequest.of(0, 20));

        assertThat(page.getContent()).hasSize(1);
        assertThat(page.getContent().get(0).getClienteNome()).isEqualTo("Maria");
        verify(clienteRepository, times(1)).findByLojaIdAndIdIn(eq(LOJA_ID), any());
        verify(clienteRepository, never()).findByIdAndLojaId(any(), any());
    }
}
