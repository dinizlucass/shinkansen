import { z } from "zod"

import { requireAdminApiUser } from "@/lib/auth/admin-api"
import { jsonErr, jsonOk } from "@/lib/api/http"
import { updateProfilePhotoLinkByEmail } from "@/lib/profiles/photo-link"

const updateExternalProfileSchema = z.object({
  email: z.string().trim().email(),
  photoLink: z.string().trim().url().nullable().optional(),
})

export async function PATCH(request: Request) {
  const auth = await requireAdminApiUser(request)

  if (!auth.ok) {
    return jsonErr(auth.error.message, auth.error.status)
  }

  const body = await request.json().catch(() => null)
  const parsed = updateExternalProfileSchema.safeParse({
    email: typeof body?.email === "string" ? body.email.trim() : body?.email,
    photoLink:
      typeof body?.photoLink === "string"
        ? body.photoLink.trim() || null
        : body?.photoLink === null
          ? null
          : undefined,
  })

  if (!parsed.success || parsed.data.photoLink === undefined) {
    return jsonErr(parsed.error?.issues[0]?.message ?? "Dados invalidos para atualizar o perfil.", 400)
  }

  const result = await updateProfilePhotoLinkByEmail(parsed.data.email, parsed.data.photoLink)

  if (!result.ok) {
    return jsonErr(result.error.message, result.error.status, result.error.code)
  }

  return jsonOk(result.data)
}
