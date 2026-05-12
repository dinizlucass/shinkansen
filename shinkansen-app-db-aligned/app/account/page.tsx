import { redirect } from "next/navigation"
import { getProfileDefaults } from "@/lib/profile-bootstrap"
import { createClient } from "@/lib/supabase/server"
import { AccountClient } from "@/components/account/account-client"

export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Fetch user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  const hydratedProfile = profile
    ? { ...profile, ...getProfileDefaults(user, profile) }
    : {
        id: user.id,
        email: user.email ?? "",
        photo_link: null,
        role: "client" as const,
        credits: 0,
        is_admin: false,
        ...getProfileDefaults(user, null),
      }

  return (
    <AccountClient 
      user={user} 
      profile={hydratedProfile}
    />
  )
}
