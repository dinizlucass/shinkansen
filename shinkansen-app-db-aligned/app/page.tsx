/**
 * app/page.tsx
 *
 * Busca slides no servidor (SSR) e passa para o HomeClient.
 * Os slides vêm de um JSON do próprio bundle (public/slides-data.json), então
 * carregá-los a cada request é praticamente gratuito.
 *
 * IMPORTANTE: a página é dinâmica (force-dynamic). Ela lê a sessão do usuário
 * (getUser) para renderizar o estado logado; se fosse cacheada (revalidate/ISR),
 * o CDN serviria a versão DESLOGADA para todos — inclusive quem acabou de logar,
 * que era o bug de "voltar para a home deslogado" atrás do Firebase.
 */

import { createClient } from "@/lib/supabase/server"
import { HomeClient }   from "@/components/home-client"
import { obterSlides }  from "@/lib/drive-slides"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Busca slides no servidor com fallback para array vazio
  const slides = await obterSlides().catch(() => [])

  return <HomeClient user={user} initialSlides={slides} />
}