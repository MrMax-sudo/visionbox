# syntax=docker/dockerfile:1.6
# VisionBox — multi-stage Dockerfile (maven builder + distroless java17 nonroot)
# Requer: Java 17, Spring Boot 3.x, Flyway, Actuator em /actuator/health

# ─────────────────────────────────────────────
# Stage 1: builder — resolve deps + build jar
# ─────────────────────────────────────────────
FROM maven:3.9-eclipse-temurin-17 AS builder
WORKDIR /app

# Cache de dependências: só pom.xml primeiro
COPY pom.xml ./
# Se existir .mvn/ ou settings, copiar (opcional)
# COPY .mvn .mvn
# COPY mvnw mvnw
RUN mvn dependency:go-offline -B -DskipTests || true

# Copia sources e builda
COPY src ./src
# Compila e empacota (skipTests para build rápido; CI roda verify separado)
RUN mvn package -DskipTests -B -Dorg.slf4j.simpleLogger.defaultLogLevel=warn \
    && ls -lh target/*.jar

# Cria HealthCheck.java para uso no distroless (sem curl/wget)
RUN printf '%s\n' \
  'import java.net.*;import java.net.http.*;import java.time.Duration;' \
  'public class HealthCheck {' \
  '  public static void main(String[] a) throws Exception {' \
  '    String url = a.length>0 ? a[0] : "http://localhost:8080/actuator/health";' \
  '    HttpClient c = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();' \
  '    HttpRequest r = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(3)).GET().build();' \
  '    HttpResponse<String> res = c.send(r, HttpResponse.BodyHandlers.ofString());' \
  '    String b = res.body();' \
  '    boolean up = res.statusCode()==200 && b!=null && b.contains("\"status\":\"UP\"");' \
  '    System.out.println(b);' \
  '    System.exit(up?0:1);' \
  '  }' \
  '}' > /tmp/HealthCheck.java \
  && javac -d /tmp /tmp/HealthCheck.java \
  && ls -lh /tmp/HealthCheck.class

# ─────────────────────────────────────────────
# Stage 2: runtime — distroless java17 nonroot
# ─────────────────────────────────────────────
FROM gcr.io/distroless/java17-debian12:nonroot AS runtime
WORKDIR /app

# Copia jar (assume spring-boot fat jar)
COPY --from=builder /app/target/*.jar app.jar
# Copia healthcheck compilado
COPY --from=builder /tmp/HealthCheck.class /app/HealthCheck.class

# Distroless nonroot já roda como nonroot (uid 65532). Expor porta.
EXPOSE 8080

# Variáveis de runtime (podem ser sobrescritas via compose/env)
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75.0 -XX:+UseG1GC -XX:+UseStringDeduplication -Djava.security.egd=file:/dev/./urandom" \
    SPRING_PROFILES_ACTIVE=prod

# HEALTHCHECK usando Java puro (funciona no distroless sem shell/curl)
# Verifica /actuator/health — UP = healthy
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=5 \
  CMD ["java", "-cp", "/app", "HealthCheck", "http://localhost:8080/actuator/health"]

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
# Alternativa com JAVA_OPTS (se precisar): use sh -c no builder image; no distroless manter ENTRYPOINT java
# Para passar JAVA_OPTS no distroless, descomente abaixo e comente ENTRYPOINT acima:
# ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/app.jar"]
