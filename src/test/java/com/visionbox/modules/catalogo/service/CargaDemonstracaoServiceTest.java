package com.visionbox.modules.catalogo.service;

import com.visionbox.modules.catalogo.dto.ProdutoResponse;
import com.visionbox.modules.catalogo.repository.ProdutoRepository;
import com.visionbox.modules.clinico.service.ReceitaService;
import com.visionbox.modules.pessoa.dto.ClienteResponse;
import com.visionbox.modules.pessoa.repository.ClienteRepository;
import com.visionbox.modules.pessoa.service.ClienteService;
import com.visionbox.shared.tenant.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.util.Collections;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CargaDemonstracaoServiceTest {

    @Mock
    private ProdutoService produtoService;

    @Mock
    private ProdutoRepository produtoRepository;

    @Mock
    private ClienteService clienteService;

    @Mock
    private ClienteRepository clienteRepository;

    @Mock
    private CategoriaService categoriaService;

    @Mock
    private ReceitaService receitaService;

    @InjectMocks
    private CargaDemonstracaoService cargaDemonstracaoService;

    private static final UUID LOJA_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    @BeforeEach
    void setUp() {
        TenantContext.setCurrentLojaId(LOJA_ID);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    @DisplayName("Deve executar carga de demonstracao com produtos e clientes se repositorio estiver vazio")
    void deveExecutarCargaDemonstracao() {
        when(categoriaService.obterOuCriar(eq(LOJA_ID), anyString(), anyString()))
            .thenAnswer(inv -> com.visionbox.modules.catalogo.domain.Categoria.builder()
                .id(UUID.randomUUID())
                .lojaId(LOJA_ID)
                .nome(inv.getArgument(1))
                .descricao(inv.getArgument(2))
                .build());

        when(produtoRepository.buscarFiltrado(eq(LOJA_ID), any(), any(), any(), any(), any(Pageable.class)))
            .thenReturn(new PageImpl<>(Collections.emptyList()));

        when(clienteRepository.findByLojaIdAndNomeContainingIgnoreCase(eq(LOJA_ID), any(), any(Pageable.class)))
            .thenReturn(new PageImpl<>(Collections.emptyList()));

        ClienteResponse mockCliente = ClienteResponse.builder()
            .id(UUID.randomUUID())
            .nome("Maria Eduarda Santos")
            .build();
        when(clienteService.criar(any())).thenReturn(mockCliente);

        Map<String, Object> resultado = cargaDemonstracaoService.executarCarga();

        assertThat(resultado).isNotNull();
        assertThat(resultado.get("sucesso")).isEqualTo(true);
        assertThat((int) resultado.get("produtosCriados")).isEqualTo(6);
        assertThat((int) resultado.get("clientesCriados")).isEqualTo(3);
        verify(produtoService, times(6)).criar(any());
        verify(clienteService, times(3)).criar(any());
    }
}
