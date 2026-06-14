/**
 * app/api/store/payment/create-pix/route.ts
 *
 * Cria uma cobrança Pix para um pedido da loja.
 * Usa lib/payments/efi (createEfiPixCharge).
 *
 * Retry automático para erros transientes da Efí (5xx, timeout).
 * Máximo 3 tentativas com backoff exponencial: 0s, 1s, 2s.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient }              from "@/lib/supabase/server"
import { createAdminClient }         from "@/lib/supabase/admin"
import { createEfiPixCharge, getEfiPixConfig } from "@/lib/payments/efi"

function isRetryable(e: any): boolean {
  const msg = String(e?.message ?? "")
  return (
    msg.includes("504") ||
    msg.includes("502") ||
    msg.includes("503") ||
    msg.includes("ECONNRESET") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("socket hang up")
  )
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function createChargeWithRetry(params: Parameters<typeof createEfiPixCharge>[0], maxTries = 3) {
  let lastError: any
  for (let attempt = 0; attempt < maxTries; attempt++) {
    try {
      if (attempt > 0) {
        await sleep(attempt * 1000)
        console.log(`[create-pix] retry ${attempt}/${maxTries - 1}`)
      }
      return await createEfiPixCharge(params)
    } catch (e: any) {
      lastError = e
      if (!isRetryable(e)) throw e
    }
  }
  throw lastError
}

export async function POST(req: NextRequest) {
  try {
    // ── Auth: client do usuário (RLS) para validar identidade ──
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 })
    }

    const { order_id } = await req.json()
    if (!order_id) {
      return NextResponse.json({ ok: false, error: "order_id obrigatorio." }, { status: 400 })
    }

    // ── Leitura: client do usuário (RLS valida propriedade) ──
    const { data: order, error } = await supabase
      .from("store_orders")
      .select("id, client_id, total_value, status, payment_status, payment_charge_id")
      .eq("id", order_id)
      .single()

    if (error || !order) {
      return NextResponse.json({ ok: false, error: "Pedido nao encontrado." }, { status: 404 })
    }
    if (order.client_id !== user.id) {
      return NextResponse.json({ ok: false, error: "Nao autorizado." }, { status: 403 })
    }
    if (["pago", "paid", "CONCLUIDA"].includes(order.payment_status ?? "")) {
      return NextResponse.json({ ok: false, error: "Pedido ja foi pago." }, { status: 400 })
    }

    // ── Gera cobrança Pix na Efí ──
    const { pixKey } = getEfiPixConfig()

    let cobranca
    try {
      cobranca = await createChargeWithRetry({
        amount:       Number(order.total_value).toFixed(2),
        pixKey,
        payerMessage: `Shinkansen Films - Pedido ${order.id.slice(0, 8).toUpperCase()}`,
      })
    } catch (e: any) {
      console.error("[create-pix]", e)
      const isTimeout = String(e.message).includes("504") || String(e.message).includes("Timeout")
      return NextResponse.json({
        ok:    false,
        error: isTimeout
          ? "O sistema de pagamento está temporariamente indisponível. Aguarde alguns segundos e tente novamente."
          : `Erro ao gerar Pix: ${e.message}`,
        retryable: isRetryable(e),
      }, { status: 502 })
    }

    const expiresAt = cobranca.expiresInSeconds
      ? new Date(Date.now() + cobranca.expiresInSeconds * 1000).toISOString()
      : null

    // ── Escrita: admin client (bypassa RLS) ──
    const admin = createAdminClient()
    const { error: updateErr } = await admin
      .from("store_orders")
      .update({
        payment_provider:        "efi",
        payment_method:          "pix",
        payment_status:          "pending",
        payment_charge_id:       cobranca.txid,
        payment_custom_id:       String(cobranca.locationId ?? ""),
        payment_link_url:        cobranca.paymentLinkUrl,
        payment_requested_at:    new Date().toISOString(),
        payment_link_expires_at: expiresAt,
        payment_last_payload:    cobranca.raw,
      })
      .eq("id", order.id)

    if (updateErr) {
      console.error("[create-pix] Falha ao salvar cobrança no banco:", updateErr)
    }

    return NextResponse.json({
      ok:  true,
      pix: {
        copia_cola: cobranca.pixCopyPaste,
        qr_base64:  cobranca.qrCodeImage,
        valor:      Number(order.total_value),
        expira_em:  expiresAt,
      },
    })
  } catch (e: any) {
    console.error("[create-pix] erro inesperado:", e)
    return NextResponse.json({ ok: false, error: e.message ?? "Erro ao gerar Pix." }, { status: 500 })
  }
}