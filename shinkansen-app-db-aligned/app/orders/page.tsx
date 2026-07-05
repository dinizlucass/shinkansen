import { redirect } from "next/navigation"

import { getProfileDefaults } from "@/lib/profile-bootstrap"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isProfileComplete } from "@/lib/profile-completion"
import { OrderFormClient } from "@/components/orders/order-form-client"

export default async function OrdersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Logado: exige perfil completo antes de pedir.
  // Deslogado: segue no formulário — a conta é criada junto com o pedido
  // (cadastro embutido no passo final).
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", user.id)
      .single()

    const hydratedProfile = getProfileDefaults(user, profile)

    if (!isProfileComplete(hydratedProfile)) {
      redirect("/account?completeProfile=1")
    }
  }

  // Catálogo de serviços (leitura pública) via admin, para funcionar também
  // para visitantes que ainda não têm conta.
  const admin = createAdminClient()
  const { data: services } = await admin
    .from("services")
    .select("id, name, description, price, category, ui_id")
    .eq("active", true)
    .order("name")

  return <OrderFormClient user={user} services={services || []} />
}
