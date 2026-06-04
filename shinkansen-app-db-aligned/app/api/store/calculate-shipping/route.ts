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

    // ── Filtro de transportadoras ─────────────────────────────────────
    // Controla quais transportadoras aparecem no checkout.
    // Use o nome que o Melhor Envio retorna em op.empresa / op.nome.
    //
    // PERMITIDAS: lista de substrings (case-insensitive).
    //   Se vazia [] → mostra todas.
    //   Se preenchida → só mostra as que baterem com pelo menos uma substring.
    //
    // Exemplos de nomes retornados pelo ME:
    //   "Correios" · "PAC" · "SEDEX" · "Mini Envios"
    //   "Jadlog" · "Jadlog .Package" · "Jadlog .Com"
    //   "Azul Cargo" · "Loggi" · "Latam Cargo" · "Total Express"
    //
    const TRANSPORTADORAS_PERMITIDAS: string[] = [
      "Loggi Express",
      "Jadlog .Package",
      "SEDEX",
      "PAC",
      "Total Express Standard",
    ]

    const opcoesFiltradas = TRANSPORTADORAS_PERMITIDAS.length === 0
      ? opcoes
      : opcoes.filter(op => {
          const label = `${op.empresa ?? ""} ${op.nome ?? ""}`.toLowerCase()
          return TRANSPORTADORAS_PERMITIDAS.some(t => label.includes(t.toLowerCase()))
        })

    if (!opcoesFiltradas.length) {
      return NextResponse.json({
        ok: false,
        error: "Nenhuma opção de frete disponível para este CEP.",
      })
    }

    // ── Margem operacional ─────────────────────────────────────────────
    const MARGEM_FIXA_BRL = 3.00   // ← ajuste aqui (R$)
    const MARGEM_PORCENTO = 0.10   // ← ajuste aqui (0.10 = 10%)

    const opcoesComMargem = opcoesFiltradas.map(op => ({
      ...op,
      preco: Math.ceil(
        (op.preco + MARGEM_FIXA_BRL + op.preco * MARGEM_PORCENTO) * 100
      ) / 100,
    }))

    return NextResponse.json({ ok: true, opcoes: opcoesComMargem })
  } catch (e: any) {
    console.error("[calculate-shipping]", e)
    return NextResponse.json(
      { ok: false, error: e.message ?? "Erro ao calcular frete." },
      { status: 500 }
    )
  }
}