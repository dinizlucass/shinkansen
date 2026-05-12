export interface OrderProfileSnapshot {
  full_name?: string | null
  phone?: string | null
}

export function isProfileComplete(profile: OrderProfileSnapshot | null | undefined) {
  return Boolean(profile?.full_name?.trim() && profile?.phone?.trim())
}
