package com.visionbox.modules.catalogo.service;

import com.visionbox.modules.catalogo.dto.ProdutoRequest;
import com.visionbox.modules.catalogo.repository.ProdutoRepository;
import com.visionbox.modules.clinico.dto.GrauDto;
import com.visionbox.modules.clinico.dto.ReceitaRequest;
import com.visionbox.modules.clinico.service.ReceitaService;
import com.visionbox.modules.pessoa.dto.ClienteRequest;
import com.visionbox.modules.pessoa.dto.ClienteResponse;
import com.visionbox.modules.pessoa.repository.ClienteRepository;
import com.visionbox.modules.pessoa.service.ClienteService;
import com.visionbox.shared.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * CargaDemonstracaoService — agiliza testes e demonstração do sistema
 * populando produtos óticos, clientes e receitas clínicas realistas.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CargaDemonstracaoService {

    private final ProdutoService produtoService;
    private final ProdutoRepository produtoRepository;
    private final CategoriaService categoriaService;
    private final ClienteService clienteService;
    private final ClienteRepository clienteRepository;
    private final ReceitaService receitaService;

    @Transactional
    public Map<String, Object> executarCarga() {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        int categoriasCriadas = 0;
        int produtosCriados = 0;
        int clientesCriados = 0;
        int receitasCriadas = 0;

        // 1. Categorias Oficiais de Ótica persistidas no banco
        var catArmacao = categoriaService.obterOuCriar(lojaId, "Armações", "Armações de grau e receituário");
        var catLentes = categoriaService.obterOuCriar(lojaId, "Lentes Oftálmicas", "Lentes de visão simples, monofocais e multifocais");
        categoriaService.obterOuCriar(lojaId, "Óculos de Sol", "Óculos solares com proteção UV");
        categoriaService.obterOuCriar(lojaId, "Lentes de Contato", "Lentes gelatinosas e descartáveis");
        var catAcessorios = categoriaService.obterOuCriar(lojaId, "Acessórios", "Estojos, flanelas, cordões e soluções higienizadoras");
        categoriaService.obterOuCriar(lojaId, "Serviços", "Montagem, ajustes, solda e coloração");

        // 2. Produtos de Ótica de Demonstração
        List<ProdutoRequest> produtosDemonstracao = List.of(
            ProdutoRequest.builder()
                .nome("Armação Ray-Ban Aviador RB3025 Dourado")
                .descricao("Armação clássica de metal com ponteira de acetato")
                .tipoProduto("ARMACAO")
                .marca("Ray-Ban")
                .categoria("Armação")
                .categoriaId(catArmacao.getId())
                .ncm("90031100")
                .cest("2805900")
                .cfop("5102")
                .custo(new BigDecimal("280.00"))
                .precoVenda(new BigDecimal("580.00"))
                .estoqueQuantidade(15)
                .ativoVenda(true)
                .build(),
            ProdutoRequest.builder()
                .nome("Armação Oakley Holbrook OO9102 Preto Fosco")
                .descricao("Armação esportiva em O-Matter resistente e leve")
                .tipoProduto("ARMACAO")
                .marca("Oakley")
                .categoria("Armação")
                .categoriaId(catArmacao.getId())
                .ncm("90031100")
                .cest("2805900")
                .cfop("5102")
                .custo(new BigDecimal("310.00"))
                .precoVenda(new BigDecimal("620.00"))
                .estoqueQuantidade(12)
                .ativoVenda(true)
                .build(),
            ProdutoRequest.builder()
                .nome("Armação Vogue Eyewear VO5230 Tartaruga")
                .descricao("Armação feminina estilosa em acetato premium")
                .tipoProduto("ARMACAO")
                .marca("Vogue")
                .categoria("Armação")
                .categoriaId(catArmacao.getId())
                .ncm("90031100")
                .cest("2805900")
                .cfop("5102")
                .custo(new BigDecimal("190.00"))
                .precoVenda(new BigDecimal("420.00"))
                .estoqueQuantidade(10)
                .ativoVenda(true)
                .build(),
            ProdutoRequest.builder()
                .nome("Lente Oftálmica Monofocal Antirreflexo Crizal")
                .descricao("Par de lentes visão simples com filtro azul e proteção UV")
                .tipoProduto("LENTE")
                .marca("Essilor")
                .categoria("Lente")
                .categoriaId(catLentes.getId())
                .ncm("90015000")
                .cest("2805800")
                .cfop("5102")
                .custo(new BigDecimal("110.00"))
                .precoVenda(new BigDecimal("250.00"))
                .estoqueQuantidade(50)
                .ativoVenda(true)
                .build(),
            ProdutoRequest.builder()
                .nome("Lente Multifocal Digital Transitions Zeiss")
                .descricao("Par de lentes multifocais fotossensíveis com campo visual ampliado")
                .tipoProduto("LENTE")
                .marca("Zeiss")
                .categoria("Lente")
                .categoriaId(catLentes.getId())
                .ncm("90015000")
                .cest("2805800")
                .cfop("5102")
                .custo(new BigDecimal("420.00"))
                .precoVenda(new BigDecimal("890.00"))
                .estoqueQuantidade(30)
                .ativoVenda(true)
                .build(),
            ProdutoRequest.builder()
                .nome("Kit Limpeza e Solução Higienizadora de Lentes 60ml")
                .descricao("Fluido limpador com flanela de microfibra de alta densidade")
                .tipoProduto("ACESSORIO")
                .marca("CleanOptic")
                .categoria("Acessório")
                .categoriaId(catAcessorios.getId())
                .ncm("90049090")
                .cest("2805900")
                .cfop("5102")
                .custo(new BigDecimal("12.00"))
                .precoVenda(new BigDecimal("35.00"))
                .estoqueQuantidade(40)
                .ativoVenda(true)
                .build()
        );

        for (ProdutoRequest pReq : produtosDemonstracao) {
            boolean jaExiste = produtoRepository.buscarFiltrado(lojaId, pReq.getNome(), null, null, null, Pageable.unpaged())
                .stream().anyMatch(p -> p.getNome().equalsIgnoreCase(pReq.getNome()));
            if (!jaExiste) {
                produtoService.criar(pReq);
                produtosCriados++;
            }
        }

        // 2. Clientes de Demonstração (CPFs válidos matematicamente)
        List<ClienteRequest> clientesDemonstracao = List.of(
            ClienteRequest.builder()
                .nome("Maria Eduarda Santos")
                .cpf("52998224725")
                .telefone("11988887777")
                .whatsapp("11988887777")
                .email("maria.santos@demo.visionbox.com.br")
                .cep("04547000")
                .logradouro("Rua das Óticas")
                .numero("123")
                .bairro("Vila Nova")
                .cidade("São Paulo")
                .uf("SP")
                .consentimentoRecall(true)
                .canalPreferido("WHATSAPP")
                .build(),
            ClienteRequest.builder()
                .nome("Carlos Eduardo Ribeiro")
                .cpf("71428793860")
                .telefone("21999998888")
                .whatsapp("21999998888")
                .email("carlos.ribeiro@demo.visionbox.com.br")
                .cep("22041001")
                .logradouro("Avenida Copacabana")
                .numero("456")
                .bairro("Copacabana")
                .cidade("Rio de Janeiro")
                .uf("RJ")
                .consentimentoRecall(true)
                .canalPreferido("WHATSAPP")
                .build(),
            ClienteRequest.builder()
                .nome("Juliana Ferreira Lima")
                .cpf("11144477735")
                .telefone("31977776666")
                .whatsapp("31977776666")
                .email("juliana.lima@demo.visionbox.com.br")
                .cep("30140071")
                .logradouro("Rua da Bahia")
                .numero("789")
                .bairro("Savassi")
                .cidade("Belo Horizonte")
                .uf("MG")
                .consentimentoRecall(true)
                .canalPreferido("SMS")
                .build()
        );

        for (ClienteRequest cReq : clientesDemonstracao) {
            boolean jaExiste = clienteRepository.findByLojaIdAndNomeContainingIgnoreCase(lojaId, cReq.getNome(), Pageable.unpaged())
                .stream().anyMatch(c -> c.getNome().equalsIgnoreCase(cReq.getNome()));
            if (!jaExiste) {
                ClienteResponse novoCliente = clienteService.criar(cReq);
                clientesCriados++;

                // Cria receita oftálmica para o cliente de teste
                if ("Maria Eduarda Santos".equals(cReq.getNome())) {
                    ReceitaRequest rReq = ReceitaRequest.builder()
                        .clienteId(novoCliente.getId())
                        .nomeMedico("Dr. Roberto Albuquerque")
                        .crmMedico("CRM-SP 123456")
                        .tipo("MONOFOCAL")
                        .dp("63")
                        .od(GrauDto.builder()
                            .esferico(new BigDecimal("-2.00"))
                            .cilindrico(new BigDecimal("-0.50"))
                            .eixo(180)
                            .dnp(new BigDecimal("31.5"))
                            .build())
                        .oe(GrauDto.builder()
                            .esferico(new BigDecimal("-1.75"))
                            .cilindrico(new BigDecimal("-0.75"))
                            .eixo(175)
                            .dnp(new BigDecimal("31.5"))
                            .build())
                        .observacao("Lentes com filtro de luz azul e antirreflexo")
                        .build();
                    receitaService.criar(rReq);
                    receitasCriadas++;
                } else if ("Carlos Eduardo Ribeiro".equals(cReq.getNome())) {
                    ReceitaRequest rReq = ReceitaRequest.builder()
                        .clienteId(novoCliente.getId())
                        .nomeMedico("Dra. Vanessa Martins")
                        .crmMedico("CRM-RJ 654321")
                        .tipo("MULTIFOCAL")
                        .dp("64")
                        .od(GrauDto.builder()
                            .esferico(new BigDecimal("1.50"))
                            .adicao(new BigDecimal("2.00"))
                            .dnp(new BigDecimal("32.0"))
                            .build())
                        .oe(GrauDto.builder()
                            .esferico(new BigDecimal("1.25"))
                            .adicao(new BigDecimal("2.00"))
                            .dnp(new BigDecimal("32.0"))
                            .build())
                        .observacao("Multifocal digital para uso contínuo no computador")
                        .build();
                    receitaService.criar(rReq);
                    receitasCriadas++;
                }
            }
        }

        log.info("Carga de demonstração executada: loja={} produtos={} clientes={} receitas={}",
            lojaId, produtosCriados, clientesCriados, receitasCriadas);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("sucesso", true);
        resp.put("produtosCriados", produtosCriados);
        resp.put("clientesCriados", clientesCriados);
        resp.put("receitasCriadas", receitasCriadas);
        resp.put("mensagem", String.format("Carga de demonstração concluída: %d produtos, %d clientes e %d receitas inseridos.",
            produtosCriados, clientesCriados, receitasCriadas));
        return resp;
    }
}
