import { createBrowserClient } from '@supabase/ssr'

import { mergeChunks, type CookieItem } from './single-cookie'

// Firebase Hosting clássico só repassa ao backend o cookie chamado `__session`.
// Por isso: (1) forçamos a sessão a viver nesse cookie e (2) sobrescrevemos a
// gravação para juntar os pedaços num único `__session` em vez de `__session.0/.1`
// (que o Firebase descartaria, quebrando o login).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { name: '__session' },
      cookies: {
        getAll() {
          if (typeof document === 'undefined') return []
          if (!document.cookie) return []
          return document.cookie
            .split('; ')
            .filter(Boolean)
            .map((pair) => {
              const eq = pair.indexOf('=')
              const name = decodeURIComponent(pair.slice(0, eq))
              const value = decodeURIComponent(pair.slice(eq + 1))
              return { name, value }
            })
        },
        setAll(cookiesToSet: CookieItem[]) {
          if (typeof document === 'undefined') return
          for (const { name, value, options } of mergeChunks(cookiesToSet)) {
            const o = (options ?? {}) as Record<string, unknown>
            let str = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`
            str += `; Path=${(o.path as string) ?? '/'}`
            if (o.maxAge != null) str += `; Max-Age=${o.maxAge as number}`
            if (o.expires) {
              const d = o.expires instanceof Date ? o.expires : new Date(o.expires as string)
              str += `; Expires=${d.toUTCString()}`
            }
            if (o.domain) str += `; Domain=${o.domain as string}`
            if (o.sameSite) str += `; SameSite=${o.sameSite as string}`
            if (o.secure) str += `; Secure`
            document.cookie = str
          }
        },
      },
    },
  )
}
