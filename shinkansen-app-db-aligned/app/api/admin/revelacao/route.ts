import { jsonErr, jsonOk } from "@/lib/api/http"
import { assertAdmin, fetchFilaEGrupos } from "@/lib/admin/revelacao"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(request: Request) {
  const auth = await assertAdmin()
  if (!auth.ok) return jsonErr(auth.message, auth.status)

  const todosGrupos =
    new URL(request.url).searchParams.get("grupos") === "todos"

  const admin = createAdminClient()
  const data = await fetchFilaEGrupos(admin, { todosGrupos })
  return jsonOk(data)
}
