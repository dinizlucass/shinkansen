/**
 * lib/store/shipping-dimensions.ts
 *
 * Dimensões e peso padrão por categoria de produto, usados no cálculo
 * de frete do Melhor Envio. Ajuste estes valores conforme a realidade
 * dos seus produtos.
 *
 * Unidades exigidas pelo Melhor Envio:
 *   weight → kg
 *   height, width, length → cm
 */

import type { ProductCategory } from "./types"

export interface PackageDimensions {
  weight: number  // kg
  height: number  // cm
  width:  number  // cm
  length: number  // cm
}

// Dimensões por unidade de cada categoria
const DIMENSOES: Record<ProductCategory, PackageDimensions> = {
  filme_35mm: { weight: 0.05, height: 3,  width: 3,  length: 7  },
  filme_120:  { weight: 0.05, height: 3,  width: 6,  length: 7  },
  camera:     { weight: 0.80, height: 12, width: 16, length: 14 },
  camera_recarregavel: { weight: 0.40, height: 10, width: 14, length: 12 },
  acessorio:  { weight: 0.20, height: 5,  width: 12, length: 12 },
  outro:      { weight: 0.30, height: 8,  width: 12, length: 14 },
}

// Embalagem mínima (caixa do envio) — usada como piso para o pacote agregado
const EMBALAGEM_MINIMA: PackageDimensions = {
  weight: 0.05,
  height: 4,
  width:  12,
  length: 17,
}

export function dimensoesDaCategoria(cat: ProductCategory): PackageDimensions {
  return DIMENSOES[cat] ?? DIMENSOES.outro
}

/**
 * Agrega itens do carrinho em um único pacote.
 * Estratégia simples e segura para o Melhor Envio:
 *   - peso = soma dos pesos
 *   - dimensões = a maior em cada eixo, respeitando a embalagem mínima
 *     (suficiente para a maioria dos casos de filmes/acessórios pequenos)
 */
export function agregarPacote(
  itens: { category: ProductCategory; quantity: number }[]
): PackageDimensions {
  let peso = EMBALAGEM_MINIMA.weight
  let altura = EMBALAGEM_MINIMA.height
  let largura = EMBALAGEM_MINIMA.width
  let comprimento = EMBALAGEM_MINIMA.length

  for (const item of itens) {
    const dim = dimensoesDaCategoria(item.category)
    peso += dim.weight * item.quantity
    // empilha altura (proxy simples de volume), mantém maior largura/comprimento
    altura += dim.height * item.quantity
    largura = Math.max(largura, dim.width)
    comprimento = Math.max(comprimento, dim.length)
  }

  return {
    weight: Number(peso.toFixed(2)),
    height: Math.min(altura, 100),       // teto de segurança
    width:  Math.min(largura, 100),
    length: Math.min(comprimento, 100),
  }
}
