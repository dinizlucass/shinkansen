import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminDashboardClient } from "@/components/admin/admin-dashboard-client"

export default async function AdminPage() {
  const supabase = await createClient()

  // Verify user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) {
    redirect("/dashboard")
  }

  // Fetch orders
  const { data: orders } = await supabase
    .from("orders")
    .select(
      `
      id,
      client_id,
      status,
      total_value,
      photo_link,
      created_at,
      notes,
      profiles ( id, full_name, email, phone, photo_link ),
      films (
        id,
        name,
        status,
        film_type,
        push_pull,
        notes,
        file_format,
        created_at,
        film_services (
          service_id,
          services ( id, name, price, category )
        )
      )
    `
    )
    .order("created_at", { ascending: false })

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, role, is_admin, photo_link, created_at")
    .order("created_at", { ascending: false })

  // Stats (orders)
  const { count: totalOrders } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })

  const { count: createdOrders } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "criado")

  const { count: receivedOrders } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "recebido")

  const { count: awaitingPaymentOrders } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "aguardando_pagamento")

  const { count: paidOrders } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "pago")

  const { count: finishedOrders } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "finalizado")

  return (
    <AdminDashboardClient
      orders={orders || []}
      users={profiles || []}
      stats={{
        totalOrders: totalOrders || 0,
        createdOrders: createdOrders || 0,
        receivedOrders: receivedOrders || 0,
        awaitingPaymentOrders: awaitingPaymentOrders || 0,
        paidOrders: paidOrders || 0,
        finishedOrders: finishedOrders || 0,
      }}
    />
  )
}
