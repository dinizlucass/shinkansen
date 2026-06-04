// app/api/admin/cancelar-pix/route.ts

import { NextRequest, NextResponse }          from "next/server"
import { createClient }                       from "@supabase/supabase-js"
import { cancelEfiPixCharge }                 from "@/lib/payments/efi"

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  try {
    const { order_id } = await req.json()
    if (!order_id) {
      return NextResponse.json({ ok: false, error: "order_id obrigatorio" }, { status: 400 })
    }

    const supabase = adminClient()

    // 1. Descobre em qual tabela está e busca o txid
    let txid:  string | null = null
    let tabela               = "store_orders"

    const { data: storeOrder } = await supabase
      .from("store_orders")
      .select("payment_charge_id, payment_status")
      .eq("id", order_id)
      .maybeSingle()

    if (storeOrder?.payment_charge_id) {
      txid = storeOrder.payment_charge_id
    } else {
      const { data: ordem } = await supabase
        .from("orders")
        .select("efi_charge_id, payment_status")
        .eq("id", order_id)
        .maybeSingle()
      if (ordem?.efi_charge_id) {
        txid   = ordem.efi_charge_id
        tabela = "orders"
      }
    }

    // 2. Se não tem cobrança registrada, atualiza o banco direto
    if (!txid) {
      await supabase
        .from(tabela)
        .update({ payment_status: "REMOVIDA_PELO_USUARIO_RECEBEDOR" })
        .eq("id", order_id)

      return NextResponse.json({
        ok:    true,
        aviso: "Sem cobranca registrada — status atualizado diretamente.",
      })
    }

    // 3. Cancela na Efí (PATCH /v2/cob/{txid})
    await cancelEfiPixCharge(txid)

    // 4. Atualiza o banco com o status real
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