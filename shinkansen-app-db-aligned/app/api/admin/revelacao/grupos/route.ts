import { z } from "zod"

import { jsonErr, jsonOk } from "@/lib/api/http"
import {
  assertAdmin,
  classeCompat,
  classeUnica,
  LIMITE_TANQUE,
  proximoIdCaixa,
  QUIMICAS,
} from "@/lib/admin/revelacao"
import { createAdminClient } from "@/lib/supabase/admin"

const createGrupoSchema = z.object({
  quimica: z.enum(QUIMICAS),
  push_pull: z.string().trim().default("0"),
  film_ids: z.array(z.string().uuid()).max(LIMITE_TANQUE).optional().default([]),
})

export async function POST(request: Request) {
  const auth = await assertAdmin()
  if (!auth.ok) return jsonErr(auth.message, auth.status)

  const body = await request.json().catch(() => null)
  const parsed = createGrupoSchema.safeParse(body)
  if (!parsed.success) {
    return jsonErr(parsed.error.issues[0]?.message ?? "Dados inválidos.", 400)
  }
  const { quimica, push_pull, film_ids } = parsed.data

  if (film_ids.length > LIMITE_TANQUE) {
    return jsonErr(`Limite de ${LIMITE_TANQUE} filmes por grupo.`, 400)
  }

  const admin = createAdminClient()

  // Regra de ouro: os filmes selecionados precisam ser compatíveis entre si
  // e com a química escolhida (D76 não mistura com C41/ECN2).
  if (film_ids.length) {
    const { data: filmes } = await admin
      .from("films")
      .select("film_type")
      .in("id", film_ids)
    const tipos = (filmes ?? []).map((f: { film_type: string | null }) => f.film_type)
    const { ok, classe } = classeUnica([...tipos, quimica])
    if (!ok) {
      return jsonErr(
        "Mistura proibida: D76 (P&B) não pode revelar junto com C41/ECN2.",
        400,
      )
    }
    const classeQuimica = classeCompat(quimica)
    if (classe && classeQuimica && classe !== classeQuimica) {
      return jsonErr(
        `Os filmes selecionados não combinam com a química ${quimica.toUpperCase()}.`,
        400,
      )
    }
  }

  const id = crypto.randomUUID()
  const id_caixa = await proximoIdCaixa(admin)

  const { data: grupo, error: grupoError } = await admin
    .from("grupos_develop")
    .insert({
      id,
      id_caixa,
      quimica,
      push_pull,
      status: "revelando",
      criado_em: new Date().toISOString(),
    })
    .select("id, id_caixa, quimica, push_pull, status, criado_em")
    .single()

  if (grupoError) return jsonErr(grupoError.message, 500, grupoError.code)

  if (film_ids.length) {
    const { error: filmError } = await admin
      .from("films")
      .update({ grupo_id: id, status: "revelando" })
      .in("id", film_ids)

    if (filmError) return jsonErr(filmError.message, 500, filmError.code)
  }

  return jsonOk({ grupo, adicionados: film_ids.length })
}
