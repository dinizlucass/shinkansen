"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

type PaymentState = "aguardando" | "confirmado" | "erro"

/**
 * Hook que escuta Supabase Realtime para detectar
 * quando o pagamento Pix é confirmado via webhook da Efí.
 *
 * Uso:
 *   const status = usePaymentStatus(orderId)
 *   if (status === "confirmado") → mostra sucesso
 */
export function usePaymentStatus(orderId: string | null): PaymentState {
  const [status, setStatus] = useState<PaymentState>("aguardando")

  useEffect(() => {
    if (!orderId) return

    const supabase = createClient()

    const channel = supabase
      .channel(`payment-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "store_orders",
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          const paymentStatus = payload.new?.payment_status
          const orderStatus   = payload.new?.status

          if (paymentStatus === "paid" || orderStatus === "pago") {
            setStatus("confirmado")
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [orderId])

  return status
}