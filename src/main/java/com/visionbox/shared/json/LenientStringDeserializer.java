package com.visionbox.shared.json;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;

import java.io.IOException;

/**
 * Converte número/decimal/booleano/texto para {@link String} sem lançar erro de coerção.
 * <p>
 * Usado em campos de texto que o frontend envia como número (ex.: {@code dp} de /receitas
 * chega como {@code 62} e não como {@code "62"}). Sem isto, a requisição caía em
 * {@code MismatchedInputException} → 400 "Corpo da requisição inválido ou JSON malformado."
 * por um detalhe de formato que não é erro do usuário.
 * <p>
 * Valor nulo ({@code null}) é preservado como {@code null}.
 */
public class LenientStringDeserializer extends JsonDeserializer<String> {

    @Override
    public String deserialize(JsonParser p, DeserializationContext ctxt) throws IOException {
        JsonToken token = p.currentToken();
        if (token == null || token == JsonToken.VALUE_NULL) {
            return null;
        }
        if (token == JsonToken.VALUE_STRING) {
            return p.getText();
        }
        if (token == JsonToken.VALUE_NUMBER_INT
                || token == JsonToken.VALUE_NUMBER_FLOAT
                || token == JsonToken.VALUE_TRUE
                || token == JsonToken.VALUE_FALSE) {
            return p.getValueAsString();
        }
        // objeto/array num campo texto → erro claro e legível pelo ProblemDetailHandler
        Object inesperado = ctxt.handleUnexpectedToken(String.class, p);
        return inesperado instanceof String texto ? texto : null;
    }
}
