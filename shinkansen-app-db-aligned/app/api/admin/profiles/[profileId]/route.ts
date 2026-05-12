import { z } from "zod"

import { jsonErr, jsonOk } from "@/lib/api/http"
import { updateProfilePhotoLinkById } from "@/lib/profiles/photo-link"
import { createClient } from "@/lib/supabase/server"

const updateAdminProfileSchema = z.object({
  photoLink: z.string().trim().url().nullable().optional(),
})

export async function PATCH(
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
  const parsed = updateAdminProfileSchema.safeParse({
    photoLink:
      typeof body?.photoLink === "string"
        ? body.photoLink.trim() || null
        : body?.photoLink === null
          ? null
          : undefined,
  })

  if (!parsed.success || parsed.data.photoLink === undefined) {
    return jsonErr("Link de perfil invalido.", 400)
  }

  const { profileId } = await context.params
  const result = await updateProfilePhotoLinkById(profileId, parsed.data.photoLink)

  if (!result.ok) {
    return jsonErr(result.error.message, result.error.status, result.error.code)
  }

  return jsonOk(result.data)
}
