/**
 * lib/store/types.ts
 *
 * Tipos compartilhados da loja.
 */

export type ProductCategory =
  | "filme_35mm"
  | "filme_120"
  | "camera"
  | "camera_recarregavel"
  | "acessorio"
  | "outro"

export interface ProductImages {
  thumb:   string  // miniatura para o grid de seleção
  package: string  // foto da embalagem/rótulo
  sample:  string  // foto de exemplo (resultado do filme)
}

export interface Product {
  id:             string
  name:           string
  description:    string | null
  price:          number
  category:       ProductCategory
  stock_quantity: number
  active:         boolean
  images:         ProductImages
  // atributos de filme (null para acessórios)
  iso:            number | null
  exposures:      number | null
  film_format:    string | null
  brand:          string | null
  process:        string | null
}

export interface CartItem {
  product:  Product
  quantity: number
}

export type DeliveryType = "envio" | "retirada"

export interface Coupon {
  id:        string
  code:      string
  discount:  number
  min_order: number
}