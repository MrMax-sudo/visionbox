package com.visionbox.modules.financeiro.fornecedor.service;

import com.visionbox.modules.financeiro.fornecedor.domain.Fornecedor;
import com.visionbox.modules.financeiro.fornecedor.dto.FornecedorRequest;
import com.visionbox.modules.financeiro.fornecedor.dto.FornecedorResponse;
import com.visionbox.modules.financeiro.fornecedor.mapper.FornecedorMapper;
import com.visionbox.modules.financeiro.fornecedor.repository.FornecedorRepository;
import com.visionbox.shared.crypto.CryptoService;
import com.visionbox.shared.tenant.TenantContext;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Fase 3 Robustez §3.3 — CRUD de Fornecedor com CNPJ cifrado (R2/ADR-002) e
 * dedup por hash por loja. Espelho do padrão do CPF no ClienteService.
 */
class FornecedorServiceTest {

    private static final UUID LOJA = UUID.fromString("00000000-0000-0000-0000-000000000001");
    /** CNPJ com dígitos verificadores válidos (11.222.333/0001-81). */
    private static final String CNPJ_VALIDO = "11.222.333/0001-81";

    private FornecedorRepository repository;
    private FornecedorMapper mapper;
    private CryptoService cryptoService;
    private FornecedorService service;

    @BeforeEach
    void setUp() {
        repository = mock(FornecedorRepository.class);
        mapper = mock(FornecedorMapper.class);
        cryptoService = mock(CryptoService.class);
        service = new FornecedorService(repository, mapper, cryptoService);
        TenantContext.setCurrentLojaId(LOJA);

        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(mapper.toResponseWithMask(any(), any())).thenAnswer(inv -> new FornecedorResponse());
        when(repository.existsByCnpjHashAndLojaId(anyString(), eq(LOJA))).thenReturn(false);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void criar_comCnpjValido_cifraECalculaHash() {
        byte[] cipherFake = "cipher".getBytes();
        when(cryptoService.hash("11222333000181")).thenReturn("hash-hmac");
        when(cryptoService.encrypt("11222333000181")).thenReturn(cipherFake);

        service.criar(FornecedorRequest.builder().nome("Essilor Brasil").cnpj(CNPJ_VALIDO).build());

        verify(cryptoService).hash("11222333000181");
        verify(cryptoService).encrypt("11222333000181");
        verify(repository).save(argThat((Fornecedor f) ->
                LOJA.equals(f.getLojaId())
                        && f.getCnpjCipher() != null
                        && "hash-hmac".equals(f.getCnpjHash())
                        && "Essilor Brasil".equals(f.getNome())));
    }

    @Test
    void criar_cnpjDuplicadoNaLoja_rejeitada() {
        when(cryptoService.hash("11222333000181")).thenReturn("hash-dup");
        when(repository.existsByCnpjHashAndLojaId("hash-dup", LOJA)).thenReturn(true);

        assertThatThrownBy(() -> service.criar(
                FornecedorRequest.builder().nome("Distribuidor X").cnpj(CNPJ_VALIDO).build()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("CNPJ já cadastrado nesta loja");
        verify(repository, never()).save(any());
    }

    @Test
    void criar_cnpjInvalido_rejeitada() {
        assertThatThrownBy(() -> service.criar(
                FornecedorRequest.builder().nome("Fornecedor Ruim").cnpj("11.222.333/0001-82").build()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("CNPJ inválido");
        verify(repository, never()).save(any());
    }

    @Test
    void criar_semCnpj_permitido_cifraNula() {
        service.criar(FornecedorRequest.builder().nome("Padaria da Esquina").build());

        verify(repository).save(argThat((Fornecedor f) ->
                f.getCnpjCipher() == null && f.getCnpjHash() == null));
        verify(cryptoService, never()).encrypt(any());
    }

    @Test
    void criar_nomeCurto_rejeitada() {
        assertThatThrownBy(() -> service.criar(FornecedorRequest.builder().nome("A").build()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("ao menos 2 caracteres");
    }

    @Test
    void buscar_retornaCnpjMascarado_revelandoDoisPrimeirosDigitos() {
        Fornecedor f = Fornecedor.builder()
                .id(UUID.randomUUID()).lojaId(LOJA)
                .nome("Hoya").cnpjCipher("x".getBytes()).build();
        when(repository.findByIdAndLojaId(f.getId(), LOJA)).thenReturn(Optional.of(f));
        when(cryptoService.decrypt(any())).thenReturn("11222333000181");

        FornecedorResponse resp = service.buscar(f.getId());

        assertThat(resp).isNotNull();
        verify(mapper).toResponseWithMask(eq(f), eq("11.***.***/****-**"));
    }

    @Test
    void atualizar_mudandoCnpj_verificaDuplicidade() {
        String novoHash = "novo-hash";
        Fornecedor f = Fornecedor.builder()
                .id(UUID.randomUUID()).lojaId(LOJA)
                .nome("Antigo").cnpjHash("hash-antigo").build();
        when(repository.findByIdAndLojaId(f.getId(), LOJA)).thenReturn(Optional.of(f));
        when(cryptoService.hash("11222333000181")).thenReturn(novoHash);
        when(repository.existsByCnpjHashAndLojaId(novoHash, LOJA)).thenReturn(true);

        assertThatThrownBy(() -> service.atualizar(f.getId(),
                FornecedorRequest.builder().nome("Novo").cnpj(CNPJ_VALIDO).build()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("CNPJ já cadastrado nesta loja");
    }

    @Test
    void remover_softDelete_marcaAtivoFalse() {
        Fornecedor f = Fornecedor.builder().id(UUID.randomUUID()).lojaId(LOJA).nome("Sair").ativo(true).build();
        when(repository.findByIdAndLojaId(f.getId(), LOJA)).thenReturn(Optional.of(f));

        service.remover(f.getId());

        assertThat(f.isAtivo()).isFalse();
        verify(repository).save(f);
    }

    /* ----------------- §3.3 — reativação de fornecedor (soft-delete reversal) ----------------- */

    @Test
    void reativar_fornecedorInativo_flipaAtivoViaUpdateNativo_semMerge() {
        UUID id = UUID.randomUUID();
        Fornecedor inativo = Fornecedor.builder()
                .id(id).lojaId(LOJA).nome("Essilor").ativo(false)
                .cnpjCipher("x".getBytes()).cnpjHash("hash-x").build();
        // 1ª chamada (já ativo?) → vazio (invisível pelo @SQLRestriction); após UPDATE → visível
        when(repository.findByIdAndLojaId(id, LOJA)).thenReturn(Optional.empty(), Optional.of(inativo));
        when(repository.existsByIdAndLojaIdInclusive(id, LOJA)).thenReturn(true);
        when(repository.findCnpjHashByIdAndLojaIdInclusive(id, LOJA)).thenReturn(Optional.of("hash-x"));
        when(repository.reativarByIdAndLojaId(id, LOJA)).thenReturn(1);

        service.reativar(id);

        verify(repository).reativarByIdAndLojaId(id, LOJA);
        // UPDATE nativo — cifra do CNPJ intocada (nenhum save/merge na entidade)
        verify(repository, never()).save(any());
        verify(mapper).toResponseWithMask(eq(inativo), any());
    }

    @Test
    void reativar_semCnpj_pulaCheckDeConflito() {
        UUID id = UUID.randomUUID();
        Fornecedor inativo = Fornecedor.builder().id(id).lojaId(LOJA).nome("Sem CNPJ").ativo(false).build();
        when(repository.findByIdAndLojaId(id, LOJA)).thenReturn(Optional.empty(), Optional.of(inativo));
        when(repository.existsByIdAndLojaIdInclusive(id, LOJA)).thenReturn(true);
        when(repository.findCnpjHashByIdAndLojaIdInclusive(id, LOJA)).thenReturn(Optional.empty());
        when(repository.reativarByIdAndLojaId(id, LOJA)).thenReturn(1);

        service.reativar(id);

        verify(repository, never()).existsByCnpjHashAndLojaId(any(), any());
        verify(repository).reativarByIdAndLojaId(id, LOJA);
    }

    @Test
    void reativar_jaAtivo_idempotente_semUpdate() {
        UUID id = UUID.randomUUID();
        Fornecedor ativo = Fornecedor.builder().id(id).lojaId(LOJA).nome("Já ativo").ativo(true).build();
        when(repository.findByIdAndLojaId(id, LOJA)).thenReturn(Optional.of(ativo));

        service.reativar(id);

        verify(repository, never()).reativarByIdAndLojaId(any(), any());
        verify(repository, never()).existsByIdAndLojaIdInclusive(any(), any());
        verify(mapper).toResponseWithMask(eq(ativo), any());
    }

    @Test
    void reativar_inexistenteOuOutraLoja_404() {
        UUID id = UUID.randomUUID();
        when(repository.findByIdAndLojaId(id, LOJA)).thenReturn(Optional.empty());
        when(repository.existsByIdAndLojaIdInclusive(id, LOJA)).thenReturn(false);

        assertThatThrownBy(() -> service.reativar(id))
                .isInstanceOf(EntityNotFoundException.class)
                .hasMessageContaining("Fornecedor não encontrado");
        verify(repository, never()).reativarByIdAndLojaId(any(), any());
    }

    @Test
    void reativar_cnpjAtivoEmOutroFornecedor_conflito409_semReativar() {
        UUID id = UUID.randomUUID();
        when(repository.findByIdAndLojaId(id, LOJA)).thenReturn(Optional.empty());
        when(repository.existsByIdAndLojaIdInclusive(id, LOJA)).thenReturn(true);
        when(repository.findCnpjHashByIdAndLojaIdInclusive(id, LOJA)).thenReturn(Optional.of("hash-dup"));
        when(repository.existsByCnpjHashAndLojaId("hash-dup", LOJA)).thenReturn(true);

        assertThatThrownBy(() -> service.reativar(id))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        verify(repository, never()).reativarByIdAndLojaId(any(), any());
        verify(repository, never()).save(any());
    }

    @Test
    void reativar_corridaBenigna_linhaJaReativadaPorOutraRequisicao_retornaOk() {
        UUID id = UUID.randomUUID();
        Fornecedor reativado = Fornecedor.builder()
                .id(id).lojaId(LOJA).nome("Corrida").ativo(true).cnpjHash("hash-c").build();
        // UPDATE nativo volta 0 (outra requisição reativou antes), mas a linha já é visível
        when(repository.findByIdAndLojaId(id, LOJA)).thenReturn(Optional.empty(), Optional.of(reativado));
        when(repository.existsByIdAndLojaIdInclusive(id, LOJA)).thenReturn(true);
        when(repository.findCnpjHashByIdAndLojaIdInclusive(id, LOJA)).thenReturn(Optional.of("hash-c"));
        when(repository.reativarByIdAndLojaId(id, LOJA)).thenReturn(0);

        service.reativar(id);

        verify(mapper).toResponseWithMask(eq(reativado), any());
    }
}
