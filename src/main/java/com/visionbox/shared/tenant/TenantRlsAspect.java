package com.visionbox.shared.tenant;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.Optional;
import java.util.UUID;

/**
 * Segunda barreira ADR-001: seta a GUC transacional usada pelas policies RLS.
 */
@Slf4j
@Aspect
@Component
@Order(Ordered.LOWEST_PRECEDENCE)
public class TenantRlsAspect {

    @PersistenceContext
    private EntityManager entityManager;

    @Around("@annotation(org.springframework.transaction.annotation.Transactional) || @within(org.springframework.transaction.annotation.Transactional)")
    public Object setTenantForRls(ProceedingJoinPoint joinPoint) throws Throwable {
        setCurrentTenantIfTransactionActive();
        return joinPoint.proceed();
    }

    void setCurrentTenantIfTransactionActive() {
        if (!TransactionSynchronizationManager.isActualTransactionActive()) {
            return;
        }

        Optional<UUID> lojaId = TenantContext.getCurrentLojaId();
        if (lojaId.isEmpty()) {
            return;
        }

        entityManager.createNativeQuery("select set_config('app.loja_id', :lojaId, true)")
                .setParameter("lojaId", lojaId.get().toString())
                .getSingleResult();
        log.trace("RLS app.loja_id setado para transação loja={}", lojaId.get());
    }
}
