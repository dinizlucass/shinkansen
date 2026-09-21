import { type NextRequest, NextResponse } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"

import { createClient } from "@/lib/supabase/server"

/**
 * Confirmação de links de e-mail (recuperação de senha, troca de e-mail, etc.)
 * pelo fluxo token_hash + verifyOtp — feito no SERVIDOR.
 *
 * Por que servidor: o fluxo PKCE (link com ?code=) exige o code_verifier salvo
 * no mesmo navegador que pediu o link, então quebra quando a pessoa abre o
 * e-mail em outro dispositivo. Com verifyOtp(token_hash) a sessão é criada aqui
 * e gravada no cookie (__session, que o Firebase Hosting repassa ao Cloud Run),
 * funcionando cross-device.
 *
 * Template do Supabase deve apontar para:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/update-password
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const next = searchParams.get("next") || "/auth/update-password"

  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || origin

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      // Sessão criada e gravada em cookie. Segue para a próxima página.
      return NextResponse.redirect(`${base}${next}`)
    }
    return NextResponse.redirect(
      `${base}/auth/error?reason=${encodeURIComponent(error.message)}`,
    )
  }

  return NextResponse.redirect(`${base}/auth/error?reason=link-invalido`)
}
