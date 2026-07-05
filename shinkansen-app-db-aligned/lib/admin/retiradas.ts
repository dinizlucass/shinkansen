import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

export type ItemRetirada = {
  id: string
  product_id: string
  product_name: string
  quantity: number
  unit_price: number | null
}

export type PedidoRetirada = {
  id: string
  client_id: string | null
  status: string
  payment_status: string | null
  payment_link_url: string | null
  payment_charge_id: string | null
  total_value: number | null
  shipping_cost: number | null
  created_at: string | null
  cliente: {
    id: string
    full_name: string | null
    email: string | null
    phone: string | null
  } | null
  itens: ItemRetirada[]
}

/** Lista todos os pedidos da loja marcados como retirada, com cliente e itens. */
export async function fetchRetiradas(
  admin: SupabaseClient,
): Promise<PedidoRetirada[]> {
  const { data: orders } = await admin
    .from("store_orders")
    .select(
      "id, client_id, status, payment_status, payment_link_url, payment_charge_id, total_value, shipping_cost, created_at, delivery_type",
    )
    .eq("delivery_type", "retirada")
    .order("created_at", { ascending: false })

  const pedidos = orders ?? []
  if (!pedidos.length) return []

  const clientIds = [
    ...new Set(
      pedidos
        .map((o: { client_id: string | null }) => o.client_id)
        .filter((v): v is string => !!v),
    ),
  ]
  const orderIds = pedidos.map((o: { id: string }) => o.id)

  const { data: perfis } = clientIds.length
    ? await admin
        .from("profiles")
        .select("id, full_name, email, phone")
        .in("id", clientIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null; phone: string | null }[] }

  const { data: itens } = await admin
    .from("store_order_items")
    .select("id, store_order_id, product_id, quantity, unit_price")
    .in("store_order_id", orderIds)

  const prodIds = [
    ...new Set((itens ?? []).map((i: { product_id: string }) => i.product_id)),
  ]
  const { data: prods } = prodIds.length
    ? await admin.from("products").select("id, name").in("id", prodIds)
    : { data: [] as { id: string; name: string }[] }

  const perfilMap = new Map((perfis ?? []).map((p) => [p.id, p]))
  const prodMap = new Map((prods ?? []).map((p) => [p.id, p.name]))

  return pedidos.map((o: Record<string, unknown>) => ({
    id: o.id as string,
    client_id: (o.client_id as string) ?? null,
    status: (o.status as string) ?? "pendente",
    payment_status: (o.payment_status as string) ?? null,
    payment_link_url: (o.payment_link_url as string) ?? null,
    payment_charge_id: (o.payment_charge_id as string) ?? null,
    total_value: (o.total_value as number) ?? null,
    shipping_cost: (o.shipping_cost as number) ?? null,
    created_at: (o.created_at as string) ?? null,
    cliente: perfilMap.get(o.client_id as string) ?? null,
    itens: (itens ?? [])
      .filter((i: { store_order_id: string }) => i.store_order_id === o.id)
      .map((i: { id: string; product_id: string; quantity: number; unit_price: number | null }) => ({
        id: i.id,
        product_id: i.product_id,
        product_name: prodMap.get(i.product_id) ?? "Produto",
        quantity: i.quantity,
        unit_price: i.unit_price,
      })),
  }))
}
