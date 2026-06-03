/**
 * app/page.tsx
 *
 * Busca slides no servidor (SSR) e passa para o HomeClient.
 * O cache é controlado pela tag "slides" — revalidado via
 * POST /api/slides/revalidate sempre que a pasta do Drive for atualizada.
 */

import { createClient } from "@/lib/supabase/server"
import { HomeClient }   from "@/components/home-client"
import { obterSlides }  from "@/lib/drive-slides"

export const revalidate = 3600 // fallback: revalida a cada 1h mesmo sem chamada manual

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Busca slides no servidor com fallback para array vazio
  const slides = await obterSlides().catch(() => [])

  return <HomeClient user={user} initialSlides={slides} />
}