"use client"

/**
 * components/logout-button.tsx
 *
 * Botão de logout isolado (client component) para uso em páginas server.
 */

import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

export function LogoutButton() {
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleLogout}
      className="font-mono text-xs uppercase bg-transparent"
    >
      <LogOut className="h-4 w-4 mr-2" />
      Sair
    </Button>
  )
}