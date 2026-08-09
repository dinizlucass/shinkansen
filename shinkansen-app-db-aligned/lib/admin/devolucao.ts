import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

// Fases de devolução dos negativos (paridade com routers/admin.py do local:
// _FASES_DEVOLUCAO). "retirado" é o estado final do fluxo de retirada.
export const FASES_DEVOLUCAO = [
  "concluido",
  "embalado",
  "enviado",
  "retirado",
] as const
export type FaseDevolucao = (typeof FASES_DEVOLUCAO)[number]

export type FilmeDevolucao = {
  id: string
  id_humano: number | null
  name: string | null
  status: string | null
}

export type PedidoDevolucao = {
  id: string
  created_at: string | null
  status: string | null
  films: FilmeDevolucao[]
}

export type ClienteDevolucao = {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  pedidos: PedidoDevolucao[]
  pendentes: number // nº de filmes ainda não retirados
}

/**
 * Filmes cujos negativos estão no fluxo de devolução, agrupados por
 * cliente → pedido. Inclui filmes já "retirado" (histórico), mas o campo
 * `pendentes` conta só os que faltam retirar (concluido/embalado/enviado).
 *
 * Busca em etapas (films → orders → profiles) e junta em JS, para não
 * depender do nome das relações FK no PostgREST.
 */
export async function fetchDevolucaoPorCliente(
  admin: SupabaseClient,
): Promise<ClienteDevolucao[]> {
  const { data: films } = await admin
    .from("films")
    .select("id, id_humano, name, status, order_id")
    .in("status", FASES_DEVOLUCAO as unknown as string[])
    .order("id_humano", { ascending: true, nullsFirst: false })

  const filmes = (films ?? []) as Array<{
    id: string
    id_humano: number | null
    name: string | null
    status: string | null
    order_id: string | null
  }>
  if (!filmes.length) return []

  const orderIds = [
    ...new Set(filmes.map((f) => f.order_id).filter((v): v is string => !!v)),
  ]

  const { data: orders } = orderIds.length
    ? await admin
        .from("orders")
        .select("id, created_at, status, client_id")
        .in("id", orderIds)
    : { data: [] as Array<{ id: string; created_at: string | null; status: string | null; client_id: string | null }> }

  const pedidos = (orders ?? []) as Array<{
    id: string
    created_at: string | null
    status: string | null
    client_id: string | null
  }>
  const orderMap = new Map(pedidos.map((o) => [o.id, o]))

  const clientIds = [
    ...new Set(pedidos.map((o) => o.client_id).filter((v): v is string => !!v)),
  ]

  const { data: perfis } = clientIds.length
    ? await admin
        .from("profiles")
        .select("id, full_name, email, phone")
        .in("id", clientIds)
    : { data: [] as Array<{ id: string; full_name: string | null; email: string | null; phone: string | null }> }

  const perfilMap = new Map(
    (perfis ?? []).map((p) => [p.id, p]),
  )

  // cliente_id → pedido_id → PedidoDevolucao
  const clientes = new Map<string, ClienteDevolucao>()

  for (const f of filmes) {
    const pedido = f.order_id ? orderMap.get(f.order_id) : null
    if (!pedido) continue
    const clientId = pedido.client_id
    if (!clientId) continue

    let cliente = clientes.get(clientId)
    if (!cliente) {
      const perfil = perfilMap.get(clientId)
      cliente = {
        id: clientId,
        full_name: perfil?.full_name ?? null,
        email: perfil?.email ?? null,
        phone: perfil?.phone ?? null,
        pedidos: [],
        pendentes: 0,
      }
      clientes.set(clientId, cliente)
    }

    let ped = cliente.pedidos.find((p) => p.id === pedido.id)
    if (!ped) {
      ped = {
        id: pedido.id,
        created_at: pedido.created_at,
        status: pedido.status,
        films: [],
      }
      cliente.pedidos.push(ped)
    }

    ped.films.push({
      id: f.id,
      id_humano: f.id_humano,
      name: f.name,
      status: f.status,
    })
    if (f.status !== "retirado") cliente.pendentes += 1
  }

  // Ordena: clientes com mais pendentes primeiro; pedidos por data desc.
  const lista = [...clientes.values()]
  for (const c of lista) {
    c.pedidos.sort((a, b) =>
      (b.created_at ?? "").localeCompare(a.created_at ?? ""),
    )
  }
  lista.sort((a, b) => b.pendentes - a.pendentes)
  return lista
}
