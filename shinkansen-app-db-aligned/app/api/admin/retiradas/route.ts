import { jsonErr, jsonOk } from "@/lib/api/http"
import { assertAdmin } from "@/lib/admin/revelacao"
import { fetchRetiradas } from "@/lib/admin/retiradas"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  const auth = await assertAdmin()
  if (!auth.ok) return jsonErr(auth.message, auth.status)

  const admin = createAdminClient()
  const pedidos = await fetchRetiradas(admin)
  return jsonOk({ pedidos })
}
