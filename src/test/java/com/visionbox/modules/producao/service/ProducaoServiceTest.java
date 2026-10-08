package com.visionbox.modules.producao.service;

import com.visionbox.modules.ordemservico.domain.OrdemServico;
import com.visionbox.modules.ordemservico.domain.StatusOS;
import com.visionbox.modules.ordemservico.domain.TransicaoInvalidaException;
import com.visionbox.modules.ordemservico.domain.TransicaoOSRegistry;
import com.visionbox.modules.ordemservico.repository.OrdemServicoRepository;
import com.visionbox.modules.ordemservico.service.OrdemServicoService;
import com.visionbox.modules.producao.domain.ProducaoOS;
import com.visionbox.modules.producao.dto.ProducaoCQRequest;
import com.visionbox.modules.producao.dto.ProducaoResponse;
import com.visionbox.modules.producao.repository.ProducaoOSRepository;
import com.visionbox.shared.error.BusinessException;
import com.visionbox.shared.tenant.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProducaoServiceTest {

    private static final UUID LOJA_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID OS_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");

    @Mock
    private ProducaoOSRepository producaoRepository;

    @Mock
    private OrdemServicoRepository osRepository;

    @Mock
    private OrdemServicoService osService;

    @Mock
    private Clock clock;

    @InjectMocks
    private ProducaoService service;

    @BeforeEach
    void setUp() {
        TenantContext.setCurrentLojaId(LOJA_ID);
        lenient().when(clock.instant()).thenReturn(Instant.parse("2026-10-08T12:00:00Z"));
        lenient().when(clock.getZone()).thenReturn(ZoneOffset.UTC);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    private OrdemServico osCom(StatusOS status) {
        return OrdemServico.builder().id(OS_ID).lojaId(LOJA_ID).numero("OS-2026-00001").status(status).build();
    }

    @Test
    void listarFila_DeveTrazerApenasStatusCorretos_EM_PRODUCAO() {
        OrdemServico os1 = OrdemServico.builder().id(OS_ID).lojaId(LOJA_ID).numero("OS-2026-00001")
                .status(StatusOS.EM_PRODUCAO).build();
        OrdemServico os2 = OrdemServico.builder().id(UUID.randomUUID()).lojaId(LOJA_ID).numero("OS-2026-00002")
                .status(StatusOS.MONTAGEM).build();
        Page<OrdemServico> page = new PageImpl<>(List.of(os1, os2), PageRequest.of(0, 10), 2);

        when(osRepository.findByLojaIdAndStatusIn(eq(LOJA_ID), anyCollection(), any(Pageable.class)))
                .thenReturn(page);

        Page<ProducaoResponse> result = service.listarFila(PageRequest.of(0, 10));

        assertThat(result.getContent()).hasSize(2);
        assertThat(result.getContent().get(0).getStatusOs()).isEqualTo("EM_PRODUCAO");
        assertThat(result.getContent().get(1).getStatusOs()).isEqualTo("MONTAGEM");
        verify(osRepository).findByLojaIdAndStatusIn(eq(LOJA_ID), argThat(set ->
                set.contains(StatusOS.EM_PRODUCAO) && set.contains(StatusOS.MONTAGEM)), any(Pageable.class));
    }

    @Test
    void iniciar_DeveRegistrarInicioGerarEventoOS() {
        OrdemServico os = OrdemServico.builder().id(OS_ID).lojaId(LOJA_ID).numero("OS-2026-00001")
                .status(StatusOS.EM_PRODUCAO).build();
        when(osRepository.findByIdAndLojaId(OS_ID, LOJA_ID)).thenReturn(Optional.of(os));
        when(producaoRepository.findByOrdemServicoIdAndLojaId(OS_ID, LOJA_ID)).thenReturn(Optional.empty());

        ProducaoOS savedProd = ProducaoOS.builder().id(UUID.randomUUID()).lojaId(LOJA_ID).ordemServicoId(OS_ID)
                .inicioProducao(OffsetDateTime.now(clock)).build();
        when(producaoRepository.save(any(ProducaoOS.class))).thenReturn(savedProd);

        ProducaoResponse resp = service.iniciar(OS_ID);

        assertThat(resp.getOrdemServicoId()).isEqualTo(OS_ID);
        assertThat(resp.getInicioProducao()).isNotNull();
        verify(producaoRepository).save(any(ProducaoOS.class));
    }

    @Test
    void finalizar_DeveAvancarParaLenteProntaEM_PRODUCAO() {
        OrdemServico os = OrdemServico.builder().id(OS_ID).lojaId(LOJA_ID).numero("OS-2026-00001")
                .status(StatusOS.EM_PRODUCAO).build();
        when(osRepository.findByIdAndLojaId(OS_ID, LOJA_ID)).thenReturn(Optional.of(os));
        when(producaoRepository.findByOrdemServicoIdAndLojaId(OS_ID, LOJA_ID)).thenReturn(Optional.empty());
        when(producaoRepository.save(any(ProducaoOS.class))).thenAnswer(inv -> inv.getArgument(0));
        when(osService.avancar(eq(LOJA_ID), eq(OS_ID), eq(StatusOS.LENTE_PRONTA), anyString(), anyString()))
                .thenReturn(osCom(StatusOS.LENTE_PRONTA));

        ProducaoResponse resp = service.finalizar(OS_ID);

        assertThat(resp.getStatusOs()).isEqualTo("LENTE_PRONTA");
        verify(osService).avancar(eq(LOJA_ID), eq(OS_ID), eq(StatusOS.LENTE_PRONTA), anyString(), anyString());
    }

    @Test
    void cq_ReprovadoSemFoto_DeveRetornarErro() {
        OrdemServico os = OrdemServico.builder().id(OS_ID).lojaId(LOJA_ID).numero("OS-2026-00001")
                .status(StatusOS.CONTROLE_QUALIDADE).build();
        when(osRepository.findByIdAndLojaId(OS_ID, LOJA_ID)).thenReturn(Optional.of(os));
        when(producaoRepository.findByOrdemServicoIdAndLojaId(OS_ID, LOJA_ID)).thenReturn(Optional.empty());

        ProducaoCQRequest req = ProducaoCQRequest.builder()
                .aprovado(false)
                .motivoReprovacao("Defeito de montagem")
                .build();

        assertThatThrownBy(() -> service.registrarCQ(OS_ID, req))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("exige foto");
        verify(osService, never()).avancar(any(), any(), any(), anyString(), anyString());
    }

    @Test
    void cq_ReprovadoComFoto_DeveIrParaRETRABALHO() {
        OrdemServico os = OrdemServico.builder().id(OS_ID).lojaId(LOJA_ID).numero("OS-2026-00001")
                .status(StatusOS.CONTROLE_QUALIDADE).build();
        when(osRepository.findByIdAndLojaId(OS_ID, LOJA_ID)).thenReturn(Optional.of(os));
        when(producaoRepository.findByOrdemServicoIdAndLojaId(OS_ID, LOJA_ID)).thenReturn(Optional.empty());
        when(producaoRepository.save(any(ProducaoOS.class))).thenAnswer(inv -> inv.getArgument(0));
        when(osService.avancar(eq(LOJA_ID), eq(OS_ID), eq(StatusOS.RETRABALHO), anyString(), anyString()))
                .thenReturn(osCom(StatusOS.RETRABALHO));

        ProducaoCQRequest req = ProducaoCQRequest.builder()
                .aprovado(false)
                .motivoReprovacao("Centro fora de alinhamento")
                .fotoS3Key("producao/cq/foto123.jpg")
                .build();

        ProducaoResponse resp = service.registrarCQ(OS_ID, req);

        assertThat(resp.getStatusOs()).isEqualTo("RETRABALHO");
        assertThat(resp.getFotoS3Key()).isEqualTo("producao/cq/foto123.jpg");
        verify(osService).avancar(eq(LOJA_ID), eq(OS_ID), eq(StatusOS.RETRABALHO), anyString(), anyString());
    }

    @Test
    void cq_Aprovado_DeveIrParaProntoParaRetirada_SeEmCQ() {
        OrdemServico os = OrdemServico.builder().id(OS_ID).lojaId(LOJA_ID).numero("OS-2026-00001")
                .status(StatusOS.CONTROLE_QUALIDADE).build();
        when(osRepository.findByIdAndLojaId(OS_ID, LOJA_ID)).thenReturn(Optional.of(os));
        when(producaoRepository.findByOrdemServicoIdAndLojaId(OS_ID, LOJA_ID)).thenReturn(Optional.empty());
        when(producaoRepository.save(any(ProducaoOS.class))).thenAnswer(inv -> inv.getArgument(0));
        when(osService.avancar(eq(LOJA_ID), eq(OS_ID), eq(StatusOS.PRONTO_PARA_RETIRADA), anyString(), anyString()))
                .thenReturn(osCom(StatusOS.PRONTO_PARA_RETIRADA));

        ProducaoCQRequest req = ProducaoCQRequest.builder()
                .aprovado(true)
                .build();

        ProducaoResponse resp = service.registrarCQ(OS_ID, req);

        assertThat(resp.getStatusOs()).isEqualTo("PRONTO_PARA_RETIRADA");
        verify(osService).avancar(eq(LOJA_ID), eq(OS_ID), eq(StatusOS.PRONTO_PARA_RETIRADA), anyString(), anyString());
    }

    @Test
    void transicaoInvalida_DevePropagarErro() {
        OrdemServico os = OrdemServico.builder().id(OS_ID).lojaId(LOJA_ID).numero("OS-2026-00001")
                .status(StatusOS.EM_PRODUCAO).build();
        when(osRepository.findByIdAndLojaId(OS_ID, LOJA_ID)).thenReturn(Optional.of(os));
        when(producaoRepository.findByOrdemServicoIdAndLojaId(OS_ID, LOJA_ID)).thenReturn(Optional.empty());
        when(producaoRepository.save(any(ProducaoOS.class))).thenAnswer(inv -> inv.getArgument(0));
        when(osService.avancar(eq(LOJA_ID), eq(OS_ID), eq(StatusOS.LENTE_PRONTA), anyString(), anyString()))
                .thenThrow(new TransicaoInvalidaException(StatusOS.EM_PRODUCAO, StatusOS.LENTE_PRONTA));

        assertThatThrownBy(() -> service.finalizar(OS_ID))
                .isInstanceOf(TransicaoInvalidaException.class);
    }
}