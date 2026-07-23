import { z } from "zod"

import { jsonErr, jsonOk } from "@/lib/api/http"
import { assertAdmin, classeUnica, QUIMICAS } from "@/lib/admin/revelacao"
import { createAdminClient } from "@/lib/supabase/admin"

const updateGrupoSchema = z
  .object({
    status: z.enum(["revelando", "concluido"]).optional(),
    quimica: z.enum(QUIMICAS).optional(),
    push_pull: z.string().trim().optional(),
  })
  .refine(
    (d) =>
      d.status !== undefined ||
      d.quimica !== undefined ||
      d.push_pull !== undefined,
    { message: "Nenhum campo para atualizar foi enviado." },
  )

export async function PATCH(
  request: Request,
  context: { params: Promise<{ grupoId: string }> },
) {
  const auth = await assertAdmin()
  if (!auth.ok) return jsonErr(auth.message, auth.status)

  const body = await request.json().catch(() => null)
  const parsed = updateGrupoSchema.safeParse(body)
  if (!parsed.success) {
    return jsonErr(parsed.error.issues[0]?.message ?? "Dados inválidos.", 400)
  }

  const { grupoId } = await context.params
  const admin = createAdminClient()

  // Se mudar a química, garante que ela não conflita com os filmes já no grupo.
  if (parsed.data.quimica !== undefined) {
    const { data: atuais } = await admin
      .from("films")
      .select("film_type")
      .eq("grupo_id", grupoId)
    const tipos = [
      parsed.data.quimica,
      ...(atuais ?? []).map((f: { film_type: string | null }) => f.film_type),
    ]
    if (!classeUnica(tipos).ok) {
      return jsonErr(
        "A química escolhida conflita com os filmes já no grupo (D76 x C41/ECN2).",
        400,
      )
    }
  }

  const updates: { status?: string; quimica?: string; push_pull?: string } = {}
  if (parsed.data.status !== undefined) updates.status = parsed.data.status
  if (parsed.data.quimica !== undefined) updates.quimica = parsed.data.quimica
  if (parsed.data.push_pull !== undefined) updates.push_pull = parsed.data.push_pull

  const { data, error } = await admin
    .from("grupos_develop")
    .update(updates)
    .eq("id", grupoId)
    .select("id, id_caixa, quimica, push_pull, status, criado_em")
    .single()

  if (error) return jsonErr(error.message, 500, error.code)
  if (!data) return jsonErr("Grupo não encontrado.", 404)

  // Ao concluir a caixa, promove a "concluido" os filmes APENAS-REVELAÇÃO
  // (sem nenhum serviço de digitalização). Filmes com digitalização seguem
  // o fluxo normal de scanner/edição/upload e não são tocados.
  if (parsed.data.status === "concluido") {
    await promoverApenasRevelacao(admin, grupoId)
  }

  return jsonOk(data)
}

const STATUS_TERMINAIS = new Set([
  "concluido", "virgem", "velado", "descartado",
  "suporte", "limpeza", "enviado", "embalado",
])

async function promoverApenasRevelacao(
  admin: ReturnType<typeof createAdminClient>,
  grupoId: string,
) {
  const { data: filmes } = await admin
    .from("films")
    .select("id, status")
    .eq("grupo_id", grupoId)

  const ids = (filmes ?? []).map((f: { id: string }) => f.id)
  if (!ids.length) return

  const { data: comDig } = await admin
    .from("film_services")
    .select("film_id, services!inner(category)")
    .in("film_id", ids)
    .eq("services.category", "digitalizacao")

  const setDig = new Set((comDig ?? []).map((r: { film_id: string }) => r.film_id))

  const promover = (filmes ?? [])
    .filter(
      (f: { id: string; status: string | null }) =>
        !setDig.has(f.id) && !STATUS_TERMINAIS.has(f.status ?? ""),
    )
    .map((f: { id: string }) => f.id)

  if (promover.length) {
    await admin.from("films").update({ status: "concluido" }).in("id", promover)
  }
}
