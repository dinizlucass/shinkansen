import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"

type ProfilePhotoLinkResult =
  | { ok: true; data: { profileId: string; email: string | null; photo_link: string | null } }
  | { ok: false; error: { message: string; status: number; code?: string } }

export async function updateProfilePhotoLinkById(
  profileId: string,
  photoLink: string | null,
): Promise<ProfilePhotoLinkResult> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from("profiles")
    .update({ photo_link: photoLink })
    .eq("id", profileId)
    .select("id, email, photo_link")
    .single()

  if (error || !data) {
    const notFound = error?.code === "PGRST116"
    return {
      ok: false,
      error: {
        message: notFound ? "Perfil nao encontrado." : error?.message ?? "Falha ao atualizar o perfil.",
        status: notFound ? 404 : 500,
        code: error?.code,
      },
    }
  }

  return {
    ok: true,
    data: {
      profileId: data.id,
      email: data.email ?? null,
      photo_link: data.photo_link ?? null,
    },
  }
}

export async function updateProfilePhotoLinkByEmail(
  email: string,
  photoLink: string | null,
): Promise<ProfilePhotoLinkResult> {
  const normalizedEmail = email.trim().toLowerCase()
  const admin = createAdminClient()

  const { data: existingProfile, error: existingProfileError } = await admin
    .from("profiles")
    .select("id, email")
    .ilike("email", normalizedEmail)
    .single()

  if (existingProfileError || !existingProfile) {
    const notFound = existingProfileError?.code === "PGRST116"
    return {
      ok: false,
      error: {
        message: notFound ? "Perfil nao encontrado." : existingProfileError?.message ?? "Falha ao localizar o perfil.",
        status: notFound ? 404 : 500,
        code: existingProfileError?.code,
      },
    }
  }

  return updateProfilePhotoLinkById(existingProfile.id, photoLink)
}
