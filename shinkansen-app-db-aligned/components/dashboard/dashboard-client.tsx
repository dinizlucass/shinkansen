"use client"

import React, { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import {
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock,
  Film,
  LogOut,
  Package,
  Wallet,
} from "lucide-react"
import type { User } from "@supabase/supabase-js"

import { createClient } from "@/lib/supabase/client"
import { isProfileComplete } from "@/lib/profile-completion"
import { AnimatedLogo } from "@/components/animated-logo"
import { GameMenuNav } from "@/components/game-menu-nav"
import { FadeIn, SlideIn } from "@/components/page-transition"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface Service {
  id: string
  name: string
  price: number
}

interface FilmService {
  service_id: string
  price: number
  services: Service | null
}

interface FilmOrder {
  id: string
  name: string
  film_type: string
  push_pull: string | null
  notes: string | null
  scan_type: string | null
  file_format: string | null
  status: string
  created_at: string
  film_services: FilmService[]
}

interface Order {
  id: string
  status: string
  total_value: number | null
  photo_link?: string | null
  payment_status?: string | null
  payment_link_url?: string | null
  payment_last_payload?: {
    charge?: {
      pixCopiaECola?: string | null
    }
    qrcode?: {
      imagemQrcode?: string | null
      qrcode?: string | null
      linkVisualizacao?: string | null
    }
  } | null
  created_at: string
  notes?: string | null
  films: FilmOrder[]
}

interface Profile {
  id: string
  full_name?: string | null
  phone?: string | null
  photo_link?: string | null
}

interface DashboardClientProps {
  user: User
  orders: Order[]
  profile: Profile | null
}

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  criado: {
    color: "bg-yellow-500/15 text-yellow-700 border-yellow-500/40",
    icon: <Clock className="h-4 w-4" />,
    label: "Pedido criado",
  },
  recebido: {
    color: "bg-blue-500/15 text-blue-700 border-blue-500/40",
    icon: <Package className="h-4 w-4" />,
    label: "Material recebido",
  },
  aguardando_pagamento: {
    color: "bg-orange-500/15 text-orange-700 border-orange-500/40",
    icon: <Wallet className="h-4 w-4" />,
    label: "Aguardando pagamento",
  },
  pago: {
    color: "bg-emerald-500/15 text-emerald-700 border-emerald-500/40",
    icon: <CheckCircle2 className="h-4 w-4" />,
    label: "Pago",
  },
  finalizado: {
    color: "bg-muted text-muted-foreground border-border",
    icon: <CheckCircle2 className="h-4 w-4" />,
    label: "Finalizado",
  },
}

const filmStatusLabel: Record<string, string> = {
  criado: "Criado",
  cadastrado: "Cadastrado",
  revelando: "Revelando",
  digitalizando: "Digitalizando",
  suporte: "Suporte",
  limpeza: "Limpeza",
  edicao: "Edicao",
  concluido: "Concluido",
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value ?? 0))
}

function formatFilmType(type: string) {
  if (type === "ja_revelado") return "Ja revelado"
  if (type === "c41") return "C-41"
  if (type === "d76") return "D-76"
  if (type === "ecn2") return "ECN-2"
  return type
}

function formatScanType(type: string | null) {
  if (type === "normal") return "Normal"
  if (type === "com_trilhas") return "Com trilhas"
  if (type === "normal_e_com_trilhas") return "Normal + trilhas"
  if (type === "so_revelar") return "So revelar"
  return type ?? "Nao informado"
}

export function DashboardClient({ user, orders, profile }: DashboardClientProps) {
  const router = useRouter()
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null)
  const profileReady = isProfileComplete(profile)

  const activeOrders = useMemo(
    () => orders.filter((order) => order.status !== "finalizado"),
    [orders],
  )
  const completedOrders = useMemo(
    () => orders.filter((order) => order.status === "finalizado"),
    [orders],
  )
  const totalFilms = useMemo(() => orders.reduce((sum, order) => sum + order.films.length, 0), [orders])
  const totalSpent = useMemo(
    () => orders.reduce((sum, order) => sum + Number(order.total_value ?? 0), 0),
    [orders],
  )

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/">
            <AnimatedLogo className="w-40 h-auto" />
          </Link>
          <div className="flex items-center gap-4">
            <GameMenuNav user={user} variant="horizontal" />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="font-mono text-xs uppercase bg-transparent"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <FadeIn>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-mono font-bold mb-2">
                MEUS PEDIDOS{profile?.full_name ? `, ${profile.full_name.toUpperCase()}` : ""}
              </h1>
              <p className="text-muted-foreground font-mono text-sm">
                Acompanhe seus filmes, prazos e o andamento do laboratorio.
              </p>
              {profile?.photo_link && (
                <p className="text-muted-foreground font-mono text-xs mt-2 break-all">
                  Link geral das fotos:{" "}
                  <a
                    href={profile.photo_link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline underline-offset-4"
                  >
                    abrir
                  </a>
                </p>
              )}
            </div>
            <div className="flex gap-3">
              {!profileReady && (
                <Button asChild variant="outline" className="font-mono uppercase bg-transparent">
                  <Link href="/account?completeProfile=1">Completar perfil</Link>
                </Button>
              )}
              <Button asChild className="font-mono uppercase tracking-wider" disabled={!profileReady}>
                <Link href={profileReady ? "/orders" : "/account?completeProfile=1"}>
                  <Camera className="h-4 w-4 mr-2" />
                  Novo pedido
                </Link>
              </Button>
            </div>
          </div>
        </FadeIn>

        {!profileReady && (
          <FadeIn delay={0.05}>
            <Card className="mb-8 border-amber-500/40 bg-amber-500/10">
              <CardContent className="p-4 font-mono text-sm text-amber-700">
                Preencha nome completo e telefone em sua conta antes de criar novos pedidos.
              </CardContent>
            </Card>
          </FadeIn>
        )}

        <SlideIn direction="up" delay={0.1}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatsCard label="PEDIDOS ATIVOS" value={activeOrders.length} icon={<Package className="h-5 w-5" />} />
            <StatsCard label="TOTAL DE PEDIDOS" value={orders.length} icon={<Camera className="h-5 w-5" />} />
            <StatsCard label="TOTAL DE FILMES" value={totalFilms} icon={<Film className="h-5 w-5" />} />
            <StatsCard label="TOTAL INVESTIDO" value={formatCurrency(totalSpent)} icon={<Wallet className="h-5 w-5" />} />
          </div>
        </SlideIn>

        <FadeIn delay={0.2}>
          <section className="mb-12">
            <h2 className="text-xl font-mono font-bold mb-4 flex items-center gap-2">
              <span className="text-primary">01</span> EM ANDAMENTO
            </h2>
            {activeOrders.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Camera className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground font-mono text-center">
                    Nenhum pedido ativo no momento.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {activeOrders.map((order, index) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    index={index}
                    isSelected={selectedOrder === order.id}
                    onSelect={() => setSelectedOrder(selectedOrder === order.id ? null : order.id)}
                  />
                ))}
              </div>
            )}
          </section>
        </FadeIn>

        <FadeIn delay={0.3}>
          <section>
            <h2 className="text-xl font-mono font-bold mb-4 flex items-center gap-2">
              <span className="text-primary">02</span> HISTORICO DE PEDIDOS
            </h2>
            {completedOrders.length === 0 ? (
              <p className="text-muted-foreground font-mono text-sm">Nenhum pedido finalizado ainda.</p>
            ) : (
              <div className="space-y-2">
                {completedOrders.map((order, index) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    index={index}
                    isSelected={selectedOrder === order.id}
                    onSelect={() => setSelectedOrder(selectedOrder === order.id ? null : order.id)}
                    compact
                  />
                ))}
              </div>
            )}
          </section>
        </FadeIn>
      </main>
    </div>
  )
}

function StatsCard({
  label,
  value,
  icon,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
}) {
  return (
    <Card className="border-border hover:border-primary/50 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-muted-foreground">{icon}</span>
        </div>
        <p className="text-2xl font-mono font-bold">{value}</p>
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{label}</p>
      </CardContent>
    </Card>
  )
}

function OrderCard({
  order,
  index,
  isSelected,
  onSelect,
  compact = false,
}: {
  order: Order
  index: number
  isSelected: boolean
  onSelect: () => void
  compact?: boolean
}) {
  const status = statusConfig[order.status] ?? statusConfig.criado

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08 }}
    >
      <Card
        className={`border-border hover:border-primary/50 transition-all cursor-pointer ${
          isSelected ? "border-primary bg-primary/5" : ""
        }`}
        onClick={onSelect}
      >
        <CardContent className={compact ? "p-4" : "p-6"}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="font-mono text-muted-foreground text-sm">#{order.id.slice(0, 8).toUpperCase()}</div>
              <Badge variant="outline" className={`font-mono text-xs ${status.color}`}>
                {status.icon}
                <span className="ml-1">{status.label}</span>
              </Badge>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-mono text-sm text-muted-foreground">
                {order.films.length} filme{order.films.length !== 1 ? "s" : ""}
              </span>
              <span className="font-mono font-bold">{formatCurrency(order.total_value)}</span>
              <ChevronRight
                className={`h-4 w-4 text-muted-foreground transition-transform ${isSelected ? "rotate-90" : ""}`}
              />
            </div>
          </div>

          <AnimatePresence>
            {isSelected && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 pt-4 border-t border-border"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <h4 className="font-mono text-xs uppercase text-muted-foreground">Filmes</h4>
                    {order.films.map((film) => (
                      <div key={film.id} className="rounded border border-border p-3">
                        <p className="font-mono text-sm font-bold">{film.name}</p>
                        <p className="font-mono text-xs text-muted-foreground mt-1">
                          {formatFilmType(film.film_type)}
                          {film.push_pull ? ` • push/pull ${film.push_pull}` : ""}
                          {film.scan_type ? ` • ${formatScanType(film.scan_type)}` : ""}
                          {film.file_format ? ` • ${film.file_format.toUpperCase()}` : ""}
                        </p>
                        {film.notes && (
                          <p className="font-mono text-xs text-muted-foreground mt-2 whitespace-pre-wrap">
                            {film.notes}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant="secondary" className="font-mono text-[10px] uppercase">
                            {filmStatusLabel[film.status] ?? film.status}
                          </Badge>
                          {film.film_services.map((filmService) => (
                            <Badge key={`${film.id}-${filmService.service_id}`} variant="outline" className="font-mono text-[10px]">
                              {filmService.services?.name ?? "Servico"}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                    <div>
                      <h4 className="font-mono text-xs uppercase text-muted-foreground mb-2">Detalhes</h4>
                      <div className="space-y-2 text-sm font-mono text-muted-foreground">
                        <p>Criado em: {new Date(order.created_at).toLocaleString("pt-BR")}</p>
                        <p>Status atual: {status.label}</p>
                        <p>Total: {formatCurrency(order.total_value)}</p>
                        {order.status === "aguardando_pagamento" && (
                          <>
                            {order.payment_link_url && (
                              <p>
                                Pagamento Pix:{" "}
                                <a
                                  href={order.payment_link_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-primary underline underline-offset-4"
                                >
                                  abrir cobranca
                                </a>
                              </p>
                            )}
                            {(order.payment_last_payload?.charge?.pixCopiaECola ||
                              order.payment_last_payload?.qrcode?.qrcode) && (
                              <div className="rounded border border-border bg-muted/30 p-3">
                                <p className="mb-2 text-xs uppercase">Pix copia e cola</p>
                                <p className="break-all text-xs">
                                  {order.payment_last_payload?.charge?.pixCopiaECola ||
                                    order.payment_last_payload?.qrcode?.qrcode}
                                </p>
                              </div>
                            )}
                            {order.payment_last_payload?.qrcode?.imagemQrcode && (
                              <div className="rounded border border-border bg-white p-3 w-fit">
                                <img
                                  src={order.payment_last_payload.qrcode.imagemQrcode}
                                  alt="QR Code Pix"
                                  className="h-40 w-40"
                                />
                              </div>
                            )}
                          </>
                        )}
                        {order.notes && <p>Observacoes: {order.notes}</p>}
                        {order.photo_link && (
                          <p>
                            Link das fotos:{" "}
                            <a
                              href={order.photo_link}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary underline underline-offset-4"
                            >
                              abrir link
                            </a>
                          </p>
                        )}
                      </div>
                    </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  )
}
