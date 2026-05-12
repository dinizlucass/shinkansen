"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FadeIn, SlideIn } from "@/components/page-transition"
import { AnimatedLogo } from "@/components/animated-logo"
import { ArrowLeft, Loader2, Lock, Mail } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isMagicLink, setIsMagicLink] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const getRedirectUrl = () => {
    return process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${window.location.origin}/`
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage(null)

    const supabase = createClient()

    if (isMagicLink) {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: getRedirectUrl(),
        },
      })

      if (error) {
        setMessage({ type: "error", text: error.message })
      } else {
        setMessage({ type: "success", text: "Confira seu email para acessar pelo link magico!" })
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setMessage({ type: "error", text: error.message })
      } else {
        router.push("/")
        router.refresh()
      }
    }

    setIsLoading(false)
  }

  return (
    <div className="min-h-screen bg-background flex">
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 md:px-16 lg:px-24">
        <FadeIn delay={0.1}>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8 font-mono text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            VOLTAR PARA O INICIO
          </Link>
        </FadeIn>

        <FadeIn delay={0.2}>
          <AnimatedLogo className="w-48 h-auto mb-8" />
        </FadeIn>

        <SlideIn direction="left" delay={0.3}>
          <h1 className="text-3xl font-mono font-bold mb-2">ENTRAR NA CONTA</h1>
          <p className="text-muted-foreground font-mono text-sm mb-8">
            Acesse seus pedidos e os dados da sua conta.
          </p>
        </SlideIn>

        <FadeIn delay={0.4}>
          <form onSubmit={handleLogin} className="space-y-6 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-mono text-xs uppercase tracking-wider">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 font-mono bg-input border-border focus:border-primary"
                  required
                />
              </div>
            </div>

            {!isMagicLink && (
              <motion.div
                className="space-y-2"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <Label htmlFor="password" className="font-mono text-xs uppercase tracking-wider">
                  Senha
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
                  />
                </div>
              </motion.div>
            )}

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
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : isMagicLink ? "ENVIAR LINK MAGICO" : "ENTRAR"}
            </Button>

            <button
              type="button"
              onClick={() => setIsMagicLink(!isMagicLink)}
              className="w-full text-center text-sm font-mono text-muted-foreground hover:text-primary transition-colors"
            >
              {isMagicLink ? "Usar senha" : "Usar link magico"}
            </button>

            <div className="border-t border-border pt-6">
              <p className="text-center text-sm font-mono text-muted-foreground">
                Ainda nao tem conta?{" "}
                <Link href="/auth/sign-up" className="text-primary hover:underline">
                  CRIAR CONTA
                </Link>
              </p>
            </div>
          </form>
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
