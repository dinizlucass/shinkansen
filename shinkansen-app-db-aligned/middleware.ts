import { updateSession } from '@/lib/supabase/proxy'
import { type NextRequest } from 'next/server'

/**
 * Supabase SSR session sync.
 *
 * This file MUST be named `middleware.ts` at the project root for Next.js
 * to pick it up.
 */
export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
