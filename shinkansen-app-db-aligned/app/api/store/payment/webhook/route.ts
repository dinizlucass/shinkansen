/**
 * app/api/store/payment/webhook/route.ts
 *
 * Recebe notificacoes de pagamento Pix da Efi.
 *
 * Seguranca: URL contem ?skey=SECRET (EFI_WEBHOOK_SKEY).
 * A Efi sempre chama a URL exata que foi registrada — validamos a skey.
 *
 * URL a registrar na Efi:
 *   https://seusite.com/api/store/payment/webhook?skey=SUA_SKEY
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient }              from "@supabase/supabase-js"

import { sendStorePurchaseEmail }    from "@/lib/email/order-status"

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

function validarSkey(req: NextRequest): boolean {
  const skey = req.nextUrl.searchParams.get("skey")
  return skey === process.env.EFI_WEBHOOK_SKEY
}

export async function POST(req: NextRequest) {
  if (!validarSkey(req)) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  let body: any = {}
  try { body = await req.json() } catch { /* ping de validacao sem corpo */ }

  // Ping de registro da Efi (sem array pix) — responde 200
  if (!body?.pix || !Array.isArray(body.pix)) {
    return NextResponse.json({ ok: true })
  }

  const supabase = adminClient()

  for (const pix of body.pix) {
    const txid = pix.txid
    if (!txid) continue

    // Tenta em store_orders
    const { data: storeOrder } = await supabase
      .from("store_orders")
      .select("id, payment_status, client_id, total_value, delivery_type")
      .eq("payment_charge_id", txid)
      .maybeSingle()

    if (storeOrder) {
      if (storeOrder.payment_status === "pago") continue // idempotencia
      await supabase
        .from("store_orders")
        .update({
          status:               "pago",
          payment_status:       "pago",
          payment_paid_at:      pix.horario ?? new Date().toISOString(),
          payment_last_payload: pix,
        })
        .eq("id", storeOrder.id)

      // E-mail de confirmação da compra (com itens e valor pago).
      if (process.env.RESEND_API_KEY && storeOrder.client_id) {
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", storeOrder.client_id)
            .single()

          if (profile?.email) {
            const { data: itens } = await supabase
              .from("store_order_items")
              .select("product_id, quantity, unit_price")
              .eq("store_order_id", storeOrder.id)

            const prodIds = [
              ...new Set((itens ?? []).map((i: { product_id: string }) => i.product_id)),
            ]
            const { data: prods } = prodIds.length
              ? await supabase.from("products").select("id, name").in("id", prodIds)
              : { data: [] as { id: string; name: string }[] }
            const prodMap = new Map((prods ?? []).map((p) => [p.id, p.name]))

            const items = (itens ?? []).map(
              (i: { product_id: string; quantity: number; unit_price: number | null }) => ({
                name: prodMap.get(i.product_id) ?? "Produto",
                quantity: i.quantity,
                unitPrice: i.unit_price,
              }),
            )

            await sendStorePurchaseEmail({
              to: profile.email,
              customerName: profile.full_name ?? null,
              orderId: storeOrder.id,
              items,
              totalValue: Number(storeOrder.total_value ?? 0),
              deliveryType: storeOrder.delivery_type ?? null,
            })
          }
        } catch (emailError) {
          console.error("[store/webhook] Falha ao enviar e-mail de compra", emailError)
        }
      }
      continue
    }

    // Tenta em orders (pedidos de servico)
    const { data: ordem } = await supabase
      .from("orders")
      .select("id, payment_status")
      .eq("efi_charge_id", txid)
      .maybeSingle()

    if (ordem) {
      if (ordem.payment_status === "pago") continue
      await supabase
        .from("orders")
        .update({
          status:               "pago",
          payment_status:       "pago",
          payment_paid_at:      pix.horario ?? new Date().toISOString(),
          payment_last_payload: pix,
        })
        .eq("id", ordem.id)
    }
  }

  return NextResponse.json({ ok: true })
}

// Efi pode validar o endpoint com GET/HEAD
export async function GET(req: NextRequest) {
  if (!validarSkey(req)) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  return NextResponse.json({ ok: true })
}