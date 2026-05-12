import "server-only"

import { z } from "zod"

import { isNotifiableOrderStatus, sendOrderStatusEmail } from "@/lib/email/order-status"
import * as efiPayments from "@/lib/payments/efi"
import { createAdminClient } from "@/lib/supabase/admin"
import { orderStatusEnum } from "@/lib/validators/orders"

export type UpdateOrderInput = {
  status?: z.infer<typeof orderStatusEnum>
  photoLink?: string | null
}

type UpdateOrderResult =
  | {
      ok: true
      data: {
        orderId: string
        status?: z.infer<typeof orderStatusEnum>
        photo_link?: string | null
        payment_provider?: string | null
        payment_status?: string | null
        payment_link_url?: string | null
        payment_requested_at?: string | null
        payment_link_expires_at?: string | null
        efi_charge_id?: string | null
        efi_charge_status?: string | null
        efi_custom_id?: string | null
        payment_error?: string | null
        payment_last_payload?: unknown
      }
    }
  | { ok: false; error: { message: string; status: number; code?: string } }

function extractPixCopyPasteFromPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") return null
  if (!("charge" in payload) || !payload.charge || typeof payload.charge !== "object") return null
  if (!("pixCopiaECola" in payload.charge) || typeof payload.charge.pixCopiaECola !== "string") return null
  return payload.charge.pixCopiaECola
}

export async function updateOrderFields(
  orderId: string,
  input: UpdateOrderInput,
): Promise<UpdateOrderResult> {
  const admin = createAdminClient()
  const { data: currentOrder, error: currentOrderError } = await admin
    .from("orders")
    .select(`
      id,
      status,
      total_value,
      photo_link,
      payment_last_payload,
      profiles:client_id (
        full_name,
        email
      )
    `)
    .eq("id", orderId)
    .single()

  if (currentOrderError || !currentOrder) {
    return {
      ok: false,
      error: {
        message: currentOrderError?.message || "Pedido nao encontrado.",
        status: 404,
        code: currentOrderError?.code,
      },
    }
  }

  const updates: {
    status?: z.infer<typeof orderStatusEnum>
    photo_link?: string | null
    payment_provider?: string | null
    payment_status?: string | null
    payment_link_url?: string | null
    payment_requested_at?: string | null
    payment_link_expires_at?: string | null
    efi_charge_id?: string | null
    efi_charge_status?: string | null
    efi_custom_id?: string | null
    payment_error?: string | null
    payment_last_payload?: unknown
  } = {}

  if (input.status !== undefined) {
    updates.status = input.status
  }

  if (input.photoLink !== undefined) {
    updates.photo_link = input.photoLink
  }

  if (input.status === "aguardando_pagamento") {
    const totalValue = Number(currentOrder.total_value ?? 0)

    if (!(totalValue > 0)) {
      return {
        ok: false,
        error: {
          message: "O pedido precisa ter um valor total maior que zero para gerar pagamento.",
          status: 400,
        },
      }
    }

    try {
      const payment = await efiPayments.createEfiPixCharge({
        amount: efiPayments.centsToPixAmount(Math.round(totalValue * 100)),
        pixKey: efiPayments.getEfiPixConfig().pixKey,
        payerMessage: `Pedido #${currentOrder.id.slice(0, 8).toUpperCase()}`,
      })

      const paymentExpiresAt = payment.expiresInSeconds
        ? new Date(Date.now() + payment.expiresInSeconds * 1000).toISOString()
        : null

      updates.payment_provider = "efi_pix"
      updates.payment_status = "pending"
      updates.payment_link_url = payment.paymentLinkUrl
      updates.payment_requested_at = new Date().toISOString()
      updates.payment_link_expires_at = paymentExpiresAt
      updates.efi_charge_id = payment.txid
      updates.efi_charge_status = payment.status
      updates.efi_custom_id = payment.locationId ? String(payment.locationId) : null
      updates.payment_error = null
      updates.payment_last_payload = payment.raw
    } catch (error) {
      return {
        ok: false,
        error: {
          message: error instanceof Error ? error.message : "Falha ao gerar cobranca Pix da Efi.",
          status: 500,
        },
      }
    }
  }

  const { error } = await admin.from("orders").update(updates).eq("id", orderId)

  if (error) {
    return {
      ok: false,
      error: {
        message: error.message,
        status: 500,
        code: error.code,
      },
    }
  }

  const nextStatus = updates.status
  const previousStatus = currentOrder.status
  const customerProfile = Array.isArray(currentOrder.profiles) ? currentOrder.profiles[0] : currentOrder.profiles
  const customerEmail = customerProfile?.email?.trim()

  if (
    nextStatus &&
    nextStatus !== previousStatus &&
    isNotifiableOrderStatus(nextStatus) &&
    customerEmail &&
    process.env.RESEND_API_KEY
  ) {
    const nextPhotoLink = updates.photo_link ?? currentOrder.photo_link ?? null
    const nextPaymentPayload =
      (updates.payment_last_payload as Record<string, unknown> | undefined) ??
      (currentOrder.payment_last_payload as Record<string, unknown> | null) ??
      null

    try {
      await sendOrderStatusEmail({
        to: customerEmail,
        customerName: customerProfile?.full_name ?? null,
        orderId,
        status: nextStatus,
        totalValue: Number(currentOrder.total_value ?? 0),
        paymentLinkUrl: updates.payment_link_url ?? null,
        pixCopyPaste: extractPixCopyPasteFromPayload(nextPaymentPayload),
        photoLink: nextPhotoLink,
      })
    } catch (emailError) {
      console.error("Failed to send order status email", emailError)
    }
  }

  return {
    ok: true,
    data: {
      orderId,
      ...updates,
    },
  }
}
