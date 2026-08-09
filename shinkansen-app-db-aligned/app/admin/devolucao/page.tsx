import { redirect } from "next/navigation"

import { DevolucaoClient } from "@/components/admin/devolucao-client"
import { assertAdmin } from "@/lib/admin/revelacao"
import { fetchDevolucaoPorCliente } from "@/lib/admin/devolucao"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

export default async function DevolucaoPage() {
  const auth = await assertAdmin()
  if (!auth.ok) {
    redirect(auth.status === 401 ? "/auth/login" : "/dashboard")
  }

  const admin = createAdminClient()
  const clientes = await fetchDevolucaoPorCliente(admin)

  return <DevolucaoClient initialClientes={clientes} />
}
