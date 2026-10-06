package com.visionbox.shared.base;

/**
 * Alias compatível — canônico é {@link com.visionbox.shared.domain.EntidadeBase}.
 * Mantido para não quebrar imports legados.
 * Novos códigos devem importar com.visionbox.shared.domain.EntidadeBase.
 *
 * @deprecated use com.visionbox.shared.domain.EntidadeBase
 */
@Deprecated
public abstract class EntidadeBase extends com.visionbox.shared.domain.EntidadeBase {
}
