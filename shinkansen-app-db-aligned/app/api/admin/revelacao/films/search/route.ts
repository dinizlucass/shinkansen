import { jsonErr, jsonOk } from "@/lib/api/http"
import { assertAdmin } from "@/lib/admin/revelacao"
import { createAdminClient } from "@/lib/supabase/admin"

const FILM_COLS = "id, id_humano, name, status, film_type, push_pull, notes, grupo_id"

export async function GET(request: Request) {
  const auth = await assertAdmin()
  if (!auth.ok) return jsonErr(auth.message, auth.status)

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim()
  if (!q) return jsonOk({ films: [] })

  const admin = createAdminClient()

  // Numérico → busca por id_humano; senão por nome (ilike)
  const asNumber = Number.parseInt(q, 10)
  const query = admin.from("films").select(FILM_COLS).limit(30)

  const { data, error } = /^\d+$/.test(q)
    ? await query.eq("id_humano", asNumber)
    : await query.ilike("name", `%${q}%`)

  if (error) return jsonErr(error.message, 500, error.code)
  return jsonOk({ films: data ?? [] })
}
