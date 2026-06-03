/**
 * app/api/store/calculate-shipping/route.ts
 *
 * Calcula opções de frete via Melhor Envio para o checkout.
 * Recebe CEP de destino + itens do carrinho, retorna lista de
 * transportadoras com preço e prazo.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { calcularFrete } from "@/lib/store/melhor-envio"
import type { ProductCategory } from "@/lib/store/types"

interface ItemInput {
  product_id: string
  quantity:   number
}

export async function POST(req: NextRequest) {
  try {
    const { cep, items } = await req.json()

    if (!cep || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { ok: false, error: "CEP e itens são obrigatórios." },
        { status: 400 }
      )
    }

    // Busca categorias e preços reais no servidor (não confiar no cliente)
    const supabase = await createClient()
    const ids = items.map((i: ItemInput) => i.product_id)
    const { data: produtos, error } = await supabase
      .from("products")
      .select("id, price, category")
      .in("id", ids)

    if (error || !produtos) {
      return NextResponse.json(
        { ok: false, error: "Erro ao buscar produtos." },
        { status: 500 }
      )
    }

    let valorTotal = 0
    const itensFrete = items.map((i: ItemInput) => {
      const p = produtos.find((pr) => pr.id === i.product_id)
      const price = p ? Number(p.price) : 0
      valorTotal += price * i.quantity
      return {
        category: (p?.category ?? "outro") as ProductCategory,
        quantity: i.quantity,
        price,
      }
    })

    const opcoes = await calcularFrete(cep, itensFrete, valorTotal)

    if (!opcoes.length) {
      return NextResponse.json({
        ok: false,
        error: "Nenhuma opção de frete disponível para este CEP.",
      })
    }

    return NextResponse.json({ ok: true, opcoes })
  } catch (e: any) {
    console.error("[calculate-shipping]", e)
    return NextResponse.json(
      { ok: false, error: e.message ?? "Erro ao calcular frete." },
      { status: 500 }
    )
  }
}