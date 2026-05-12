import { z } from "zod"

import { requireAdminApiUser } from "@/lib/auth/admin-api"
import { jsonErr, jsonOk } from "@/lib/api/http"
import { updateOrderFields } from "@/lib/orders/update-order"
import { orderStatusEnum } from "@/lib/validators/orders"

const updateExternalOrderSchema = z
  .object({
    status: orderStatusEnum.optional(),
    photoLink: z.string().trim().url().nullable().optional(),
  })
  .refine((data) => data.status !== undefined || data.photoLink !== undefined, {
    message: "Nenhum campo para atualizar foi enviado.",
  })

const orderIdSchema = z.string().uuid("orderId invalido. Envie o UUID do pedido.")

export async function PATCH(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const auth = await requireAdminApiUser(request)

  if (!auth.ok) {
    return jsonErr(auth.error.message, auth.error.status)
  }

  const { orderId } = await context.params
  const parsedOrderId = orderIdSchema.safeParse(orderId)

  if (!parsedOrderId.success) {
    return jsonErr(parsedOrderId.error.issues[0]?.message ?? "orderId invalido.", 400)
  }

  const body = await request.json().catch(() => null)
  const parsed = updateExternalOrderSchema.safeParse({
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

  const result = await updateOrderFields(parsedOrderId.data, {
    status: parsed.data.status,
    photoLink: parsed.data.photoLink,
  })

  if (!result.ok) {
    return jsonErr(result.error.message, result.error.status, result.error.code)
  }

  return jsonOk(result.data)
}
