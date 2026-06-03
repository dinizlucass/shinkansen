"use client"

/**
 * components/store/animated-total.tsx
 *
 * Total do time com animação de contagem ("rolagem" dos números)
 * quando o valor muda — efeito de placar de jogo de luta.
 */

import * as React from "react"
import { motion, useSpring, useTransform } from "framer-motion"

export function AnimatedTotal({ value }: { value: number }) {
  // Spring que persegue o valor alvo — dá o efeito de "somando na tela"
  const spring = useSpring(value, {
    stiffness: 90,
    damping:   16,
    mass:      0.8,
  })

  React.useEffect(() => {
    spring.set(value)
  }, [value, spring])

  const display = useTransform(spring, (v) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
  )

  return (
    <motion.span className="tabular-nums">{display}</motion.span>
  )
}