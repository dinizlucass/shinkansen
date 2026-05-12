interface UserMetadataShape {
  full_name?: unknown
  phone?: unknown
}

interface UserShape {
  id: string
  email?: string | null
  user_metadata?: UserMetadataShape | null
}

interface ProfileShape {
  full_name?: string | null
  phone?: string | null
  adress?: string | null
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export function getProfileDefaults(user: UserShape, profile?: ProfileShape | null) {
  const metadata = user.user_metadata ?? {}
  const fullName = getString(profile?.full_name) || getString(metadata.full_name)
  const phone = getString(profile?.phone) || getString(metadata.phone)
  const adress = getString(profile?.adress)

  return {
    full_name: fullName || null,
    phone: phone || null,
    adress: adress || null,
  }
}
