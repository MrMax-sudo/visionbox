package com.visionbox.modules.financeiro.formapagamento.service;

import com.visionbox.modules.financeiro.formapagamento.domain.FormaPagamento;
import com.visionbox.modules.financeiro.formapagamento.domain.FormaPagamento.TipoFormaPagamento;
import com.visionbox.modules.financeiro.formapagamento.dto.FormaPagamentoRequest;
import com.visionbox.modules.financeiro.formapagamento.dto.FormaPagamentoResponse;
import com.visionbox.modules.financeiro.formapagamento.mapper.FormaPagamentoMapper;
import com.visionbox.modules.financeiro.formapagamento.repository.FormaPagamentoRepository;
import com.visionbox.shared.tenant.TenantContext;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class FormaPagamentoServiceTest {

    private static final UUID LOJA = UUID.fromString("00000000-0000-0000-0000-000000000001");

    private FormaPagamentoRepository repository;
    private FormaPagamentoMapper mapper;
    private FormaPagamentoService service;

    @BeforeEach
    void setUp() {
        repository = mock(FormaPagamentoRepository.class);
        mapper = mock(FormaPagamentoMapper.class);
        service = new FormaPagamentoService(repository, mapper);
        TenantContext.setCurrentLojaId(LOJA);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void listarAtivas_retornaSomenteAtivas() {
        when(repository.findByLojaIdAndAtivoTrue(LOJA))
                .thenReturn(List.of(formaTipo(TipoFormaPagamento.PIX), formaTipo(TipoFormaPagamento.DINHEIRO)));
        when(mapper.toResponse(any())).thenAnswer(inv -> new FormaPagamentoResponse());

        List<FormaPagamentoResponse> result = service.listarAtivas();

        assertThat(result).hasSize(2);
        verify(repository).findByLojaIdAndAtivoTrue(LOJA);
    }

    @Test
    void buscar_formaInexistente_lancaEntityNotFound() {
        when(repository.findByIdAndLojaId(any(), eq(LOJA))).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.buscar(UUID.randomUUID()))
                .isInstanceOf(EntityNotFoundException.class)
                .hasMessageContaining("Forma de pagamento não encontrada");
    }

    @Test
    void criar_comPadrao_desmarcaPadraoAnteriorUMParaZero() {
        FormaPagamento antigo = formaTipo(TipoFormaPagamento.DINHEIRO);
        antigo.setPadrao(true);
        when(repository.findByLojaIdAndPadraoTrue(LOJA)).thenReturn(Optional.of(antigo));
        when(mapper.toResponse(any())).thenReturn(new FormaPagamentoResponse());
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        FormaPagamentoRequest req = FormaPagamentoRequest.builder()
                .nome("PIX")
                .tipo(TipoFormaPagamento.PIX)
                .padrao(true)
                .tPagNfce("17")
                .build();

        service.criar(req);

        assertThat(antigo.isPadrao()).isFalse();
        verify(repository).save(antigo);
        verify(repository).save(argThat(fp -> fp instanceof FormaPagamento
                && ((FormaPagamento) fp).isPadrao()
                && "17".equals(((FormaPagamento) fp).getTPagNfce())));
    }

    @Test
    void atualizar_semPadrao_naoAlteraOutras() {
        FormaPagamento fp = formaTipo(TipoFormaPagamento.DINHEIRO);
        fp.setId(UUID.randomUUID());
        when(repository.findByIdAndLojaId(fp.getId(), LOJA)).thenReturn(Optional.of(fp));
        when(mapper.toResponse(any())).thenReturn(new FormaPagamentoResponse());
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        FormaPagamentoRequest req = FormaPagamentoRequest.builder()
                .nome("Dinheiro Novo")
                .tipo(TipoFormaPagamento.DINHEIRO)
                .padrao(false)
                .build();

        service.atualizar(fp.getId(), req);

        verify(repository, never()).findByLojaIdAndPadraoTrue(LOJA);
    }

    @Test
    void remover_softDelete_marcaAtivoFalse() {
        FormaPagamento fp = formaTipo(TipoFormaPagamento.CREDITO);
        fp.setAtivo(true);
        when(repository.findByIdAndLojaId(fp.getId(), LOJA)).thenReturn(Optional.of(fp));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.remover(fp.getId());

        assertThat(fp.isAtivo()).isFalse();
    }

    @Test
    void criar_taxaPercentualEPrazos_mapeados() {
        when(mapper.toResponse(any())).thenReturn(new FormaPagamentoResponse());
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        FormaPagamentoRequest req = FormaPagamentoRequest.builder()
                .nome("Crédito 3x")
                .tipo(TipoFormaPagamento.CREDITO)
                .permiteParcelar(true)
                .maxParcelas(3)
                .taxaPercentual(new BigDecimal("2.50"))
                .prazoDias(30)
                .tPagNfce("03")
                .build();

        service.criar(req);

        verify(repository).save(argThat(fp -> {
            FormaPagamento fp1 = (FormaPagamento) fp;
            return fp1.isPermiteParcelar()
                    && fp1.getMaxParcelas() == 3
                    && fp1.getTaxaPercentual().compareTo(new BigDecimal("2.50")) == 0
                    && fp1.getPrazoDias() == 30
                    && "03".equals(fp1.getTPagNfce());
        }));
    }

    private FormaPagamento formaTipo(TipoFormaPagamento tipo) {
        return FormaPagamento.builder()
                .lojaId(LOJA)
                .nome(tipo.name())
                .tipo(tipo)
                .ativo(true)
                .build();
    }
}