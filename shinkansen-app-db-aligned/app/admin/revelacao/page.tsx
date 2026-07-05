import { redirect } from "next/navigation"

import { RevelacaoClient } from "@/components/admin/revelacao-client"
import { assertAdmin, fetchFilaEGrupos } from "@/lib/admin/revelacao"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

export default async function RevelacaoPage() {
  const auth = await assertAdmin()
  if (!auth.ok) {
    redirect(auth.status === 401 ? "/auth/login" : "/dashboard")
  }

  const admin = createAdminClient()
  const { fila, grupos } = await fetchFilaEGrupos(admin)

  return <RevelacaoClient initialFila={fila} initialGrupos={grupos} />
}
