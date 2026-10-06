package com.visionbox.modules.usuario.domain;

/**
 * Perfil RBAC VisionBox (spec §3, ADR-003).
 * ADMIN = acesso total, GERENTE = loja, VENDEDOR = PDV/cliente, OTICO = grau/receita, FINANCEIRO = contas.
 */
public enum Perfil {
    ADMIN,
    GERENTE,
    VENDEDOR,
    OTICO,
    TECNICO,
    FINANCEIRO,
    LABORATORIO
}
