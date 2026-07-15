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

  // A busca vem da etiqueta: aceita SOMENTE código base-36 (hexatrigesimal) do
  // id_humano. "20" → 72, "1Z" → 71. Qualquer outra coisa não é um código válido.
  const token = q.replace(/^#/, "").toLowerCase()
  if (!/^[0-9a-z]+$/.test(token)) return jsonOk({ films: [] })
  const idBase36 = Number.parseInt(token, 36)
  if (!Number.isFinite(idBase36)) return jsonOk({ films: [] })

  const { data, error } = await admin
    .from("films")
    .select(FILM_COLS)
    .eq("id_humano", idBase36)
    .limit(30)

  if (error) return jsonErr(error.message, 500, error.code)
  return jsonOk({ films: data ?? [] })
}
