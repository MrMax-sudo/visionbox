package com.visionbox.modules.pessoa.repository;

import com.visionbox.modules.pessoa.domain.Cliente;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface ClienteRepository extends JpaRepository<Cliente, UUID> {

    Optional<Cliente> findByIdAndLojaId(UUID id, UUID lojaId);

    Page<Cliente> findAllByLojaId(UUID lojaId, Pageable pageable);

    java.util.List<Cliente> findAllByLojaId(UUID lojaId);

    @Query("select c from Cliente c where c.cpfHash = :hash and c.lojaId = :lojaId")
    Optional<Cliente> findByCpfHashAndLojaId(@Param("hash") String hash, @Param("lojaId") UUID lojaId);

    @Query("select c from Cliente c where c.lojaId = :lojaId and lower(c.nome) like lower(concat('%', :nome, '%'))")
    Page<Cliente> findByLojaIdAndNomeContainingIgnoreCase(@Param("lojaId") UUID lojaId, @Param("nome") String nome, Pageable pageable);

    boolean existsByCpfHashAndLojaId(String cpfHash, UUID lojaId);

    long countByLojaId(UUID lojaId);
}
