/**
 * app/api/store/payment/create-pix/route.ts
 *
 * Cria uma cobrança Pix (Efí) para um pedido da loja já existente.
 * Salva os dados do pagamento na store_orders e retorna o QR Code.
 *
 * Fluxo:
 *   1. create-order cria o pedido (status pendente)
 *   2. este endpoint gera a cobrança Pix e o QR
 *   3. cliente paga → webhook marca como pago
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { criarCobrancaPix } from "@/lib/store/efi-pix"

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 })
    }

    const { order_id } = await req.json()
    if (!order_id) {
      return NextResponse.json({ ok: false, error: "order_id obrigatório." }, { status: 400 })
    }

    // Busca o pedido e confirma que pertence ao usuário
    const { data: order, error } = await supabase
      .from("store_orders")
      .select("id, client_id, total_value, status, payment_status")
      .eq("id", order_id)
      .single()

    if (error || !order) {
      return NextResponse.json({ ok: false, error: "Pedido não encontrado." }, { status: 404 })
    }
    if (order.client_id !== user.id) {
      return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 403 })
    }
    if (order.payment_status === "pago" || order.status === "pago") {
      return NextResponse.json({ ok: false, error: "Pedido já foi pago." }, { status: 400 })
    }

    // Cria a cobrança Pix
    const cobranca = await criarCobrancaPix(
      Number(order.total_value),
      `Shinkansen Films - Pedido ${order.id.slice(0, 8).toUpperCase()}`,
      3600
    )

    // Salva os dados do pagamento no pedido
    const expiresAt = new Date(Date.now() + cobranca.expiracao * 1000).toISOString()
    await supabase
      .from("store_orders")
      .update({
        payment_provider:        "efi",
        payment_method:          "pix",
        payment_status:          "ATIVA",
        payment_charge_id:       cobranca.txid,
        payment_custom_id:       cobranca.charge_id,
        payment_requested_at:    new Date().toISOString(),
        payment_link_expires_at: expiresAt,
        payment_last_payload:    {
          txid:    cobranca.txid,
          qrcode:  {
            qrcode:       cobranca.pix_copia_cola,
            imagemQrcode: cobranca.qr_code_base64,
          },
        },
      })
      .eq("id", order.id)

    return NextResponse.json({
      ok: true,
      pix: {
        copia_cola: cobranca.pix_copia_cola,
        qr_base64:  cobranca.qr_code_base64,
        valor:      cobranca.valor,
        expira_em:  expiresAt,
      },
    })
  } catch (e: any) {
    console.error("[create-pix]", e)
    return NextResponse.json(
      { ok: false, error: e.message ?? "Erro ao gerar Pix." },
      { status: 500 }
    )
  }
}