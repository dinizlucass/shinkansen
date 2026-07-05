import { z } from "zod"

import { jsonErr, jsonOk } from "@/lib/api/http"
import { assertAdmin, MAX_OBSERVACAO, STATUS_FILME } from "@/lib/admin/revelacao"
import { createAdminClient } from "@/lib/supabase/admin"

const updateFilmSchema = z
  .object({
    status: z.enum(STATUS_FILME).optional(),
    notes: z.string().trim().max(MAX_OBSERVACAO).nullable().optional(),
  })
  .refine((d) => d.status !== undefined || d.notes !== undefined, {
    message: "Nenhum campo para atualizar foi enviado.",
  })

export async function PATCH(
  request: Request,
  context: { params: Promise<{ filmId: string }> },
) {
  const auth = await assertAdmin()
  if (!auth.ok) return jsonErr(auth.message, auth.status)

  const body = await request.json().catch(() => null)
  const parsed = updateFilmSchema.safeParse({
    status: body?.status,
    notes:
      typeof body?.notes === "string"
        ? body.notes
        : body?.notes === null
          ? null
          : undefined,
  })

  if (!parsed.success) {
    return jsonErr(
      parsed.error.issues[0]?.message ?? "Dados inválidos.",
      400,
    )
  }

  const { filmId } = await context.params
  const updates: { status?: string; notes?: string | null } = {}
  if (parsed.data.status !== undefined) updates.status = parsed.data.status
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("films")
    .update(updates)
    .eq("id", filmId)
    .select("id, id_humano, name, status, film_type, push_pull, notes, grupo_id")
    .single()

  if (error) return jsonErr(error.message, 500, error.code)
  if (!data) return jsonErr("Filme não encontrado.", 404)

  return jsonOk(data)
}
