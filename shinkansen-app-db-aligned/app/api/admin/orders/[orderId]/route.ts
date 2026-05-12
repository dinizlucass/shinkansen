import { z } from "zod"

import { jsonErr, jsonOk } from "@/lib/api/http"
import { updateOrderFields } from "@/lib/orders/update-order"
import { createClient } from "@/lib/supabase/server"
import { orderStatusEnum } from "@/lib/validators/orders"

const updateAdminOrderSchema = z
  .object({
    status: orderStatusEnum.optional(),
    photoLink: z.string().trim().url().nullable().optional(),
  })
  .refine((data) => data.status !== undefined || data.photoLink !== undefined, {
    message: "Nenhum campo para atualizar foi enviado.",
  })

export async function PATCH(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return jsonErr("Voce precisa estar logado.", 401)
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (profileError || !profile?.is_admin) {
    return jsonErr("Acesso negado.", 403)
  }

  const body = await request.json().catch(() => null)
  const parsed = updateAdminOrderSchema.safeParse({
    status: body?.status,
    photoLink:
      typeof body?.photoLink === "string"
        ? body.photoLink.trim() || null
        : body?.photoLink === null
          ? null
          : undefined,
  })

  if (!parsed.success) {
    return jsonErr(parsed.error.issues[0]?.message ?? "Dados invalidos para atualizar o pedido.", 400)
  }

  const { orderId } = await context.params
  const result = await updateOrderFields(orderId, {
    status: parsed.data.status,
    photoLink: parsed.data.photoLink,
  })

  if (!result.ok) {
    return jsonErr(result.error.message, result.error.status, result.error.code)
  }

  return jsonOk(result.data)
}
