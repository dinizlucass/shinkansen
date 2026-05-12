"use client"

import { useMemo, useState } from "react"
import { Loader2, Save, Search } from "lucide-react"
import { useRouter } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type OrderStatus = "criado" | "recebido" | "aguardando_pagamento" | "pago" | "finalizado"

type FilmStatus =
  | "criado"
  | "cadastrado"
  | "revelando"
  | "digitalizando"
  | "suporte"
  | "limpeza"
  | "edicao"
  | "concluido"

interface Service {
  id: string
  name: string
  price: number
  category: string
}

interface FilmServiceJoin {
  service_id: string
  services?: Service[] | Service | null
}

interface Film {
  id: string
  name: string
  film_type: string
  push_pull: string | null
  notes: string | null
  scan_type: string | null
  file_format: string | null
  status: FilmStatus
  film_services?: FilmServiceJoin[]
}

interface OrderProfile {
  id?: string
  full_name: string | null
  email: string
  phone: string | null
  photo_link?: string | null
}

interface Order {
  id: string
  client_id: string
  status: OrderStatus
  total_value: number
  photo_link: string | null
  notes: string | null
  created_at: string
  profiles: OrderProfile | OrderProfile[] | null
  films: Film[]
}

interface AdminUser {
  id: string
  full_name: string | null
  email: string
  phone: string | null
  role: string
  is_admin: boolean
  photo_link: string | null
  created_at: string | null
}

interface Stats {
  totalOrders: number
  createdOrders: number
  receivedOrders: number
  awaitingPaymentOrders: number
  paidOrders: number
  finishedOrders: number
}

const statusMeta: Record<OrderStatus, { label: string; variant: "default" | "secondary" | "outline" }> = {
  criado: { label: "Criado", variant: "outline" },
  recebido: { label: "Recebido", variant: "secondary" },
  aguardando_pagamento: { label: "Aguardando Pagamento", variant: "secondary" },
  pago: { label: "Pago", variant: "default" },
  finalizado: { label: "Finalizado", variant: "default" },
}

function normalizeLinkValue(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : ""
}

function getRelatedProfile(profile: Order["profiles"]) {
  if (Array.isArray(profile)) {
    return profile[0] ?? null
  }

  return profile ?? null
}

export function AdminDashboardClient({
  orders,
  users,
  stats,
}: {
  orders: Order[]
  users: AdminUser[]
  stats: Stats
}) {
  const router = useRouter()
  const [orderQuery, setOrderQuery] = useState("")
  const [status, setStatus] = useState<OrderStatus | "all">("all")
  const [userQuery, setUserQuery] = useState("")
  const [orderDrafts, setOrderDrafts] = useState<
    Record<string, { status: OrderStatus; photoLink: string }>
  >(
    Object.fromEntries(
      (orders ?? []).map((order) => [
        order.id,
        { status: order.status, photoLink: normalizeLinkValue(order.photo_link) },
      ]),
    ) as Record<string, { status: OrderStatus; photoLink: string }>,
  )
  const [savedOrders, setSavedOrders] = useState<
    Record<string, { status: OrderStatus; photoLink: string }>
  >(
    Object.fromEntries(
      (orders ?? []).map((order) => [
        order.id,
        { status: order.status, photoLink: normalizeLinkValue(order.photo_link) },
      ]),
    ) as Record<string, { status: OrderStatus; photoLink: string }>,
  )
  const [userLinks, setUserLinks] = useState<Record<string, string>>(
    Object.fromEntries((users ?? []).map((user) => [user.id, normalizeLinkValue(user.photo_link)])) as Record<
      string,
      string
    >,
  )
  const [savedUserLinks, setSavedUserLinks] = useState<Record<string, string>>(
    Object.fromEntries((users ?? []).map((user) => [user.id, normalizeLinkValue(user.photo_link)])) as Record<
      string,
      string
    >,
  )
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null)
  const [savingUserId, setSavingUserId] = useState<string | null>(null)
  const [orderFeedback, setOrderFeedback] = useState<
    Record<string, { type: "success" | "error"; text: string }>
  >({})
  const [userFeedback, setUserFeedback] = useState<
    Record<string, { type: "success" | "error"; text: string }>
  >({})

  const filteredOrders = useMemo(() => {
    const q = orderQuery.trim().toLowerCase()

    return (orders ?? []).filter((order) => {
      const draft = orderDrafts[order.id] ?? {
        status: order.status,
        photoLink: normalizeLinkValue(order.photo_link),
      }
      if (status !== "all" && draft.status !== status) return false
      if (!q) return true

      const profile = getRelatedProfile(order.profiles)
      const name = profile?.full_name?.toLowerCase() ?? ""
      const email = profile?.email?.toLowerCase() ?? ""
      const phone = profile?.phone?.toLowerCase() ?? ""

      return (
        order.id.toLowerCase().includes(q) ||
        name.includes(q) ||
        email.includes(q) ||
        phone.includes(q)
      )
    })
  }, [orders, orderDrafts, orderQuery, status])

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase()
    if (!q) return users ?? []

    return (users ?? []).filter((user) => {
      const name = user.full_name?.toLowerCase() ?? ""
      const email = user.email.toLowerCase()
      const phone = user.phone?.toLowerCase() ?? ""
      const role = user.role.toLowerCase()

      return (
        user.id.toLowerCase().includes(q) ||
        name.includes(q) ||
        email.includes(q) ||
        phone.includes(q) ||
        role.includes(q)
      )
    })
  }, [userQuery, users])

  const userStats = useMemo(
    () => ({
      total: users.length,
      admins: users.filter((user) => user.is_admin).length,
      withLink: users.filter((user) => normalizeLinkValue(user.photo_link)).length,
    }),
    [users],
  )

  const updateOrder = async (order: Order) => {
    const draft = orderDrafts[order.id]
    if (!draft) return

    setSavingOrderId(order.id)
    setOrderFeedback((current) => {
      const copy = { ...current }
      delete copy[order.id]
      return copy
    })

    try {
      const response = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: draft.status,
          photoLink: draft.photoLink.trim() || null,
        }),
      })

      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error?.message || "Falha ao atualizar o pedido.")
      }

      setSavedOrders((current) => ({
        ...current,
        [order.id]: { status: draft.status, photoLink: draft.photoLink.trim() },
      }))
      setOrderFeedback((current) => ({
        ...current,
        [order.id]: { type: "success", text: "Pedido atualizado com sucesso." },
      }))
      router.refresh()
    } catch (error) {
      setOrderFeedback((current) => ({
        ...current,
        [order.id]: {
          type: "error",
          text: error instanceof Error ? error.message : "Falha ao atualizar o pedido.",
        },
      }))
    } finally {
      setSavingOrderId(null)
    }
  }

  const updateUserLink = async (user: AdminUser) => {
    const photoLink = userLinks[user.id] ?? ""

    setSavingUserId(user.id)
    setUserFeedback((current) => {
      const copy = { ...current }
      delete copy[user.id]
      return copy
    })

    try {
      const response = await fetch(`/api/admin/profiles/${user.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          photoLink: photoLink.trim() || null,
        }),
      })

      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error?.message || "Falha ao atualizar o link do usuario.")
      }

      setSavedUserLinks((current) => ({
        ...current,
        [user.id]: photoLink.trim(),
      }))
      setUserFeedback((current) => ({
        ...current,
        [user.id]: { type: "success", text: "Link do usuario atualizado com sucesso." },
      }))
      router.refresh()
    } catch (error) {
      setUserFeedback((current) => ({
        ...current,
        [user.id]: {
          type: "error",
          text: error instanceof Error ? error.message : "Falha ao atualizar o link do usuario.",
        },
      }))
    } finally {
      setSavingUserId(null)
    }
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 py-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-mono font-bold">ADMIN</h1>
        <p className="text-muted-foreground font-mono text-sm">
          Gerencie pedidos, atualize links das fotos e acompanhe os usuarios.
        </p>
      </div>

      <Tabs defaultValue="orders" className="gap-6">
        <TabsList className="font-mono bg-muted/40 border border-border p-1">
          <TabsTrigger
            value="orders"
            className="font-mono text-sm text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary"
          >
            Pedidos
          </TabsTrigger>
          <TabsTrigger
            value="users"
            className="font-mono text-sm text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary"
          >
            Usuarios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="relative">
              <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={orderQuery}
                onChange={(e) => setOrderQuery(e.target.value)}
                placeholder="Buscar por nome, email, telefone ou ID"
                className="pl-9 font-mono w-full sm:w-[340px]"
              />
            </div>

            <Select value={status} onValueChange={(value) => setStatus(value as OrderStatus | "all")}>
              <SelectTrigger className="font-mono w-full sm:w-[220px]">
                <SelectValue placeholder="Filtrar status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="font-mono">
                  Todos
                </SelectItem>
                {(Object.keys(statusMeta) as OrderStatus[]).map((itemStatus) => (
                  <SelectItem key={itemStatus} value={itemStatus} className="font-mono">
                    {statusMeta[itemStatus].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <StatCard title="Total" value={stats.totalOrders} />
            <StatCard title="Criado" value={stats.createdOrders} />
            <StatCard title="Recebido" value={stats.receivedOrders} />
            <StatCard title="Aguard. Pag." value={stats.awaitingPaymentOrders} />
            <StatCard title="Pago" value={stats.paidOrders} />
            <StatCard title="Finalizado" value={stats.finishedOrders} />
          </div>

          <div className="space-y-4">
            {filteredOrders.length === 0 ? (
              <EmptyState text="Nenhum pedido encontrado." />
            ) : (
              filteredOrders.map((order) => {
                const profile = getRelatedProfile(order.profiles)
                const completedFilms = order.films?.filter((film) => film.status === "concluido").length ?? 0
                const draft = orderDrafts[order.id] ?? {
                  status: order.status,
                  photoLink: normalizeLinkValue(order.photo_link),
                }
                const saved = savedOrders[order.id] ?? {
                  status: order.status,
                  photoLink: normalizeLinkValue(order.photo_link),
                }
                const isSaving = savingOrderId === order.id
                const isDirty =
                  draft.status !== saved.status || draft.photoLink.trim() !== saved.photoLink.trim()

                return (
                  <Card key={order.id} className="bg-card/50 backdrop-blur">
                    <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="font-mono text-base truncate">
                          {profile?.full_name?.trim() || profile?.email || order.client_id}
                        </CardTitle>
                        <div className="text-xs text-muted-foreground font-mono">
                          {profile?.email ? profile.email : ""}
                          {profile?.phone ? ` • ${profile.phone}` : ""}
                          {order.created_at ? ` • ${new Date(order.created_at).toLocaleString("pt-BR")}` : ""}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono mt-1">ID: {order.id}</div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Badge variant={statusMeta[draft.status].variant} className="font-mono">
                          {statusMeta[draft.status].label}
                        </Badge>
                        <div className="font-mono font-bold whitespace-nowrap">
                          R$ {Number(order.total_value || 0).toFixed(2)}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                        <span>{order.films?.length || 0} filme(s)</span>
                        <span>{completedFilms} concluido(s)</span>
                      </div>

                      {order.notes && (
                        <div className="p-3 bg-muted/50 rounded">
                          <p className="font-mono text-xs uppercase text-muted-foreground mb-1">
                            Observacoes do pedido
                          </p>
                          <p className="font-mono text-sm whitespace-pre-wrap">{order.notes}</p>
                        </div>
                      )}

                      {order.films?.length > 0 && (
                        <div className="grid gap-2">
                          {order.films.map((film) => (
                            <div
                              key={film.id}
                              className="border border-border rounded p-3 flex items-start justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <p className="font-mono text-sm font-bold truncate">{film.name}</p>
                                <p className="font-mono text-xs text-muted-foreground">
                                  {film.film_type}
                                  {film.push_pull ? ` • puxada ${film.push_pull}` : ""}
                                  {film.scan_type ? ` • ${film.scan_type}` : ""}
                                  {film.file_format ? ` • ${film.file_format.toUpperCase()}` : ""}
                                </p>
                                {film.notes && (
                                  <p className="font-mono text-xs text-muted-foreground mt-1 line-clamp-2">
                                    {film.notes}
                                  </p>
                                )}
                              </div>
                              <Badge variant="outline" className="font-mono shrink-0">
                                {film.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="grid gap-3 lg:grid-cols-[240px,1fr,auto]">
                        <div className="w-full">
                          <Select
                            value={draft.status}
                            onValueChange={(value) =>
                              setOrderDrafts((current) => ({
                                ...current,
                                [order.id]: {
                                  ...(current[order.id] ?? draft),
                                  status: value as OrderStatus,
                                },
                              }))
                            }
                          >
                            <SelectTrigger className="font-mono">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.keys(statusMeta) as OrderStatus[]).map((itemStatus) => (
                                <SelectItem key={itemStatus} value={itemStatus} className="font-mono">
                                  {statusMeta[itemStatus].label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Input
                            value={draft.photoLink}
                            onChange={(e) =>
                              setOrderDrafts((current) => ({
                                ...current,
                                [order.id]: {
                                  ...(current[order.id] ?? draft),
                                  photoLink: e.target.value,
                                },
                              }))
                            }
                            placeholder="https://link-das-fotos-do-pedido"
                            className="font-mono"
                          />
                        </div>

                        <Button
                          variant="outline"
                          className="font-mono uppercase bg-transparent"
                          onClick={() => updateOrder(order)}
                          disabled={isSaving || !isDirty}
                        >
                          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                          Salvar pedido
                        </Button>
                      </div>

                      {orderFeedback[order.id] && (
                        <FeedbackMessage
                          type={orderFeedback[order.id].type}
                          text={orderFeedback[order.id].text}
                        />
                      )}
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="relative">
              <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="Buscar por nome, email, telefone, cargo ou ID"
                className="pl-9 font-mono w-full sm:w-[360px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard title="Usuarios" value={userStats.total} />
            <StatCard title="Admins" value={userStats.admins} />
            <StatCard title="Com link" value={userStats.withLink} />
          </div>

          <div className="space-y-4">
            {filteredUsers.length === 0 ? (
              <EmptyState text="Nenhum usuario encontrado." />
            ) : (
              filteredUsers.map((user) => {
                const currentLink = userLinks[user.id] ?? ""
                const savedLink = savedUserLinks[user.id] ?? normalizeLinkValue(user.photo_link)
                const isSaving = savingUserId === user.id
                const isDirty = currentLink.trim() !== savedLink.trim()

                return (
                  <Card key={user.id} className="bg-card/50 backdrop-blur">
                    <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="font-mono text-base truncate">
                          {user.full_name?.trim() || user.email}
                        </CardTitle>
                        <div className="text-xs text-muted-foreground font-mono">
                          {user.email}
                          {user.phone ? ` • ${user.phone}` : ""}
                          {user.created_at ? ` • ${new Date(user.created_at).toLocaleString("pt-BR")}` : ""}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono mt-1">ID: {user.id}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant={user.is_admin ? "default" : "outline"} className="font-mono">
                          {user.is_admin ? "ADMIN" : "CLIENTE"}
                        </Badge>
                        <Badge variant="secondary" className="font-mono">
                          {user.role}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-3">
                      <Input
                        value={currentLink}
                        onChange={(e) =>
                          setUserLinks((current) => ({
                            ...current,
                            [user.id]: e.target.value,
                          }))
                        }
                        placeholder="https://link-geral-das-fotos-do-usuario"
                        className="font-mono"
                      />

                      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-end">
                        <Button
                          variant="outline"
                          className="font-mono uppercase bg-transparent"
                          onClick={() => updateUserLink(user)}
                          disabled={isSaving || !isDirty}
                        >
                          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                          Salvar link do usuario
                        </Button>
                      </div>

                      {userFeedback[user.id] && (
                        <FeedbackMessage
                          type={userFeedback[user.id].type}
                          text={userFeedback[user.id].text}
                        />
                      )}
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <Card className="bg-card/50 backdrop-blur">
      <CardContent className="p-4">
        <p className="font-mono text-xs uppercase text-muted-foreground">{title}</p>
        <p className="font-mono text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="p-6 border border-border rounded font-mono text-sm text-muted-foreground">{text}</div>
}

function FeedbackMessage({ type, text }: { type: "success" | "error"; text: string }) {
  return (
    <div
      className={`rounded border p-3 font-mono text-xs ${
        type === "success"
          ? "border-green-500/40 bg-green-500/10 text-green-700"
          : "border-destructive/40 bg-destructive/10 text-destructive"
      }`}
    >
      {text}
    </div>
  )
}
