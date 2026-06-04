/**
 * app/store/page.tsx
 *
 * Página da loja. Busca produtos ativos no servidor e passa para o StoreClient.
 */

import { createClient } from "@/lib/supabase/server"
import { StoreClient }  from "@/components/store/store-client"
import type { Product } from "@/lib/store/types"

export const revalidate = 60 // produtos podem mudar de estoque com frequência

interface ProductRow {
  id:             string
  name:           string
  description:    string | null
  price:          number
  category:       Product["category"]
  stock_quantity: number
  active:         boolean
  thumb_url:      string | null
  image_url:      string | null
  example_url:    string | null
  iso:            number | null
  exposures:      number | null
  film_format:    string | null
  brand:          string | null
  process:        string | null
}

const PLACEHOLDER = "/store/placeholder.jpg"

/**
 * Converte links do Google Drive para o formato de imagem direta.
 * Aceita tanto /file/d/ID/view quanto /open?id=ID e retorna a URL thumbnail,
 * que é a mais confiável para tags <img>.
 */
function normalizarUrl(url: string | null, largura = 1000): string | null {
  if (!url) return null

  // Extrai o FILE_ID de qualquer formato de link do Drive
  const match =
    url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    url.match(/[?&]id=([a-zA-Z0-9_-]+)/)

  if (match) {
    return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w${largura}`
  }
  // Não é Drive — retorna como está (ex: já é Vercel Blob ou placehold.co)
  return url
}

function montarImagens(r: ProductRow): Product["images"] {
  return {
    thumb:   normalizarUrl(r.thumb_url, 600)    ?? normalizarUrl(r.image_url, 600)  ?? PLACEHOLDER,
    package: normalizarUrl(r.image_url, 1000)   ?? normalizarUrl(r.thumb_url, 1000) ?? PLACEHOLDER,
    sample:  normalizarUrl(r.example_url, 1000) ?? normalizarUrl(r.image_url, 1000) ?? PLACEHOLDER,
  }
}

export default async function StorePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: rows } = await supabase
    .from("products")
    .select("*")
    .eq("active", true)
    .order("category", { ascending: true })
    .order("name",     { ascending: true })

  // Busca dados do perfil para pré-preencher o checkout
  let perfil: { adress: string | null; cpf: string | null } | null = null
  let negativosPendentes = 0
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("adress, cpf")
      .eq("id", user.id)
      .single()
    perfil = data ?? null

    // Conta negativos prontos para devolução: filmes concluídos do cliente
    // que ainda não foram enviados, embalados ou descartados.
    // O vínculo cliente→filme passa por orders (films.order_id → orders.client_id).
    const { data: pedidosCliente } = await supabase
      .from("orders")
      .select("id")
      .eq("client_id", user.id)

    const orderIds = (pedidosCliente ?? []).map((o) => o.id)
    if (orderIds.length > 0) {
      const { count } = await supabase
        .from("films")
        .select("id", { count: "exact", head: true })
        .in("order_id", orderIds)
        .eq("status", "concluido")
      negativosPendentes = count ?? 0
    }
  }

  const products: Product[] = (rows ?? []).map((r: ProductRow) => ({
    id:             r.id,
    name:           r.name,
    description:    r.description,
    price:          Number(r.price),
    category:       r.category,
    stock_quantity: r.stock_quantity,
    active:         r.active,
    images:         montarImagens(r),
    iso:            r.iso,
    exposures:      r.exposures,
    film_format:    r.film_format,
    brand:          r.brand,
    process:        r.process,
  }))

  return <StoreClient user={user} products={products} perfil={perfil} negativosPendentes={negativosPendentes} />
}