package com.visionbox.modules.modulos.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.visionbox.modules.modulos.domain.ModuloConfiguracaoLoja;
import com.visionbox.modules.modulos.domain.ModuloSistema;
import com.visionbox.modules.modulos.domain.PlanoSaaS;
import com.visionbox.modules.modulos.dto.ModuloDtos.AlternarModulosRequest;
import com.visionbox.modules.modulos.dto.ModuloDtos.AplicarPlanoRequest;
import com.visionbox.modules.modulos.dto.ModuloDtos.ItemModuloRequest;
import com.visionbox.modules.modulos.dto.ModuloDtos.LojaResumoResponse;
import com.visionbox.modules.modulos.dto.ModuloDtos.ModuloConfiguracaoStatusResponse;
import com.visionbox.modules.modulos.dto.ModuloDtos.ModuloStatusResponse;
import com.visionbox.modules.modulos.repository.ModuloConfiguracaoLojaRepository;
import com.visionbox.modules.pessoa.repository.LojaRepository;
import com.visionbox.shared.audit.LogAuditoria;
import com.visionbox.shared.audit.LogAuditoriaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Gestor SaaS de Módulos & Planos (spec §4 — feature flagging por loja, R11).
 * <p>
 * <b>Default sem registro (decisão D-014):</b> loja sem linha em
 * {@code modulo_configuracao_loja} tem TODOS os módulos ativos — retrocompatível, nenhuma
 * loja existente quebra ao aplicar a V36. Materializar um plano/toggle grava as linhas e a
 * partir daí vale o gravado.
 * <p>
 * <b>Escopo de tenant (R1):</b> os métodos {@code @Transactional} rodam com o ThreadLocal já
 * apontando para a loja alvo (ver {@link ModuloTenantScope}) para que o
 * {@code TenantRlsAspect} grave a GUC correta e a RLS FORCE da V36 deixe o operador
 * autorizado a ler e escrever as linhas daquela loja.
 * <p>
 * <b>Autorização cross-tenant:</b> DESENVOLVEDOR acessa qualquer loja; ADMIN apenas a própria
 * (defesa em profundidade além do {@code /api/v1/dev/**} do SecurityConfig).
 * Toda alteração gera linha em {@code log_auditoria} (quem, quando, o quê).
 */
import com.visionbox.modules.catalogo.domain.Categoria;
import com.visionbox.modules.catalogo.repository.CategoriaRepository;
import com.visionbox.modules.financeiro.formapagamento.domain.FormaPagamento;
import com.visionbox.modules.financeiro.formapagamento.repository.FormaPagamentoRepository;
import com.visionbox.modules.modulos.dto.ModuloDtos.CriarLojaRequest;
import com.visionbox.modules.modulos.dto.ModuloDtos.EditarLojaRequest;
import com.visionbox.modules.modulos.dto.ModuloDtos.LojaCriadaResponse;
import com.visionbox.modules.pessoa.domain.Loja;
import com.visionbox.modules.usuario.domain.Perfil;
import com.visionbox.modules.usuario.domain.Usuario;
import com.visionbox.modules.usuario.repository.UsuarioRepository;
import org.springframework.security.crypto.password.PasswordEncoder;

@Service
@Slf4j
public class ModuloConfiguracaoService {

    public static final String FONTE_PADRAO = "PADRAO";
    public static final String FONTE_REGISTRO = "REGISTRO";
    public static final String PLANO_PADRAO = "PADRAO";
    public static final String PLANO_PERSONALIZADO = "PERSONALIZADO";
    public static final String ENTIDADE_AUDITORIA = "modulo_configuracao_loja";
    public static final String ACAO_AUDITORIA = "UPDATE";

    private final ModuloConfiguracaoLojaRepository moduloRepository;
    private final LojaRepository lojaRepository;
    private final LogAuditoriaRepository logAuditoriaRepository;
    private final ObjectMapper objectMapper;
    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final FormaPagamentoRepository formaPagamentoRepository;
    private final CategoriaRepository categoriaRepository;

    @org.springframework.beans.factory.annotation.Autowired
    public ModuloConfiguracaoService(
            ModuloConfiguracaoLojaRepository moduloRepository,
            LojaRepository lojaRepository,
            LogAuditoriaRepository logAuditoriaRepository,
            ObjectMapper objectMapper,
            UsuarioRepository usuarioRepository,
            PasswordEncoder passwordEncoder,
            FormaPagamentoRepository formaPagamentoRepository,
            CategoriaRepository categoriaRepository) {
        this.moduloRepository = moduloRepository;
        this.lojaRepository = lojaRepository;
        this.logAuditoriaRepository = logAuditoriaRepository;
        this.objectMapper = objectMapper;
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.formaPagamentoRepository = formaPagamentoRepository;
        this.categoriaRepository = categoriaRepository;
    }

    /** Construtor para testes unitários isolados de regras de módulos. */
    public ModuloConfiguracaoService(
            ModuloConfiguracaoLojaRepository moduloRepository,
            LojaRepository lojaRepository,
            LogAuditoriaRepository logAuditoriaRepository,
            ObjectMapper objectMapper) {
        this(moduloRepository, lojaRepository, logAuditoriaRepository, objectMapper, null, null, null, null);
    }

    // =====================================================================
    // Autorização / identidade do operador (JWT)
    // =====================================================================

    /**
     * Autoriza o operador a gerenciar/consultar a configuração de {@code lojaAlvo}.
     * DESENVOLVEDOR = qualquer loja; ADMIN = somente a própria; demais perfis = negado.
     *
     * @throws AccessDeniedException 403 (ProblemDetail) quando fora do escopo
     */
    public void autorizarAcessoLoja(UUID lojaAlvo) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) {
            throw new AccessDeniedException("Autenticação ausente para gestão de módulos da loja.");
        }
        String perfil = claim(auth, "perfil");
        UUID lojaOperador = claimLoja(auth);

        if ("DESENVOLVEDOR".equals(perfil) || temAutoridade(auth, "ROLE_DESENVOLVEDOR")) {
            return;
        }
        boolean ehAdmin = "ADMIN".equals(perfil) || temAutoridade(auth, "ROLE_ADMIN");
        if (ehAdmin && lojaAlvo.equals(lojaOperador)) {
            return;
        }
        throw new AccessDeniedException(
                "Gestão de módulos de outra loja restrita ao perfil DESENVOLVEDOR.");
    }

    /** Lojas visíveis no seletor do Painel: DESENVOLVEDOR vê todas; ADMIN vê a própria. */
    public List<LojaResumoResponse> listarLojasPermitidas() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean ehDev = auth != null
                && ("DESENVOLVEDOR".equals(claim(auth, "perfil")) || temAutoridade(auth, "ROLE_DESENVOLVEDOR"));
        if (ehDev) {
            return lojaRepository.findAll().stream()
                    .map(l -> new LojaResumoResponse(
                            l.getId(),
                            l.getNome(),
                            l.getCodigo(),
                            l.getSubdominio(),
                            l.getCnpj(),
                            l.getTelefone(),
                            l.getEmailContato(),
                            l.isAtivo()
                    ))
                    .toList();
        }
        UUID lojaOperador = auth != null ? claimLoja(auth) : null;
        if (lojaOperador == null) {
            return List.of();
        }
        return lojaRepository.findById(lojaOperador)
                .<List<LojaResumoResponse>>map(l -> List.of(new LojaResumoResponse(
                        l.getId(),
                        l.getNome(),
                        l.getCodigo(),
                        l.getSubdominio(),
                        l.getCnpj(),
                        l.getTelefone(),
                        l.getEmailContato(),
                        l.isAtivo()
                )))
                .orElseGet(List::of);
    }

    /** Identidade do operador para auditoria (quem alterou). */
    public RegistroOperador resolverOperador(String ipOrigem) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) {
            return new RegistroOperador(null, null, null, ipOrigem);
        }
        String sub = auth instanceof JwtAuthenticationToken jwt ? jwt.getToken().getSubject() : null;
        UUID id = null;
        if (sub != null && !sub.isBlank()) {
            try {
                id = UUID.fromString(sub);
            } catch (IllegalArgumentException e) {
                log.warn("Subject JWT não é UUID (auditoria segue sem usuario_id): {}", sub);
            }
        }
        return new RegistroOperador(id, claim(auth, "nome"), claim(auth, "perfil"), ipOrigem);
    }

    public record RegistroOperador(UUID id, String nome, String perfil, String ipOrigem) {
    }

    // =====================================================================
    // Leitura
    // =====================================================================

    /** Visão completa dos 19 módulos da loja (status + plano derivado da matriz). */
    @Transactional(readOnly = true)
    public ModuloConfiguracaoStatusResponse listarStatus(UUID lojaId) {
        Map<String, ModuloConfiguracaoLoja> porCodigo = porCodigo(moduloRepository.findByLojaId(lojaId));

        List<ModuloStatusResponse> modulos = new ArrayList<>(ModuloSistema.values().length);
        Set<ModuloSistema> ativos = EnumSet.noneOf(ModuloSistema.class);
        for (ModuloSistema m : ModuloSistema.values()) {
            ModuloConfiguracaoLoja linha = porCodigo.get(m.name());
            boolean ativo = linha == null || linha.isAtivo();
            if (ativo) {
                ativos.add(m);
            }
            modulos.add(new ModuloStatusResponse(
                    m.name(), m.getNomeExibicao(), m.getDescricao(), m.getRotas(),
                    ativo, linha == null ? FONTE_PADRAO : FONTE_REGISTRO));
        }

        boolean registrosExistem = !porCodigo.isEmpty();
        String planoAtual = !registrosExistem
                ? PLANO_PADRAO
                : Optional.ofNullable(PlanoSaaS.compativelCom(ativos)).map(p -> p.name()).orElse(PLANO_PERSONALIZADO);
        return new ModuloConfiguracaoStatusResponse(lojaId, planoAtual, registrosExistem, modulos);
    }

    /**
     * Enforcement do {@code ModuloTenantInterceptor}.
     * Sem linha = ativo (default retrocompatível D-014); linha=false = bloqueado.
     */
    @Transactional(readOnly = true)
    public boolean moduloAtivo(UUID lojaId, ModuloSistema modulo) {
        return moduloRepository.findByLojaIdAndModuloCodigo(lojaId, modulo.name())
                .map(ModuloConfiguracaoLoja::isAtivo)
                .orElse(true);
    }

    // =====================================================================
    // Escrita
    // =====================================================================

    /** Toggle granular em lote (overriding avulso) com auditoria. */
    @Transactional
    public ModuloConfiguracaoStatusResponse alternarModulos(UUID lojaId, AlternarModulosRequest req, String ipOrigem) {
        Map<String, ModuloConfiguracaoLoja> porCodigo = porCodigo(moduloRepository.findByLojaId(lojaId));
        RegistroOperador operador = resolverOperador(ipOrigem);

        // Passo 1 — valida TODO o payload antes de gravar nada (nunca escrita parcial).
        Set<String> vistos = new HashSet<>();
        List<ModuloSistema> pendencias = new ArrayList<>();
        List<Boolean> desejados = new ArrayList<>();
        for (ItemModuloRequest item : req.modulos()) {
            ModuloSistema modulo = ModuloSistema.deCodigo(item.codigo());
            if (!vistos.add(modulo.name())) {
                throw new IllegalArgumentException("Módulo duplicado no payload: " + modulo.name());
            }
            pendencias.add(modulo);
            desejados.add(Boolean.TRUE.equals(item.ativo()));
        }

        // Passo 2 — upsert.
        List<Map<String, Object>> alteracoes = new ArrayList<>();
        for (int i = 0; i < pendencias.size(); i++) {
            ModuloSistema modulo = pendencias.get(i);
            boolean desejado = desejados.get(i);
            ModuloConfiguracaoLoja linha = porCodigo.get(modulo.name());
            if (linha == null) {
                linha = ModuloConfiguracaoLoja.builder()
                        .lojaId(lojaId)
                        .moduloCodigo(modulo.name())
                        .ativo(desejado)
                        .planoNome(PLANO_PERSONALIZADO)
                        .build();
                moduloRepository.save(linha);
                alteracoes.add(itemAlteracao(modulo, null, desejado));
            } else if (linha.isAtivo() != desejado) {
                alteracoes.add(itemAlteracao(modulo, linha.isAtivo(), desejado));
                linha.setAtivo(desejado);
                moduloRepository.save(linha);
            }
        }

        if (!alteracoes.isEmpty()) {
            Map<String, Object> detalhe = new LinkedHashMap<>();
            detalhe.put("interna", "ALTERNAR_MODULOS");
            detalhe.put("alteracoes", alteracoes);
            detalhe.put("observacao", req.observacao());
            registrarAuditoria(lojaId, detalhe, operador);
        }
        return listarStatus(lojaId);
    }

    /**
     * Aplica uma matriz de plano (Start/Pro/Enterprise) gravando TODOS os 19 módulos.
     * Nunca apaga linha: remover linha reativaria o módulo pelo default "sem registro = ativo".
     */
    @Transactional
    public ModuloConfiguracaoStatusResponse aplicarPlano(UUID lojaId, AplicarPlanoRequest req, String ipOrigem) {
        PlanoSaaS plano = PlanoSaaS.deNome(req.plano());
        if (plano == PlanoSaaS.PERSONALIZADO) {
            throw new IllegalArgumentException(
                    "Plano PERSONALIZADO não é aplicável em lote: use o toggle granular (PUT .../modulos) "
                            + "para ligar/desligar módulo a módulo.");
        }
        Map<String, ModuloConfiguracaoLoja> porCodigo = porCodigo(moduloRepository.findByLojaId(lojaId));
        RegistroOperador operador = resolverOperador(ipOrigem);

        int ativados = 0;
        int desativados = 0;
        for (ModuloSistema modulo : ModuloSistema.values()) {
            boolean desejado = plano.inclui(modulo);
            ModuloConfiguracaoLoja linha = porCodigo.get(modulo.name());
            if (linha == null) {
                linha = ModuloConfiguracaoLoja.builder()
                        .lojaId(lojaId)
                        .moduloCodigo(modulo.name())
                        .ativo(desejado)
                        .planoNome(plano.name())
                        .build();
            } else {
                linha.setAtivo(desejado);
                linha.setPlanoNome(plano.name());
            }
            moduloRepository.save(linha);
            if (desejado) {
                ativados++;
            } else {
                desativados++;
            }
        }

        Map<String, Object> detalhe = new LinkedHashMap<>();
        detalhe.put("interna", "APLICAR_PLANO");
        detalhe.put("plano", plano.name());
        detalhe.put("ativados", ativados);
        detalhe.put("desativados", desativados);
        registrarAuditoria(lojaId, detalhe, operador);
        return listarStatus(lojaId);
    }

    // =====================================================================
    // Internos
    // =====================================================================

    private Map<String, ModuloConfiguracaoLoja> porCodigo(List<ModuloConfiguracaoLoja> linhas) {
        Map<String, ModuloConfiguracaoLoja> mapa = new LinkedHashMap<>();
        for (ModuloConfiguracaoLoja linha : linhas) {
            mapa.putIfAbsent(linha.getModuloCodigo(), linha);
        }
        return mapa;
    }

    private Map<String, Object> itemAlteracao(ModuloSistema modulo, Boolean de, boolean para) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("modulo", modulo.name());
        item.put("de", de);
        item.put("para", para);
        return item;
    }

    /** Append-only em log_auditoria: quem alterou, quando (criado_em), o quê (detalhe_json). */
    private void registrarAuditoria(UUID lojaId, Map<String, Object> detalhe, RegistroOperador operador) {
        try {
            LogAuditoria audit = LogAuditoria.builder()
                    .lojaId(lojaId)
                    .entidade(ENTIDADE_AUDITORIA)
                    .entidadeId(lojaId.toString())
                    .acao(ACAO_AUDITORIA)
                    .usuarioId(operador.id() != null ? operador.id().toString() : null)
                    .usuarioNome(operador.nome())
                    .ipOrigem(operador.ipOrigem())
                    .detalheJson(objectMapper.writeValueAsString(detalhe))
                    .build();
            logAuditoriaRepository.save(audit);
        } catch (JsonProcessingException e) {
            log.error("Falha ao serializar auditoria de módulos (sem dado sensível): {}", e.getMessage());
        } catch (Exception e) {
            log.error("Falha ao registrar auditoria de módulos da loja {}: {}", lojaId, e.getMessage());
        }
    }

    private String claim(Authentication auth, String chave) {
        if (auth instanceof JwtAuthenticationToken jwtAuth) {
            return jwtAuth.getToken().getClaimAsString(chave);
        }
        return null;
    }

    private UUID claimLoja(Authentication auth) {
        Jwt jwt = auth instanceof JwtAuthenticationToken jwtAuth ? jwtAuth.getToken() : null;
        if (jwt == null) {
            return null;
        }
        for (String chave : new String[]{"loja_id", "lojaId", "tenant_id", "tenantId"}) {
            String valor = jwt.getClaimAsString(chave);
            if (valor != null && !valor.isBlank()) {
                try {
                    return UUID.fromString(valor.trim());
                } catch (IllegalArgumentException e) {
                    log.warn("Claim {} do JWT não é UUID", chave);
                }
            }
        }
        return null;
    }

    private boolean temAutoridade(Authentication auth, String autoridade) {
        for (GrantedAuthority a : auth.getAuthorities()) {
            if (autoridade.equals(a.getAuthority())) {
                return true;
            }
        }
        return false;
    }

    /**
     * Provisiona uma nova Loja / Empresa SaaS, seu primeiro Admin e sua estrutura inicial (R11).
     * Restrito a usuários com perfil DESENVOLVEDOR.
     */
    @Transactional
    public LojaCriadaResponse criarNovaLoja(CriarLojaRequest req, String ipOrigem) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean ehDev = auth != null
                && ("DESENVOLVEDOR".equals(claim(auth, "perfil")) || temAutoridade(auth, "ROLE_DESENVOLVEDOR"));
        if (!ehDev) {
            throw new AccessDeniedException("Criação e provisionamento de novas empresas/lojas é restrito ao perfil DESENVOLVEDOR.");
        }

        UUID novaLojaId = UUID.randomUUID();
        String cnpjLimpo = req.cnpj() != null ? req.cnpj().replaceAll("\\D", "") : "00000000000000";
        if (cnpjLimpo.length() > 14) cnpjLimpo = cnpjLimpo.substring(0, 14);

        long count = lojaRepository.count() + 1;
        String codigoGerado = "LJ-" + String.format("%03d", count);
        while (lojaRepository.existsByCodigo(codigoGerado)) {
            count++;
            codigoGerado = "LJ-" + String.format("%03d", count);
        }

        String sub = req.subdominio() != null && !req.subdominio().isBlank()
                ? normalizarSubdominio(req.subdominio())
                : normalizarSubdominio(req.nome());
        String subFinal = sub;
        int subIdx = 1;
        while (lojaRepository.existsBySubdominio(subFinal)) {
            subFinal = sub + (subIdx++);
        }

        Loja novaLoja = Loja.builder()
                .id(novaLojaId)
                .codigo(codigoGerado)
                .subdominio(subFinal)
                .ativo(true)
                .nome(req.nome().trim())
                .cnpj(cnpjLimpo.isBlank() ? "00000000000000" : cnpjLimpo)
                .telefone(req.telefone())
                .emailContato(req.emailContato())
                .build();
        novaLoja = lojaRepository.save(novaLoja);

        // Plano SaaS inicial
        String planoStr = req.plano() != null && !req.plano().isBlank() ? req.plano().trim().toUpperCase() : "PRO";
        PlanoSaaS plano = PlanoSaaS.PRO;
        try {
            plano = PlanoSaaS.deNome(planoStr);
        } catch (Exception ignored) {
            plano = PlanoSaaS.PRO;
        }
        final String planoNomeEfetivo = plano.name();
        ModuloTenantScope.executar(novaLojaId, () -> aplicarPlano(novaLojaId, new AplicarPlanoRequest(planoNomeEfetivo), ipOrigem));

        // Usuário Administrador da nova loja
        String emailAdmin = req.adminEmail().trim().toLowerCase();
        Usuario adminUsuario = Usuario.builder()
                .lojaId(novaLojaId)
                .nome(req.adminNome().trim())
                .email(emailAdmin)
                .senhaHash(passwordEncoder.encode(req.adminSenha().trim()))
                .perfil(Perfil.ADMIN)
                .build();
        usuarioRepository.save(adminUsuario);

        // 4 Formas de pagamento padrão ativas no PDV
        if (formaPagamentoRepository != null) {
            try {
                FormaPagamento pix = FormaPagamento.builder()
                        .lojaId(novaLojaId)
                        .nome("PIX")
                        .tipo(FormaPagamento.TipoFormaPagamento.PIX)
                        .tPagNfce("17")
                        .ativo(true)
                        .padrao(true)
                        .build();
                FormaPagamento dinheiro = FormaPagamento.builder()
                        .lojaId(novaLojaId)
                        .nome("DINHEIRO")
                        .tipo(FormaPagamento.TipoFormaPagamento.DINHEIRO)
                        .tPagNfce("01")
                        .ativo(true)
                        .padrao(false)
                        .build();
                FormaPagamento debito = FormaPagamento.builder()
                        .lojaId(novaLojaId)
                        .nome("DEBITO")
                        .tipo(FormaPagamento.TipoFormaPagamento.DEBITO)
                        .tPagNfce("04")
                        .ativo(true)
                        .padrao(false)
                        .build();
                FormaPagamento credito = FormaPagamento.builder()
                        .lojaId(novaLojaId)
                        .nome("CREDITO")
                        .tipo(FormaPagamento.TipoFormaPagamento.CREDITO)
                        .tPagNfce("03")
                        .ativo(true)
                        .padrao(false)
                        .build();
                formaPagamentoRepository.saveAll(List.of(pix, dinheiro, debito, credito));
            } catch (Exception e) {
                log.warn("Falha ao criar formas de pagamento para nova loja {}: {}", novaLojaId, e.getMessage());
            }
        }

        // 7 Categorias canônicas de ótica
        if (categoriaRepository != null) {
            try {
                List<String> nomesCategorias = List.of(
                        "Armações", "Lentes", "Óculos de Sol", "Lentes de Contato", "Acessórios", "Serviços", "Lentes Oftálmicas"
                );
                List<Categoria> cats = new java.util.ArrayList<>();
                for (String n : nomesCategorias) {
                    cats.add(Categoria.builder().lojaId(novaLojaId).nome(n).build());
                }
                categoriaRepository.saveAll(cats);
            } catch (Exception e) {
                log.warn("Falha ao criar categorias canônicas para nova loja {}: {}", novaLojaId, e.getMessage());
            }
        }

        // Auditoria
        RegistroOperador op = resolverOperador(ipOrigem);
        LogAuditoria audit = LogAuditoria.builder()
                .lojaId(novaLojaId)
                .usuarioId(op.id() != null ? op.id().toString() : null)
                .usuarioNome(op.nome())
                .entidade("loja")
                .entidadeId(novaLojaId.toString())
                .acao("CREATE")
                .detalheJson(String.format("{\"nome\":\"%s\",\"codigo\":\"%s\",\"subdominio\":\"%s\",\"cnpj\":\"%s\",\"plano\":\"%s\",\"admin\":\"%s\"}",
                        novaLoja.getNome(), codigoGerado, subFinal, novaLoja.getCnpj(), plano.name(), emailAdmin))
                .ipOrigem(ipOrigem)
                .build();
        logAuditoriaRepository.save(audit);

        log.info("Nova empresa/loja provisionada lojaId={} codigo={} subdominio={} nome={} plano={} admin={}",
                novaLojaId, codigoGerado, subFinal, novaLoja.getNome(), plano.name(), emailAdmin);

        return new LojaCriadaResponse(novaLojaId, novaLoja.getNome(), codigoGerado, subFinal, novaLoja.getCnpj(), emailAdmin, plano.name());
    }

    /**
     * Edita dados cadastrais da Loja no Painel Dev.
     */
    @Transactional
    public LojaResumoResponse editarLoja(UUID lojaId, EditarLojaRequest req, String ipOrigem) {
        autorizarAcessoLoja(lojaId);
        Loja loja = lojaRepository.findById(lojaId)
                .orElseThrow(() -> new IllegalArgumentException("Loja não encontrada: " + lojaId));

        loja.setNome(req.nome().trim());
        if (req.cnpj() != null) {
            String cnpjLimpo = req.cnpj().replaceAll("\\D", "");
            if (cnpjLimpo.length() > 14) cnpjLimpo = cnpjLimpo.substring(0, 14);
            loja.setCnpj(cnpjLimpo.isBlank() ? "00000000000000" : cnpjLimpo);
        }
        if (req.telefone() != null) loja.setTelefone(req.telefone().trim());
        if (req.emailContato() != null) loja.setEmailContato(req.emailContato().trim());
        if (req.subdominio() != null && !req.subdominio().isBlank()) {
            String subNorm = normalizarSubdominio(req.subdominio());
            if (!subNorm.equals(loja.getSubdominio()) && lojaRepository.existsBySubdominio(subNorm)) {
                throw new IllegalArgumentException("Subdomínio já em uso por outra loja: " + subNorm);
            }
            loja.setSubdominio(subNorm);
        }
        if (req.ativo() != null) {
            loja.setAtivo(req.ativo());
        }
        loja = lojaRepository.save(loja);

        RegistroOperador op = resolverOperador(ipOrigem);
        LogAuditoria audit = LogAuditoria.builder()
                .lojaId(lojaId)
                .usuarioId(op.id() != null ? op.id().toString() : null)
                .usuarioNome(op.nome())
                .entidade("loja")
                .entidadeId(lojaId.toString())
                .acao("UPDATE")
                .detalheJson(String.format("{\"nome\":\"%s\",\"cnpj\":\"%s\",\"subdominio\":\"%s\",\"ativo\":%b}",
                        loja.getNome(), loja.getCnpj(), loja.getSubdominio(), loja.isAtivo()))
                .ipOrigem(ipOrigem)
                .build();
        logAuditoriaRepository.save(audit);

        return new LojaResumoResponse(
                loja.getId(), loja.getNome(), loja.getCodigo(), loja.getSubdominio(),
                loja.getCnpj(), loja.getTelefone(), loja.getEmailContato(), loja.isAtivo()
        );
    }

    /**
     * Exclui uma Loja permanentemente (apenas DESENVOLVEDOR).
     */
    @Transactional
    public void excluirLoja(UUID lojaId, String ipOrigem) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean ehDev = auth != null
                && ("DESENVOLVEDOR".equals(claim(auth, "perfil")) || temAutoridade(auth, "ROLE_DESENVOLVEDOR"));
        if (!ehDev) {
            throw new AccessDeniedException("Exclusão de lojas é restrita ao perfil DESENVOLVEDOR.");
        }
        if (UUID.fromString("00000000-0000-0000-0000-000000000001").equals(lojaId)) {
            throw new IllegalArgumentException("A loja matriz base do sistema não pode ser excluída.");
        }
        Loja loja = lojaRepository.findById(lojaId)
                .orElseThrow(() -> new IllegalArgumentException("Loja não encontrada: " + lojaId));

        moduloRepository.deleteAll(moduloRepository.findByLojaId(lojaId));
        usuarioRepository.findAllByLojaId(lojaId, org.springframework.data.domain.Pageable.unpaged())
                .forEach(usuarioRepository::delete);
        if (formaPagamentoRepository != null) {
            formaPagamentoRepository.deleteAll(formaPagamentoRepository.findByLojaId(lojaId));
        }

        lojaRepository.delete(loja);

        RegistroOperador op = resolverOperador(ipOrigem);
        LogAuditoria audit = LogAuditoria.builder()
                .lojaId(lojaId)
                .usuarioId(op.id() != null ? op.id().toString() : null)
                .usuarioNome(op.nome())
                .entidade("loja")
                .entidadeId(lojaId.toString())
                .acao("DELETE")
                .detalheJson(String.format("{\"lojaId\":\"%s\",\"nome\":\"%s\"}", lojaId, loja.getNome()))
                .ipOrigem(ipOrigem)
                .build();
        logAuditoriaRepository.save(audit);
        log.info("Loja excluída lojaId={} nome={}", lojaId, loja.getNome());
    }

    public static String normalizarSubdominio(String texto) {
        if (texto == null || texto.isBlank()) return "loja";
        String norm = java.text.Normalizer.normalize(texto, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "")
                .toLowerCase()
                .replaceAll("[^a-z0-9]", "");
        if (norm.isBlank()) norm = "loja";
        if (norm.length() > 30) norm = norm.substring(0, 30);
        return norm;
    }
}

