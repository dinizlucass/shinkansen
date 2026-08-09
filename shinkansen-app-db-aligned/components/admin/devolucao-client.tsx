"use client"

import { useMemo, useState } from "react"
import {
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Package,
  Search,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ClienteDevolucao } from "@/lib/admin/devolucao"

// Fases de devolução mostradas no seletor (avançar até "retirado").
const FASES = ["concluido", "embalado", "enviado", "retirado"] as const

const ROTULO_FASE: Record<string, string> = {
  concluido: "Concluído",
  embalado: "Embalado",
  enviado: "Enviado",
  retirado: "Retirado",
}

// id_humano em base 36 (mesmo formato do resto do admin).
function idParaCodigo(n: number | null): string {
  if (n == null) return "—"
  return n.toString(36).toUpperCase()
}

function dataCurta(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function DevolucaoClient({
  initialClientes,
}: {
  initialClientes: ClienteDevolucao[]
}) {
  const [clientes, setClientes] = useState(initialClientes)
  const [busca, setBusca] = useState("")
  const [aberto, setAberto] = useState<string | null>(null)
  const [salvando, setSalvando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return clientes
    return clientes.filter((c) =>
      [c.full_name, c.email, c.phone]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    )
  }, [clientes, busca])

  async function atualizarStatus(
    clienteId: string,
    pedidoId: string,
    filmId: string,
    status: string,
  ) {
    setSalvando(filmId)
    setErro(null)
    try {
      const res = await fetch(`/api/admin/revelacao/films/${filmId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error?.message ?? "Falha ao atualizar o filme.")
      }
      // Atualiza estado local (status do filme + contagem de pendentes).
      setClientes((prev) =>
        prev.map((c) => {
          if (c.id !== clienteId) return c
          let pendentes = 0
          const pedidos = c.pedidos.map((p) => {
            const films =
              p.id === pedidoId
                ? p.films.map((f) =>
                    f.id === filmId ? { ...f, status } : f,
                  )
                : p.films
            return { ...p, films }
          })
          for (const p of pedidos)
            for (const f of p.films) if (f.status !== "retirado") pendentes += 1
          return { ...c, pedidos, pendentes }
        }),
      )
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro inesperado.")
    } finally {
      setSalvando(null)
    }
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 font-mono text-3xl font-bold">
          <Package className="h-7 w-7" /> Devolução de negativos
        </h1>
        <p className="font-mono text-sm text-muted-foreground">
          Cliente → pedidos → filmes. Atualize o status do filme para{" "}
          <b>retirado</b> quando o cliente levar os negativos.
        </p>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar cliente por nome, e-mail ou telefone…"
          className="pl-9 font-mono"
        />
      </div>

      {erro ? (
        <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 font-mono text-sm text-destructive">
          {erro}
        </p>
      ) : null}

      {filtrados.length === 0 ? (
        <p className="py-16 text-center font-mono text-sm text-muted-foreground">
          Nenhum filme em fluxo de devolução.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtrados.map((c) => {
            const expandido = aberto === c.id
            return (
              <Card key={c.id} className="overflow-hidden">
                <CardHeader
                  className="cursor-pointer select-none flex-row items-center justify-between gap-3 py-4"
                  onClick={() => setAberto(expandido ? null : c.id)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {expandido ? (
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <CardTitle className="truncate font-mono text-base">
                        {c.full_name || c.email || "Cliente"}
                      </CardTitle>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {c.email}
                        {c.phone ? ` · ${c.phone}` : ""}
                      </p>
                    </div>
                  </div>
                  {c.pendentes > 0 ? (
                    <Badge variant="secondary" className="shrink-0 font-mono">
                      {c.pendentes} pendente{c.pendentes > 1 ? "s" : ""}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="shrink-0 font-mono">
                      <Check className="mr-1 h-3 w-3" /> tudo retirado
                    </Badge>
                  )}
                </CardHeader>

                {expandido ? (
                  <CardContent className="flex flex-col gap-4 border-t pt-4">
                    {c.pedidos.map((p) => (
                      <div key={p.id}>
                        <p className="mb-2 font-mono text-xs text-muted-foreground">
                          Pedido {p.id.slice(0, 8).toUpperCase()} ·{" "}
                          {dataCurta(p.created_at)}
                        </p>
                        <div className="flex flex-col gap-2">
                          {p.films.map((f) => {
                            const retirado = f.status === "retirado"
                            return (
                              <div
                                key={f.id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
                              >
                                <div className="min-w-0 font-mono text-sm">
                                  <span className="text-primary font-semibold">
                                    #{idParaCodigo(f.id_humano)}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {" "}
                                    (#{f.id_humano ?? "—"})
                                  </span>{" "}
                                  <span className="truncate">
                                    {f.name || "sem nome"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {retirado ? (
                                    <Badge className="font-mono">
                                      <Check className="mr-1 h-3 w-3" /> retirado
                                    </Badge>
                                  ) : null}
                                  <Select
                                    value={f.status ?? undefined}
                                    onValueChange={(v) =>
                                      atualizarStatus(c.id, p.id, f.id, v)
                                    }
                                    disabled={salvando === f.id}
                                  >
                                    <SelectTrigger className="w-[140px] font-mono">
                                      {salvando === f.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <SelectValue placeholder="status" />
                                      )}
                                    </SelectTrigger>
                                    <SelectContent>
                                      {FASES.map((s) => (
                                        <SelectItem
                                          key={s}
                                          value={s}
                                          className="font-mono"
                                        >
                                          {ROTULO_FASE[s]}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                ) : null}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
