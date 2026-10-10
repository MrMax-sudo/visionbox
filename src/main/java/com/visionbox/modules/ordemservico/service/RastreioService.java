package com.visionbox.modules.ordemservico.service;

import com.visionbox.modules.ordemservico.dto.RastreioResponse;
import com.visionbox.modules.ordemservico.dto.RastreioResponse.Evento;
import com.visionbox.modules.ordemservico.dto.RastreioResponse.Garantia;
import com.visionbox.modules.ordemservico.dto.RastreioResponse.GarantiaItem;
import com.visionbox.modules.ordemservico.dto.RastreioResponse.Optica;
import com.visionbox.modules.ordemservico.dto.RastreioBuscaResponse;
import com.visionbox.modules.pessoa.domain.Loja;
import com.visionbox.modules.ordemservico.repository.OrdemServicoRepository;
import com.visionbox.modules.catalogo.repository.ProdutoRepository;
import com.visionbox.modules.pessoa.repository.ClienteRepository;
import com.visionbox.modules.pessoa.repository.LojaRepository;
import com.visionbox.modules.ordemservico.domain.EventoOS;
import com.visionbox.modules.ordemservico.domain.OrdemServico;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

import static com.visionbox.modules.ordemservico.domain.StatusOS.*;

@Service
@RequiredArgsConstructor
public class RastreioService {

    private static final int VALIDADE_GARANTIA_MESES = 12;

    private final OrdemServicoRepository repository;
    private final LojaRepository lojaRepository;
    private final ClienteRepository clienteRepository;
    private final ProdutoRepository produtoRepository;
    private final RastreioTokenService tokenService;

    /**
     * Busca OS pelo número em todas as lojas ativas (endpoint público /numero=X).
     * Retorna {token, ordem} onde token permite acesso via /rastreio/{token}.
     * Se não encontrar em nenhuma loja → lança RuntimeException 404.
     */
    @Transactional(readOnly = true)
    public RastreioBuscaResponse buscarPorNumero(String numero) {
        for (Loja loja : lojaRepository.findAll()) {
            try {
                UUID lojaId = loja.getId();
                setTenantContext(lojaId);
                Optional<OrdemServico> osOptional = repository.findByNumeroAndLojaId(numero, lojaId);
                if (osOptional.isPresent()) {
                    OrdemServico os = osOptional.get();
                    String token = tokenService.gerar(lojaId, os.getId());
                    RastreioResponse ordem = montarPayload(os, lojaId);
                    return RastreioBuscaResponse.builder()
                            .token(token)
                            .ordem(ordem)
                            .build();
                }
            } catch (Exception e) {
                // continua para próxima loja
            } finally {
                clearTenantContext();
            }
        }
        throw new RuntimeException("OS número " + numero + " não encontrada em nenhuma loja");
    }

    /**
     * Busca OS pelo token assinado (endpoint público /{token}).
     * Valida token → retorna payload RastreioResponse.
     * Token inválido/expirado → ResponseStatusException (404 ou 410).
     */
    @Transactional(readOnly = true)
    public RastreioResponse buscarPorToken(String token) {
        RastreioTokenService.Payload payload = tokenService.validar(token);
        UUID lojaId = payload.lojaId();
        UUID osId = payload.ordemServicoId();
        setTenantContext(lojaId);
        try {
            OrdemServico os = repository.findByIdAndLojaId(osId, lojaId)
                    .orElseThrow(() -> new RuntimeException("OS não encontrada"));
            return montarPayload(os, lojaId);
        } finally {
            clearTenantContext();
        }
    }

    /**
     * Monta o objeto RastreioResponse a partir da OS.
     * Minimização LGPD: apenas primeiro nome do cliente; não expõe CPF nem grau/receita.
     */
    private RastreioResponse montarPayload(OrdemServico os, UUID lojaId) {
        RastreioResponse ordem = new RastreioResponse();

        ordem.setOrdemServicoId(os.getId());
        ordem.setNumeroOs(os.getNumero());
        ordem.setStatusAtual(os.getStatus() != null ? os.getStatus().name() : null);
        ordem.setDataAbertura(os.getCriadoEm());
        ordem.setPrevisaoEntrega(os.getPrevisaoEntrega());
        ordem.setDataEntregaReal(os.getDataEntregaReal());

        // Cliente: apenas primeiro nome (LGPD)
        if (os.getClienteId() != null) {
            try {
                String nomeCliente = clienteRepository.findByIdAndLojaId(os.getClienteId(), lojaId)
                        .map(c -> c.getNome())
                        .orElse(null);
                if (nomeCliente != null && !nomeCliente.isBlank()) {
                    String primeiroNome = nomeCliente.split(" ")[0];
                    ordem.setClientePrimeiroNome(primeiroNome);
                }
            } catch (Exception ignored) {
            }
        }

        // Produto/Armacao/Lente: lookup por loja
        if (os.getArmacaoId() != null) {
            produtoRepository.findByIdAndLojaId(os.getArmacaoId(), lojaId)
                    .ifPresent(prod -> ordem.setArmacaoNome(prod.getNome()));
        }
        if (os.getLenteId() != null) {
            produtoRepository.findByIdAndLojaId(os.getLenteId(), lojaId)
                    .ifPresent(prod -> ordem.setLenteNome(prod.getNome()));
        }

        // Produto resumo
        StringBuilder resumo = new StringBuilder();
        if (ordem.getArmacaoNome() != null) resumo.append(ordem.getArmacaoNome());
        if (ordem.getLenteNome() != null) {
            if (resumo.length() > 0) resumo.append(" + ");
            resumo.append(ordem.getLenteNome());
        }
        ordem.setProdutoResumo(resumo.length() > 0 ? resumo.toString() : null);

        // Optica (loja) - busca loja pelo id da OS
        ordem.setOptica(mapearOptica(lojaId, os.getLojaId()));

        // Garantia
        Garantia garantia = null;
        if (os.getStatus() == ENTREGUE && os.getDataEntregaReal() != null) {
            garantia = new Garantia();
            garantia.setDataCompra(os.getDataEntregaReal());
            garantia.setValidadeMeses(VALIDADE_GARANTIA_MESES);
            garantia.setItens(List.of(new GarantiaItem(
                    "Cobertura padrão " + VALIDADE_GARANTIA_MESES + " meses",
                    VALIDADE_GARANTIA_MESES,
                    VALIDADE_GARANTIA_MESES,
                    os.getDataEntregaReal().plusMonths(VALIDADE_GARANTIA_MESES)
            )));
        }
        ordem.setGarantia(garantia);

        // Timeline (eventos historico)
        if (os.getHistorico() != null) {
            List<Evento> eventos = new ArrayList<>();
            for (EventoOS e : os.getHistorico()) {
                Evento evento = new Evento();
                evento.setId(e.getId());
                String statusAnt = e.getStatusAnterior() != null ? e.getStatusAnterior().name() : null;
                evento.setStatusAnterior(statusAnt);
                String statusNovo = e.getStatusNovo() != null ? e.getStatusNovo().name() : null;
                evento.setStatusNovo(statusNovo);
                evento.setDataHora(e.getDataHora());
                evento.setResponsavel(e.getResponsavel());
                evento.setObservacao(e.getObservacao());
                eventos.add(evento);
            }
            ordem.setTimeline(eventos);
        }

        return ordem;
    }

    private RastreioResponse.Optica mapearOptica(UUID lojaId, UUID osLojaId) {
        Loja loja = lojaRepository.findById(osLojaId).orElse(null);
        if (loja == null) return null;
        RastreioResponse.Optica optica = new RastreioResponse.Optica();
        optica.setNome(loja.getNome());
        optica.setCnpj(loja.getCnpj());
        optica.setTelefone(loja.getTelefone());
        optica.setWhatsapp(loja.getWhatsapp());
        String endereco = Optional.ofNullable(loja.getEndereco()).filter(x -> !x.isBlank())
                .map(x -> x + ", ")
                .orElse("");
        optica.setEndereco(endereco + Optional.ofNullable(loja.getNumero()).filter(x -> !x.isBlank()).orElse("") + " " +
                Optional.ofNullable(loja.getBairro()).filter(x -> !x.isBlank()).orElse(""));
        optica.setCidade(loja.getCidade());
        optica.setUf(loja.getUf());
        return optica;
    }

    // ---------- TenantContext management ----------

    private static final ThreadLocal<UUID> TENANT_THREAD_LOCAL = new ThreadLocal<>();

    private void setTenantContext(UUID lojaId) {
        TENANT_THREAD_LOCAL.set(lojaId);
        com.visionbox.shared.tenant.TenantContext.setCurrentLojaId(lojaId);
    }

    private void clearTenantContext() {
        TENANT_THREAD_LOCAL.remove();
        com.visionbox.shared.tenant.TenantContext.clear();
    }
}