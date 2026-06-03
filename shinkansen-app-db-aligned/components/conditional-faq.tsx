/**
 * components/conditional-faq.tsx
 *
 * Renderiza o FloatingFaq em todas as páginas EXCETO a loja (/store),
 * onde o HUD do time ocupa a base da tela.
 *
 * Uso: no app/layout.tsx, substitua <FloatingFaq /> por <ConditionalFaq />
 */

import { usePathname } from "next/navigation"
import { FloatingFaq } from "@/components/floating-faq"

export function ConditionalFaq() {
  const pathname = usePathname()
  if (pathname?.startsWith("/store")) return null
  return <FloatingFaq />
}