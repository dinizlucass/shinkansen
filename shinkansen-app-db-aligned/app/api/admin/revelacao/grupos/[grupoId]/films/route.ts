import { z } from "zod"

import { jsonErr, jsonOk } from "@/lib/api/http"
import { assertAdmin, classeUnica, LIMITE_TANQUE } from "@/lib/admin/revelacao"
import { createAdminClient } from "@/lib/supabase/admin"

const bodySchema = z
  .object({
    add: z.array(z.string().uuid()).optional().default([]),
    remove: z.array(z.string().uuid()).optional().default([]),
  })
  .refine((d) => d.add.length > 0 || d.remove.length > 0, {
    message: "Nenhum filme para mover.",
  })

export async function POST(
  request: Request,
  context: { params: Promise<{ grupoId: string }> },
) {
  const auth = await assertAdmin()
  if (!auth.ok) return jsonErr(auth.message, auth.status)

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return jsonErr(parsed.error.issues[0]?.message ?? "Dados inválidos.", 400)
  }
  const { add, remove } = parsed.data
  const { grupoId } = await context.params

  const admin = createAdminClient()

  const { data: grupo, error: grupoError } = await admin
    .from("grupos_develop")
    .select("id, status, quimica")
    .eq("id", grupoId)
    .single()

  if (grupoError || !grupo) return jsonErr("Grupo não encontrado.", 404)

  // Remoções: devolve o filme para a fila (cadastrado, sem grupo)
  if (remove.length) {
    const { error } = await admin
      .from("films")
      .update({ grupo_id: null, status: "cadastrado" })
      .in("id", remove)
      .eq("grupo_id", grupoId)
    if (error) return jsonErr(error.message, 500, error.code)
  }

  // Adições: grupo precisa estar "revelando" e respeitar o limite do tanque
  if (add.length) {
    if (grupo.status !== "revelando") {
      return jsonErr("Grupo não está mais aceitando filmes.", 400)
    }
    const { count } = await admin
      .from("films")
      .select("id", { count: "exact", head: true })
      .eq("grupo_id", grupoId)

    if ((count ?? 0) + add.length > LIMITE_TANQUE) {
      return jsonErr(
        `Grupo cheio — limite de ${LIMITE_TANQUE} filmes atingido.`,
        400,
      )
    }

    // Regra de ouro: filmes novos precisam ser compatíveis com a química do
    // grupo e com os filmes já presentes (D76 não mistura com C41/ECN2).
    const { data: novos } = await admin
      .from("films")
      .select("film_type")
      .in("id", add)
    const { data: atuais } = await admin
      .from("films")
      .select("film_type")
      .eq("grupo_id", grupoId)
    const tipos = [
      grupo.quimica,
      ...(novos ?? []).map((f: { film_type: string | null }) => f.film_type),
      ...(atuais ?? []).map((f: { film_type: string | null }) => f.film_type),
    ]
    if (!classeUnica(tipos).ok) {
      return jsonErr(
        "Mistura proibida: D76 (P&B) não pode revelar junto com C41/ECN2.",
        400,
      )
    }

    const { error } = await admin
      .from("films")
      .update({ grupo_id: grupoId, status: "revelando" })
      .in("id", add)
    if (error) return jsonErr(error.message, 500, error.code)
  }

  return jsonOk({ adicionados: add.length, removidos: remove.length })
}
