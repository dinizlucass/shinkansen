import { z } from "zod"
import { Resend } from "resend"

import { jsonErr, jsonOk } from "@/lib/api/http"
import { assertAdmin, MAX_OBSERVACAO, STATUS_FILME } from "@/lib/admin/revelacao"
import { createAdminClient } from "@/lib/supabase/admin"

// Status de devolução dos negativos que disparam e-mail automático ao cliente.
const NOTIFICA = {
  embalado: "foram embalados e serão devolvidos em breve.",
  enviado:  "foram enviados pelos Correios e estão a caminho.",
  retirado: "foram retirados no balcão. Obrigado!",
} as const

async function notificarFilme(
  admin: ReturnType<typeof createAdminClient>,
  film: { name: string | null; order_id?: string | null },
  status: string,
) {
  const apiKey = process.env.RESEND_API_KEY
  const frase = (NOTIFICA as Record<string, string>)[status]
  if (!apiKey || !frase || !film.order_id) return
  const { data: order } = await admin
    .from("orders").select("client_id").eq("id", film.order_id).single()
  if (!order?.client_id) return
  const { data: perfil } = await admin
    .from("profiles").select("full_name, email").eq("id", order.client_id).single()
  const email = perfil?.email?.trim()
  if (!email) return
  const nome = perfil?.full_name?.trim() || "cliente"
  const resend = new Resend(apiKey)
  const from = `Shinkansen Films <${process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev"}>`
  const replyTo = process.env.RESEND_REPLY_TO || undefined
  await resend.emails.send({
    from, to: email,
    subject: `Negativos do filme ${film.name ?? ""} — ${status}`,
    html: `<p>Olá, ${nome}.</p><p>Os negativos do filme <b>${film.name ?? "—"}</b> ${frase}</p>`,
    ...(replyTo ? { replyTo } : {}),
  })
}

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
    .select("id, id_humano, name, status, film_type, push_pull, notes, grupo_id, order_id")
    .single()

  if (error) return jsonErr(error.message, 500, error.code)
  if (!data) return jsonErr("Filme não encontrado.", 404)

  // Notificação automática ao cliente nas etapas de devolução dos negativos.
  if (parsed.data.status && parsed.data.status in NOTIFICA) {
    try {
      await notificarFilme(admin, data, parsed.data.status)
    } catch (e) {
      console.error("Falha ao notificar status do filme", e)
    }
  }

  return jsonOk(data)
}
