import "server-only"

import { randomBytes } from "node:crypto"
import { Resend } from "resend"

import { requireAdminApiUser } from "@/lib/auth/admin-api"
import { jsonErr, jsonOk } from "@/lib/api/http"
import * as efiPayments from "@/lib/payments/efi"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Reconcilia a cobrança de um pedido quando o valor muda (ex.: cliente troca de
 * serviço na re-triagem). Casos:
 *   1. NÃO pago + link válido    → revisa a cobrança na Efí (mesmo link/QR).
 *   2. Já pago + novo valor MENOR → cupom da diferença + e-mail.
 *   3. Já pago + novo valor MAIOR → cobrança complementar do extra + e-mail.
 *   4. NÃO pago + link expirado  → nova cobrança + e-mail.
 * Se a revisão (caso 1) falhar porque a cobrança já foi paga no meio-tempo,
 * cai automaticamente no caso 2/3. Idempotente quando o valor não muda.
 */

const PAGO = new Set(["concluido", "concluida", "pago", "paid"])
const isPaid = (ps?: string | null) => PAGO.has((ps ?? "").toLowerCase())
const couponCode = () => "SKS" + randomBytes(3).toString("hex").toUpperCase()
const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)

async function enviarEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey || !to) return
  const resend = new Resend(apiKey)
  const from = `Shinkansen Films <${process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev"}>`
  const replyTo = process.env.RESEND_REPLY_TO || undefined
  await resend.emails.send({ from, to, subject, html, ...(replyTo ? { replyTo } : {}) })
}

// Erro da Efí que indica que a cobrança não está mais ATIVA (provavelmente paga).
function pareceJaPaga(msg: string) {
  const m = (msg || "").toLowerCase()
  return m.includes("conclu") || m.includes("paga") || m.includes("pago") ||
    m.includes("operacao_invalida") || m.includes("nao_permitido") || m.includes("não_permitido")
}

type OrderRow = {
  id: string
  total_value: number | null
  payment_status: string | null
  payment_link_url: string | null
  payment_link_expires_at: string | null
  efi_charge_id: string | null
  obs_interna: string | null
  payment_last_payload: unknown
}

/** Trata um pedido já pago cujo valor mudou: cupom (menor) ou cobrança extra (maior). */
async function reconciliarPago(
  admin: ReturnType<typeof createAdminClient>,
  order: OrderRow,
  novoTotal: number,
  valorPago: number,
  email: string,
  nome: string,
  idCurto: string,
) {
  const diff = Math.round((valorPago - novoTotal) * 100) / 100

  // Novo valor MENOR → devolve a diferença em cupom
  if (diff > 0.005) {
    const code = couponCode()
    const expira = new Date(Date.now() + 182 * 24 * 3600 * 1000).toISOString()
    const { error } = await admin.from("coupons").insert({
      code, discount: diff, min_order: 0, max_uses: 1,
      one_per_client: true, active: true, expires_at: expira,
    })
    if (error) return jsonErr("Falha ao gerar cupom: " + error.message, 500)
    await enviarEmail(
      email,
      `Ajuste no seu pedido #${idCurto} — cupom de ${brl(diff)}`,
      `<p>Olá, ${nome}.</p>
       <p>Seu pedido #${idCurto} ficou mais barato. Como o pagamento já havia sido feito,
       a diferença de <b>${brl(diff)}</b> volta como cupom:</p>
       <p style="font-size:20px;font-weight:700;letter-spacing:2px;">${code}</p>
       <p>Use no checkout da nossa loja. Uso único, válido por 6 meses.</p>`,
    )
    return jsonOk({ caso: "pago_cupom", cupom: code, diferenca: diff })
  }

  // Novo valor MAIOR → cobrança complementar só do extra
  if (diff < -0.005) {
    const extra = Math.round((novoTotal - valorPago) * 100) / 100
    try {
      const charge = await efiPayments.createEfiPixCharge({
        amount: efiPayments.centsToPixAmount(Math.round(extra * 100)),
        pixKey: efiPayments.getEfiPixConfig().pixKey,
        payerMessage: `Complemento pedido #${idCurto}`,
      })
      const expiresAt = charge.expiresInSeconds
        ? new Date(Date.now() + charge.expiresInSeconds * 1000).toISOString()
        : null
      const nota = `[COMPLEMENTO] Base paga ${brl(valorPago)}; complemento ${brl(extra)} gerado (txid ${charge.txid}).`
      await admin.from("orders").update({
        payment_provider: "efi_pix",
        payment_status: "pending",
        payment_link_url: charge.paymentLinkUrl,
        payment_requested_at: new Date().toISOString(),
        payment_link_expires_at: expiresAt,
        efi_charge_id: charge.txid,
        efi_charge_status: charge.status,
        efi_custom_id: charge.locationId ? String(charge.locationId) : null,
        payment_error: null,
        payment_last_payload: charge.raw,
        obs_interna: order.obs_interna ? `${order.obs_interna}\n${nota}` : nota,
      }).eq("id", order.id)
      await enviarEmail(
        email,
        `Complemento do pedido #${idCurto} — ${brl(extra)}`,
        `<p>Olá, ${nome}.</p>
         <p>Seu pedido #${idCurto} foi ampliado. Falta pagar a diferença de <b>${brl(extra)}</b>:</p>
         ${charge.paymentLinkUrl ? `<p><a href="${charge.paymentLinkUrl}">Pagar a diferença</a></p>` : ""}
         ${charge.pixCopyPaste ? `<p>Pix copia-e-cola:<br><code>${charge.pixCopyPaste}</code></p>` : ""}`,
      )
      return jsonOk({ caso: "pago_complemento", extra, link: charge.paymentLinkUrl })
    } catch (e) {
      return jsonErr(e instanceof Error ? e.message : "Falha ao gerar cobrança complementar.", 502)
    }
  }

  return jsonOk({ caso: "pago_sem_ajuste", diferenca: 0 })
}

export async function POST(request: Request, context: { params: Promise<{ orderId: string }> }) {
  const auth = await requireAdminApiUser(request)
  if (!auth.ok) return jsonErr(auth.error.message, auth.error.status)

  const { orderId } = await context.params
  const admin = createAdminClient()

  const { data: order, error } = await admin
    .from("orders")
    .select(`
      id, total_value, payment_status, payment_link_url, payment_link_expires_at,
      efi_charge_id, obs_interna, payment_last_payload, client_id,
      profiles:client_id ( full_name, email )
    `)
    .eq("id", orderId)
    .single()

  if (error || !order) return jsonErr(error?.message || "Pedido não encontrado.", 404)

  const perfil = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles
  const email = perfil?.email?.trim() || ""
  const nome = perfil?.full_name?.trim() || "cliente"
  const novoTotal = Number(order.total_value ?? 0)
  const idCurto = String(order.id).slice(0, 8).toUpperCase()

  if (!(novoTotal > 0)) return jsonErr("Pedido sem valor total — nada a cobrar.", 400)

  const valorCobranca = (() => {
    const v = Number((order.payment_last_payload as any)?.charge?.valor?.original)
    return Number.isFinite(v) ? v : NaN
  })()

  // ── CASO 2/3: já pago ────────────────────────────────────────────
  if (isPaid(order.payment_status)) {
    if (!Number.isFinite(valorCobranca)) {
      return jsonOk({ caso: "pago_sem_ajuste", motivo: "valor pago desconhecido" })
    }
    return reconciliarPago(admin, order as OrderRow, novoTotal, valorCobranca, email, nome, idCurto)
  }

  // ── NÃO pago ──────────────────────────────────────────────────────
  const exp = order.payment_link_expires_at ? new Date(order.payment_link_expires_at) : null
  const linkValido = Boolean(order.efi_charge_id) && (!exp || exp.getTime() > Date.now())
  const novoAmount = efiPayments.centsToPixAmount(Math.round(novoTotal * 100))

  // Idempotência: valor da cobrança ativa já é o novo total → nada a fazer.
  if (linkValido && Number.isFinite(valorCobranca) && Math.abs(valorCobranca - novoTotal) < 0.005) {
    return jsonOk({ caso: "inalterado" })
  }

  // ── CASO 1: revisa a cobrança existente (mantém o link) ──
  if (linkValido) {
    try {
      const rev = await efiPayments.reviseEfiPixCharge(String(order.efi_charge_id), novoAmount)
      await admin.from("orders").update({
        payment_status: "pending",
        payment_last_payload: { ...(order.payment_last_payload as object ?? {}), charge: rev.raw },
        payment_requested_at: new Date().toISOString(),
      }).eq("id", orderId)
      return jsonOk({ caso: "revisado", valor: rev.amount, link: order.payment_link_url })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      // Corrida: pagou entre a re-triagem e a revisão → reconcilia como pago.
      if (pareceJaPaga(msg) && Number.isFinite(valorCobranca)) {
        return reconciliarPago(admin, order as OrderRow, novoTotal, valorCobranca, email, nome, idCurto)
      }
      return jsonErr("Falha ao revisar cobrança: " + msg, 502)
    }
  }

  // ── CASO 4: link expirado/inexistente → nova cobrança + e-mail ──
  try {
    const charge = await efiPayments.createEfiPixCharge({
      amount: novoAmount,
      pixKey: efiPayments.getEfiPixConfig().pixKey,
      payerMessage: `Pedido #${idCurto}`,
    })
    const expiresAt = charge.expiresInSeconds
      ? new Date(Date.now() + charge.expiresInSeconds * 1000).toISOString()
      : null
    await admin.from("orders").update({
      payment_provider: "efi_pix",
      payment_status: "pending",
      payment_link_url: charge.paymentLinkUrl,
      payment_requested_at: new Date().toISOString(),
      payment_link_expires_at: expiresAt,
      efi_charge_id: charge.txid,
      efi_charge_status: charge.status,
      efi_custom_id: charge.locationId ? String(charge.locationId) : null,
      payment_error: null,
      payment_last_payload: charge.raw,
    }).eq("id", orderId)
    await enviarEmail(
      email,
      `Novo link de pagamento — pedido #${idCurto}`,
      `<p>Olá, ${nome}.</p>
       <p>Geramos um novo link de pagamento para o seu pedido #${idCurto}, no valor de
       <b>${brl(novoTotal)}</b>:</p>
       ${charge.paymentLinkUrl ? `<p><a href="${charge.paymentLinkUrl}">Pagar agora</a></p>` : ""}
       ${charge.pixCopyPaste ? `<p>Pix copia-e-cola:<br><code>${charge.pixCopyPaste}</code></p>` : ""}`,
    )
    return jsonOk({ caso: "novo_link", valor: novoAmount, link: charge.paymentLinkUrl })
  } catch (e) {
    return jsonErr(e instanceof Error ? e.message : "Falha ao criar cobrança.", 502)
  }
}
