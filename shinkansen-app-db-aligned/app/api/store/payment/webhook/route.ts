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
      .select("id, payment_status")
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