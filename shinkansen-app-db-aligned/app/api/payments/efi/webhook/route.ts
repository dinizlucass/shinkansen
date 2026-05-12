import { jsonErr, jsonOk } from "@/lib/api/http"
import { sendOrderStatusEmail } from "@/lib/email/order-status"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { configureEfiPixWebhook, getEfiPixConfig, getEfiPixWebhook } from "@/lib/payments/efi"

function isAuthorizedWebhookRequest(request: Request) {
  const { webhookHmac } = getEfiPixConfig()
  if (!webhookHmac) {
    return false
  }

  const url = new URL(request.url)
  return url.searchParams.get("hmac") === webhookHmac
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return jsonErr("Voce precisa estar logado.", 401)
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) {
    return jsonErr("Acesso negado.", 403)
  }

  try {
    const webhook = await getEfiPixWebhook()
    return jsonOk(webhook)
  } catch (error) {
    return jsonErr(error instanceof Error ? error.message : "Falha ao consultar webhook Pix.", 500)
  }
}

export async function PUT() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return jsonErr("Voce precisa estar logado.", 401)
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) {
    return jsonErr("Acesso negado.", 403)
  }

  try {
    const webhook = await configureEfiPixWebhook()
    return jsonOk(webhook)
  } catch (error) {
    return jsonErr(error instanceof Error ? error.message : "Falha ao configurar webhook Pix.", 500)
  }
}

export async function POST(request: Request) {
  if (!isAuthorizedWebhookRequest(request)) {
    return new Response("unauthorized", { status: 401 })
  }

  const payload = await request.json().catch(() => null) as
    | {
        pix?: Array<{
          txid?: string
          horario?: string
          valor?: string
          endToEndId?: string
          chave?: string
        }>
      }
    | null

  if (!payload?.pix?.length) {
    return new Response("ok", { status: 200 })
  }

  const admin = createAdminClient()

  for (const pix of payload.pix) {
    if (!pix.txid) continue

    const { data: order } = await admin
      .from("orders")
      .select(`
        id,
        status,
        payment_status,
        payment_paid_at,
        payment_last_payload,
        total_value,
        profiles:client_id (
          full_name,
          email
        )
      `)
      .eq("efi_charge_id", pix.txid)
      .single()

    if (!order) continue

    const previousPayload =
      order.payment_last_payload && typeof order.payment_last_payload === "object"
        ? (order.payment_last_payload as Record<string, unknown>)
        : {}

    const history = Array.isArray(previousPayload.webhookEvents)
      ? previousPayload.webhookEvents
      : []

    const duplicateEvent = history.some((event) => {
      if (!event || typeof event !== "object") return false

      const payloadEvent = "pix" in event && event.pix && typeof event.pix === "object"
        ? (event.pix as Record<string, unknown>)
        : null

      if (!payloadEvent) return false

      const sameEndToEndId =
        pix.endToEndId &&
        typeof payloadEvent.endToEndId === "string" &&
        payloadEvent.endToEndId === pix.endToEndId

      const sameTxidAndTime =
        typeof payloadEvent.txid === "string" &&
        payloadEvent.txid === pix.txid &&
        typeof payloadEvent.horario === "string" &&
        payloadEvent.horario === pix.horario

      return Boolean(sameEndToEndId || sameTxidAndTime)
    })

    if (duplicateEvent) {
      continue
    }

    const alreadyPaid = order.status === "pago" || order.payment_status === "paid"

    await admin
      .from("orders")
      .update({
        status: "pago",
        payment_status: "paid",
        payment_paid_at: pix.horario ?? new Date().toISOString(),
        efi_charge_status: "CONCLUIDA",
        payment_error: null,
        payment_last_payload: {
          ...previousPayload,
          webhookEvents: [
            ...history,
            {
              receivedAt: new Date().toISOString(),
              pix,
            },
          ],
        },
      })
      .eq("id", order.id)

    const customerProfile = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles
    const customerEmail = customerProfile?.email?.trim()

    if (!alreadyPaid && customerEmail && process.env.RESEND_API_KEY) {
      try {
        await sendOrderStatusEmail({
          to: customerEmail,
          customerName: customerProfile?.full_name ?? null,
          orderId: order.id,
          status: "pago",
          totalValue: Number(order.total_value ?? 0),
        })
      } catch (emailError) {
        console.error("Failed to send paid email after Pix webhook", emailError)
      }
    }
  }

  return new Response("ok", { status: 200 })
}
