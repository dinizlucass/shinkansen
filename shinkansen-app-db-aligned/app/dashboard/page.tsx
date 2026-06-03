/**
 * app/dashboard/page.tsx
 *
 * Página da dashboard com toggle Serviços/Loja.
 * - Serviços: pedidos de revelação (orders + films)
 * - Loja: pedidos de compra (store_orders + items + negativos incluídos)
 */

import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

import { AnimatedLogo } from "@/components/animated-logo"
import { GameMenuNav } from "@/components/game-menu-nav"
import { LogoutButton } from "@/components/logout-button"
import { ServicosContent } from "@/components/dashboard/dashboard-client"
import { StoreDashboardClient, type StoreOrder } from "@/components/store-dashboard-client"
import { DashboardTabs } from "@/components/dashboard-tabs"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  // ── Perfil ──
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, phone, photo_link")
    .eq("id", user.id)
    .single()

  // ── Pedidos de serviço (revelação) ──
  const { data: orders } = await supabase
    .from("orders")
    .select(`
      id, status, total_value, photo_link, payment_status, payment_link_url,
      payment_last_payload, created_at, notes,
      films (
        id, name, film_type, push_pull, notes, file_format, status, created_at,
        film_services ( service_id, price, services ( id, name, price ) )
      )
    `)
    .eq("client_id", user.id)
    .order("created_at", { ascending: false })

  // ── Pedidos da loja ──
  const { data: storeRows } = await supabase
    .from("store_orders")
    .select(`
      id, status, total_value, coupon_discount, delivery_type, shipping_address,
      shipping_cost, shipping_service, shipping_deadline, shipping_cep, tracking_code,
      payment_status, payment_last_payload,
      created_at, film_ids,
      store_order_items (
        id, quantity, unit_price,
        products ( name, category )
      )
    `)
    .eq("client_id", user.id)
    .order("created_at", { ascending: false })

  // Busca os negativos incluídos (film_ids) de todos os pedidos da loja
  const todosFilmIds = (storeRows ?? []).flatMap((o) => o.film_ids ?? [])
  let filmesPorId: Record<string, { id: string; name: string; status: string }> = {}
  if (todosFilmIds.length > 0) {
    const { data: filmes } = await supabase
      .from("films")
      .select("id, name, status")
      .in("id", todosFilmIds)
    filmesPorId = Object.fromEntries((filmes ?? []).map((f) => [f.id, f]))
  }

  const storeOrders: StoreOrder[] = (storeRows ?? []).map((o: any) => ({
    id:                o.id,
    status:            o.status,
    total_value:       o.total_value,
    coupon_discount:   o.coupon_discount,
    delivery_type:     o.delivery_type,
    shipping_address:  o.shipping_address,
    shipping_cost:     o.shipping_cost,
    shipping_service:  o.shipping_service,
    shipping_deadline: o.shipping_deadline,
    shipping_cep:      o.shipping_cep,
    tracking_code:     o.tracking_code,
    payment_status:    o.payment_status,
    payment_last_payload: o.payment_last_payload,
    created_at:        o.created_at,
    items: (o.store_order_items ?? []).map((it: any) => ({
      id:         it.id,
      quantity:   it.quantity,
      unit_price: Number(it.unit_price),
      product:    it.products ? { name: it.products.name, category: it.products.category } : null,
    })),
    films: (o.film_ids ?? [])
      .map((id: string) => filmesPorId[id])
      .filter(Boolean),
  }))

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/">
            <AnimatedLogo className="w-40 h-auto" />
          </Link>
          <div className="flex items-center gap-4">
            <GameMenuNav user={user} variant="horizontal" />
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <DashboardTabs
          servicosSlot={<ServicosContent orders={(orders as any) ?? []} profile={profile ?? null} />}
          lojaSlot={<StoreDashboardClient orders={storeOrders} />}
        />
      </main>
    </div>
  )
}