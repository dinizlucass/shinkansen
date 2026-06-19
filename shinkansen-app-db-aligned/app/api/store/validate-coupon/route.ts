/**
 * app/api/store/validate-coupon/route.ts
 *
 * Valida um cupom antes de aplicar no checkout.
 * Checa: ativo, expirado, usos globais, uso por cliente.
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

    // Identifica o usuário
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Faça login para usar cupons." }, { status: 401 })
    }

    // Busca cupom
    const { data: coupon, error } = await supabase
      .from("coupons")
      .select("id, code, discount, min_order, max_uses, uses_count, active, one_per_client, expires_at")
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

    // Verifica uso por cliente (se habilitado)
    if (coupon.one_per_client) {
      const { count } = await supabase
        .from("store_orders")
        .select("id", { count: "exact", head: true })
        .eq("client_id", user.id)
        .eq("coupon_id", coupon.id)
        .neq("status", "cancelado")

      if (count && count > 0) {
        return NextResponse.json({ ok: false, error: "Você já usou este cupom." })
      }
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