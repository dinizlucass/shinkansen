import { createBrowserClient } from '@supabase/ssr'

// Firebase Hosting só repassa ao backend o cookie chamado `__session`; todos os
// outros são descartados. Por isso forçamos a sessão do Supabase a viver nesse
// cookie único, senão o SSR/middleware nunca enxerga o usuário logado.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { name: '__session' },
    },
  )
}
