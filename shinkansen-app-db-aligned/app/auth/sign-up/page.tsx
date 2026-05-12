"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"

import { createClient } from "@/lib/supabase/client"
import { normalizePhoneToE164 } from "@/lib/validators/profiles"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FadeIn, SlideIn } from "@/components/page-transition"
import { AnimatedLogo } from "@/components/animated-logo"
import { ArrowLeft, Loader2, Lock, Mail, Phone, User } from "lucide-react"

export default function SignUpPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const getRedirectUrl = () => {
    return process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${window.location.origin}/`
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage(null)

    if (formData.password !== formData.confirmPassword) {
      setMessage({ type: "error", text: "As senhas nao conferem." })
      setIsLoading(false)
      return
    }

    if (formData.password.length < 6) {
      setMessage({ type: "error", text: "A senha deve ter ao menos 6 caracteres." })
      setIsLoading(false)
      return
    }

    const phoneE164 = normalizePhoneToE164(formData.phone)
    if (!phoneE164) {
      setMessage({ type: "error", text: "Telefone invalido. Informe DDD + numero (ex: (11) 99999-9999)." })
      setIsLoading(false)
      return
    }

    const supabase = createClient()

    const { data, error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        emailRedirectTo: getRedirectUrl(),
        data: {
          full_name: formData.fullName.trim(),
          phone: phoneE164,
        },
      },
    })

    if (error) {
      setMessage({ type: "error", text: error.message })
    } else {
      if (data.session) {
        router.push("/")
        router.refresh()
      } else {
        router.push("/auth/login")
      }
    }

    setIsLoading(false)
  }

  return (
    <div className="min-h-screen bg-background flex">
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 md:px-16 lg:px-24 py-12">
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
          <h1 className="text-3xl font-mono font-bold mb-2">CRIAR CONTA</h1>
          <p className="text-muted-foreground font-mono text-sm mb-8">
            Crie sua conta para acompanhar seus pedidos e acessar recursos exclusivos.
          </p>
        </SlideIn>

        <FadeIn delay={0.4}>
          <form onSubmit={handleSignUp} className="space-y-5 max-w-md">
            {message && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 border font-mono text-sm ${
                  message.type === "success"
                    ? "border-green-500 bg-green-500/10 text-green-500"
                    : "border-destructive bg-destructive/10 text-destructive"
                }`}
              >
                {message.text}
              </motion.div>
            )}

            <div className="space-y-2">
              <Label htmlFor="fullName" className="font-mono text-xs uppercase tracking-wider">
                Nome completo
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="fullName"
                  name="fullName"
                  type="text"
                  placeholder="Ex: Maria Silva"
                  value={formData.fullName}
                  onChange={handleChange}
                  className="pl-10 font-mono bg-input border-border focus:border-primary"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="font-mono text-xs uppercase tracking-wider">
                Telefone
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={formData.phone}
                  onChange={handleChange}
                  className="pl-10 font-mono bg-input border-border focus:border-primary"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                Aceita formato internacional. Se nao informar o codigo do pais, assumimos Brasil (+55).
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="font-mono text-xs uppercase tracking-wider">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={formData.email}
                  onChange={handleChange}
                  className="pl-10 font-mono bg-input border-border focus:border-primary"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="font-mono text-xs uppercase tracking-wider">
                Senha
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="********"
                  value={formData.password}
                  onChange={handleChange}
                  className="pl-10 font-mono bg-input border-border focus:border-primary"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="font-mono text-xs uppercase tracking-wider">
                Confirmar senha
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="********"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="pl-10 font-mono bg-input border-border focus:border-primary"
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full font-mono uppercase h-12" disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "CRIAR CONTA"}
            </Button>

            <p className="text-center font-mono text-sm text-muted-foreground">
              Ja tem conta?{" "}
              <Link href="/auth/login" className="text-primary hover:underline">
                Entrar
              </Link>
            </p>
          </form>
        </FadeIn>
      </div>

      <div className="hidden lg:block lg:w-1/2 bg-muted/20 border-l border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background" />
        <div className="relative h-full flex items-center justify-center p-12">
          <div className="max-w-md text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="text-4xl font-mono font-bold mb-4">Shinkansen Films</h2>
              <p className="text-muted-foreground font-mono">
                Revelacao, digitalizacao e impressao com acompanhamento online.
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
