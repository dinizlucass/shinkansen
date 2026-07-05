import { z } from "zod"

import { jsonErr, jsonOk } from "@/lib/api/http"
import { assertAdmin } from "@/lib/admin/revelacao"
import { createAdminClient } from "@/lib/supabase/admin"
import { getEfiPixAccessToken, getEfiPixConfig } from "@/lib/payments/efi"

const schema = z.object({
  status: z.enum(["retirado", "cancelado"]),
})

const PAGAMENTO_FINALIZADO = ["paid", "CONCLUIDA", "REMOVIDA_PELO_USUARIO_RECEBEDOR"]

export async function PATCH(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const auth = await assertAdmin()
  if (!auth.ok) return jsonErr(auth.message, auth.status)

  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return jsonErr(parsed.error.issues[0]?.message ?? "Status inválido.", 400)
  }

  const { orderId } = await context.params
  const admin = createAdminClient()

  const { data: order, error: orderErr } = await admin
    .from("store_orders")
    .select("id, status, payment_charge_id, payment_status, delivery_type")
    .eq("id", orderId)
    .single()

  if (orderErr || !order) return jsonErr("Pedido não encontrado.", 404)
  if (order.delivery_type !== "retirada") {
    return jsonErr("Este pedido não é de retirada.", 400)
  }

  // ── RETIRADO: apenas marca; NÃO finaliza/mexe na cobrança ──
  if (parsed.data.status === "retirado") {
    const { error } = await admin
      .from("store_orders")
      .update({ status: "retirado" })
      .eq("id", orderId)
    if (error) return jsonErr(error.message, 500, error.code)
    return jsonOk({ status: "retirado" })
  }

  // ── CANCELADO ──
  if (order.status === "cancelado") {
    return jsonOk({ status: "cancelado", aviso: "Pedido já estava cancelado." })
  }

  // 1. Re-integra os itens ao estoque (o checkout debita via trigger; aqui devolvemos)
  const { data: itens } = await admin
    .from("store_order_items")
    .select("product_id, quantity")
    .eq("store_order_id", orderId)

  for (const it of itens ?? []) {
    const { data: prod } = await admin
      .from("products")
      .select("stock_quantity")
      .eq("id", it.product_id)
      .single()
    if (prod) {
      await admin
        .from("products")
        .update({ stock_quantity: (prod.stock_quantity ?? 0) + (it.quantity ?? 0) })
        .eq("id", it.product_id)
    }
  }

  // 2. Cancela a cobrança Pix na Efí (best-effort), se ainda estiver ativa
  let cancelouEfi = false
  if (
    order.payment_charge_id &&
    !PAGAMENTO_FINALIZADO.includes(order.payment_status ?? "")
  ) {
    try {
      const { baseUrl } = getEfiPixConfig()
      const token = await getEfiPixAccessToken()
      const resp = await fetch(`${baseUrl}/v2/cob/${order.payment_charge_id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      cancelouEfi = resp.ok || resp.status === 204
    } catch {
      cancelouEfi = false
    }
  }

  // 3. Atualiza o pedido
  const { error } = await admin
    .from("store_orders")
    .update({
      status: "cancelado",
      payment_status: cancelouEfi
        ? "REMOVIDA_PELO_USUARIO_RECEBEDOR"
        : order.payment_status ?? null,
      payment_link_url: null,
    })
    .eq("id", orderId)

  if (error) return jsonErr(error.message, 500, error.code)

  return jsonOk({
    status: "cancelado",
    cancelou_efi: cancelouEfi,
    itens_reintegrados: (itens ?? []).length,
  })
}
