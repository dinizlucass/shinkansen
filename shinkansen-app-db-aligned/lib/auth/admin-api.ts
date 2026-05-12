import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"

type AdminApiAuthResult =
  | { ok: true; data: { userId: string; email: string | null } }
  | { ok: false; error: { message: string; status: number } }

export async function requireAdminApiUser(request: Request): Promise<AdminApiAuthResult> {
  const authorization = request.headers.get("authorization")?.trim()

  if (!authorization?.startsWith("Bearer ")) {
    return {
      ok: false,
      error: {
        message: "Authorization Bearer token obrigatorio.",
        status: 401,
      },
    }
  }

  const token = authorization.slice("Bearer ".length).trim()

  if (!token) {
    return {
      ok: false,
      error: {
        message: "Authorization Bearer token obrigatorio.",
        status: 401,
      },
    }
  }

  const admin = createAdminClient()
  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(token)

  if (userError || !user) {
    return {
      ok: false,
      error: {
        message: "Token invalido ou expirado.",
        status: 401,
      },
    }
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("is_admin, email")
    .eq("id", user.id)
    .single()

  if (profileError || !profile?.is_admin) {
    return {
      ok: false,
      error: {
        message: "Acesso negado.",
        status: 403,
      },
    }
  }

  return {
    ok: true,
    data: {
      userId: user.id,
      email: profile.email ?? user.email ?? null,
    },
  }
}
