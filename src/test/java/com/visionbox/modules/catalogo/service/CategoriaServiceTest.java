package com.visionbox.modules.catalogo.service;

import com.visionbox.modules.catalogo.domain.Categoria;
import com.visionbox.modules.catalogo.dto.CategoriaRequest;
import com.visionbox.modules.catalogo.dto.CategoriaResponse;
import com.visionbox.modules.catalogo.mapper.CategoriaMapper;
import com.visionbox.modules.catalogo.repository.CategoriaRepository;
import com.visionbox.shared.tenant.TenantContext;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CategoriaServiceTest {

    @Mock
    private CategoriaRepository repository;

    @Mock
    private CategoriaMapper mapper;

    @InjectMocks
    private CategoriaService service;

    private static final UUID LOJA_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID CATEGORIA_ID = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        TenantContext.setCurrentLojaId(LOJA_ID);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    @DisplayName("Deve criar categoria com sucesso quando nome for unico na loja")
    void deveCriarCategoriaComSucesso() {
        CategoriaRequest req = new CategoriaRequest("Armações", "Armações de grau");
        when(repository.existsByLojaIdAndNomeIgnoreCase(LOJA_ID, "Armações")).thenReturn(false);

        Categoria salva = Categoria.builder()
                .id(CATEGORIA_ID)
                .lojaId(LOJA_ID)
                .nome("Armações")
                .descricao("Armações de grau")
                .build();
        when(repository.save(any(Categoria.class))).thenReturn(salva);

        CategoriaResponse respMock = CategoriaResponse.builder()
                .id(CATEGORIA_ID)
                .nome("Armações")
                .descricao("Armações de grau")
                .ativo(true)
                .build();
        when(mapper.toResponse(salva)).thenReturn(respMock);

        CategoriaResponse resultado = service.criar(req);

        assertThat(resultado).isNotNull();
        assertThat(resultado.getNome()).isEqualTo("Armações");
        verify(repository).save(argThat(c -> c.getLojaId().equals(LOJA_ID) && c.getNome().equals("Armações")));
    }

    @Test
    @DisplayName("Deve lancar IllegalArgumentException ao tentar criar categoria com nome duplicado")
    void deveLancarErroAoCriarCategoriaDuplicada() {
        CategoriaRequest req = new CategoriaRequest("Armações", "Armações de grau");
        when(repository.existsByLojaIdAndNomeIgnoreCase(LOJA_ID, "Armações")).thenReturn(true);

        assertThatThrownBy(() -> service.criar(req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Já existe uma categoria cadastrada com o nome: Armações");

        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("Deve listar todas as categorias ativas da loja")
    void deveListarTodasCategorias() {
        Categoria c1 = Categoria.builder().id(UUID.randomUUID()).lojaId(LOJA_ID).nome("Armações").build();
        Categoria c2 = Categoria.builder().id(UUID.randomUUID()).lojaId(LOJA_ID).nome("Lentes").build();
        when(repository.findAllByLojaIdOrderByNomeAsc(LOJA_ID)).thenReturn(List.of(c1, c2));

        CategoriaResponse r1 = CategoriaResponse.builder().nome("Armações").build();
        CategoriaResponse r2 = CategoriaResponse.builder().nome("Lentes").build();
        when(mapper.toResponse(c1)).thenReturn(r1);
        when(mapper.toResponse(c2)).thenReturn(r2);

        List<CategoriaResponse> resultado = service.listarTodas();

        assertThat(resultado).hasSize(2);
        assertThat(resultado.get(0).getNome()).isEqualTo("Armações");
    }

    @Test
    @DisplayName("Deve buscar categoria por ID com sucesso")
    void deveBuscarPorId() {
        Categoria c = Categoria.builder().id(CATEGORIA_ID).lojaId(LOJA_ID).nome("Armações").build();
        when(repository.findByIdAndLojaId(CATEGORIA_ID, LOJA_ID)).thenReturn(Optional.of(c));

        CategoriaResponse r = CategoriaResponse.builder().id(CATEGORIA_ID).nome("Armações").build();
        when(mapper.toResponse(c)).thenReturn(r);

        CategoriaResponse resultado = service.buscarPorId(CATEGORIA_ID);

        assertThat(resultado).isNotNull();
        assertThat(resultado.getId()).isEqualTo(CATEGORIA_ID);
    }

    @Test
    @DisplayName("Deve lancar EntityNotFoundException se categoria nao for encontrada na loja")
    void deveLancarErroSeNaoEncontrar() {
        when(repository.findByIdAndLojaId(CATEGORIA_ID, LOJA_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.buscarPorId(CATEGORIA_ID))
                .isInstanceOf(EntityNotFoundException.class);
    }

    @Test
    @DisplayName("Deve desativar categoria (soft delete) com sucesso")
    void deveExcluirCategoriaSoftDelete() {
        Categoria c = Categoria.builder().id(CATEGORIA_ID).lojaId(LOJA_ID).nome("Armações").build();
        c.setAtivo(true);
        when(repository.findByIdAndLojaId(CATEGORIA_ID, LOJA_ID)).thenReturn(Optional.of(c));

        service.excluir(CATEGORIA_ID);

        assertThat(c.isAtivo()).isFalse();
        verify(repository).save(c);
    }
}
