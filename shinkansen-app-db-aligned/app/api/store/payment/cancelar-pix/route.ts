/**
 * app/api/store/payment/cancelar-pix/route.ts
 *
 * Cancela uma cobrança Pix ativa na Efi (cortesia / admin).
 * Usa getEfiPixAccessToken e getEfiPixConfig de lib/payments/efi.
 *
 * A lib do colega nao tem funcao de cancelamento — fazemos o DELETE
 * diretamente com o token dela, seguindo o mesmo padrao de requestWithMtls.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient }              from "@/lib/supabase/server"
import { getEfiPixAccessToken, getEfiPixConfig } from "@/lib/payments/efi"

export async function POST(req: NextRequest) {
  try {
    const { order_id } = await req.json()
    if (!order_id) {
      return NextResponse.json({ ok: false, error: "order_id obrigatorio" }, { status: 400 })
    }

    const supabase = await createClient()

    // Busca charge_id em store_orders ou orders
    let chargeId: string | null = null
    let tabela = "store_orders"

    const { data: storeOrder } = await supabase
      .from("store_orders")
      .select("payment_charge_id, payment_status")
      .eq("id", order_id)
      .maybeSingle()

    if (storeOrder?.payment_charge_id) {
      chargeId = storeOrder.payment_charge_id
    } else {
      const { data: ordem } = await supabase
        .from("orders")
        .select("efi_charge_id, payment_status")
        .eq("id", order_id)
        .maybeSingle()
      if (ordem?.efi_charge_id) {
        chargeId = ordem.efi_charge_id
        tabela   = "orders"
      }
    }

    if (!chargeId) {
      // Sem cobranca registrada — atualiza banco diretamente
      await supabase
        .from(tabela)
        .update({ payment_status: "REMOVIDA_PELO_USUARIO_RECEBEDOR" })
        .eq("id", order_id)
      return NextResponse.json({
        ok:   true,
        aviso: "Sem cobranca registrada — status atualizado diretamente.",
      })
    }

    // Cancela na Efi usando token da lib do colega
    const { baseUrl } = getEfiPixConfig()
    const token       = await getEfiPixAccessToken()

    const resp = await fetch(`${baseUrl}/v2/cob/${chargeId}`, {
      method:  "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!resp.ok && resp.status !== 204) {
      const corpo = await resp.text().catch(() => "")
      return NextResponse.json(
        { ok: false, error: `Efi rejeitou: ${resp.status} ${corpo}` },
        { status: 502 },
      )
    }

    await supabase
      .from(tabela)
      .update({
        payment_status:   "REMOVIDA_PELO_USUARIO_RECEBEDOR",
        payment_link_url: null,
      })
      .eq("id", order_id)

    return NextResponse.json({ ok: true, status: "REMOVIDA_PELO_USUARIO_RECEBEDOR" })

  } catch (err: any) {
    console.error("[cancelar-pix]", err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}