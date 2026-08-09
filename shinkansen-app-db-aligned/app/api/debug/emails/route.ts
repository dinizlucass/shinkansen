/**
 * app/api/debug/emails/route.ts
 *
 * Rota de DEBUG para disparar cada tipo de e-mail com dados editáveis.
 * NÃO deve ir para produção — bloqueada quando NODE_ENV === "production".
 */

import { NextResponse } from "next/server"
import { Resend } from "resend"

import { sendOrderStatusEmail, sendStorePurchaseEmail } from "@/lib/email/order-status"

const NOTIFICA_NEGATIVOS: Record<string, string> = {
  embalado: "foram embalados e serão devolvidos em breve.",
  enviado: "foram enviados pelos Correios e estão a caminho.",
  retirado: "foram retirados no balcão. Obrigado!",
}

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { ok: false, error: "Debug de e-mails desativado em produção." },
      { status: 403 },
    )
  }

  const body = await req.json().catch(() => null)
  if (!body?.to) {
    return NextResponse.json({ ok: false, error: "Informe o e-mail de destino." }, { status: 400 })
  }
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ ok: false, error: "RESEND_API_KEY ausente no .env." }, { status: 500 })
  }

  const orderId = body.orderId?.trim() || crypto.randomUUID()

  try {
    switch (body.type) {
      case "order-status":
        await sendOrderStatusEmail({
          to: body.to,
          customerName: body.customerName ?? null,
          orderId,
          status: body.status,
          totalValue: body.totalValue ?? null,
          paymentLinkUrl: body.paymentLinkUrl || null,
          pixCopyPaste: body.pixCopyPaste || null,
          photoLink: body.photoLink || null,
          serviceItems: Array.isArray(body.serviceItems) ? body.serviceItems : undefined,
        })
        break

      case "store-purchase":
        await sendStorePurchaseEmail({
          to: body.to,
          customerName: body.customerName ?? null,
          orderId,
          items: Array.isArray(body.items) ? body.items : [],
          totalValue: body.totalValue ?? null,
          deliveryType: body.deliveryType ?? null,
        })
        break

      case "negativos": {
        const frase = NOTIFICA_NEGATIVOS[body.status]
        if (!frase) {
          return NextResponse.json({ ok: false, error: "Status de negativo inválido." }, { status: 400 })
        }
        const resend = new Resend(process.env.RESEND_API_KEY)
        const from = `Shinkansen Films <${process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev"}>`
        const replyTo = process.env.RESEND_REPLY_TO || undefined
        const nome = (body.customerName || "cliente").trim()
        await resend.emails.send({
          from,
          to: body.to,
          subject: `Negativos do filme ${body.filmName ?? ""} — ${body.status}`,
          html: `<p>Olá, ${nome}.</p><p>Os negativos do filme <b>${body.filmName ?? "—"}</b> ${frase}</p>`,
          ...(replyTo ? { replyTo } : {}),
        })
        break
      }

      default:
        return NextResponse.json({ ok: false, error: "Tipo de e-mail desconhecido." }, { status: 400 })
    }

    return NextResponse.json({ ok: true, orderId })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao enviar."
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
