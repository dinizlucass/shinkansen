/**
 * app/api/store/payment/webhook/route.ts
 *
 * Recebe notificações de pagamento Pix da Efí.
 *
 * Segurança na Vercel (sem mTLS de entrada):
 *   A URL do webhook contém ?skey=SECRET. A Efí sempre chama a mesma URL
 *   que foi registrada, então validamos que a skey bate com EFI_WEBHOOK_SKEY.
 *   Sem a skey correta, ignoramos a requisição.
 *
 * A Efí faz uma checagem de disponibilidade (POST no /pix sem corpo de pix)
 * ao registrar o webhook — respondemos 200 para qualquer chamada válida.
 *
 * URL a registrar na Efí:
 *   https://seusite.com/api/store/payment/webhook?skey=SUA_SKEY
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Usa client com service role para atualizar pedidos sem sessão de usuário
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  // 1. Valida a skey da URL
  const skey = req.nextUrl.searchParams.get("skey")
  if (skey !== process.env.EFI_WEBHOOK_SKEY) {
    // Não revela detalhe — apenas nega
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  let body: any = {}
  try { body = await req.json() } catch { /* corpo vazio = ping de validação */ }

  // 2. Ping de validação da Efí (sem array pix) → responde 200
  if (!body?.pix || !Array.isArray(body.pix)) {
    return NextResponse.json({ ok: true })
  }

  // 3. Processa cada notificação de pagamento
  const supabase = adminClient()

  for (const pix of body.pix) {
    const txid = pix.txid
    if (!txid) continue

    // Localiza o pedido pela cobrança
    const { data: order } = await supabase
      .from("store_orders")
      .select("id, status, payment_status")
      .eq("payment_charge_id", txid)
      .single()

    if (!order) continue
    if (order.payment_status === "pago") continue // idempotência

    // Marca como pago
    await supabase
      .from("store_orders")
      .update({
        status:               "pago",
        payment_status:       "pago",
        payment_paid_at:      pix.horario ?? new Date().toISOString(),
        payment_last_payload: pix,
      })
      .eq("id", order.id)
  }

  return NextResponse.json({ ok: true })
}

// A Efí pode validar o endpoint com GET/HEAD em alguns fluxos
export async function GET(req: NextRequest) {
  const skey = req.nextUrl.searchParams.get("skey")
  if (skey !== process.env.EFI_WEBHOOK_SKEY) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  return NextResponse.json({ ok: true })
}