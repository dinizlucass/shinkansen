/**
 * app/api/store/validate-coupon/route.ts
 *
 * Valida um cupom antes de aplicar no checkout.
 * A validação definitiva acontece no trigger do banco ao criar o pedido,
 * mas validamos aqui para dar feedback imediato ao usuário.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  try {
    const { code, subtotal } = await req.json()

    if (!code || typeof subtotal !== "number") {
      return NextResponse.json(
        { ok: false, error: "Dados inválidos." },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: coupon, error } = await supabase
      .from("coupons")
      .select("id, code, discount, min_order, max_uses, uses_count, active, expires_at")
      .eq("code", code)
      .single()

    if (error || !coupon) {
      return NextResponse.json({ ok: false, error: "Cupom não encontrado." })
    }

    if (!coupon.active) {
      return NextResponse.json({ ok: false, error: "Cupom inativo." })
    }

    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return NextResponse.json({ ok: false, error: "Cupom expirado." })
    }

    if (coupon.max_uses !== null && coupon.uses_count >= coupon.max_uses) {
      return NextResponse.json({ ok: false, error: "Cupom esgotado." })
    }

    if (subtotal < coupon.min_order) {
      return NextResponse.json({
        ok: false,
        error: `Valor mínimo de ${coupon.min_order.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} para este cupom.`,
      })
    }

    return NextResponse.json({
      ok: true,
      coupon: {
        id:       coupon.id,
        code:     coupon.code,
        discount: coupon.discount,
      },
    })
  } catch {
    return NextResponse.json(
      { ok: false, error: "Erro ao validar cupom." },
      { status: 500 }
    )
  }
}