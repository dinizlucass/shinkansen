"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FadeIn, SlideIn } from "@/components/page-transition"
import { AnimatedLogo } from "@/components/animated-logo"
import { ArrowLeft, Loader2, Lock } from "lucide-react"

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [checking, setChecking] = useState(true)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // A sessão de recuperação é estabelecida pelo browser client ao abrir o link
  // do e-mail (detectSessionInUrl). Confirmamos que existe uma sessão válida.
  useEffect(() => {
    const supabase = createClient()

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setReady(true)
        setChecking(false)
      }
    })

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setReady(true)
      }
      setChecking(false)
    })

    // Se após alguns segundos não houver sessão, o link é inválido/expirado.
    const timer = setTimeout(() => setChecking(false), 4000)

    return () => {
      sub.subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    if (password.length < 8) {
      setMessage({ type: "error", text: "A senha deve ter ao menos 8 caracteres." })
      return
    }
    if (password !== confirm) {
      setMessage({ type: "error", text: "As senhas nao coincidem." })
      return
    }

    setIsLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setMessage({ type: "error", text: error.message })
      setIsLoading(false)
    } else {
      setMessage({ type: "success", text: "Senha definida com sucesso! Redirecionando..." })
      setTimeout(() => {
        router.push("/account")
        router.refresh()
      }, 1500)
    }
  }

  return (
    <div className="min-h-screen bg-background flex">
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 md:px-16 lg:px-24">
        <FadeIn delay={0.1}>
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8 font-mono text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            VOLTAR PARA O LOGIN
          </Link>
        </FadeIn>

        <FadeIn delay={0.2}>
          <AnimatedLogo className="w-48 h-auto mb-8" />
        </FadeIn>

        <SlideIn direction="left" delay={0.3}>
          <h1 className="text-3xl font-mono font-bold mb-2">DEFINIR NOVA SENHA</h1>
          <p className="text-muted-foreground font-mono text-sm mb-8">
            Escolha uma senha para acessar sua conta com e-mail e senha.
          </p>
        </SlideIn>

        <FadeIn delay={0.4}>
          {checking ? (
            <div className="flex items-center gap-2 font-mono text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Validando o link...
            </div>
          ) : !ready ? (
            <div className="max-w-md space-y-4">
              <div className="p-4 border border-destructive bg-destructive/10 text-destructive font-mono text-sm">
                Link invalido ou expirado. Peca um novo link para redefinir a senha.
              </div>
              <Button asChild className="font-mono uppercase">
                <Link href="/auth/forgot-password">Pedir novo link</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="password" className="font-mono text-xs uppercase tracking-wider">
                  Nova senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="********"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 font-mono bg-input border-border focus:border-primary"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm" className="font-mono text-xs uppercase tracking-wider">
                  Confirmar senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm"
                    type="password"
                    placeholder="********"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="pl-10 font-mono bg-input border-border focus:border-primary"
                    required
                  />
                </div>
              </div>

              {message && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 border font-mono text-sm ${
                    message.type === "error"
                      ? "border-destructive bg-destructive/10 text-destructive"
                      : "border-green-500 bg-green-500/10 text-green-500"
                  }`}
                >
                  {message.text}
                </motion.div>
              )}

              <Button type="submit" disabled={isLoading} className="w-full font-mono uppercase tracking-wider h-12">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "SALVAR SENHA"}
              </Button>
            </form>
          )}
        </FadeIn>
      </div>

      <div className="hidden lg:flex w-1/2 bg-muted/20 items-center justify-center relative overflow-hidden">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
        >
          <div className="w-48 h-48 border-4 border-primary mx-auto mb-8 flex items-center justify-center">
            <Lock className="h-16 w-16 text-primary" />
          </div>
          <p className="font-mono text-muted-foreground text-sm">ACESSO SEGURO</p>
        </motion.div>

        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(var(--primary) 1px, transparent 1px),
              linear-gradient(90deg, var(--primary) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
          }}
        />
      </div>
    </div>
  )
}
