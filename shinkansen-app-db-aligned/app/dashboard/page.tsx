import { redirect } from "next/navigation"
import { getProfileDefaults } from "@/lib/profile-bootstrap"
import { createClient } from "@/lib/supabase/server"
import { DashboardClient } from "@/components/dashboard/dashboard-client"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Fetch user's orders
  const { data: orders } = await supabase
    .from("orders")
    .select(`
      id,
      status,
      total_value,
      photo_link,
      payment_status,
      payment_link_url,
      payment_last_payload,
      created_at,
      notes,
      films (
        id,
        name,
        film_type,
        push_pull,
        notes,
        scan_type,
        file_format,
        status,
        created_at,
        film_services (
          service_id,
          price,
          services ( id, name, price )
        )
      )
    `)
    .eq("client_id", user.id)
    .order("created_at", { ascending: false })

  // Fetch user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, phone, photo_link")
    .eq("id", user.id)
    .single()

  const hydratedProfile = profile
    ? { ...profile, ...getProfileDefaults(user, profile) }
    : { id: user.id, ...getProfileDefaults(user, null) }

  return (
    <DashboardClient 
      user={user} 
      orders={orders || []} 
      profile={hydratedProfile}
    />
  )
}
