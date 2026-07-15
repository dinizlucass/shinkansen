"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  FlaskConical,
  Loader2,
  Pencil,
  Plus,
  Search,
  Settings2,
  Trash2,
  X,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

const QUIMICAS = ["c41", "d76", "ecn2"] as const
const PUSH_PULL = ["-3", "-2", "-1", "0", "+1", "+2", "+3"] as const
const STATUS_GRUPO = ["revelando", "concluido"] as const
const STATUS_FILME = [
  "criado",
  "cadastrado",
  "revelando",
  "digitalizando",
  "edicao",
  "concluido",
  "virgem",
  "velado",
  "suporte",
  "limpeza",
  "embalado",
  "enviado",
  "descartado",
] as const
const LIMITE_TANQUE = 8
const MAX_OBSERVACAO = 999
const REGRA_OURO =
  "Regra de ouro: D76 (P&B) não mistura com C41/ECN2. C41 e ECN2 podem revelar juntos. Puxadas (push/pull) podem misturar."

type Filme = {
  id: string
  id_humano: number | null
  name: string | null
  status: string | null
  film_type: string | null
  push_pull: string | null
  notes: string | null
  grupo_id: string | null
}

type Grupo = {
  id: string
  id_caixa: string
  quimica: string
  push_pull: string | null
  status: string
  criado_em: string | null
  films: Filme[]
}

type Flash = { type: "ok" | "erro"; text: string } | null

function classeCompat(t: string | null | undefined): "cor" | "pb" | null {
  if (t === "c41" || t === "ecn2") return "cor"
  if (t === "d76") return "pb"
  return null
}

function statusVariant(status: string | null): "default" | "secondary" | "outline" {
  if (status === "revelando") return "default"
  if (status === "concluido") return "secondary"
  return "outline"
}

// ── ID em base 36 (hexatrigesimal): dígitos 0-9 + letras A-Z ──
// Ex.: 71 → "1Z", 1000 → "RS". Encurta o número e é o formato exibido/buscado.
function idParaCodigo(n: number | null): string {
  if (n == null) return "—"
  return n.toString(36).toUpperCase()
}

export function RevelacaoClient({
  initialFila,
  initialGrupos,
}: {
  initialFila: Filme[]
  initialGrupos: Grupo[]
}) {
  const [fila, setFila] = useState<Filme[]>(initialFila)
  const [grupos, setGrupos] = useState<Grupo[]>(initialGrupos)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<Flash>(null)

  // criar grupo
  const [novaQuimica, setNovaQuimica] = useState<string>("c41")
  const [novoPushPull, setNovoPushPull] = useState<string>("0")
  const [alvoGrupo, setAlvoGrupo] = useState<string>("")

  // filtros de grupos
  const [fQuimica, setFQuimica] = useState<string>("todas")
  const [fCaixa, setFCaixa] = useState<string>("")
  const [mostrarConcluidas, setMostrarConcluidas] = useState(false)

  // busca de filmes
  const [q, setQ] = useState("")
  const [resultados, setResultados] = useState<Filme[]>([])
  const [buscou, setBuscou] = useState(false)

  // edição de filme
  const [editando, setEditando] = useState<Filme | null>(null)
  const [editStatus, setEditStatus] = useState<string>("cadastrado")
  const [editNotes, setEditNotes] = useState<string>("")

  // edição de grupo
  const [editGrupo, setEditGrupo] = useState<Grupo | null>(null)
  const [egStatus, setEgStatus] = useState<string>("revelando")
  const [egQuimica, setEgQuimica] = useState<string>("c41")
  const [egPushPull, setEgPushPull] = useState<string>("0")

  const selCount = sel.size

  function aviso(type: "ok" | "erro", text: string) {
    setFlash({ type, text })
    window.setTimeout(() => setFlash(null), 4500)
  }

  async function api<T = unknown>(url: string, opts?: RequestInit): Promise<T> {
    const r = await fetch(url, opts)
    const j = await r.json().catch(() => null)
    if (!r.ok || !j?.ok) {
      throw new Error(j?.error?.message ?? "Erro na requisição.")
    }
    return j.data as T
  }

  async function reload(incluirConcluidas = mostrarConcluidas) {
    const url = incluirConcluidas
      ? "/api/admin/revelacao?grupos=todos"
      : "/api/admin/revelacao"
    const data = await api<{ fila: Filme[]; grupos: Grupo[] }>(url)
    setFila(data.fila)
    setGrupos(data.grupos)
  }

  function toggleSel(id: string) {
    setSel((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function run(fn: () => Promise<void>, sucesso: string, limparSel = true) {
    setBusy(true)
    try {
      await fn()
      await reload()
      if (limparSel) setSel(new Set())
      aviso("ok", sucesso)
    } catch (e) {
      aviso("erro", e instanceof Error ? e.message : "Falha na operação.")
    } finally {
      setBusy(false)
    }
  }

  // ── validações client da regra de ouro ──
  function classesDe(films: Filme[]): Set<"cor" | "pb"> {
    const s = new Set<"cor" | "pb">()
    films.forEach((f) => {
      const c = classeCompat(f.film_type)
      if (c) s.add(c)
    })
    return s
  }

  function criarGrupo(comSelecionados: boolean) {
    const film_ids = comSelecionados ? [...sel] : []
    if (comSelecionados) {
      if (!film_ids.length) {
        aviso("erro", "Selecione ao menos um filme.")
        return
      }
      const selecionados = fila.filter((f) => sel.has(f.id))
      const classes = classesDe(selecionados)
      if (classes.size > 1) {
        aviso("erro", "Mistura proibida: D76 não vai junto com C41/ECN2.")
        return
      }
      const cq = classeCompat(novaQuimica)
      const only = [...classes][0]
      if (only && cq && only !== cq) {
        aviso(
          "erro",
          `Os selecionados são ${only === "pb" ? "P&B" : "coloridos"}; escolha uma química compatível.`,
        )
        return
      }
    }
    run(
      () =>
        api("/api/admin/revelacao/grupos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quimica: novaQuimica,
            push_pull: novoPushPull,
            film_ids,
          }),
        }).then(() => undefined),
      "Grupo criado.",
    )
  }

  function adicionarAoGrupo() {
    if (!alvoGrupo) {
      aviso("erro", "Escolha um grupo de destino.")
      return
    }
    if (!sel.size) {
      aviso("erro", "Selecione ao menos um filme.")
      return
    }
    const grupo = grupos.find((g) => g.id === alvoGrupo)
    const selecionados = fila.filter((f) => sel.has(f.id))
    const tipos: Filme[] = [
      ...(grupo ? [{ film_type: grupo.quimica } as Filme] : []),
      ...(grupo?.films ?? []),
      ...selecionados,
    ]
    if (classesDe(tipos).size > 1) {
      aviso("erro", "Mistura proibida: D76 não vai junto com C41/ECN2.")
      return
    }
    run(
      () =>
        api(`/api/admin/revelacao/grupos/${alvoGrupo}/films`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ add: [...sel] }),
        }).then(() => undefined),
      "Filmes adicionados ao grupo.",
    )
  }

  function removerDoGrupo(grupoId: string, filmId: string) {
    run(
      () =>
        api(`/api/admin/revelacao/grupos/${grupoId}/films`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ remove: [filmId] }),
        }).then(() => undefined),
      "Filme devolvido para a fila.",
      false,
    )
  }

  // ── edição de filme ──
  function abrirEdicao(f: Filme) {
    setEditando(f)
    setEditStatus(f.status ?? "cadastrado")
    setEditNotes(f.notes ?? "")
  }

  function salvarEdicao() {
    if (!editando) return
    const filmId = editando.id
    run(
      async () => {
        await api(`/api/admin/revelacao/films/${filmId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: editStatus, notes: editNotes || null }),
        })
        setEditando(null)
        setResultados((prev) =>
          prev.map((r) =>
            r.id === filmId ? { ...r, status: editStatus, notes: editNotes } : r,
          ),
        )
      },
      "Filme atualizado.",
      false,
    )
  }

  // ── edição de grupo ──
  function abrirEdicaoGrupo(g: Grupo) {
    setEditGrupo(g)
    setEgStatus(g.status)
    setEgQuimica(g.quimica)
    setEgPushPull(g.push_pull ?? "0")
  }

  function salvarGrupo() {
    if (!editGrupo) return
    const grupoId = editGrupo.id
    run(
      async () => {
        await api(`/api/admin/revelacao/grupos/${grupoId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: egStatus,
            quimica: egQuimica,
            push_pull: egPushPull,
          }),
        })
        setEditGrupo(null)
      },
      "Grupo atualizado.",
      false,
    )
  }

  async function buscar() {
    const termo = q.trim()
    if (!termo) {
      setResultados([])
      setBuscou(false)
      return
    }
    setBusy(true)
    try {
      const data = await api<{ films: Filme[] }>(
        `/api/admin/revelacao/films/search?q=${encodeURIComponent(termo)}`,
      )
      setResultados(data.films)
      setBuscou(true)
    } catch (e) {
      aviso("erro", e instanceof Error ? e.message : "Falha na busca.")
    } finally {
      setBusy(false)
    }
  }

  const filaOrdenada = useMemo(
    () => [...fila].sort((a, b) => (a.id_humano ?? 0) - (b.id_humano ?? 0)),
    [fila],
  )

  const gruposFiltrados = useMemo(
    () =>
      grupos.filter(
        (g) =>
          (fQuimica === "todas" || g.quimica === fQuimica) &&
          (fCaixa === "" || g.id_caixa.includes(fCaixa.trim())) &&
          (mostrarConcluidas || g.status === "revelando"),
      ),
    [grupos, fQuimica, fCaixa, mostrarConcluidas],
  )

  const gruposAbertos = grupos.filter((g) => g.status === "revelando")

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Admin
          </Link>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <FlaskConical className="h-5 w-5" /> Revelação
          </h1>
        </div>
        {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      <p className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
        {REGRA_OURO}
      </p>

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

      <Card className="mb-6">
        <CardContent className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center">
          <div className="flex flex-1 gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value.replace(/[^0-9a-zA-Z]/g, "").toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && buscar()}
              placeholder="Código da etiqueta (base-36, ex.: 1Z)"
            />
            <Button variant="secondary" onClick={buscar} disabled={busy}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
        {buscou && (
          <CardContent className="border-t pt-4">
            {resultados.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum filme encontrado.</p>
            ) : (
              <ul className="divide-y">
                {resultados.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {f.id_humano ? `#${idParaCodigo(f.id_humano)} · ` : ""}
                        {f.name ?? "Sem nome"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {f.film_type ?? "—"} · {f.status ?? "—"}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => abrirEdicao(f)}>
                      <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── FILA ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span>Fila de revelação</span>
              <Badge variant="outline">{filaOrdenada.length} filme(s)</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">
                  Selecionados: {selCount}
                </p>
                <div className="flex gap-2">
                  <button
                    className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                    onClick={() => setSel(new Set(filaOrdenada.map((f) => f.id)))}
                  >
                    Selecionar todos
                  </button>
                  <button
                    className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                    onClick={() => setSel(new Set())}
                  >
                    Limpar
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Química</Label>
                  <Select value={novaQuimica} onValueChange={setNovaQuimica}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {QUIMICAS.map((qm) => (
                        <SelectItem key={qm} value={qm}>
                          {qm.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Push/Pull</Label>
                  <Select value={novoPushPull} onValueChange={setNovoPushPull}>
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PUSH_PULL.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => criarGrupo(true)} disabled={busy}>
                  <Plus className="mr-1 h-4 w-4" /> Criar com selecionados ({selCount})
                </Button>
                <Button variant="outline" onClick={() => criarGrupo(false)} disabled={busy}>
                  Novo grupo vazio
                </Button>
              </div>
              {gruposAbertos.length > 0 && (
                <div className="mt-3 flex flex-wrap items-end gap-2 border-t pt-3">
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">Adicionar selecionados a</Label>
                    <Select value={alvoGrupo} onValueChange={setAlvoGrupo}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Escolha um grupo" />
                      </SelectTrigger>
                      <SelectContent>
                        {gruposAbertos.map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            Caixa {g.id_caixa} · {g.quimica.toUpperCase()} ({g.films.length}/
                            {LIMITE_TANQUE})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="secondary" onClick={adicionarAoGrupo} disabled={busy}>
                    Adicionar
                  </Button>
                </div>
              )}
            </div>

            {filaOrdenada.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhum filme aguardando revelação.
              </p>
            ) : (
              <ul className="divide-y">
                {filaOrdenada.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 py-2">
                    <Checkbox
                      checked={sel.has(f.id)}
                      onCheckedChange={() => toggleSel(f.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {f.id_humano ? `#${idParaCodigo(f.id_humano)} · ` : ""}
                        {f.name ?? "Sem nome"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(f.film_type ?? "—").toUpperCase()} · push {f.push_pull ?? "0"}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => abrirEdicao(f)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* ── GRUPOS ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span>Grupos em revelação</span>
              <Badge variant="outline">{gruposFiltrados.length} grupo(s)</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* filtros */}
            <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Química</Label>
                <Select value={fQuimica} onValueChange={setFQuimica}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    {QUIMICAS.map((qm) => (
                      <SelectItem key={qm} value={qm}>
                        {qm.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Caixa</Label>
                <Input
                  className="w-24"
                  value={fCaixa}
                  onChange={(e) => setFCaixa(e.target.value)}
                  placeholder="nº"
                />
              </div>
              <label className="flex items-center gap-2 pb-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={mostrarConcluidas}
                  onCheckedChange={(v) => {
                    const on = v === true
                    setMostrarConcluidas(on)
                    reload(on).catch(() => aviso("erro", "Falha ao recarregar."))
                  }}
                />
                Mostrar concluídas
              </label>
            </div>

            {gruposFiltrados.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhum grupo para os filtros atuais.
              </p>
            ) : (
              gruposFiltrados.map((g) => (
                <div key={g.id} className="rounded-md border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge>Caixa {g.id_caixa}</Badge>
                      <span className="text-sm font-medium">{g.quimica.toUpperCase()}</span>
                      <span className="text-xs text-muted-foreground">
                        push {g.push_pull ?? "0"}
                      </span>
                      <Badge variant={statusVariant(g.status)}>{g.status}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {g.films.length}/{LIMITE_TANQUE}
                      </Badge>
                      <Button size="sm" variant="ghost" onClick={() => abrirEdicaoGrupo(g)}>
                        <Settings2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {g.films.length === 0 ? (
                    <p className="py-2 text-xs text-muted-foreground">Grupo vazio.</p>
                  ) : (
                    <ul className="divide-y">
                      {g.films.map((f) => (
                        <li key={f.id} className="flex items-center gap-2 py-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm">
                              {f.id_humano ? `#${idParaCodigo(f.id_humano)} · ` : ""}
                              {f.name ?? "Sem nome"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              <Badge variant={statusVariant(f.status)} className="mr-1">
                                {f.status ?? "—"}
                              </Badge>
                              {(f.film_type ?? "").toUpperCase()}
                            </p>
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => abrirEdicao(f)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {g.status === "revelando" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removerDoGrupo(g.id, f.id)}
                              disabled={busy}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-500" />
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── DIALOG EDIÇÃO DE FILME ── */}
      <Dialog open={!!editando} onOpenChange={(o) => !o && setEditando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Editar filme {editando?.id_humano ? `#${idParaCodigo(editando.id_humano)}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILME.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Observação</Label>
              <Textarea
                value={editNotes}
                maxLength={MAX_OBSERVACAO}
                rows={4}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Observação interna do filme"
              />
              <p className="text-right text-xs text-muted-foreground">
                {editNotes.length}/{MAX_OBSERVACAO}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>
              <X className="mr-1 h-4 w-4" /> Cancelar
            </Button>
            <Button onClick={salvarEdicao} disabled={busy}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG EDIÇÃO DE GRUPO ── */}
      <Dialog open={!!editGrupo} onOpenChange={(o) => !o && setEditGrupo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Editar grupo {editGrupo ? `· Caixa ${editGrupo.id_caixa}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={egStatus} onValueChange={setEgStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_GRUPO.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Química</Label>
                <Select value={egQuimica} onValueChange={setEgQuimica}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUIMICAS.map((qm) => (
                      <SelectItem key={qm} value={qm}>
                        {qm.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Push/Pull</Label>
                <Select value={egPushPull} onValueChange={setEgPushPull}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PUSH_PULL.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditGrupo(null)}>
              <X className="mr-1 h-4 w-4" /> Cancelar
            </Button>
            <Button onClick={salvarGrupo} disabled={busy}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
