"use client"

import React, { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"

import { createClient } from "@/lib/supabase/client"
import { getProfileDefaults } from "@/lib/profile-bootstrap"
import { isProfileComplete } from "@/lib/profile-completion"
import { normalizePhoneToE164, profileUpsertSchema } from "@/lib/validators/profiles"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { AnimatedLogo } from "@/components/animated-logo"
import { GameMenuNav } from "@/components/game-menu-nav"
import { FadeIn, SlideIn } from "@/components/page-transition"

import { AlertTriangle, Loader2, LogOut, Save } from "lucide-react"
import type { User as SupabaseUser } from "@supabase/supabase-js"

interface Profile {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  adress: string | null
  photo_link?: string | null
  role: "client" | "admin"
  credits: number | null
  is_admin: boolean
}

interface AccountClientProps {
  user: SupabaseUser
  profile: Profile | null
}

export function AccountClient({ user, profile }: AccountClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialProfile = getProfileDefaults(user, profile)
  const [formData, setFormData] = useState({
    full_name: initialProfile.full_name ?? "",
    phone: initialProfile.phone ?? "",
    adress: initialProfile.adress ?? "",
  })
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Troca de e-mail pelo próprio cliente (confirmação enviada ao e-mail novo).
  const [showEmailEdit, setShowEmailEdit] = useState(false)
  const [newEmail, setNewEmail] = useState("")
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailMessage, setEmailMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Troca de senha pelo próprio cliente (já logado — aplica na hora).
  const [showPwEdit, setShowPwEdit] = useState(false)
  const [pw, setPw] = useState("")
  const [pwConfirm, setPwConfirm] = useState("")
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMessage, setPwMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const handleChangePassword = async () => {
    setPwMessage(null)
    if (pw.length < 8) {
      setPwMessage({ type: "error", text: "A senha deve ter ao menos 8 caracteres." })
      return
    }
    if (pw !== pwConfirm) {
      setPwMessage({ type: "error", text: "As senhas nao coincidem." })
      return
    }
    setPwSaving(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: pw })
    if (error) {
      setPwMessage({ type: "error", text: error.message })
    } else {
      setPwMessage({ type: "success", text: "Senha atualizada com sucesso." })
      setPw("")
      setPwConfirm("")
      setShowPwEdit(false)
    }
    setPwSaving(false)
  }

  const handleChangeEmail = async () => {
    const email = newEmail.trim().toLowerCase()
    setEmailMessage(null)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailMessage({ type: "error", text: "Informe um e-mail valido." })
      return
    }
    if (email === (user.email ?? "").trim().toLowerCase()) {
      setEmailMessage({ type: "error", text: "Esse ja e o seu e-mail atual." })
      return
    }
    setEmailSaving(true)
    const supabase = createClient()
    const redirectTo =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (typeof window !== "undefined" ? window.location.origin : "")
    const { error } = await supabase.auth.updateUser(
      { email },
      { emailRedirectTo: `${redirectTo}/account?emailChanged=1` },
    )
    if (error) {
      setEmailMessage({ type: "error", text: error.message })
    } else {
      setEmailMessage({
        type: "success",
        text: `Enviamos um link de confirmacao para ${email}. O e-mail so muda depois que voce clicar nesse link.`,
      })
      setNewEmail("")
      setShowEmailEdit(false)
    }
    setEmailSaving(false)
  }

  const profileIsComplete = useMemo(
    () => isProfileComplete({ full_name: formData.full_name, phone: formData.phone }),
    [formData.full_name, formData.phone],
  )
  const shouldHighlightCompletion = searchParams.get("completeProfile") === "1" || !isProfileComplete(profile)

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setMessage(null)

    const supabase = createClient()

    if (!user.email) {
      setMessage({
        type: "error",
        text: "Seu usuario nao possui email. Nao foi possivel salvar o perfil.",
      })
      setIsSaving(false)
      return
    }

    const normalizedPhone = normalizePhoneToE164(formData.phone)
    if (!normalizedPhone) {
      setMessage({
        type: "error",
        text: "Telefone invalido. Informe DDD e numero ou formato internacional.",
      })
      setIsSaving(false)
      return
    }

    const parsed = profileUpsertSchema.safeParse({
      id: user.id,
      email: user.email,
      full_name: formData.full_name,
      phone: normalizedPhone,
      adress: formData.adress,
    })

    if (!parsed.success) {
      setMessage({
        type: "error",
        text: parsed.error.issues[0]?.message ?? "Dados invalidos.",
      })
      setIsSaving(false)
      return
    }

    const { error } = await supabase
      .from("profiles")
      .upsert(parsed.data, { onConflict: "id" })

    if (error) {
      setMessage({ type: "error", text: error.message })
    } else {
      setMessage({ type: "success", text: "Perfil atualizado com sucesso." })
      router.replace("/account")
      router.refresh()
    }

    setIsSaving(false)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/">
            <AnimatedLogo className="w-40 h-auto" />
          </Link>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block">
              <GameMenuNav user={user} variant="horizontal" />
            </div>
            <Button variant="ghost" onClick={handleLogout} className="gap-2">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-8 max-w-4xl">
        <FadeIn>
          <SlideIn direction="left" delay={0.1}>
            <h1 className="text-3xl font-mono font-bold mb-2">MINHA CONTA</h1>
            <p className="text-muted-foreground font-mono text-sm mb-8">
              Complete seus dados para criar pedidos e acompanhar o andamento do laboratorio.
            </p>
          </SlideIn>

          {shouldHighlightCompletion && (
            <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
              <Card className="border-amber-500/40 bg-amber-500/10">
                <CardContent className="p-4 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="font-mono text-sm">
                    <p className="font-bold text-amber-700">Perfil incompleto</p>
                    <p className="text-amber-700/90">
                      So nome completo e telefone valido sao obrigatorios para liberar a criacao de novos pedidos.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="font-mono">Dados do Perfil</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant={profileIsComplete ? "default" : "secondary"} className="font-mono">
                    {profileIsComplete ? "PRONTO PARA PEDIDOS" : "PREENCHIMENTO PENDENTE"}
                  </Badge>
                  <Badge variant="outline" className="font-mono">
                    {profile?.role === "admin" ? "ADMIN" : "CLIENTE"}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleSave} className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="font-mono text-xs uppercase">Nome completo</Label>
                      <Input
                        name="full_name"
                        value={formData.full_name}
                        onChange={handleChange}
                        className="font-mono"
                        placeholder="Seu nome completo"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="font-mono text-xs uppercase">Email</Label>
                      <div className="flex gap-2">
                        <Input value={user.email ?? ""} disabled className="font-mono" />
                        <Button
                          type="button"
                          variant="outline"
                          className="font-mono uppercase bg-transparent shrink-0 text-xs"
                          onClick={() => {
                            setShowEmailEdit((v) => !v)
                            setEmailMessage(null)
                          }}
                        >
                          {showEmailEdit ? "Cancelar" : "Alterar"}
                        </Button>
                      </div>

                      {showEmailEdit && (
                        <div className="space-y-2 pt-2">
                          <Input
                            type="email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            className="font-mono"
                            placeholder="novo@email.com"
                          />
                          <Button
                            type="button"
                            className="font-mono uppercase w-full"
                            onClick={handleChangeEmail}
                            disabled={emailSaving || !newEmail.trim()}
                          >
                            {emailSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar link de confirmacao"}
                          </Button>
                          <p className="text-xs text-muted-foreground font-mono">
                            Enviaremos um link para o e-mail novo. A troca so acontece depois que voce confirmar por la.
                          </p>
                        </div>
                      )}

                      {emailMessage && (
                        <div
                          className={`p-2 border font-mono text-xs rounded ${
                            emailMessage.type === "success"
                              ? "border-green-500/40 bg-green-500/10 text-green-700"
                              : "border-destructive/40 bg-destructive/10 text-destructive"
                          }`}
                        >
                          {emailMessage.text}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="font-mono text-xs uppercase">Telefone</Label>
                      <Input
                        name="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={handleChange}
                        className="font-mono"
                        placeholder="(11) 99999-9999 ou +5511999999999"
                        required
                      />
                      <p className="text-xs text-muted-foreground font-mono">
                        Salvaremos em formato internacional, ex.: +5511999999999.
                      </p>
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <Label className="font-mono text-xs uppercase">Endereco</Label>
                      <Input
                        name="adress"
                        value={formData.adress}
                        onChange={handleChange}
                        className="font-mono"
                        placeholder="Rua, numero, bairro, cidade"
                      />
                      <p className="text-xs text-muted-foreground font-mono">Campo opcional.</p>
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <Label className="font-mono text-xs uppercase">Link das fotos</Label>
                      <Input
                        value={profile?.photo_link ?? ""}
                        readOnly
                        className="font-mono"
                        placeholder="Sera preenchido pela equipe quando houver link disponivel"
                      />
                      {profile?.photo_link ? (
                        <p className="text-xs text-muted-foreground font-mono break-all">
                          Campo somente leitura, gerenciado pela equipe.{" "}
                          <a
                            href={profile.photo_link}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary underline underline-offset-4"
                          >
                            Abrir link
                          </a>
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground font-mono">
                          Campo somente leitura, gerenciado pela equipe.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-border pt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="font-mono text-xs uppercase">Senha</Label>
                      <Button
                        type="button"
                        variant="outline"
                        className="font-mono uppercase bg-transparent text-xs"
                        onClick={() => {
                          setShowPwEdit((v) => !v)
                          setPwMessage(null)
                        }}
                      >
                        {showPwEdit ? "Cancelar" : "Trocar senha"}
                      </Button>
                    </div>

                    {showPwEdit && (
                      <div className="space-y-2 pt-1">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Input
                            type="password"
                            value={pw}
                            onChange={(e) => setPw(e.target.value)}
                            className="font-mono"
                            placeholder="Nova senha (min. 8)"
                          />
                          <Input
                            type="password"
                            value={pwConfirm}
                            onChange={(e) => setPwConfirm(e.target.value)}
                            className="font-mono"
                            placeholder="Confirmar senha"
                          />
                        </div>
                        <Button
                          type="button"
                          className="font-mono uppercase w-full sm:w-auto"
                          onClick={handleChangePassword}
                          disabled={pwSaving || !pw || !pwConfirm}
                        >
                          {pwSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar nova senha"}
                        </Button>
                      </div>
                    )}

                    {pwMessage && (
                      <div
                        className={`p-2 border font-mono text-xs rounded ${
                          pwMessage.type === "success"
                            ? "border-green-500/40 bg-green-500/10 text-green-700"
                            : "border-destructive/40 bg-destructive/10 text-destructive"
                        }`}
                      >
                        {pwMessage.text}
                      </div>
                    )}
                  </div>

                  {message && (
                    <div
                      className={`p-3 border font-mono text-sm rounded ${
                        message.type === "success"
                          ? "border-green-500/40 bg-green-500/10 text-green-700"
                          : "border-destructive/40 bg-destructive/10 text-destructive"
                      }`}
                    >
                      {message.text}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button type="submit" className="font-mono uppercase" disabled={isSaving}>
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                    </Button>
                    <Button asChild variant="outline" className="font-mono uppercase bg-transparent">
                      <Link href="/dashboard">Voltar para meus pedidos</Link>
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </FadeIn>
      </main>
    </div>
  )
}
