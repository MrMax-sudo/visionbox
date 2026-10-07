package com.visionbox.shared.error;

import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.exc.InvalidFormatException;
import com.fasterxml.jackson.databind.exc.MismatchedInputException;
import com.fasterxml.jackson.databind.exc.UnrecognizedPropertyException;
import com.visionbox.shared.tenant.TenantContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.net.URI;
import java.time.OffsetDateTime;
import java.util.stream.Collectors;

/**
 * Handler RFC 7807 (ProblemDetail) — foundation S0-02.
 * <p>
 * Spring Boot 3.4 (Spring 6.1) expõe org.springframework.http.ProblemDetail.
 * Todos os erros retornam application/problem+json com:
 * type, title, status, detail, instance, timestamp, traceId (quando houver).
 * <p>
 * Nunca loga dado sensível (cpf, grau, authorization) em plain — LGPD.
 */
@RestControllerAdvice
public class ProblemDetailHandler {

    private static final Logger log = LoggerFactory.getLogger(ProblemDetailHandler.class);

    private ProblemDetail build(HttpStatus status, String detail, HttpServletRequest request, String title, String typeSuffix) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(status, detail);
        pd.setTitle(title);
        pd.setType(URI.create("https://visionbox.tech/errors/" + typeSuffix));
        pd.setInstance(URI.create(request.getRequestURI()));
        pd.setProperty("timestamp", OffsetDateTime.now().toString());
        String traceId = request.getHeader("X-Trace-Id");
        if (traceId == null) {
            traceId = request.getHeader("X-Request-Id");
        }
        if (traceId != null) {
            pd.setProperty("traceId", traceId);
        }
        TenantContext.getCurrentLojaId().ifPresent(lojaId -> pd.setProperty("lojaId", lojaId.toString()));
        return pd;
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleValidation(MethodArgumentNotValidException ex, HttpServletRequest request) {
        String detail = ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .collect(Collectors.joining("; "));
        log.warn("Validation failed: {}", detail);
        ProblemDetail pd = build(HttpStatus.BAD_REQUEST, detail, request, "Erro de validação", "validation");
        pd.setProperty("fieldErrors", ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> java.util.Map.of("field", fe.getField(), "message", fe.getDefaultMessage() != null ? fe.getDefaultMessage() : "invalid"))
                .toList());
        return pd;
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ProblemDetail handleConstraintViolation(ConstraintViolationException ex, HttpServletRequest request) {
        String detail = ex.getConstraintViolations().stream()
                .map(v -> v.getPropertyPath() + ": " + v.getMessage())
                .collect(Collectors.joining("; "));
        log.warn("Constraint violation: {}", detail);
        return build(HttpStatus.BAD_REQUEST, detail, request, "Violação de constraint", "constraint-violation");
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ProblemDetail handleNotReadable(HttpMessageNotReadableException ex, HttpServletRequest request) {
        String detail = detalheMensagemLegivel(ex);
        log.warn("JSON não legível em {} {}: {}", request.getMethod(), request.getRequestURI(), detail);
        return build(HttpStatus.BAD_REQUEST, detail, request, "Requisição inválida", "not-readable");
    }

    /**
     * Converte os erros de leitura do Jackson em mensagens legíveis em PT-BR.
     * <p>
     * Sem isto, o cliente só via "Corpo da requisição inválido ou JSON malformado." mesmo para
     * erros claros (campo desconhecido, tipo errado, UUID inválido) — o que tornava impossível
     * descobrir o problema sem ler log de servidor.
     * <p>
     * Nunca ecoa o valor recebido no detail (pode conter CPF/grau → LGPD). Apenas nome do campo
     * e tipo esperado.
     *
     * @return detail legível; se nenhuma causa conhecida, a mensagem genérica original.
     */
    private String detalheMensagemLegivel(HttpMessageNotReadableException ex) {
        Throwable atual = ex.getCause();
        while (atual != null) {
            if (atual instanceof UnrecognizedPropertyException desconhecido) {
                return "Campo desconhecido '" + desconhecido.getPropertyName()
                        + "' na requisição. Verifique o nome do campo e tente novamente.";
            }
            if (atual instanceof InvalidFormatException formato) {
                return detalheValorInvalido(ultimoCampo(formato), formato.getTargetType());
            }
            if (atual instanceof MismatchedInputException incompativel) {
                // cobre também UUID malformado (Jackson lança MismatchedInputException, não InvalidFormat)
                return detalheValorInvalido(ultimoCampo(incompativel), incompativel.getTargetType());
            }
            atual = atual.getCause();
        }
        return "Corpo da requisição inválido ou JSON malformado.";
    }

    /**
     * Mensagem legível por tipo alvo do Jackson.
     * <p>
     * UUID ganha mensagem orientada (é o campo {@code clienteId} que a UI preenche com texto livre
     * "UUID ou CPF mascarado"); demais tipos citam campo e tipo esperado. Nada de ecoar o valor.
     */
    private String detalheValorInvalido(String campo, Class<?> alvo) {
        if (alvo != null && java.util.UUID.class.isAssignableFrom(alvo)) {
            if ("clienteId".equals(campo)) {
                return "clienteId inválido: informe o UUID do cliente.";
            }
            return (campo != null ? campo : "UUID") + " inválido: informe um UUID válido (formato 8-4-4-4-12).";
        }
        String onde = campo != null ? " no campo '" + campo + "'" : "";
        return "Valor" + onde + " com tipo inválido — esperado: "
                + (alvo != null ? alvo.getSimpleName() : "o tipo correto") + ".";
    }

    /**
     * Último nome de campo na cadeia do erro (ex.: "od" ao falhar dentro de ReceitaRequest.od).
     * Retorna {@code null} quando a falha é na raiz do corpo.
     */
    private String ultimoCampo(JsonMappingException ex) {
        java.util.List<JsonMappingException.Reference> caminhos = ex.getPath();
        if (caminhos == null || caminhos.isEmpty()) {
            return null;
        }
        for (int i = caminhos.size() - 1; i >= 0; i--) {
            String nome = caminhos.get(i).getFieldName();
            if (nome != null && !nome.isBlank()) {
                return nome;
            }
        }
        return null;
    }

    @ExceptionHandler(java.time.format.DateTimeParseException.class)
    public ProblemDetail handleDataInvalida(java.time.format.DateTimeParseException ex, HttpServletRequest request) {
        log.warn("Data inválida: {}", ex.getMessage());
        return build(HttpStatus.BAD_REQUEST,
                "Data com formato inválido: informe a data no formato yyyy-MM-dd (ex: 2026-10-07).",
                request, "Requisição inválida", "invalid-date");
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ProblemDetail handleTypeMismatch(MethodArgumentTypeMismatchException ex, HttpServletRequest request) {
        String detail = String.format("Parâmetro '%s' com valor '%s' inválido. Esperado: %s", ex.getName(), ex.getValue(), ex.getRequiredType() != null ? ex.getRequiredType().getSimpleName() : "tipo correto");
        return build(HttpStatus.BAD_REQUEST, detail, request, "Tipo de parâmetro inválido", "type-mismatch");
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ProblemDetail handleAccessDenied(AccessDeniedException ex, HttpServletRequest request) {
        log.warn("Acesso negado: {} {}", request.getMethod(), request.getRequestURI());
        return build(HttpStatus.FORBIDDEN, "Acesso negado. Verifique suas permissões.", request, "Acesso negado", "forbidden");
    }

    @ExceptionHandler(AuthenticationException.class)
    public ProblemDetail handleAuth(AuthenticationException ex, HttpServletRequest request) {
        log.warn("Não autenticado: {}", ex.getMessage());
        return build(HttpStatus.UNAUTHORIZED, "Não autenticado. Faça login novamente.", request, "Não autenticado", "unauthorized");
    }

    @ExceptionHandler(BusinessException.class)
    public ProblemDetail handleBusiness(BusinessException ex, HttpServletRequest request) {
        log.warn("Business rule violation: {}", ex.getMessage());
        return build(HttpStatus.UNPROCESSABLE_ENTITY, ex.getMessage(), request, "Regra de negócio violada", "business-error");
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ProblemDetail handleIllegalArg(IllegalArgumentException ex, HttpServletRequest request) {
        log.warn("IllegalArgument: {}", ex.getMessage());
        return build(HttpStatus.BAD_REQUEST, ex.getMessage(), request, "Requisição inválida", "illegal-argument");
    }

    @ExceptionHandler(IllegalStateException.class)
    public ProblemDetail handleIllegalState(IllegalStateException ex, HttpServletRequest request) {
        // inclui tenant ausente
        if (ex.getMessage() != null && ex.getMessage().toLowerCase().contains("tenant")) {
            log.warn("Tenant ausente: {}", ex.getMessage());
            return build(HttpStatus.BAD_REQUEST, ex.getMessage(), request, "Tenant ausente", "tenant-required");
        }
        log.error("IllegalState: {}", ex.getMessage(), ex);
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "Erro interno de estado.", request, "Erro interno", "illegal-state");
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ProblemDetail handleDataIntegrity(DataIntegrityViolationException ex, HttpServletRequest request) {
        String root = ex.getMostSpecificCause() != null ? ex.getMostSpecificCause().getMessage() : ex.getMessage();
        log.warn("Data integrity: {}", root);
        // nunca expõe stack SQL completo, só mensagem tratada
        String detail = "Violação de integridade de dados.";
        if (root != null && root.contains("duplicate key")) {
            detail = "Registro duplicado. Já existe um registro com esses dados.";
            return build(HttpStatus.CONFLICT, detail, request, "Conflito de dados", "conflict");
        }
        return build(HttpStatus.CONFLICT, detail, request, "Conflito de dados", "data-integrity");
    }

    @ExceptionHandler(jakarta.persistence.EntityNotFoundException.class)
    public ProblemDetail handleNotFound(jakarta.persistence.EntityNotFoundException ex, HttpServletRequest request) {
        return build(HttpStatus.NOT_FOUND, ex.getMessage() != null ? ex.getMessage() : "Recurso não encontrado.", request, "Não encontrado", "not-found");
    }

    @ExceptionHandler(com.visionbox.modules.ordemservico.domain.TransicaoInvalidaException.class)
    public ProblemDetail handleTransicao(com.visionbox.modules.ordemservico.domain.TransicaoInvalidaException ex, HttpServletRequest request) {
        log.warn("Transição OS inválida: {} -> {}", ex.getOrigem(), ex.getDestino());
        ProblemDetail pd = build(HttpStatus.UNPROCESSABLE_ENTITY, ex.getMessage(), request, "Transição de OS inválida", "transicao-invalida");
        pd.setProperty("origem", ex.getOrigem() != null ? ex.getOrigem().name() : null);
        pd.setProperty("destino", ex.getDestino() != null ? ex.getDestino().name() : null);
        return pd;
    }

    // catch-all — deve ser último
    @ExceptionHandler(Exception.class)
    public ProblemDetail handleGeneric(Exception ex, HttpServletRequest request) {
        log.error("Erro não tratado {} {}: {}", request.getMethod(), request.getRequestURI(), ex.getMessage(), ex);
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "Erro interno inesperado. Tente novamente.", request, "Erro interno", "internal");
    }
}
