package com.visionbox;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * VisionBox — ERP vertical para óticas.
 * S0 Foundation: bootstrap Spring Boot 3.4.5 + JPA + Security + Flyway.
 * JPA Auditing fica em config/JpaAuditingConfig para não duplicar bean.
 */
@SpringBootApplication
@EnableScheduling
public class VisionBoxApplication {

    public static void main(String[] args) {
        SpringApplication.run(VisionBoxApplication.class, args);
    }
}
