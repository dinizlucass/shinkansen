import { redirect } from "next/navigation"

import { getProfileDefaults } from "@/lib/profile-bootstrap"
import { createClient } from "@/lib/supabase/server"
import { isProfileComplete } from "@/lib/profile-completion"
import { OrderFormClient } from "@/components/orders/order-form-client"

export default async function OrdersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("id", user.id)
    .single()

  const hydratedProfile = getProfileDefaults(user, profile)

  if (!isProfileComplete(hydratedProfile)) {
    redirect("/account?completeProfile=1")
  }

  const { data: services } = await supabase
    .from("services")
    .select("id, name, description, price, category")
    .eq("active", true)
    .order("name")

  return <OrderFormClient user={user} services={services || []} />
}
