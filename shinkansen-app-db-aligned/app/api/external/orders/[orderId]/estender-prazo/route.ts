import "server-only"

import { Resend } from "resend"

import { requireAdminApiUser } from "@/lib/auth/admin-api"
import { jsonErr, jsonOk } from "@/lib/api/http"
import * as efiPayments from "@/lib/payments/efi"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * "Estender prazo de pagamento" — usado pelo admin quando o link Pix expirou.
 *
 * A Efí NÃO permite estender uma cobrança imediata já expirada. Então, quando o
 * link está expirado (ou não existe), geramos uma cobrança NOVA com validade de
 * 24h (a partir de agora) e atualizamos o pedido + reenviamos o link ao cliente.
 * Se o link ainda estiver válido, não recria — apenas informa até quando vale.
 */

const PAGO = new Set(["concluido", "concluida", "pago", "paid"])
const isPaid = (ps?: string | null) => PAGO.has((ps ?? "").toLowerCase())
const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)

const EXPIRACAO_24H = 60 * 60 * 24 // segundos

async function enviarEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey || !to) return
  const resend = new Resend(apiKey)
  const from = `Shinkansen Films <${process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev"}>`
  const replyTo = process.env.RESEND_REPLY_TO || undefined
  await resend.emails.send({ from, to, subject, html, ...(replyTo ? { replyTo } : {}) })
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

  if (isPaid(order.payment_status)) {
    return jsonErr("Este pedido já está pago — não há prazo a estender.", 400)
  }

  const perfil = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles
  const email = perfil?.email?.trim() || ""
  const nome = perfil?.full_name?.trim() || "cliente"
  const total = Number(order.total_value ?? 0)
  const idCurto = String(order.id).slice(0, 8).toUpperCase()

  if (!(total > 0)) return jsonErr("Pedido sem valor total — nada a cobrar.", 400)

  // ── 1) Tenta ESTENDER a cobrança existente (mesmo txid/QR/link) ──────────
  // A Efí permite PATCH em calendario.expiracao enquanto a cobrança está ATIVA.
  // expiracao é contado a partir da criação → para valer +24h a partir de agora
  // usamos (agora − criacao) + 24h.
  const txid = order.efi_charge_id ? String(order.efi_charge_id) : ""
  if (txid) {
    try {
      let criacaoIso: string | undefined =
        (order.payment_last_payload as any)?.charge?.calendario?.criacao
      if (!criacaoIso) {
        const atual = await efiPayments.getEfiPixCharge(txid)
        criacaoIso = atual.calendario?.criacao as string | undefined
      }
      const criacaoMs = criacaoIso ? new Date(criacaoIso).getTime() : Date.now()
      const decorrido = Math.max(0, Math.floor((Date.now() - criacaoMs) / 1000))
      const novaExpiracao = decorrido + EXPIRACAO_24H
      const raw = await efiPayments.extendEfiPixExpiration(txid, novaExpiracao)
      const expiresAt = new Date(criacaoMs + novaExpiracao * 1000).toISOString()
      const nota = `[PRAZO ESTENDIDO +24h] mesma cobrança (txid ${txid}), vence ${new Date(expiresAt).toLocaleString("pt-BR")}.`

      await admin.from("orders").update({
        payment_status: "pending",
        payment_link_expires_at: expiresAt,
        payment_requested_at: new Date().toISOString(),
        payment_last_payload: { ...(order.payment_last_payload as object ?? {}), charge: raw },
        obs_interna: order.obs_interna ? `${order.obs_interna}\n${nota}` : nota,
      }).eq("id", orderId)

      return jsonOk({
        caso: "prazo_estendido",
        link: order.payment_link_url,
        expires_at: expiresAt,
      })
    } catch (e) {
      // Cobrança não está mais ATIVA (paga/removida) ou erro → cai para nova cobrança.
      console.warn("[estender-prazo] extensão falhou, criando nova cobrança:", e)
    }
  }

  // ── 2) Fallback: cobrança nova de 24h (link antigo inutilizável) ─────────
  try {
    const charge = await efiPayments.createEfiPixCharge({
      amount: efiPayments.centsToPixAmount(Math.round(total * 100)),
      pixKey: efiPayments.getEfiPixConfig().pixKey,
      payerMessage: `Pedido #${idCurto}`,
      expiracaoSegundos: EXPIRACAO_24H,
    })
    const expiresAt = new Date(Date.now() + EXPIRACAO_24H * 1000).toISOString()
    const nota = `[PRAZO ESTENDIDO +24h] novo link (txid ${charge.txid}), vence ${new Date(expiresAt).toLocaleString("pt-BR")}.`

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
    }).eq("id", orderId)

    await enviarEmail(
      email,
      `Novo prazo de pagamento — pedido #${idCurto}`,
      `<p>Olá, ${nome}.</p>
       <p>Geramos um novo link de pagamento para o seu pedido #${idCurto}
       (valor <b>${brl(total)}</b>), válido por 24 horas:</p>
       ${charge.paymentLinkUrl ? `<p><a href="${charge.paymentLinkUrl}">Pagar agora</a></p>` : ""}
       ${charge.pixCopyPaste ? `<p>Pix copia-e-cola:<br><code>${charge.pixCopyPaste}</code></p>` : ""}`,
    )

    return jsonOk({
      caso: "novo_link_24h",
      link: charge.paymentLinkUrl,
      expires_at: expiresAt,
      valor: total,
    })
  } catch (e) {
    return jsonErr(e instanceof Error ? e.message : "Falha ao gerar nova cobrança.", 502)
  }
}
