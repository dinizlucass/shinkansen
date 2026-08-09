import "server-only"

import { Resend } from "resend"

type OrderStatusEmailStatus = "criado" | "recebido" | "aguardando_pagamento" | "pago" | "finalizado"

type OrderStatusEmailInput = {
  to: string
  customerName?: string | null
  orderId: string
  status: OrderStatusEmailStatus
  totalValue?: number | null
  paymentLinkUrl?: string | null
  pixCopyPaste?: string | null
  photoLink?: string | null
  // Resumo do pedido de serviço: por filme, o nome e os serviços escolhidos.
  // Usado no e-mail "criado".
  serviceItems?: { film: string; services: string[] }[]
}

// Item de uma compra na loja (produtos), usado no e-mail de compra confirmada.
export type StorePurchaseItem = {
  name: string
  quantity: number
  unitPrice: number | null
}

type StorePurchaseEmailInput = {
  to: string
  customerName?: string | null
  orderId: string
  items: StorePurchaseItem[]
  totalValue?: number | null
  // "retirada" | "envio"/"correios" | outro/desconhecido → mensagem genérica.
  deliveryType?: string | null
}

const INTERNAL_CC_EMAIL = "films.shinkansen@gmail.com"

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY.")
  }

  return new Resend(apiKey)
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value ?? 0))
}

function getGreeting(name?: string | null) {
  return name?.trim() ? `Ola, ${name.trim()}` : "Ola"
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function renderEmailLayout({
  eyebrow,
  title,
  intro,
  details,
  ctaLabel,
  ctaHref,
  extraBlock,
  closing,
}: {
  eyebrow: string
  title: string
  intro: string
  details: string[]
  ctaLabel?: string
  ctaHref?: string | null
  extraBlock?: string
  closing: string
}) {
  const detailRows = details
    .map(
      (detail) => `
        <tr>
          <td style="padding:0 0 10px; color:#b8b8b8; font-size:13px; line-height:1.6; font-family:'Courier New', monospace;">
            ${detail}
          </td>
        </tr>
      `,
    )
    .join("")

  return `
    <div style="margin:0; padding:0; background:#050505;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#050505; padding:32px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px; background:#0d0d0d; border:1px solid #252525;">
              <tr>
                <td style="padding:28px 28px 16px; border-bottom:1px solid #252525;">
                  <div style="color:#e10621; font-size:12px; letter-spacing:1.8px; text-transform:uppercase; font-family:'Courier New', monospace; margin-bottom:14px;">
                    ${eyebrow}
                  </div>
                  <div style="color:#ffffff; font-size:34px; line-height:1; font-weight:700; font-family:'Courier New', monospace;">
                    Shinkansen Films
                  </div>
                </td>
              </tr>

              <tr>
                <td style="padding:28px;">
                  <div style="color:#ffffff; font-size:28px; line-height:1.2; font-weight:700; font-family:'Courier New', monospace; margin-bottom:18px;">
                    ${title}
                  </div>

                  <div style="color:#d0d0d0; font-size:15px; line-height:1.7; font-family:'Courier New', monospace; margin-bottom:20px;">
                    ${intro}
                  </div>

                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#111111; border:1px solid #252525; margin:0 0 20px;">
                    <tr>
                      <td style="padding:18px;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                          ${detailRows}
                        </table>
                      </td>
                    </tr>
                  </table>

                  ${
                    ctaLabel && ctaHref
                      ? `
                        <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 20px;">
                          <tr>
                            <td style="background:#e10621; text-align:center;">
                              <a href="${ctaHref}" style="display:inline-block; padding:14px 22px; color:#ffffff; text-decoration:none; font-size:13px; font-weight:700; letter-spacing:1px; text-transform:uppercase; font-family:'Courier New', monospace;">
                                ${ctaLabel}
                              </a>
                            </td>
                          </tr>
                        </table>
                      `
                      : ""
                  }

                  ${extraBlock ?? ""}

                  <div style="margin-top:24px; padding-top:18px; border-top:1px solid #252525; color:#a0a0a0; font-size:13px; line-height:1.7; font-family:'Courier New', monospace;">
                    ${closing}
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `
}

function getStatusEmailContent(input: OrderStatusEmailInput) {
  const shortOrderId = input.orderId.slice(0, 8).toUpperCase()
  const greeting = getGreeting(input.customerName)
  const orderLine = `Pedido: <strong>#${shortOrderId}</strong>`
  const totalLine = input.totalValue !== undefined ? `Total: <strong>${formatCurrency(input.totalValue)}</strong>` : null

  switch (input.status) {
    case "criado": {
      // Uma linha por filme com os serviços escolhidos.
      const filmeLinhas = (input.serviceItems ?? []).map(
        (it) =>
          `${escapeHtml(it.film)}: <strong>${
            it.services.length ? it.services.map(escapeHtml).join(", ") : "—"
          }</strong>`,
      )
      return {
        subject: `Pedido #${shortOrderId} registrado`,
        html: renderEmailLayout({
          eyebrow: "Novo pedido",
          title: "Pedido registrado",
          intro: `${greeting}, recebemos o seu pedido. Confira abaixo o resumo dos filmes e serviços cadastrados.`,
          details: [
            orderLine,
            ...filmeLinhas,
            ...(totalLine ? [totalLine] : []),
          ],
          closing:
            "Importante: o link de pagamento sera enviado por e-mail somente apos a nossa equipe receber e conferir os filmes no laboratorio. Voce sera avisado a cada etapa.",
        }),
      }
    }

    case "recebido":
      return {
        subject: `Pedido #${shortOrderId} recebido`,
        html: renderEmailLayout({
          eyebrow: "Status atualizado",
          title: "Pedido recebido",
          intro: `${greeting}, recebemos o seu pedido e ele ja entrou na fila do laboratorio.`,
          details: [orderLine, ...(totalLine ? [totalLine] : [])],
          closing: "Em breve seguiremos com os proximos passos e manteremos voce informado por email.",
        }),
      }

    case "aguardando_pagamento":
      return {
        subject: `Pagamento pendente do pedido #${shortOrderId}`,
        html: renderEmailLayout({
          eyebrow: "Pagamento",
          title: "Pedido aguardando pagamento",
          intro: `${greeting}, seu pedido esta pronto para pagamento.`,
          details: [orderLine, ...(totalLine ? [totalLine] : [])],
          ctaLabel: input.paymentLinkUrl ? "Abrir cobranca Pix" : undefined,
          ctaHref: input.paymentLinkUrl,
          extraBlock: input.pixCopyPaste
            ? `
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#111111; border:1px solid #252525; margin:0 0 20px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <div style="color:#e10621; text-transform:uppercase; letter-spacing:1px; font-size:12px; font-family:'Courier New', monospace; margin-bottom:10px;">
                      Pix copia e cola
                    </div>
                    <div style="word-break:break-all; color:#d0d0d0; font-size:12px; line-height:1.7; font-family:'Courier New', monospace;">
                      ${escapeHtml(input.pixCopyPaste)}
                    </div>
                  </td>
                </tr>
              </table>
            `
            : undefined,
          closing: "Assim que o pagamento for confirmado, enviaremos uma nova atualizacao automaticamente.",
        }),
      }

    case "pago":
      return {
        subject: `Pagamento confirmado do pedido #${shortOrderId}`,
        html: renderEmailLayout({
          eyebrow: "Pagamento confirmado",
          title: "Pagamento aprovado",
          intro: `${greeting}, confirmamos o pagamento do seu pedido.`,
          details: [orderLine, ...(totalLine ? [totalLine] : [])],
          closing: "Agora vamos seguir com o processamento do material no laboratorio.",
        }),
      }

    case "finalizado":
      return {
        subject: `Pedido #${shortOrderId} finalizado`,
        html: renderEmailLayout({
          eyebrow: "Finalizado",
          title: "Pedido finalizado",
          intro: `${greeting}, seu pedido foi finalizado pelo Shinkansen Films.`,
          details: [
            orderLine,
            ...(input.photoLink
              ? [
                  `Link das fotos: <a href="${escapeHtml(input.photoLink)}" style="color:#e10621; text-decoration:underline;">${escapeHtml(input.photoLink)}</a>`,
                ]
              : []),
          ],
          ctaLabel: input.photoLink ? "Abrir link das fotos" : undefined,
          ctaHref: input.photoLink,
          closing: "Obrigado por usar o Shinkansen Films.",
        }),
      }
  }
}

export async function sendOrderStatusEmail(input: OrderStatusEmailInput) {
  const resend = getResendClient()
  const from = `Shinkansen Films <${process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev"}>`
  const replyTo = process.env.RESEND_REPLY_TO || undefined
  const content = getStatusEmailContent(input)

  const response = await resend.emails.send({
    from,
    to: input.to,
    cc: INTERNAL_CC_EMAIL,
    subject: content.subject,
    html: content.html,
    ...(replyTo ? { replyTo } : {}),
  })

  if (response.error) {
    throw new Error(response.error.message)
  }

  return response.data
}

export function isNotifiableOrderStatus(status: string): status is OrderStatusEmailStatus {
  return ["criado", "recebido", "aguardando_pagamento", "pago", "finalizado"].includes(status)
}

/**
 * E-mail de confirmação de COMPRA NA LOJA (produtos), enviado quando o
 * pagamento é confirmado. Mostra o id do pedido, os itens comprados (com
 * quantidade, valor unitário e subtotal) e o total pago, avisando que o
 * cliente será notificado quando o pedido estiver pronto para retirada ou
 * for enviado pelos Correios.
 */
export async function sendStorePurchaseEmail(input: StorePurchaseEmailInput) {
  const resend = getResendClient()
  const from = `Shinkansen Films <${process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev"}>`
  const replyTo = process.env.RESEND_REPLY_TO || undefined

  const shortOrderId = input.orderId.slice(0, 8).toUpperCase()
  const greeting = getGreeting(input.customerName)

  const itemRows = input.items.map((item) => {
    const subtotal = (Number(item.unitPrice ?? 0)) * item.quantity
    return `${escapeHtml(item.name)} — ${item.quantity} × ${formatCurrency(
      item.unitPrice,
    )} = <strong>${formatCurrency(subtotal)}</strong>`
  })

  const html = renderEmailLayout({
    eyebrow: "Pagamento confirmado",
    title: "Compra confirmada",
    intro: `${greeting}! Obrigado por comprar com a Shinkansen Films — recebemos o pagamento da sua compra.`,
    details: [
      `Pedido: <strong>#${shortOrderId}</strong>`,
      ...itemRows,
      `Total pago: <strong>${formatCurrency(input.totalValue)}</strong>`,
    ],
    // As etapas de embalado/enviado são notificadas pelo sistema do laboratório,
    // então aqui avisamos apenas que os produtos entraram em separação.
    closing: "Seus produtos já estão em separação. Avisaremos você nas próximas etapas.",
  })

  const response = await resend.emails.send({
    from,
    to: input.to,
    cc: INTERNAL_CC_EMAIL,
    subject: `Compra #${shortOrderId} confirmada`,
    html,
    ...(replyTo ? { replyTo } : {}),
  })

  if (response.error) {
    throw new Error(response.error.message)
  }

  return response.data
}
