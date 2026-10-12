package com.visionbox.modules.catalogo.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SugestaoSkuEanResponse {
    private String sku;
    private String codigoBarras;
}
