/**
 * app/api/store/create-order/route.ts
 *
 * Cria um pedido da loja (store_orders + store_order_items).
 *
 * O banco cuida automaticamente via triggers de:
 *   - validar e decrementar estoque (fn_decrement_stock)
 *   - validar cupom e incrementar uso (fn_validate_coupon_on_order)
 *
 * O pedido nasce com status 'pendente'. O pagamento será
 * adicionado em camada posterior (Efí / Mercado Pago).
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

interface ItemInput {
  product_id: string
  quantity:   number
  unit_price: number
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Não autenticado." },
        { status: 401 }
      )
    }

    const body = await req.json()
    const items: ItemInput[]   = body.items ?? []
    const deliveryType: string = body.delivery_type
    const shippingAddress      = body.shipping_address ?? null
    const cpf                  = body.cpf ?? null
    const cep                  = body.cep ?? null
    const shippingOption       = body.shipping_option ?? null
    const couponCode           = body.coupon_code ?? null
    const salvarPerfil         = body.salvar_perfil === true
    const incluirNegativos     = body.incluir_negativos === true

    if (!items.length) {
      return NextResponse.json({ ok: false, error: "Carrinho vazio." }, { status: 400 })
    }
    if (!["correios", "transportadora", "retirada"].includes(deliveryType)) {
      return NextResponse.json({ ok: false, error: "Tipo de entrega inválido." }, { status: 400 })
    }
    if (deliveryType !== "retirada" && !shippingAddress) {
      return NextResponse.json({ ok: false, error: "Endereço obrigatório." }, { status: 400 })
    }
    if (deliveryType !== "retirada" && (!cpf || cpf.replace(/\D/g, "").length !== 11)) {
      return NextResponse.json({ ok: false, error: "CPF válido obrigatório para envio." }, { status: 400 })
    }

    // Salva endereço e CPF no perfil, se o cliente pediu
    if (salvarPerfil && deliveryType !== "retirada") {
      await supabase
        .from("profiles")
        .update({ adress: shippingAddress, cpf: cpf.replace(/\D/g, "") })
        .eq("id", user.id)
    }

    // ── Recalcula valores no servidor (nunca confiar no cliente) ──
    const productIds = items.map((i) => i.product_id)
    const { data: produtos, error: prodErr } = await supabase
      .from("products")
      .select("id, price, stock_quantity, active")
      .in("id", productIds)

    if (prodErr || !produtos) {
      return NextResponse.json({ ok: false, error: "Erro ao buscar produtos." }, { status: 500 })
    }

    let totalValue = 0
    for (const item of items) {
      const produto = produtos.find((p) => p.id === item.product_id)
      if (!produto)        return NextResponse.json({ ok: false, error: "Produto não encontrado." }, { status: 400 })
      if (!produto.active) return NextResponse.json({ ok: false, error: "Produto indisponível." }, { status: 400 })
      if (produto.stock_quantity < item.quantity) {
        return NextResponse.json({ ok: false, error: `Estoque insuficiente.` }, { status: 400 })
      }
      totalValue += produto.price * item.quantity
    }

    // Soma o frete ao total (valor do frete validado no cliente via Melhor Envio)
    const shippingCost = shippingOption?.preco ? Number(shippingOption.preco) : 0
    totalValue += shippingCost

    // ── Resolve cupom (se houver) ──
    let couponId: string | null = null
    if (couponCode) {
      const { data: coupon } = await supabase
        .from("coupons")
        .select("id")
        .eq("code", couponCode)
        .single()
      couponId = coupon?.id ?? null
    }

    // ── Negativos a incluir no envio ──
    // Se o cliente pediu, busca TODOS os filmes concluídos dele que ainda
    // não foram enviados/embalados/descartados.
    let filmIds: string[] = []
    if (incluirNegativos && deliveryType !== "retirada") {
      const { data: pedidosCliente } = await supabase
        .from("orders")
        .select("id")
        .eq("client_id", user.id)

      const orderIds = (pedidosCliente ?? []).map((o) => o.id)
      if (orderIds.length > 0) {
        const { data: negativos } = await supabase
          .from("films")
          .select("id")
          .in("order_id", orderIds)
          .eq("status", "concluido")
        filmIds = (negativos ?? []).map((f) => f.id)
      }
    }

    // ── Cria o pedido — o trigger valida cupom e ajusta coupon_discount ──
    const { data: order, error: orderErr } = await supabase
      .from("store_orders")
      .insert({
        client_id:         user.id,
        status:            "pendente",
        total_value:       totalValue,
        delivery_type:     deliveryType,
        shipping_address:  shippingAddress,
        shipping_cost:     shippingCost,
        shipping_service:  shippingOption ? `${shippingOption.empresa} ${shippingOption.nome}` : null,
        shipping_deadline: shippingOption?.prazo ?? null,
        shipping_cep:      cep,
        cpf:               cpf,
        coupon_id:         couponId,
        film_ids:          filmIds,
      })
      .select("id, total_value, coupon_discount")
      .single()

    if (orderErr || !order) {
      // Trigger de cupom pode lançar exceção — repassa a mensagem
      return NextResponse.json(
        { ok: false, error: orderErr?.message ?? "Erro ao criar pedido." },
        { status: 400 }
      )
    }

    // ── Insere os itens — o trigger decrementa estoque ──
    const itensInsert = items.map((i) => ({
      store_order_id: order.id,
      product_id:     i.product_id,
      quantity:       i.quantity,
      unit_price:     produtos.find((p) => p.id === i.product_id)!.price,
    }))

    const { error: itemsErr } = await supabase
      .from("store_order_items")
      .insert(itensInsert)

    if (itemsErr) {
      // Reverte o pedido se os itens falharem (ex: estoque insuficiente no trigger)
      await supabase.from("store_orders").delete().eq("id", order.id)
      return NextResponse.json(
        { ok: false, error: itemsErr.message ?? "Erro ao adicionar itens." },
        { status: 400 }
      )
    }

    // ── Marca os negativos incluídos como "embalado" ──
    // Saíram da caixa de leva e foram para a caixa de envio deste pedido.
    if (filmIds.length > 0) {
      await supabase
        .from("films")
        .update({ status: "embalado" })
        .in("id", filmIds)
    }

    return NextResponse.json({
      ok: true,
      order: {
        id:              order.id,
        total_value:     order.total_value,
        coupon_discount: order.coupon_discount,
        negativos_incluidos: filmIds.length,
      },
    })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Erro ao processar o pedido." },
      { status: 500 }
    )
  }
}