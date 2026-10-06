package com.visionbox.modules.financeiro.repository;

import com.visionbox.modules.financeiro.domain.ContaReceber;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ContaReceberRepository extends JpaRepository<ContaReceber, UUID> {

    Optional<ContaReceber> findByIdAndLojaId(UUID id, UUID lojaId);

    Page<ContaReceber> findAllByLojaId(UUID lojaId, Pageable pageable);

    Page<ContaReceber> findByLojaIdAndStatus(UUID lojaId, ContaReceber.StatusConta status, Pageable pageable);

    Page<ContaReceber> findByLojaIdAndClienteId(UUID lojaId, UUID clienteId, Pageable pageable);

    List<ContaReceber> findByLojaIdAndVencimentoBetween(UUID lojaId, LocalDate inicio, LocalDate fim);

    List<ContaReceber> findByLojaIdAndStatusAndVencimentoBefore(UUID lojaId, ContaReceber.StatusConta status, LocalDate data);
}
