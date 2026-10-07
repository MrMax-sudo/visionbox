package com.visionbox.modules.clinico.dto;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.visionbox.config.JacksonConfig;
import com.visionbox.shared.error.ProblemDetailHandler;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.mock.web.MockHttpServletRequest;

import java.math.BigDecimal;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

/**
 * Contrato JSON de POST/PUT /api/v1/receitas contra o payload real do frontend
 * (apps/web/src/pages/Receitas.tsx) — regressão do bug "Corpo da requisição inválido ou
 * JSON malformado." que impedia salvar receita.
 * <p>
 * Usa exatamente o {@code ObjectMapper} da aplicação (JacksonConfig), não um mapper de teste.
 */
class ReceitaRequestJsonTest {

    /** Payload que o frontend envia — sem datas, com tipoLente e dp numérico. */
    private static final String PAYLOAD_FRONTEND = """
            {
              "clienteId": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
              "tipoLente": "MONOFOCAL",
              "dp": 62,
              "od": {"esferico": -2.5, "cilindrico": -1.25, "eixo": 90, "adicao": 0},
              "oe": {"esferico": -2.25, "cilindrico": -1, "eixo": 90, "adicao": 0},
              "observacao": null
            }
            """;

    private final ObjectMapper mapper = new JacksonConfig().objectMapper();
    private final ProblemDetailHandler handler = new ProblemDetailHandler();

    private MockHttpServletRequest request() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/api/v1/receitas");
        return request;
    }

    private ProblemDetail detalheDoErroDeLeitura(Throwable causa) {
        return handler.handleNotReadable(new HttpMessageNotReadableException("JSON parse error", causa), request());
    }

    @Test
    @DisplayName("payload do frontend (sem datas, tipoLente, dp numérico) é aceito")
    void payloadDoFrontendEhAceito() throws Exception {
        ReceitaRequest req = mapper.readValue(PAYLOAD_FRONTEND, ReceitaRequest.class);

        assertThat(req.getClienteId()).isEqualTo(UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"));
        // @JsonAlias("tipoLente")
        assertThat(req.getTipo()).isEqualTo("MONOFOCAL");
        // LenientStringDeserializer: JSON numérico vira String
        assertThat(req.getDp()).isEqualTo("62");
        assertThat(new BigDecimal(req.getDp())).isEqualByComparingTo("62");
        // datas são opcionais (service defaulta hoje / hoje+2anos)
        assertThat(req.getDataEmissao()).isNull();
        assertThat(req.getDataValidade()).isNull();
        assertThat(req.getOd().getEsferico()).isEqualByComparingTo("-2.5");
        assertThat(req.getOd().getAdicao()).isEqualByComparingTo("0");
        assertThat(req.getObservacao()).isNull();
    }

    @Test
    @DisplayName("campo desconhecido no payload não derruba a requisição (JacksonConfig)")
    void camposDesconhecidosSaoIgnorados() throws Exception {
        ReceitaRequest req = mapper.readValue(
                "{\"clienteId\":\"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb\",\"campoInventado\":\"x\"}",
                ReceitaRequest.class);
        assertThat(req.getClienteId()).isNotNull();
    }

    @Test
    @DisplayName("dp aceito como string também")
    void dpStringEhAceito() throws Exception {
        ReceitaRequest req = mapper.readValue(
                "{\"clienteId\":\"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb\",\"dp\":\"62.5\"}",
                ReceitaRequest.class);
        assertThat(req.getDp()).isEqualTo("62.5");
    }

    @Test
    @DisplayName("clienteId que não é UUID vira 400 com detail legível (não o genérico)")
    void clienteIdInvalidoGeraMensagemLegivel() {
        Throwable causa = catchThrowableOfType(() -> mapper.readValue(
                "{\"clienteId\":\"12345678900\",\"tipoLente\":\"MONOFOCAL\"}", ReceitaRequest.class),
                Throwable.class);

        ProblemDetail pd = detalheDoErroDeLeitura(causa);

        assertThat(causa).isNotNull();
        assertThat(pd.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST.value());
        assertThat(pd.getDetail()).isEqualTo("clienteId inválido: informe o UUID do cliente.");
        // LGPD: não ecoa o valor recebido
        assertThat(pd.getDetail()).doesNotContain("12345678900");
    }

    @Test
    @DisplayName("campo desconhecido (mapper estrito) aponta o nome do campo")
    void campoDesconhecidoApontaONomeDoCampo() {
        // reproduz o cenário do mapper estrito (FAIL_ON_UNKNOWN_PROPERTIES=true) para exercitar
        // a mensagem do handler; o mapper da aplicação está com a feature desligada
        ObjectMapper estrito = new ObjectMapper();
        Throwable causa = catchThrowableOfType(() -> estrito.readValue(
                "{\"clienteId\":\"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb\",\"campoInventado\":\"x\"}",
                ReceitaRequest.class),
                Throwable.class);

        ProblemDetail pd = detalheDoErroDeLeitura(causa);

        assertThat(causa).isNotNull();
        assertThat(pd.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST.value());
        assertThat(pd.getDetail()).isEqualTo(
                "Campo desconhecido 'campoInventado' na requisição. Verifique o nome do campo e tente novamente.");
    }

    @Test
    @DisplayName("valor de tipo errado cita campo e tipo esperado")
    void valorDeTipoErradoCitaCampoETipoEsperado() {
        Throwable causa = catchThrowableOfType(() -> mapper.readValue(
                "{\"clienteId\":\"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb\",\"od\":\"naoEhObjeto\"}",
                ReceitaRequest.class),
                Throwable.class);

        ProblemDetail pd = detalheDoErroDeLeitura(causa);

        assertThat(causa).isNotNull();
        assertThat(pd.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST.value());
        assertThat(pd.getDetail()).isEqualTo("Valor no campo 'od' com tipo inválido — esperado: GrauDto.");
    }

    @Test
    @DisplayName("corpo malformado de verdade cai na mensagem genérica")
    void corpoMalformadoCaiNaMensagemGenerica() {
        Throwable causa = catchThrowableOfType(() -> mapper.readValue("{\"clienteId\": ", ReceitaRequest.class),
                Throwable.class);

        ProblemDetail pd = detalheDoErroDeLeitura(causa);

        assertThat(pd.getDetail()).isEqualTo("Corpo da requisição inválido ou JSON malformado.");
    }
}
