package com.visionbox.modules.financeiro.service;

import com.visionbox.modules.financeiro.domain.ConciliacaoOfx;
import com.visionbox.modules.financeiro.domain.ConciliacaoOfx.StatusConciliacao;
import com.visionbox.modules.financeiro.domain.ConciliacaoOfx.TipoContaConciliacao;
import com.visionbox.modules.financeiro.domain.ContaPagar;
import com.visionbox.modules.financeiro.domain.ContaReceber;
import com.visionbox.modules.financeiro.dto.BaixaContaReceberRequest;
import com.visionbox.modules.financeiro.dto.OfxImportarRequest;
import com.visionbox.modules.financeiro.dto.OfxImportarResponse;
import com.visionbox.modules.financeiro.formapagamento.domain.FormaPagamento;
import com.visionbox.modules.financeiro.formapagamento.domain.FormaPagamento.TipoFormaPagamento;
import com.visionbox.modules.financeiro.formapagamento.repository.FormaPagamentoRepository;
import com.visionbox.modules.financeiro.mapper.ConciliacaoOfxMapper;
import com.visionbox.modules.financeiro.repository.ConciliacaoOfxRepository;
import com.visionbox.modules.financeiro.repository.ContaPagarRepository;
import com.visionbox.modules.financeiro.repository.ContaReceberRepository;
import com.visionbox.shared.error.BusinessException;
import com.visionbox.shared.tenant.TenantContext;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * OfxConciliacaoServiceTest — US13: match por valor+data (tolerância),
 * divergência, dedup por FITID, escopo por loja e direção receber/pagar.
 * Fase 3 (D-017): CONCILIADO a receber baixa o título via ContaReceberService
 * (linha em conta_receber_pagamento + movimento no caixa) sem quebrar o lote.
 */
class OfxConciliacaoServiceTest {

    private static final UUID LOJA = UUID.fromString("00000000-0000-0000-0000-000000000001");

    private ConciliacaoOfxRepository conciliacaoRepository;
    private ContaReceberRepository contaReceberRepository;
    private ContaPagarRepository contaPagarRepository;
    private ConciliacaoOfxMapper mapper;
    private FormaPagamentoRepository formaPagamentoRepository;
    private ContaReceberService contaReceberService;
    private OfxConciliacaoService service;

    @BeforeEach
    void setUp() {
        conciliacaoRepository = mock(ConciliacaoOfxRepository.class);
        contaReceberRepository = mock(ContaReceberRepository.class);
        contaPagarRepository = mock(ContaPagarRepository.class);
        mapper = mock(ConciliacaoOfxMapper.class);
        formaPagamentoRepository = mock(FormaPagamentoRepository.class);
        contaReceberService = mock(ContaReceberService.class);
        service = new OfxConciliacaoService(conciliacaoRepository, contaReceberRepository,
                contaPagarRepository, mapper, formaPagamentoRepository, contaReceberService);
        TenantContext.setCurrentLojaId(LOJA);

        when(conciliacaoRepository.findIdsContaReceberConciliadas(LOJA, StatusConciliacao.CONCILIADO))
                .thenReturn(new java.util.ArrayList<>());
        when(conciliacaoRepository.findIdsContaPagarConciliadas(LOJA, StatusConciliacao.CONCILIADO))
                .thenReturn(new java.util.ArrayList<>());
        when(conciliacaoRepository.save(any(ConciliacaoOfx.class))).thenAnswer(inv -> {
            ConciliacaoOfx c = inv.getArgument(0);
            if (c.getId() == null) {
                c.setId(UUID.randomUUID());
            }
            return c;
        });
        // por padrão: loja sem forma padrão → baixa da conciliação sem forma (D-017)
        when(formaPagamentoRepository.findByLojaIdAndPadraoTrue(LOJA)).thenReturn(Optional.empty());
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void matchExatoValorEData_conciliaContaReceber() {
        UUID r1 = UUID.randomUUID();
        when(contaReceberRepository.findByLojaIdAndValorAndStatusNot(
                LOJA, new BigDecimal("100.00"), ContaReceber.StatusConta.CANCELADO))
                .thenReturn(List.of(contaReceber(r1, "100.00", LocalDate.of(2026, 10, 5),
                        ContaReceber.StatusConta.PAGO)));

        OfxImportarResponse resp = service.importarConteudo(ofxCredito("100.00", "20261005", "F1"), 3, null);

        assertThat(resp.getImportados()).isEqualTo(1);
        assertThat(resp.getConciliados()).isEqualTo(1);
        assertThat(resp.getDuplicados()).isZero();

        ConciliacaoOfx salva = capturarLinhaSalva();
        assertThat(salva.getStatus()).isEqualTo(StatusConciliacao.CONCILIADO);
        assertThat(salva.getTipoConta()).isEqualTo(TipoContaConciliacao.RECEBER);
        assertThat(salva.getContaReceberId()).isEqualTo(r1);
        assertThat(salva.getContaPagarId()).isNull();
        assertThat(salva.getDiferencaValor()).isEqualByComparingTo("0.00");
        assertThat(salva.getFitId()).isEqualTo("F1");
    }

    @Test
    void matchDentroDaToleranciaDeDias_concilia() {
        UUID r1 = UUID.randomUUID();
        // vencimento 2026-10-01, postado 2026-10-03 => distância 2 <= 3
        when(contaReceberRepository.findByLojaIdAndValorAndStatusNot(
                LOJA, new BigDecimal("100.00"), ContaReceber.StatusConta.CANCELADO))
                .thenReturn(List.of(contaReceber(r1, "100.00", LocalDate.of(2026, 10, 1),
                        ContaReceber.StatusConta.PAGO)));

        OfxImportarResponse resp = service.importarConteudo(ofxCredito("100.00", "20261003", "F2"), 3, null);

        assertThat(resp.getConciliados()).isEqualTo(1);
        assertThat(capturarLinhaSalva().getStatus()).isEqualTo(StatusConciliacao.CONCILIADO);
    }

    @Test
    void valorDiferenteDataProxima_marcaDivergente() {
        UUID r1 = UUID.randomUUID();
        when(contaReceberRepository.findByLojaIdAndValorAndStatusNot(
                eq(LOJA), eq(new BigDecimal("100.00")), eq(ContaReceber.StatusConta.CANCELADO)))
                .thenReturn(List.of());
        when(contaReceberRepository.findByLojaIdAndVencimentoBetween(
                LOJA, LocalDate.of(2026, 9, 29), LocalDate.of(2026, 10, 5)))
                .thenReturn(List.of(contaReceber(r1, "90.00", LocalDate.of(2026, 10, 2),
                        ContaReceber.StatusConta.PAGO)));

        OfxImportarResponse resp = service.importarConteudo(ofxCredito("100.00", "20261002", "F3"), 3, null);

        assertThat(resp.getDivergentes()).isEqualTo(1);
        assertThat(resp.getConciliados()).isZero();

        ConciliacaoOfx salva = capturarLinhaSalva();
        assertThat(salva.getStatus()).isEqualTo(StatusConciliacao.DIVERGENTE);
        assertThat(salva.getContaReceberId()).isEqualTo(r1);
        assertThat(salva.getDiferencaValor()).isEqualByComparingTo("10.00");
    }

    @Test
    void semCorrespondencia_marcaPendente() {
        when(contaReceberRepository.findByLojaIdAndValorAndStatusNot(
                any(UUID.class), any(BigDecimal.class), any(ContaReceber.StatusConta.class)))
                .thenReturn(List.of());
        when(contaReceberRepository.findByLojaIdAndVencimentoBetween(any(UUID.class), any(), any()))
                .thenReturn(List.of());

        OfxImportarResponse resp = service.importarConteudo(ofxCredito("100.00", "20261002", "F4"), 3, null);

        assertThat(resp.getPendentes()).isEqualTo(1);
        ConciliacaoOfx salva = capturarLinhaSalva();
        assertThat(salva.getStatus()).isEqualTo(StatusConciliacao.PENDENTE);
        assertThat(salva.getContaReceberId()).isNull();
        assertThat(salva.getObservacao()).contains("Sem correspondência");
    }

    @Test
    void fitIdJaImportado_naoGravaDuplicado() {
        when(conciliacaoRepository.existsByLojaIdAndFitId(LOJA, "F5")).thenReturn(true);

        OfxImportarResponse resp = service.importarConteudo(ofxCredito("100.00", "20261002", "F5"), 3, null);

        assertThat(resp.getImportados()).isZero();
        assertThat(resp.getDuplicados()).isEqualTo(1);
        verify(conciliacaoRepository, never()).save(any(ConciliacaoOfx.class));
    }

    @Test
    void fitIdRepetidoNoMesmoArquivo_importaUmaVez() {
        // duas transações idênticas (mesmo FITID) no mesmo arquivo
        String ofx = ofxCredito("100.00", "20261002", "F6") + ofxCredito("100.00", "20261002", "F6");
        when(conciliacaoRepository.existsByLojaIdAndFitId(LOJA, "F6")).thenReturn(false, true);
        when(contaReceberRepository.findByLojaIdAndValorAndStatusNot(
                eq(LOJA), eq(new BigDecimal("100.00")), eq(ContaReceber.StatusConta.CANCELADO)))
                .thenReturn(List.of());

        OfxImportarResponse resp = service.importarConteudo(ofx, 3, null);

        assertThat(resp.getTotalTransacoes()).isEqualTo(2);
        assertThat(resp.getImportados()).isEqualTo(1);
        assertThat(resp.getDuplicados()).isEqualTo(1);
        verify(conciliacaoRepository, times(1)).save(any(ConciliacaoOfx.class));
    }

    @Test
    void debito_conciliaContaPagar() {
        UUID p1 = UUID.randomUUID();
        when(contaPagarRepository.findByLojaIdAndValorAndStatusNot(
                LOJA, new BigDecimal("50.00"), ContaPagar.StatusContaPagar.CANCELADO))
                .thenReturn(List.of(contaPagar(p1, "50.00", LocalDate.of(2026, 10, 4),
                        ContaPagar.StatusContaPagar.PAGO)));

        OfxImportarResponse resp = service.importarConteudo(ofxDebito("50.00", "20261004", "F7"), 3, null);

        assertThat(resp.getConciliados()).isEqualTo(1);
        ConciliacaoOfx salva = capturarLinhaSalva();
        assertThat(salva.getStatus()).isEqualTo(StatusConciliacao.CONCILIADO);
        assertThat(salva.getTipoConta()).isEqualTo(TipoContaConciliacao.PAGAR);
        assertThat(salva.getContaPagarId()).isEqualTo(p1);
        assertThat(salva.getContaReceberId()).isNull();
        // débito conciliado é evidência — NÃO baixa conta a receber
        verify(contaReceberService, never()).baixar(any(UUID.class), any(BaixaContaReceberRequest.class));
    }

    @Test
    void contaJaConciliada_naoReconcilia() {
        UUID r1 = UUID.randomUUID();
        when(conciliacaoRepository.findIdsContaReceberConciliadas(LOJA, StatusConciliacao.CONCILIADO))
                .thenReturn(new java.util.ArrayList<>(List.of(r1)));
        when(contaReceberRepository.findByLojaIdAndValorAndStatusNot(
                eq(LOJA), eq(new BigDecimal("100.00")), eq(ContaReceber.StatusConta.CANCELADO)))
                .thenReturn(List.of(contaReceber(r1, "100.00", LocalDate.of(2026, 10, 2),
                        ContaReceber.StatusConta.PAGO)));

        OfxImportarResponse resp = service.importarConteudo(ofxCredito("100.00", "20261002", "F8"), 3, null);

        assertThat(resp.getPendentes()).isEqualTo(1);
        assertThat(capturarLinhaSalva().getContaReceberId()).isNull();
    }

    @Test
    void conciliarFalse_importaTudoPendenteSemConsultarContas() {
        when(contaReceberRepository.findByLojaIdAndValorAndStatusNot(
                any(UUID.class), any(BigDecimal.class), any(ContaReceber.StatusConta.class)))
                .thenReturn(List.of());

        OfxImportarResponse resp = service.importarConteudo(ofxCredito("100.00", "20261002", "F9"), 3, false);

        assertThat(resp.getImportados()).isEqualTo(1);
        assertThat(resp.getPendentes()).isEqualTo(1);
        assertThat(capturarLinhaSalva().getStatus()).isEqualTo(StatusConciliacao.PENDENTE);
        verify(contaReceberRepository, never()).findByLojaIdAndVencimentoBetween(any(), any(), any());
    }

    @Test
    void conteudoVazio_lancaBusinessException() {
        assertThatThrownBy(() -> service.importarConteudo("   ", 3, null))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("OFX vazio");
    }

    @Test
    void requestJson_comToleranciaZero_valorBateDataNao_conciliaComoDivergente() {
        UUID r1 = UUID.randomUUID();
        // vencimento 2026-10-01, postado 2026-10-02 => distância 1 > 0 (não concilia),
        // mas valor igual => candidata divergente
        when(contaReceberRepository.findByLojaIdAndValorAndStatusNot(
                eq(LOJA), eq(new BigDecimal("100.00")), eq(ContaReceber.StatusConta.CANCELADO)))
                .thenReturn(List.of(contaReceber(r1, "100.00", LocalDate.of(2026, 10, 1),
                        ContaReceber.StatusConta.PAGO)));

        OfxImportarRequest req = OfxImportarRequest.builder()
                .conteudo(ofxCredito("100.00", "20261002", "F10"))
                .toleranciaDias(0)
                .build();

        OfxImportarResponse resp = service.importar(req);

        assertThat(resp.getConciliados()).isZero();
        assertThat(resp.getDivergentes()).isEqualTo(1);
        assertThat(capturarLinhaSalva().getStatus()).isEqualTo(StatusConciliacao.DIVERGENTE);
    }

    private ConciliacaoOfx capturarLinhaSalva() {
        ArgumentCaptor<ConciliacaoOfx> captor = ArgumentCaptor.forClass(ConciliacaoOfx.class);
        verify(conciliacaoRepository).save(captor.capture());
        return captor.getValue();
    }

    @Test
    void conciliadoReceber_baixaTituloPeloFluxoDeBaixa_comFitIdRastreavel() {
        UUID r1 = UUID.randomUUID();
        when(contaReceberRepository.findByLojaIdAndValorAndStatusNot(
                LOJA, new BigDecimal("100.00"), ContaReceber.StatusConta.CANCELADO))
                .thenReturn(List.of(contaReceber(r1, "100.00", LocalDate.of(2026, 10, 5),
                        ContaReceber.StatusConta.PENDENTE)));

        OfxImportarResponse resp = service.importarConteudo(ofxCredito("100.00", "20261005", "F11"), 3, null);

        // a linha de conta_receber_pagamento nasce DENTRO de baixar (mock aqui);
        // status PAGO/PARCIAL é garantido pelo fluxo canônico (ContaReceberServiceBaixaTest)
        verify(contaReceberService).baixar(eq(r1), argThat((BaixaContaReceberRequest req) ->
                req.getValorPago().compareTo(new BigDecimal("100.00")) == 0
                        && req.getFormaPagamentoId() == null
                        && req.getObservacao() != null && req.getObservacao().contains("F11")));
        assertThat(resp.getConciliados()).isEqualTo(1);
        assertThat(capturarLinhaSalva().getObservacao()).contains("baixa registrada");
    }

    @Test
    void conciliadoReceber_usaFormaPadraoDaLoja_quandoRequestNaoInforma() {
        UUID r1 = UUID.randomUUID();
        FormaPagamento padrao = forma(TipoFormaPagamento.PIX, true);
        when(contaReceberRepository.findByLojaIdAndValorAndStatusNot(
                LOJA, new BigDecimal("100.00"), ContaReceber.StatusConta.CANCELADO))
                .thenReturn(List.of(contaReceber(r1, "100.00", LocalDate.of(2026, 10, 5),
                        ContaReceber.StatusConta.PENDENTE)));
        when(formaPagamentoRepository.findByLojaIdAndPadraoTrue(LOJA)).thenReturn(Optional.of(padrao));

        service.importarConteudo(ofxCredito("100.00", "20261005", "F12"), 3, null);

        verify(contaReceberService).baixar(eq(r1), argThat((BaixaContaReceberRequest req) ->
                padrao.getId().equals(req.getFormaPagamentoId())));
    }

    @Test
    void conciliadoReceber_formaDoRequestTemPrecedenciaSobrePadrao() {
        UUID r1 = UUID.randomUUID();
        FormaPagamento informada = forma(TipoFormaPagamento.CREDITO, false);
        when(contaReceberRepository.findByLojaIdAndValorAndStatusNot(
                LOJA, new BigDecimal("100.00"), ContaReceber.StatusConta.CANCELADO))
                .thenReturn(List.of(contaReceber(r1, "100.00", LocalDate.of(2026, 10, 5),
                        ContaReceber.StatusConta.PENDENTE)));
        when(formaPagamentoRepository.findByIdAndLojaId(informada.getId(), LOJA))
                .thenReturn(Optional.of(informada));

        OfxImportarRequest req = OfxImportarRequest.builder()
                .conteudo(ofxCredito("100.00", "20261005", "F13"))
                .formaPagamentoId(informada.getId())
                .build();
        service.importar(req);

        verify(contaReceberService).baixar(eq(r1), argThat((BaixaContaReceberRequest b) ->
                informada.getId().equals(b.getFormaPagamentoId())));
    }

    @Test
    void formaDoRequestInexistente_falhaImportacaoSemGravarNada() {
        UUID formaInexistente = UUID.randomUUID();
        when(formaPagamentoRepository.findByIdAndLojaId(formaInexistente, LOJA))
                .thenReturn(Optional.empty());

        OfxImportarRequest req = OfxImportarRequest.builder()
                .conteudo(ofxCredito("100.00", "20261005", "F14"))
                .formaPagamentoId(formaInexistente)
                .build();

        assertThatThrownBy(() -> service.importar(req))
                .isInstanceOf(EntityNotFoundException.class)
                .hasMessageContaining("Forma de pagamento");
        verify(conciliacaoRepository, never()).save(any(ConciliacaoOfx.class));
        verify(contaReceberService, never()).baixar(any(UUID.class), any(BaixaContaReceberRequest.class));
    }

    @Test
    void baixaDaConciliacaoFalha_linhaPermaneceConciliada_contagensPreservadas() {
        UUID r1 = UUID.randomUUID();
        when(contaReceberRepository.findByLojaIdAndValorAndStatusNot(
                LOJA, new BigDecimal("100.00"), ContaReceber.StatusConta.CANCELADO))
                .thenReturn(List.of(contaReceber(r1, "100.00", LocalDate.of(2026, 10, 5),
                        ContaReceber.StatusConta.PENDENTE)));
        when(contaReceberService.baixar(eq(r1), any(BaixaContaReceberRequest.class)))
                .thenThrow(new IllegalStateException("Conta já está totalmente paga"));

        OfxImportarResponse resp = service.importarConteudo(ofxCredito("100.00", "20261005", "F15"), 3, null);

        // contagem do relatório inalterada; motivo da não-baixa fica na observação
        assertThat(resp.getConciliados()).isEqualTo(1);
        assertThat(resp.getImportados()).isEqualTo(1);
        ConciliacaoOfx salva = capturarLinhaSalva();
        assertThat(salva.getStatus()).isEqualTo(StatusConciliacao.CONCILIADO);
        assertThat(salva.getObservacao()).contains("NÃO aplicada");
    }

    @Test
    void conciliarFalse_nuncaChamaBaixa() {
        UUID r1 = UUID.randomUUID();
        when(contaReceberRepository.findByLojaIdAndValorAndStatusNot(
                any(UUID.class), any(BigDecimal.class), any(ContaReceber.StatusConta.class)))
                .thenReturn(List.of());

        service.importarConteudo(ofxCredito("100.00", "20261002", "F16"), 3, false);

        verify(contaReceberService, never()).baixar(any(UUID.class), any(BaixaContaReceberRequest.class));
    }

    private FormaPagamento forma(TipoFormaPagamento tipo, boolean padrao) {
        return FormaPagamento.builder()
                .id(UUID.randomUUID())
                .lojaId(LOJA)
                .nome(tipo.name())
                .tipo(tipo)
                .ativo(true)
                .padrao(padrao)
                .build();
    }

    private String ofxCredito(String valor, String dtPosted, String fitId) {
        return ofxLinha("CREDIT", valor, dtPosted, fitId);
    }

    private String ofxDebito(String valor, String dtPosted, String fitId) {
        return ofxLinha("DEBIT", "-" + valor, dtPosted, fitId);
    }

    private String ofxLinha(String tipo, String valor, String dtPosted, String fitId) {
        return "<STMTTRN><TRNTYPE>" + tipo + "</TRNTYPE><DTPOSTED>" + dtPosted
                + "</DTPOSTED><TRNAMT>" + valor + "</TRNAMT><FITID>" + fitId + "</FITID></STMTTRN>";
    }

    private ContaReceber contaReceber(UUID id, String valor, LocalDate vencimento, ContaReceber.StatusConta status) {
        return ContaReceber.builder()
                .id(id)
                .lojaId(LOJA)
                .valor(new BigDecimal(valor))
                .valorPago(BigDecimal.ZERO.setScale(2))
                .vencimento(vencimento)
                .status(status)
                .build();
    }

    private ContaPagar contaPagar(UUID id, String valor, LocalDate vencimento, ContaPagar.StatusContaPagar status) {
        return ContaPagar.builder()
                .id(id)
                .lojaId(LOJA)
                .fornecedor("Fornecedor Teste")
                .valor(new BigDecimal(valor))
                .valorPago(BigDecimal.ZERO.setScale(2))
                .vencimento(vencimento)
                .status(status)
                .build();
    }
}