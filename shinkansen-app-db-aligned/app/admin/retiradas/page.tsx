import { redirect } from "next/navigation"

import { RetiradasClient } from "@/components/admin/retiradas-client"
import { assertAdmin } from "@/lib/admin/revelacao"
import { fetchRetiradas } from "@/lib/admin/retiradas"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

export default async function RetiradasPage() {
  const auth = await assertAdmin()
  if (!auth.ok) {
    redirect(auth.status === 401 ? "/auth/login" : "/dashboard")
  }

  const admin = createAdminClient()
  const pedidos = await fetchRetiradas(admin)

  return <RetiradasClient initialPedidos={pedidos} />
}
