package com.visionbox.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

/**
 * Habilita @CreatedDate / @LastModifiedDate se usados futuro.
 * S0 usa @CreationTimestamp/@UpdateTimestamp do Hibernate + manual @PrePersist.
 */
@Configuration
@EnableJpaAuditing
public class JpaAuditingConfig {
}
