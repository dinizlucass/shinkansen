"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Mail,
  Phone,
  ShoppingBag,
  XCircle,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Item = {
  id: string
  product_id: string
  product_name: string
  quantity: number
  unit_price: number | null
}

type Pedido = {
  id: string
  client_id: string | null
  status: string
  payment_status: string | null
  payment_link_url: string | null
  payment_charge_id: string | null
  total_value: number | null
  shipping_cost: number | null
  created_at: string | null
  cliente: {
    id: string
    full_name: string | null
    email: string | null
    phone: string | null
  } | null
  itens: Item[]
}

type Flash = { type: "ok" | "erro"; text: string } | null

const STATUS_FILTRO = ["todos", "pendente", "pago", "retirado", "cancelado"] as const

function brl(v: number | null | undefined) {
  return (Number(v ?? 0)).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}

function statusVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "pago") return "default"
  if (s === "retirado") return "secondary"
  if (s === "cancelado") return "destructive"
  return "outline"
}

function dataBr(iso: string | null) {
  if (!iso) return "—"
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR")
}

export function RetiradasClient({ initialPedidos }: { initialPedidos: Pedido[] }) {
  const [pedidos, setPedidos] = useState<Pedido[]>(initialPedidos)
  const [filtro, setFiltro] = useState<string>("todos")
  const [q, setQ] = useState<string>("")
  const [aberto, setAberto] = useState<Pedido | null>(null)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<Flash>(null)

  function aviso(type: "ok" | "erro", text: string) {
    setFlash({ type, text })
    window.setTimeout(() => setFlash(null), 4500)
  }

  async function api<T = unknown>(url: string, opts?: RequestInit): Promise<T> {
    const r = await fetch(url, opts)
    const j = await r.json().catch(() => null)
    if (!r.ok || !j?.ok) throw new Error(j?.error?.message ?? "Erro na requisição.")
    return j.data as T
  }

  async function reload() {
    const data = await api<{ pedidos: Pedido[] }>("/api/admin/retiradas")
    setPedidos(data.pedidos)
    // mantém o pedido aberto sincronizado
    setAberto((prev) =>
      prev ? data.pedidos.find((p) => p.id === prev.id) ?? null : null,
    )
  }

  async function atualizar(orderId: string, status: "retirado" | "cancelado") {
    if (status === "cancelado") {
      const ok = window.confirm(
        "Cancelar este pedido? Os itens voltam ao estoque e a cobrança Pix (se ativa) é cancelada.",
      )
      if (!ok) return
    }
    setBusy(true)
    try {
      await api(`/api/admin/retiradas/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      await reload()
      aviso("ok", status === "retirado" ? "Pedido marcado como retirado." : "Pedido cancelado.")
    } catch (e) {
      aviso("erro", e instanceof Error ? e.message : "Falha ao atualizar.")
    } finally {
      setBusy(false)
    }
  }

  const filtrados = useMemo(() => {
    const termo = q.trim().toLowerCase()
    return pedidos.filter((p) => {
      if (filtro !== "todos" && p.status !== filtro) return false
      if (!termo) return true
      const campos = [
        p.cliente?.full_name,
        p.cliente?.email,
        p.cliente?.phone,
        p.id,
      ]
      return campos.some((c) => (c ?? "").toLowerCase().includes(termo))
    })
  }, [pedidos, filtro, q])

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Admin
          </Link>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <ShoppingBag className="h-5 w-5" /> Retiradas
          </h1>
        </div>
        {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {flash && (
        <div
          className={`mb-4 rounded-md border px-3 py-2 text-sm ${
            flash.type === "ok"
              ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400"
              : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"
          }`}
        >
          {flash.text}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-col gap-3 text-base sm:flex-row sm:items-center sm:justify-between">
            <span>Pedidos para retirada</span>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{filtrados.length}</Badge>
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nome, e-mail ou telefone"
                className="h-9 w-full font-normal sm:w-64"
              />
              <Select value={filtro} onValueChange={setFiltro}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTRO.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s === "todos" ? "Todos" : s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtrados.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum pedido de retirada.
            </p>
          ) : (
            <ul className="divide-y">
              {filtrados.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      #{p.id.slice(0, 8).toUpperCase()} ·{" "}
                      {p.cliente?.full_name ?? p.cliente?.email ?? "Cliente"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {dataBr(p.created_at)} · {p.itens.length} item(ns) · {brl(p.total_value)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
                    <Button size="sm" variant="outline" onClick={() => setAberto(p)}>
                      Abrir
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ── DETALHE ── */}
      <Dialog open={!!aberto} onOpenChange={(o) => !o && setAberto(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          {aberto && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Pedido #{aberto.id.slice(0, 8).toUpperCase()}
                  <Badge variant={statusVariant(aberto.status)}>{aberto.status}</Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 text-sm">
                {/* Contatos */}
                <div>
                  <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                    Comprador
                  </p>
                  <p className="font-medium">{aberto.cliente?.full_name ?? "—"}</p>
                  <div className="mt-1 flex flex-col gap-1">
                    {aberto.cliente?.email && (
                      <a
                        href={`mailto:${aberto.cliente.email}`}
                        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
                      >
                        <Mail className="h-3.5 w-3.5" /> {aberto.cliente.email}
                      </a>
                    )}
                    {aberto.cliente?.phone && (
                      <a
                        href={`tel:${aberto.cliente.phone}`}
                        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
                      >
                        <Phone className="h-3.5 w-3.5" /> {aberto.cliente.phone}
                      </a>
                    )}
                  </div>
                </div>

                {/* Pagamento */}
                <div>
                  <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                    Pagamento
                  </p>
                  <p className="text-muted-foreground">
                    Status: {aberto.payment_status ?? "—"}
                  </p>
                  {aberto.payment_link_url ? (
                    <Button asChild size="sm" variant="outline" className="mt-2">
                      <a
                        href={aberto.payment_link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="mr-1 h-3.5 w-3.5" /> Abrir link de pagamento
                      </a>
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">Sem link de pagamento.</p>
                  )}
                </div>

                {/* Itens */}
                <div>
                  <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                    Itens
                  </p>
                  <ul className="divide-y rounded-md border">
                    {aberto.itens.map((it) => (
                      <li key={it.id} className="flex items-center justify-between px-3 py-2">
                        <span className="truncate">
                          {it.quantity}× {it.product_name}
                        </span>
                        <span className="text-muted-foreground">
                          {brl((it.unit_price ?? 0) * it.quantity)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 flex justify-between font-medium">
                    <span>Total</span>
                    <span>{brl(aberto.total_value)}</span>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex flex-wrap gap-2 border-t pt-4">
                  {aberto.status !== "retirado" && aberto.status !== "cancelado" && (
                    <Button
                      onClick={() => atualizar(aberto.id, "retirado")}
                      disabled={busy}
                    >
                      <CheckCircle2 className="mr-1 h-4 w-4" /> Marcar como retirado
                    </Button>
                  )}
                  {aberto.status !== "cancelado" && (
                    <Button
                      variant="destructive"
                      onClick={() => atualizar(aberto.id, "cancelado")}
                      disabled={busy}
                    >
                      <XCircle className="mr-1 h-4 w-4" /> Cancelar (devolve estoque)
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
