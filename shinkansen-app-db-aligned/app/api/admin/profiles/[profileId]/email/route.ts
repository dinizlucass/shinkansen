import { z } from "zod"

import { jsonErr, jsonOk } from "@/lib/api/http"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

const schema = z.object({
  email: z.string().trim().email(),
})

/**
 * Troca imediata do e-mail de um cliente pelo administrador.
 *
 * Usa a service role para atualizar o e-mail em auth.users (já confirmado, sem
 * enviar link) e mantém profiles.email em sincronia. Pensado para o caso em que
 * o e-mail antigo do cliente não funciona mais e ele não consegue se autenticar.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ profileId: string }> },
) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return jsonErr("Voce precisa estar logado.", 401)
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (profileError || !profile?.is_admin) {
    return jsonErr("Acesso negado.", 403)
  }

  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return jsonErr("E-mail invalido.", 400)
  }

  const { profileId } = await context.params
  const email = parsed.data.email.toLowerCase()

  const admin = createAdminClient()

  // 1. Atualiza o e-mail no Auth, já confirmado (não dispara e-mail).
  const { error: updateAuthError } = await admin.auth.admin.updateUserById(profileId, {
    email,
    email_confirm: true,
  })
  if (updateAuthError) {
    return jsonErr(updateAuthError.message || "Falha ao atualizar o e-mail no login.", 400)
  }

  // 2. Mantém o e-mail do perfil em sincronia.
  const { error: updateProfileError } = await admin
    .from("profiles")
    .update({ email })
    .eq("id", profileId)
  if (updateProfileError) {
    return jsonErr(updateProfileError.message || "E-mail do login trocado, mas falhou no perfil.", 400)
  }

  return jsonOk({ email })
}
