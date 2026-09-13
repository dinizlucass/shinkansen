import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { mergeChunks } from './single-cookie'


export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Firebase Hosting só repassa o cookie `__session` ao backend.
      cookieOptions: { name: '__session' },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            // Junta os pedaços num único `__session` (Firebase só repassa esse).
            mergeChunks(cookiesToSet).forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as never),
            )
          } catch {
          }
        },
      },
    },
  )
}
