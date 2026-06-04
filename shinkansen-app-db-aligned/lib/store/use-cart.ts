"use client"

/**
 * lib/store/use-cart.ts
 *
 * Hook de carrinho com validação de estoque por produto.
 * Estado em memória (useState) — sem localStorage, pois o carrinho
 * abandonado será rastreado pelo banco via store_orders pendente.
 */

import * as React from "react"
import type { CartItem, Product } from "./types"

export function useCart() {
  const [items, setItems] = React.useState<CartItem[]>([])

  const adicionar = React.useCallback((product: Product, quantity = 1) => {
    setItems((prev) => {
      const existente = prev.find((i) => i.product.id === product.id)
      const novaQtd   = (existente?.quantity ?? 0) + quantity

      // Respeita o estoque disponível
      const qtdFinal = Math.min(novaQtd, product.stock_quantity)

      if (existente) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: qtdFinal } : i
        )
      }
      return [...prev, { product, quantity: qtdFinal }]
    })
  }, [])

  const remover = React.useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.product.id !== productId))
  }, [])

  const alterarQuantidade = React.useCallback(
    (productId: string, quantity: number) => {
      setItems((prev) => {
        if (quantity <= 0) {
          return prev.filter((i) => i.product.id !== productId)
        }
        return prev.map((i) => {
          if (i.product.id !== productId) return i
          // Não deixa passar do estoque
          const qtdFinal = Math.min(quantity, i.product.stock_quantity)
          return { ...i, quantity: qtdFinal }
        })
      })
    },
    []
  )

  const limpar = React.useCallback(() => setItems([]), [])

  const subtotal = React.useMemo(
    () => items.reduce((acc, i) => acc + i.product.price * i.quantity, 0),
    [items]
  )

  const totalItens = React.useMemo(
    () => items.reduce((acc, i) => acc + i.quantity, 0),
    [items]
  )

  // Verifica se pode adicionar mais de um produto (respeitando estoque)
  const podeAdicionar = React.useCallback(
    (product: Product) => {
      const item = items.find((i) => i.product.id === product.id)
      const qtdAtual = item?.quantity ?? 0
      return qtdAtual < product.stock_quantity
    },
    [items]
  )

  return {
    items,
    adicionar,
    remover,
    alterarQuantidade,
    limpar,
    subtotal,
    totalItens,
    podeAdicionar,
  }
}